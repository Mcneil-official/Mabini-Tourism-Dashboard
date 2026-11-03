/**
 * Sinsay Official Manifesto Image Generator
 * Generates the modern visual boat dive manifesto graphic matching the Sinsay design:
 * - Ocean header with diver silhouette
 * - SINSAY brand logo & title
 * - Floating rounded white card
 * - "| Vessel Details" 8-tile icon specifications
 * - "| Diver List" electric blue table with mint green status pills
 */

export interface DiverRosterItem {
  name: string;
  ecoId?: string | null;
  isWalkIn?: boolean;
  level?: string | null;
  nationality?: string | null;
}

export interface ManifestoImageOptions {
  id: string;
  operator: string;
  site: string;
  date: string;
  divers: number;
  verified: boolean;
  boatName?: string | null;
  diveType?: string | null;
  maxDivers?: number | null;
  captainName?: string | null;
  boatContact?: string | null;
  crewCount?: number | null;
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

/**
 * Draws layered organic ocean wave curves transitioning the blue ocean header
 * into the floating white card container.
 * Kept strictly above cardY on the outer edges (X < cardX and X > cardX + cardW)
 * so nothing overflows under or alongside the Vessel Details section.
 */
function drawOceanWaves(
  ctx: CanvasRenderingContext2D,
  width: number,
  cardY: number
) {
  // Wave 1: Back Azure Wave (translucent royal/sky blue)
  ctx.save();
  ctx.fillStyle = "rgba(120, 185, 255, 0.45)";
  ctx.beginPath();
  ctx.moveTo(0, cardY - 22);
  ctx.bezierCurveTo(
    width * 0.15,
    cardY - 12,
    width * 0.35,
    cardY - 52,
    width * 0.50,
    cardY - 44
  );
  ctx.bezierCurveTo(
    width * 0.68,
    cardY - 14,
    width * 0.85,
    cardY - 32,
    width,
    cardY - 24
  );
  // Bottom boundary: stays strictly above cardY on the outer edges
  ctx.lineTo(width, cardY - 12);
  ctx.bezierCurveTo(
    width * 0.75,
    cardY + 6,
    width * 0.35,
    cardY + 4,
    0,
    cardY - 10
  );
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  // Wave 2: Front Crest Wave (soft translucent white/cyan)
  ctx.save();
  ctx.fillStyle = "rgba(255, 255, 255, 0.6)";
  ctx.beginPath();
  ctx.moveTo(0, cardY - 14);
  ctx.bezierCurveTo(
    width * 0.28,
    cardY - 38,
    width * 0.52,
    cardY - 16,
    width * 0.76,
    cardY - 36
  );
  ctx.bezierCurveTo(
    width * 0.88,
    cardY - 44,
    width * 0.96,
    cardY - 16,
    width,
    cardY - 20
  );
  // Bottom boundary: stays strictly above cardY on the outer edges
  ctx.lineTo(width, cardY - 8);
  ctx.bezierCurveTo(
    width * 0.75,
    cardY + 10,
    width * 0.35,
    cardY + 8,
    0,
    cardY - 6
  );
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function loadSvgImage(svg: string): Promise<HTMLImageElement> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(img);
    img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
  });
}

function loadLocalImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

// Scuba diver silhouette vector
const DIVER_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 260" fill="#00357A">
  <!-- Bubbles floating up -->
  <circle cx="205" cy="42" r="5" fill="rgba(255,255,255,0.45)"/>
  <circle cx="225" cy="28" r="6" fill="rgba(255,255,255,0.35)"/>
  <circle cx="240" cy="16" r="4" fill="rgba(255,255,255,0.55)"/>
  <circle cx="218" cy="10" r="7" fill="rgba(255,255,255,0.4)"/>
  <circle cx="250" cy="5" r="3.5" fill="rgba(255,255,255,0.6)"/>
  <!-- Diver Body in angled swim stroke -->
  <g transform="rotate(-24 160 130)">
    <!-- Scuba Tank -->
    <rect x="110" y="74" width="70" height="24" rx="12" fill="#002D66" opacity="0.95"/>
    <rect x="180" y="80" width="10" height="12" rx="2" fill="#00224D"/>
    <!-- Head with Mask & Regulator -->
    <ellipse cx="200" cy="110" rx="15" ry="14" fill="#003882"/>
    <path d="M202 100 L218 106 L212 118 L198 116 Z" fill="#00285C"/>
    <!-- Torso with BCD -->
    <path d="M115 95 Q145 88 190 100 L185 128 Q140 128 110 116 Z" fill="#003E8F"/>
    <!-- Left Arm forward -->
    <path d="M180 116 Q200 132 230 138 L224 146 Q194 138 172 124 Z" fill="#00357A"/>
    <!-- Right Arm back -->
    <path d="M125 110 Q110 130 95 145 L90 138 Q105 124 120 105 Z" fill="#002F6E"/>
    <!-- Legs with dive suit -->
    <path d="M115 105 Q85 110 60 125 L45 140 Q30 155 10 170 L5 160 Q25 145 45 130 L70 100 Z" fill="#003E8F"/>
    <path d="M115 112 Q80 120 50 145 L35 165 Q15 185 0 200 L-5 190 Q15 170 35 150 L65 115 Z" fill="#002D66"/>
    <!-- Long Fins -->
    <path d="M12 165 L-25 200 L-14 212 L20 176 Z" fill="#002454"/>
    <path d="M0 195 L-35 230 L-24 242 L10 206 Z" fill="#001F47"/>
  </g>
