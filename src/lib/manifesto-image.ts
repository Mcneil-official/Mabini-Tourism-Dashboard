/**
 * Sinsay Official Manifesto Image Generator
 * Renders the official Municipal Passenger Manifest design matching FormalManifestoPrint.tsx:
 * - Official Republic of the Philippines / Municipality of Mabini emblem and letterhead
 * - Top-right Manifest Number and Schedule Date
 * - "PASSENGER MANIFEST" header with Shore/Boat Dive Record subtitle
 * - Deep navy (#0D3B66) 3x3 Vessel / Dive Entry information card with #C5D9ED grid
 * - Deep navy (#0D3B66) Passenger List card with ice-blue (#C8DCF0) column headers
 * - Diver rows with #0066CC monospace ECO IDs and padded placeholder rows
 * - Official municipal certification footer
 */

import { MABINI_LGU_LOGO_URI } from "@/constants/lguLogo";
import { formatDiverNationality } from "./metrics";

export interface DiverRosterItem {
  name: string;
  ecoId?: string | null;
  isWalkIn?: boolean;
  level?: string | null;
  nationality?: string | null;
}

export interface ManifestoImageOptions {
  id: string;
  operator?: string | null;
  site?: string | null;
  date?: string | null;
  divers?: number | null;
  verified?: boolean;
  boatName?: string | null;
  diveMode?: string | null;
  diveType?: string | null;
  difficulty?: string | null;
  maxDivers?: number | null;
  captainName?: string | null;
  crewCount?: number | null;
  crewMembers?: string[] | null;
  diveMasters?: string[] | null;
  instructorName?: string | null;
  roster?: DiverRosterItem[] | null;
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Failed to load image"));
    img.src = src;
  });
}