</svg>`;

// Icon SVGs matching the 8 Vessel Details tiles
const ICONS = {
  operator: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="22" height="22" fill="#0265D2"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>`,
  location: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="22" height="22" fill="#0265D2"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>`,
  date: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="22" height="22" fill="#0265D2"><path d="M19 4h-1V2h-2v2H8V2H6v2H5c-1.11 0-1.99.9-1.99 2L3 20c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 16H5V10h14v10zm0-12H5V6h14v2z"/><circle cx="8" cy="13" r="1.5"/><circle cx="12" cy="13" r="1.5"/><circle cx="16" cy="13" r="1.5"/><circle cx="8" cy="17" r="1.5"/><circle cx="12" cy="17" r="1.5"/></svg>`,
  boat: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="22" height="22" fill="#0265D2"><path d="M20 21c-1.39 0-2.78-.47-4-1.32-2.44 1.71-5.56 1.71-8 0C6.78 20.53 5.39 21 4 21H2v2h2c1.38 0 2.74-.35 4-.99 2.52 1.29 5.48 1.29 8 0 1.26.65 2.62.99 4 .99h2v-2h-2zM3.95 19H4c1.6 0 3.02-.88 4-2 .98 1.12 2.4 2 4 2s3.02-.88 4-2c.98 1.12 2.4 2 4 2h.05l1.89-6.68c.08-.26.06-.54-.06-.78s-.34-.42-.6-.47L20 13.01V8.5c0-.83-.67-1.5-1.5-1.5H15V4c0-.55-.45-1-1-1h-4c-.55 0-1 .45-1 1v3H5.5C4.67 7 4 7.67 4 8.5v4.51l-1.28.23c-.26.05-.48.23-.6.47s-.14.52-.06.78L3.95 19zM6 9h12v4.06l-6-.9-6 .9V9z"/></svg>`,
  divers: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="22" height="22" fill="#0265D2"><path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/></svg>`,
  tank: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="22" height="22" fill="#0265D2"><path d="M11 2h2v2h-2zM9 4h6v2H9zM7 8c0-1.1.9-2 2-2h6c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H9c-1.1 0-2-.9-2-2V8zm4 3h2v6h-2v-6z"/></svg>`,
  capacity: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="22" height="22" fill="#0265D2"><path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/></svg>`,
  captain: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="22" height="22" fill="#0265D2"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z"/><path d="M6 10h12v2H6z"/></svg>`,
  check: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="14" height="14" fill="#059669"><path d="M9 16.2L4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4L9 16.2z"/></svg>`,
};

export async function generateManifestoImageBlob(
  options: ManifestoImageOptions
): Promise<Blob> {
  const {
    id,
    operator,
    site,
    date,
    divers,
    boatName = "Bantay Dagat",
    diveType = "Scuba Diving",
    maxDivers,
    captainName,
    instructorName,
    roster,
  } = options;

  const diversCount = Math.max(divers || 1, roster?.length || 1);
  const rows =
    roster && roster.length > 0
      ? roster
      : Array.from({ length: diversCount }, (_, i) => ({
          name: i === 0 ? "John Smith" : "Jhon Mcneil Magtilay",
          ecoId: i === 0 ? null : "VERIFIED ID",
          isWalkIn: i === 0,
          level: i === 0 ? "Walk-in Registration" : "Open Water Diver",
          nationality: "Philippines",
        }));

  // Geometry
  const width = 1100;
  const headerHeight = 360;
  const cardPadding = 36;
  const cardY = 280;
  const tileH = 68;
  const tileGap = 14;
  const vesselGridHeight = tileH * 2 + tileGap; // 150
  const tableHeaderHeight = 44;
  const rowHeight = 52;
  const tableHeight = tableHeaderHeight + rows.length * rowHeight;
  const cardBottomPadding = 56;
  const cardHeight =
    cardPadding + 38 + vesselGridHeight + 36 + 34 + tableHeight + cardBottomPadding;

  const bottomPageMargin = 64;
  const height = cardY + cardHeight + bottomPageMargin;

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not initialize canvas context");

  // Load vector icons & logo
  const [bgImg, sinsayLogoImg, opIcon, locIcon, dateIcon, boatIcon, divIcon, tankIcon, capIcon, captIcon, checkIcon] =
    await Promise.all([
      loadLocalImage("/manifesto-bg.png"),
      loadLocalImage("/sinsay-logo-white.png"),
      loadSvgImage(ICONS.operator),
      loadSvgImage(ICONS.location),
      loadSvgImage(ICONS.date),
      loadSvgImage(ICONS.boat),
      loadSvgImage(ICONS.divers),
      loadSvgImage(ICONS.tank),
      loadSvgImage(ICONS.capacity),
      loadSvgImage(ICONS.captain),
      loadSvgImage(ICONS.check),
    ]);

  // 0. Soft light blue page background
  ctx.fillStyle = "#EEF5FD";
  ctx.fillRect(0, 0, width, height);

  // 1. Ocean Blue Header Background (using the uploaded illustration)
  // Clipped strictly to the wave curve so no artwork spills below or beside Vessel Details
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(width, 0);
  ctx.lineTo(width, cardY - 24);
  ctx.bezierCurveTo(
    width * 0.85,
    cardY - 32,
    width * 0.68,
    cardY - 14,
    width * 0.50,
    cardY - 44
  );
  ctx.bezierCurveTo(
    width * 0.35,
    cardY - 52,
    width * 0.15,
    cardY - 12,
    0,
    cardY - 22
  );
  ctx.closePath();
  ctx.clip();

  const drawH = 340;
  if (bgImg && bgImg.width > 0) {
    const imgRatio = bgImg.width / bgImg.height;
    const canvasRatio = width / drawH;
    let sx = 0, sy = 0, sw = bgImg.width, sh = bgImg.height;
    if (imgRatio > canvasRatio) {
      sw = bgImg.height * canvasRatio;
      sx = (bgImg.width - sw) / 2;
    } else {
      sh = bgImg.width / canvasRatio;
      sy = (bgImg.height - sh) / 2;
    }
    ctx.drawImage(bgImg, sx, sy, sw, sh, 0, 0, width, drawH);
  } else {
    const oceanGrad = ctx.createLinearGradient(0, 0, width, headerHeight);
    oceanGrad.addColorStop(0, "#0175F2");
    oceanGrad.addColorStop(0.5, "#015FD0");
    oceanGrad.addColorStop(1, "#0047AE");
    ctx.fillStyle = oceanGrad;
    ctx.fillRect(0, 0, width, headerHeight + 50);
  }
  ctx.restore();

  // 2. SINSAY Brand Logo
  if (sinsayLogoImg && sinsayLogoImg.width > 0) {
    const logoH = 46;
    const logoW = logoH * (sinsayLogoImg.width / sinsayLogoImg.height);
    ctx.drawImage(sinsayLogoImg, 56, 56, logoW, logoH);
  } else {
    ctx.textAlign = "left";
    ctx.fillStyle = "#FFFFFF";
    ctx.font = "900 44px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
    ctx.fillText("SINSAY", 56, 100);
  }

  // Underline decorative capsule pill
  ctx.fillStyle = "#60A5FA";
  roundRect(ctx, 56, 114, 46, 5, 2.5);
  ctx.fill();

  // "Official Boat Dive Manifesto" Title
  ctx.fillStyle = "#FFFFFF";
  ctx.font = "bold 38px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
  ctx.fillText("Official Boat Dive", 56, 182);
  ctx.fillText("Manifesto", 56, 230);

  // Layered Ocean Waves Transition into Vessel Details
  drawOceanWaves(ctx, width, cardY);

  // 3. Floating White Container Card
  const cardX = 36;
  const cardW = width - cardX * 2;
  const actualCardH = cardHeight;

  // Drop shadow for card
  ctx.save();
  ctx.shadowColor = "rgba(0, 40, 110, 0.25)";
  ctx.shadowBlur = 35;
  ctx.shadowOffsetY = 15;
  ctx.fillStyle = "#FFFFFF";
  roundRect(ctx, cardX, cardY, cardW, actualCardH, 24);
  ctx.fill();
  ctx.restore();

  // Subtle border on card
  ctx.strokeStyle = "#E2E8F0";
  ctx.lineWidth = 1.5;
  roundRect(ctx, cardX, cardY, cardW, actualCardH, 24);
  ctx.stroke();

  let curY = cardY + cardPadding;

  // 4. Section 1: "| Vessel Details"
  const bluePillX = cardX + cardPadding;
  ctx.fillStyle = "#0066EE";
  roundRect(ctx, bluePillX, curY + 2, 5, 22, 2.5);
  ctx.fill();

  ctx.textAlign = "left";
  ctx.fillStyle = "#0F172A";
  ctx.font = "bold 22px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
  ctx.fillText("Vessel Details", bluePillX + 16, curY + 20);

  curY += 38;

  // 8 Vessel Tiles in 4x2 Grid
  const gridW = cardW - cardPadding * 2;
  const tileW = (gridW - tileGap * 3) / 4;

  const tileData = [
    { icon: opIcon, label: "ACCREDITED OPERATOR", val: operator || "Magtilay" },
    { icon: locIcon, label: "DIVE LOCATION", val: site || "Anilao Pier" },
    { icon: dateIcon, label: "VOYAGE DATE", val: date },
    { icon: boatIcon, label: "VESSEL / BOAT", val: boatName || "Bantay Dagat" },
    { icon: divIcon, label: "DIVERS ONBOARD", val: `${diversCount} Certified Divers` },
    { icon: tankIcon, label: "DIVE TYPE", val: diveType || "Scuba Diving" },
    { icon: capIcon, label: "CAPACITY", val: maxDivers ? `${diversCount}/${maxDivers} Max` : `${diversCount}/22 Max` },
    { icon: captIcon, label: "GUIDE / CAPTAIN", val: captainName || instructorName || "Licensed Guide" },
  ];

  tileData.forEach((t, i) => {
    const col = i % 4;
    const row = Math.floor(i / 4);
    const tx = cardX + cardPadding + col * (tileW + tileGap);
    const ty = curY + row * (tileH + tileGap);

    // Tile rounded background
    ctx.fillStyle = "#F1F6FD";
    roundRect(ctx, tx, ty, tileW, tileH, 12);
    ctx.fill();

    // Tile soft border
    ctx.strokeStyle = "#E4EDFA";
    ctx.lineWidth = 1;
    roundRect(ctx, tx, ty, tileW, tileH, 12);
    ctx.stroke();

    // Tile Icon
    ctx.drawImage(t.icon, tx + 14, ty + (tileH - 24) / 2, 24, 24);

    // Tile Label
    ctx.textAlign = "left";
    ctx.fillStyle = "#8FA5BE";
    ctx.font = "bold 9px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
    ctx.fillText(t.label, tx + 48, ty + 28);

    // Tile Value
    ctx.fillStyle = "#0F172A";
    ctx.font = "bold 13px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";

    // Text truncation if needed
    let valStr = t.val;
    const maxTextW = tileW - 56;
    if (ctx.measureText(valStr).width > maxTextW) {
      while (valStr.length > 3 && ctx.measureText(valStr + "…").width > maxTextW) {
        valStr = valStr.slice(0, -1);
      }
      valStr += "…";
    }
    ctx.fillText(valStr, tx + 48, ty + 49);
  });

  curY += tileH * 2 + tileGap + 36;

  // 5. Section 2: "| Diver List"
  ctx.fillStyle = "#0066EE";
  roundRect(ctx, bluePillX, curY + 2, 5, 22, 2.5);
  ctx.fill();

  ctx.fillStyle = "#0F172A";
  ctx.font = "bold 22px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
  ctx.fillText("Diver List", bluePillX + 16, curY + 20);

  curY += 34;

  // Table Container
  const tableX = cardX + cardPadding;
  const tableW = cardW - cardPadding * 2;

  // Table Header Background (Electric Blue)
  ctx.fillStyle = "#0066EE";
  roundRect(ctx, tableX, curY, tableW, tableHeaderHeight, 8);
  ctx.fill();

  // Column X Coordinates & Widths
  const colX = {
    num: tableX + 28,
    name: tableX + 60,
    eco: tableX + 285,
    cert: tableX + 440,
    feeCenter: tableX + 680,
    waiverCenter: tableX + 845,
  };

  ctx.fillStyle = "#FFFFFF";
  ctx.font = "bold 11px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";

  ctx.textAlign = "center";
  ctx.fillText("#", colX.num, curY + 27);

  ctx.textAlign = "left";
  ctx.fillText("DIVER PASSENGER NAME", colX.name, curY + 27);
  ctx.fillText("ECO DIVE ID", colX.eco, curY + 27);
  ctx.fillText("CERTIFICATION / STATUS", colX.cert, curY + 27);

  ctx.textAlign = "center";
  ctx.fillText("MUNICIPAL FEE", colX.feeCenter, curY + 27);
  ctx.fillText("SAFETY WAIVER", colX.waiverCenter, curY + 27);

  curY += tableHeaderHeight;

  // Table Rows
  rows.forEach((r, idx) => {
    const rowY = curY + idx * rowHeight;

    // Row divider
    ctx.strokeStyle = "#E8EEF7";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(tableX, rowY + rowHeight);
    ctx.lineTo(tableX + tableW, rowY + rowHeight);
    ctx.stroke();

    // Col 1: #
    ctx.textAlign = "center";
    ctx.fillStyle = "#0F172A";
    ctx.font = "bold 13px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
    ctx.fillText(String(idx + 1), colX.num, rowY + 31);

    // Col 2: Diver Name
    ctx.textAlign = "left";
    ctx.fillStyle = "#0F172A";
    ctx.font = "bold 13.5px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
    ctx.fillText(r.name, colX.name, rowY + 31);

    // Col 3: Eco Dive ID Pill
    const ecoText = r.ecoId || (r.isWalkIn ? "WALK-IN GUEST" : "VERIFIED ID");
    ctx.textAlign = "left";
    ctx.fillStyle = "#0265D2";
    ctx.font = "bold 11px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
    ctx.fillText(ecoText, colX.eco, rowY + 31);

    // Col 4: Certification Level
    ctx.textAlign = "left";
    ctx.fillStyle = "#334155";
    ctx.font = "500 13px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
    ctx.fillText(
      r.level || (r.isWalkIn ? "Walk-in Registration" : "Open Water Diver"),
      colX.cert,
      rowY + 31
    );

    // Col 5: Municipal Fee Badge (Mint Green)
    const feePillW = 116;
    const feePillH = 28;
    const feePillX = colX.feeCenter - feePillW / 2;
    const feePillY = rowY + (rowHeight - feePillH) / 2;

    ctx.fillStyle = "#ECFDF5";
    roundRect(ctx, feePillX, feePillY, feePillW, feePillH, 14);
    ctx.fill();

    ctx.strokeStyle = "#A7F3D0";
    ctx.lineWidth = 1;
    roundRect(ctx, feePillX, feePillY, feePillW, feePillH, 14);
    ctx.stroke();

    ctx.textAlign = "center";
    ctx.fillStyle = "#059669";
    ctx.font = "bold 10px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
    ctx.fillText("PAID & CLEARED", colX.feeCenter, feePillY + 18);

    // Col 6: Safety Waiver Badge (Mint Green with Checkmark)
    const wPillW = 96;
    const wPillH = 28;
    const wPillX = colX.waiverCenter - wPillW / 2;
    const wPillY = rowY + (rowHeight - wPillH) / 2;

    ctx.fillStyle = "#ECFDF5";
    roundRect(ctx, wPillX, wPillY, wPillW, wPillH, 14);
    ctx.fill();

    ctx.strokeStyle = "#A7F3D0";
    ctx.lineWidth = 1;
    roundRect(ctx, wPillX, wPillY, wPillW, wPillH, 14);
    ctx.stroke();

    // Draw check icon
    ctx.drawImage(checkIcon, wPillX + 16, wPillY + 7, 14, 14);

    ctx.textAlign = "left";
    ctx.fillStyle = "#059669";
    ctx.font = "bold 10.5px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
    ctx.fillText("SIGNED", wPillX + 36, wPillY + 18);
  });

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("Canvas toBlob failed"));
    }, "image/png");
  });
}

export async function downloadManifestoImage(
  options: ManifestoImageOptions,
  filename?: string
): Promise<void> {
  const blob = await generateManifestoImageBlob(options);
  const fname = filename || `Sinsay-Manifesto-${options.id}-${options.date}.png`;
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fname;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    if (a.parentNode) document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 100);
}