export async function generateManifestoImageBlob(
  options: ManifestoImageOptions
): Promise<Blob> {
  const {
    id,
    operator = "Magtibay",
    site = "Mainit, Mabini, Batangas",
    date = "",
    divers = 1,
    verified = false,
    boatName,
    diveMode,
    diveType,
    difficulty = "Beginner",
    maxDivers,
    captainName,
    crewCount,
    crewMembers,
    diveMasters,
    instructorName,
    roster,
  } = options;

  // Format Manifest Number
  const rawId = (id || "0001").trim();
  const manifestNumber = rawId.startsWith("MF-")
    ? rawId
    : rawId.length > 10
      ? `2026-${rawId.slice(0, 8).toUpperCase()}`
      : `2026-${rawId.toUpperCase()}`;

  // Format Date (e.g. "Nov 9, 2026")
  let formattedDate = date || "Nov 9, 2026";
  if (date) {
    try {
      const d = new Date(date.length <= 10 ? date + "T00:00:00" : date);
      if (!isNaN(d.getTime())) {
        formattedDate = d.toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
        });
      }
    } catch {
      formattedDate = date;
    }
  }

  // Detect Dive Mode
  const rawMode = (diveMode || "").toLowerCase();
  const isBoatDive =
    rawMode.includes("boat") ||
    (!rawMode.includes("shore") && Boolean(boatName && boatName !== "Shore Base"));

  const subHeaderTitle = isBoatDive ? "Boat Dive Record" : "Shore Dive Record";
  const resolvedOperator = (operator || "Magtibay").trim();
  const diveSiteDisplay = (site || (isBoatDive ? "Anilao Dive Site" : "Mainit, Mabini, Batangas")).trim();
  const diveTypeDisplay = (diveType || (isBoatDive ? "Scuba Diving" : "Free Diving")).trim();
  const difficultyDisplay = (difficulty || "Beginner").trim();

  // Lead Divemaster / Guide
  const dms = (diveMasters || []).map((s) => s.trim()).filter(Boolean);
  const leadDmDisplay =
    dms.length > 0
      ? dms.join(", ")
      : (instructorName || "").trim() || "—";

  // Crew / Captain
  const captainDisplay = (captainName || "").trim() || "—";
  const crews = (crewMembers || []).map((s) => s.trim()).filter(Boolean);
  const crewDisplay =
    crews.length > 0
      ? crews.join(", ")
      : crewCount
        ? `${crewCount} Vessel Crew`
        : "—";

  const vesselNameDisplay = (boatName || (isBoatDive ? "Official Dive Vessel" : "Shore Base")).trim();
  const diverCount = Math.max(divers || 0, roster?.length || 0) || 1;
  const maxCap = maxDivers || (isBoatDive ? 22 : 30);

  // Normalizing Diver Roster
  const normalizedDivers: DiverRosterItem[] =
    roster && roster.length > 0
      ? roster
      : [
          {
            name: "Jhon Mcneil Magtibay",
            nationality: "Filipino",
            ecoId: "ECO-2026-100005",
          },
        ];

  const minRows = 5;
  const emptyRowCount = Math.max(1, minRows - normalizedDivers.length);
  const totalPassengerRows = normalizedDivers.length + emptyRowCount;

  // Geometry Setup (Canvas width 1024px @ 2x pixel ratio for crystal clear text)
  const width = 1024;
  const cardX = 48;
  const cardW = width - cardX * 2; // 928px

  const section1Top = 212;
  const section1Height = 186; // 38 header + 3 * 49 rows approx = 185px

  const section2Top = section1Top + section1Height + 22; // 420
  const section2RowHeight = 40;
  const section2HeaderH = 38;
  const section2ColHeaderH = 38;
  const section2Height =
    section2HeaderH + section2ColHeaderH + totalPassengerRows * section2RowHeight;

  const footerTop = section2Top + section2Height + 20;
  const footerHeight = 44;
  const height = footerTop + footerHeight + 36;

  // Create Canvas with Retina 2x Resolution
  const canvas = document.createElement("canvas");
  const scale = 2;
  canvas.width = width * scale;
  canvas.height = height * scale;

  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not initialize canvas context");
  ctx.scale(scale, scale);

  // Background Fill (Pure White)
  ctx.fillStyle = "#FFFFFF";
  ctx.fillRect(0, 0, width, height);

  // Subtle outer document border with rounded corners
  ctx.strokeStyle = "#E2E8F0";
  ctx.lineWidth = 1;
  roundRect(ctx, 16, 16, width - 32, height - 32, 16);
  ctx.stroke();

  // Load Official Mabini Seal
  try {
    const sealImg = await loadImage(MABINI_LGU_LOGO_URI);
    ctx.drawImage(sealImg, cardX, 36, 76, 76);
  } catch {
    // If logo fails to load, continue gracefully
  }

  // Header Letterhead Text
  const textX = cardX + 90;
  ctx.textAlign = "left";

  // "REPUBLIC OF THE PHILIPPINES"
  ctx.fillStyle = "#475569";
  ctx.font = "bold 11px system-ui, -apple-system, sans-serif";
  ctx.fillText("REPUBLIC OF THE PHILIPPINES", textX, 48);

  // "PROVINCE OF BATANGAS • MUNICIPALITY OF MABINI"
  ctx.fillStyle = "#0F172A";
  ctx.font = "bold 13.5px system-ui, -apple-system, sans-serif";
  ctx.fillText("PROVINCE OF BATANGAS • MUNICIPALITY OF MABINI", textX, 68);

  // "MUNICIPAL TOURISM OFFICE"
  ctx.fillStyle = "#0D3B66";
  ctx.font = "bold 12px system-ui, -apple-system, sans-serif";
  ctx.fillText("MUNICIPAL TOURISM OFFICE", textX, 88);

  // "Operating Resort: <Operator>"
  ctx.fillStyle = "#0066CC";
  ctx.font = "600 12px system-ui, -apple-system, sans-serif";
  ctx.fillText("Operating Resort: ", textX, 107);
  const opLabelW = ctx.measureText("Operating Resort: ").width;
  ctx.fillStyle = "#0066CC";
  ctx.font = "bold 12px system-ui, -apple-system, sans-serif";
  ctx.fillText(resolvedOperator, textX + opLabelW, 107);

  // Right Meta: Manifest No. & Schedule Date
  ctx.textAlign = "right";
  const rightX = cardX + cardW;

  ctx.fillStyle = "#0F172A";
  ctx.font = "bold 14px system-ui, -apple-system, sans-serif";
  ctx.fillText(`Manifest No. ${manifestNumber}`, rightX, 58);

  ctx.fillStyle = "#334155";
  ctx.font = "600 13px system-ui, -apple-system, sans-serif";
  ctx.fillText(`Date: ${formattedDate}`, rightX, 80);

  // Centered Document Title Block
  ctx.textAlign = "center";
  const midX = width / 2;

  ctx.fillStyle = "#0D3B66";
  ctx.font = "bold 26px system-ui, -apple-system, sans-serif";
  ctx.fillText("PASSENGER MANIFEST", midX, 154);

  ctx.fillStyle = "#0F172A";
  ctx.font = "bold 14.5px system-ui, -apple-system, sans-serif";
  ctx.fillText(subHeaderTitle, midX, 178);

  // Title Divider Line
  ctx.fillStyle = "#0D3B66";
  ctx.fillRect(cardX, 194, cardW, 2);

  // ==========================================
  // SECTION 1: Dive Site & Entry / Vessel Info
  // ==========================================
  const s1HeaderTitle = isBoatDive
    ? "Vessel & Trip Information"
    : "Dive Site & Entry Information";

  // Card Outer Container
  ctx.fillStyle = "#FFFFFF";
  roundRect(ctx, cardX, section1Top, cardW, section1Height, 8);
  ctx.fill();
  ctx.strokeStyle = "#B8D2EB";
  ctx.lineWidth = 1;
  ctx.stroke();

  // Section 1 Header Bar (#0D3B66)
  ctx.save();
  ctx.beginPath();
  roundRect(ctx, cardX, section1Top, cardW, 38, 8);
  ctx.clip();
  ctx.fillStyle = "#0D3B66";
  ctx.fillRect(cardX, section1Top, cardW, 38);
  ctx.restore();

  // Section 1 Header Title Text
  ctx.textAlign = "left";
  ctx.fillStyle = "#FFFFFF";
  ctx.font = "bold 14px system-ui, -apple-system, sans-serif";
  ctx.fillText(s1HeaderTitle, cardX + 16, section1Top + 24);

  // Grid Data (3 Rows x 3 Cols)
  const colW = cardW / 3;
  const rowH = (section1Height - 38) / 3; // ~49.3px

  interface TileData {
    label: string;
    value: string;
  }

  const shoreGrid: TileData[][] = [
    [
      { label: "Dive Site / Shore Entry", value: diveSiteDisplay },
      { label: "Dive Mode", value: "Shore Entry Dive" },
      { label: "Dive Type", value: diveTypeDisplay },
    ],
    [
      { label: "Lead Divemaster / Guide", value: leadDmDisplay },
      { label: "Operating Resort", value: resolvedOperator },
      { label: "Difficulty Tier", value: difficultyDisplay },
    ],
    [
      { label: "Registered Divers", value: `${diverCount} Divers Registered` },
      { label: "Schedule Date", value: formattedDate },
      { label: "Safety Protocol", value: "Standard PCSSD Protocols" },
    ],
  ];

  const boatGrid: TileData[][] = [
    [
      { label: "Vessel Name", value: vesselNameDisplay },
      { label: "Dive Site / Destination", value: diveSiteDisplay },
      { label: "Dive Mode & Type", value: `Boat Dive • ${diveTypeDisplay}` },
    ],
    [
      { label: "Boat Captain", value: captainDisplay },
      { label: "Lead Divemaster / Guide", value: leadDmDisplay },
      { label: "Crew Members", value: crewDisplay },
    ],
    [
      { label: "Diver Capacity", value: `${diverCount} / ${maxCap} Max Divers` },
      { label: "Difficulty Tier", value: difficultyDisplay },
      { label: "Departure Date", value: formattedDate },
    ],
  ];

  const gridData = isBoatDive ? boatGrid : shoreGrid;

  for (let r = 0; r < 3; r++) {
    const yRow = section1Top + 38 + r * rowH;

    // Horizontal Row Divider
    if (r > 0) {
      ctx.strokeStyle = "#C5D9ED";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(cardX, yRow);
      ctx.lineTo(cardX + cardW, yRow);
      ctx.stroke();
    }

    for (let c = 0; c < 3; c++) {
      const xCol = cardX + c * colW;

      // Vertical Column Divider
      if (c > 0) {
        ctx.strokeStyle = "#C5D9ED";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(xCol, yRow);
        ctx.lineTo(xCol, yRow + rowH);
        ctx.stroke();
      }

      const item = gridData[r][c];

      // Tile Label
      ctx.textAlign = "left";
      ctx.fillStyle = "#334E68";
      ctx.font = "600 11.5px system-ui, -apple-system, sans-serif";
      ctx.fillText(item.label, xCol + 14, yRow + 18);

      // Tile Value
      ctx.fillStyle = "#0A2540";
      ctx.font = "bold 13px system-ui, -apple-system, sans-serif";

      // Truncate text if exceeds colW
      let val = item.value;
      const maxW = colW - 28;
      if (ctx.measureText(val).width > maxW) {
        while (ctx.measureText(val + "…").width > maxW && val.length > 0) {
          val = val.slice(0, -1);
        }
        val += "…";
      }
      ctx.fillText(val, xCol + 14, yRow + 36);
    }
  }

  // ==========================================
  // SECTION 2: Passenger List Card
  // ==========================================
  ctx.fillStyle = "#FFFFFF";
  roundRect(ctx, cardX, section2Top, cardW, section2Height, 8);
  ctx.fill();
  ctx.strokeStyle = "#B8D2EB";
  ctx.lineWidth = 1;
  ctx.stroke();

  // Section 2 Header Bar (#0D3B66)
  ctx.save();
  ctx.beginPath();
  roundRect(ctx, cardX, section2Top, cardW, 38, 8);
  ctx.clip();
  ctx.fillStyle = "#0D3B66";
  ctx.fillRect(cardX, section2Top, cardW, 38);
  ctx.restore();

  ctx.textAlign = "left";
  ctx.fillStyle = "#FFFFFF";
  ctx.font = "bold 14px system-ui, -apple-system, sans-serif";
  ctx.fillText("Passenger List", cardX + 16, section2Top + 24);

  // Ice-Blue Sub-Headers Bar (#C8DCF0)
  const colSubY = section2Top + 38;
  ctx.fillStyle = "#C8DCF0";
  ctx.fillRect(cardX, colSubY, cardW, 38);
  ctx.strokeStyle = "#B8D2EB";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(cardX, colSubY + 38);
  ctx.lineTo(cardX + cardW, colSubY + 38);
  ctx.stroke();

  // Columns Widths:
  // Col 1 (No.): 64px
  // Col 2 (Diver Passenger Name): 448px
  // Col 3 (Nationality): 180px
  // Col 4 (ECO ID / ID No.): 236px
  const wNo = 64;
  const wNat = 180;
  const wEco = 236;
  const wName = cardW - wNo - wNat - wEco; // 448px

  const xNo = cardX;
  const xName = xNo + wNo;
  const xNat = xName + wName;
  const xEco = xNat + wNat;

  // Sub-header Column Divider Lines
  ctx.strokeStyle = "#B8D2EB";
  ctx.lineWidth = 1;

  ctx.beginPath();
  ctx.moveTo(xName, colSubY);
  ctx.lineTo(xName, colSubY + 38);
  ctx.moveTo(xNat, colSubY);
  ctx.lineTo(xNat, colSubY + 38);
  ctx.moveTo(xEco, colSubY);
  ctx.lineTo(xEco, colSubY + 38);
  ctx.stroke();

  // Sub-header Labels
  ctx.fillStyle = "#0A2540";
  ctx.font = "bold 13px system-ui, -apple-system, sans-serif";

  ctx.textAlign = "center";
  ctx.fillText("No.", xNo + wNo / 2, colSubY + 24);

  ctx.textAlign = "left";
  ctx.fillText("Diver Passenger Name", xName + 16, colSubY + 24);

  ctx.textAlign = "center";
  ctx.fillText("Nationality", xNat + wNat / 2, colSubY + 24);
  ctx.fillText("ECO ID / ID No.", xEco + wEco / 2, colSubY + 24);

  // Render Passenger Rows
  const rowsStartY = colSubY + 38;

  for (let idx = 0; idx < totalPassengerRows; idx++) {
    const rowY = rowsStartY + idx * section2RowHeight;
    const isRealDiver = idx < normalizedDivers.length;
    const diver = isRealDiver ? normalizedDivers[idx] : null;

    // Bottom border for each row
    ctx.strokeStyle = "#C5D9ED";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(cardX, rowY + section2RowHeight);
    ctx.lineTo(cardX + cardW, rowY + section2RowHeight);
    ctx.stroke();

    // Column Dividers
    ctx.beginPath();
    ctx.moveTo(xName, rowY);
    ctx.lineTo(xName, rowY + section2RowHeight);
    ctx.moveTo(xNat, rowY);
    ctx.lineTo(xNat, rowY + section2RowHeight);
    ctx.moveTo(xEco, rowY);
    ctx.lineTo(xEco, rowY + section2RowHeight);
    ctx.stroke();

    if (diver) {
      // Col 1: No.
      ctx.textAlign = "center";
      ctx.fillStyle = "#0A2540";
      ctx.font = "bold 13px system-ui, -apple-system, sans-serif";
      ctx.fillText(String(idx + 1), xNo + wNo / 2, rowY + 25);

      // Col 2: Diver Name
      ctx.textAlign = "left";
      ctx.font = "bold 13px system-ui, -apple-system, sans-serif";
      ctx.fillText(diver.name, xName + 16, rowY + 25);

      // Col 3: Nationality
      ctx.textAlign = "center";
      ctx.font = "500 13px system-ui, -apple-system, sans-serif";
      ctx.fillStyle = "#334155";
      ctx.fillText(formatDiverNationality(diver.nationality), xNat + wNat / 2, rowY + 25);

      // Col 4: ECO ID (Blue Mono)
      ctx.textAlign = "center";
      ctx.fillStyle = "#0066CC";
      ctx.font = "bold 13px monospace, monospace";
      ctx.fillText(diver.ecoId || "ECO-2026-100005", xEco + wEco / 2, rowY + 25);
    } else {
      // Empty placeholder row
      ctx.textAlign = "center";
      ctx.fillStyle = "#94A3B8";
      ctx.font = "12px system-ui, -apple-system, sans-serif";
      ctx.fillText("—", xNo + wNo / 2, rowY + 25);
      ctx.fillText("—", xNat + wNat / 2, rowY + 25);
      ctx.fillText("—", xEco + wEco / 2, rowY + 25);
    }
  }

  // ==========================================
  // SECTION 3: Official Verification Footer
  // ==========================================
  ctx.textAlign = "left";
  ctx.fillStyle = "#64748B";
  ctx.font = "600 11.5px system-ui, -apple-system, sans-serif";
  ctx.fillText(
    "Official Passenger Manifest • Mabini Municipal Tourism Office",
    cardX + 4,
    footerTop + 24
  );

  // Status Badge on the right
  ctx.textAlign = "right";
  if (verified) {
    ctx.fillStyle = "#059669";
    ctx.font = "bold 12px system-ui, -apple-system, sans-serif";
    ctx.fillText("✓ Officially Verified & Cleared", rightX - 4, footerTop + 24);
  } else {
    ctx.fillStyle = "#D97706";
    ctx.font = "bold 12px system-ui, -apple-system, sans-serif";
    ctx.fillText("• Registered Manifest Record", rightX - 4, footerTop + 24);
  }

  // Export to PNG Blob
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("Canvas toBlob export failed"));
    }, "image/png");
  });
}

export async function downloadManifestoImage(
  options: ManifestoImageOptions,
  filename?: string
): Promise<void> {
  const blob = await generateManifestoImageBlob(options);
  const cleanId = (options.id || "0001").replace(/[^a-zA-Z0-9_-]/g, "");
  const fname = filename || `Passenger-Manifest-${cleanId}-${options.date || "2026"}.png`;
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fname;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    if (a.parentNode) document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 120);
}
