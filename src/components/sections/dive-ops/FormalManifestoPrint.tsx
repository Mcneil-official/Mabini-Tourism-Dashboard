import { useMemo } from "react";
import { Printer, ArrowLeft, ShieldCheck, ShieldAlert } from "lucide-react";
import { MABINI_LGU_LOGO_URI } from "@/constants/lguLogo";

export interface FormalDiver {
  name: string;
  ecoId?: string | null;
  isWalkIn?: boolean;
  nationality?: string | null;
  certification?: string | null;
  municipalFeeStatus?: string;
  safetyWaiverStatus?: string;
}

export interface FormalManifest {
  id: string;
  boat_name?: string | null;
  boatName?: string | null;
  dive_mode?: string | null;
  diveMode?: string | null;
  dive_type?: string | null;
  diveType?: string | null;
  location?: string | null;
  site?: string | null;
  difficulty?: string | null;
  dive_date?: string | null;
  date?: string | null;
  diver_count?: number | null;
  divers?: number | null;
  max_divers?: number | null;
  maxDivers?: number | null;
  captain_name?: string | null;
  captainName?: string | null;
  crew_members?: string[] | null;
  crewMembers?: string[] | null;
  dive_masters?: string[] | null;
  diveMasters?: string[] | null;
  instructor_name?: string | null;
  instructorName?: string | null;
  crew_count?: number | null;
  crewCount?: number | null;
  verified?: boolean;
  operator?: string;
  _dbId?: string;
}

interface FormalManifestoPrintProps {
  manifest: FormalManifest;
  divers?: FormalDiver[];
  showToolbar?: boolean;
  inModal?: boolean;
  onBack?: () => void;
}

const MIN_ROW_COUNT = 8;

export function FormalManifestoPrint({
  manifest,
  divers = [],
  showToolbar = true,
  inModal = false,
  onBack,
}: FormalManifestoPrintProps) {
  const diveMode = (
    manifest.dive_mode ||
    manifest.diveMode ||
    "Boat Dive"
  ).trim();
  const isBoatDive = diveMode.toLowerCase().includes("boat");
  const subHeaderTitle = isBoatDive ? "Boat Trip Record" : "Shore Dive Record";
  const resolvedOperator =
    manifest.operator?.trim() || "Accredited Dive Operator";

  // Normalize divers
  const normalizedDivers: FormalDiver[] = useMemo(() => {
    if (divers && divers.length > 0) {
      return divers.map((d) => {
        const isWalkIn = Boolean(d.isWalkIn);
        let resolvedEcoId = "Walk-in";
        if (isWalkIn) {
          resolvedEcoId = "Walk-in";
        } else if (
          d.ecoId &&
          d.ecoId !== "VERIFIED ID" &&
          d.ecoId !== "WALK-IN GUEST"
        ) {
          resolvedEcoId = d.ecoId;
        } else {
          resolvedEcoId = d.ecoId || "—";
        }
        return {
          ...d,
          ecoId: resolvedEcoId,
          isWalkIn,
          nationality: d.nationality || "Filipino",
          certification:
            d.certification ||
            (isWalkIn ? "Walk-in Registration" : "Certified Diver"),
          municipalFeeStatus: d.municipalFeeStatus || "PAID & CLEARED",
          safetyWaiverStatus: d.safetyWaiverStatus || "SIGNED",
        };
      });
    }

    // Fallback diver mock count if none provided
    const count = manifest.diver_count || manifest.divers || 6;
    const generated: FormalDiver[] = [];
    for (let i = 1; i <= count; i++) {
      generated.push({
        name: `Registered Diver #${i}`,
        ecoId:
          i % 3 === 0
            ? "Walk-in"
            : `ECO-2026-${String(1040 + i).padStart(4, "0")}`,
        isWalkIn: i % 3 === 0,
        nationality: i % 2 === 0 ? "Philippines" : "International",
        certification: i === 1 ? "Divemaster" : "Open Water",
        municipalFeeStatus: "PAID & CLEARED",
        safetyWaiverStatus: "SIGNED",
      });
    }
    return generated;
  }, [divers, manifest.diver_count, manifest.divers]);

  const diverCount =
    manifest.diver_count || manifest.divers || normalizedDivers.length;
  const maxDivers =
    manifest.max_divers || manifest.maxDivers || (isBoatDive ? 22 : 30);

  // Short ID & Formatted Manifest Number
  const rawId = manifest.id || "0001";
  const manifestNumber = useMemo(() => {
    if (rawId.startsWith("MF-")) return rawId;
    const clean =
      rawId.length > 10 ? rawId.slice(0, 5).toUpperCase() : rawId.toUpperCase();
    return `2026-${clean}`;
  }, [rawId]);

  // Date formatting
  const rawDate = manifest.dive_date || manifest.date || "";
  const formattedDate = useMemo(() => {
    if (!rawDate) return "Current Voyage";
    try {
      const d = new Date(rawDate);
      if (!isNaN(d.getTime())) {
        return d.toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
        });
      }
    } catch {
      // ignore
    }
    return rawDate;
  }, [rawDate]);

  const diveSiteDisplay =
    manifest.location?.trim() ||
    manifest.site?.trim() ||
    (isBoatDive ? "Anilao Dive Site" : "Anilao Shore Entry");
  const vesselNameDisplay =
    manifest.boat_name?.trim() ||
    manifest.boatName?.trim() ||
    (isBoatDive ? "Official Dive Vessel" : "Shore Base");
  const captainDisplay =
    manifest.captain_name?.trim() || manifest.captainName?.trim() || "—";

  const dms = (manifest.dive_masters || manifest.diveMasters || [])
    .map((s) => s.trim())
    .filter(Boolean);
  const leadDmDisplay =
    dms.length > 0
      ? dms.join(", ")
      : manifest.instructor_name?.trim() ||
        manifest.instructorName?.trim() ||
        "—";

  const crews = (manifest.crew_members || manifest.crewMembers || [])
    .map((s) => s.trim())
    .filter(Boolean);
  const crewDisplay =
    crews.length > 0
      ? crews.join(", ")
      : manifest.crew_count || manifest.crewCount
        ? `${manifest.crew_count || manifest.crewCount} Vessel Crew`
        : "—";

  const difficultyDisplay = manifest.difficulty?.trim() || "All Levels";
  const diveTypeDisplay =
    manifest.dive_type?.trim() || manifest.diveType?.trim() || "Scuba Diving";

  const totalRows = Math.max(MIN_ROW_COUNT, normalizedDivers.length + 3);
  const emptyRowCount = Math.max(2, totalRows - normalizedDivers.length);

  return (
    <div
      className={
        inModal
          ? "w-full flex flex-col items-center p-0 bg-transparent text-slate-900"
          : "min-h-screen bg-slate-100 py-6 px-3 sm:px-6 print:p-0 print:bg-white text-slate-900 flex flex-col items-center"
      }
    >
      <style>{`
        @page {
          size: A4 portrait;
          margin: 8mm 10mm 8mm 10mm;
        }
        @media print {
          .no-print {
            display: none !important;
          }
          body {
            background: #ffffff !important;
            padding: 0 !important;
            margin: 0 !important;
          }
          .formal-canvas {
            box-shadow: none !important;
            border: none !important;
            padding: 0 !important;
            margin: 0 !important;
            max-width: 100% !important;
            width: 100% !important;
          }
          * {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
        }
      `}</style>

      {/* Non-Printable Top Action Toolbar */}
      {showToolbar && !inModal && (
        <div className="no-print w-full max-w-[1024px] mb-4 bg-white border border-slate-200 rounded-xl p-3 sm:p-4 shadow-sm flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            {onBack ? (
              <button
                type="button"
                onClick={onBack}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 px-3 py-2 rounded-lg transition-colors"
              >
                <ArrowLeft className="size-4" />
                <span>Back</span>
              </button>
            ) : (
              <a
                href="/?section=dive-ops"
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 px-3 py-2 rounded-lg transition-colors"
              >
                <ArrowLeft className="size-4" />
                <span>Dashboard</span>
              </a>
            )}
            <div>
              <div className="text-sm font-bold text-slate-900">
                Official Passenger Manifest &mdash; {manifestNumber}
              </div>
              <div className="text-xs text-slate-500">
                Formal municipal printable layout mirrored from operator preview
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {manifest.verified ? (
              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-full">
                <ShieldCheck className="size-3.5 text-emerald-600" /> LGU
                Verified
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-full">
                <ShieldAlert className="size-3.5 text-amber-600" /> Pending
                Verification
              </span>
            )}

            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex items-center gap-2 bg-[#0D3B66] hover:bg-[#092b4c] text-white text-xs font-bold px-4 py-2 rounded-lg shadow-sm transition-all hover:shadow"
            >
              <Printer className="size-4" />
              <span>Print / Save as PDF</span>
            </button>
          </div>
        </div>
      )}

      {/* Formal Manifesto Printable Sheet (1024px Width Canvas) */}
      <div
        className={
          inModal
            ? "formal-canvas w-full max-w-[1024px] bg-white rounded-xl border border-slate-200 px-6 sm:px-10 pt-8 pb-0 relative overflow-hidden flex flex-col justify-between"
            : "formal-canvas w-full max-w-[1024px] bg-white rounded-xl shadow-lg border border-slate-200 px-8 sm:px-12 pt-10 pb-0 relative overflow-hidden flex flex-col justify-between"
        }
      >
        <div>
          {/* Top Header Row: Mabini LGU Emblem + Letterhead Left, Manifest No. & Date Right */}
          <div className="flex items-start justify-between gap-4 mb-5">
            <div className="flex items-center gap-4 flex-1">
              <img
                src={MABINI_LGU_LOGO_URI}
                alt="Municipality of Mabini Emblem"
                className="w-20 h-20 object-contain shrink-0"
              />
              <div className="flex flex-col justify-center">
                <div className="text-[11px] font-bold text-slate-600 tracking-[1.4px] uppercase">
                  Republic of the Philippines
                </div>
                <div className="text-[13.5px] font-bold text-slate-900 tracking-[0.3px] mt-0.5">
                  PROVINCE OF BATANGAS &bull; MUNICIPALITY OF MABINI
                </div>
                <div className="text-[12px] font-bold text-[#0D3B66] tracking-[0.8px] mt-0.5 uppercase">
                  Municipal Tourism &amp; Maritime Safety Office
                </div>
                <div className="text-[11.5px] font-semibold text-[#0066CC] mt-1 truncate">
                  Operating Resort:{" "}
                  <span className="font-bold">{resolvedOperator}</span>
                </div>
              </div>
            </div>

            {/* Right Meta Block */}
            <div className="text-right shrink-0 pt-1">
              <div className="text-[14.5px] font-bold text-slate-900 tracking-[0.2px]">
                Manifest No. {manifestNumber}
              </div>
              <div className="text-[13px] font-semibold text-slate-800 mt-1">
                Date: {formattedDate}
              </div>
            </div>
          </div>

          {/* Centered Document Title Block */}
          <div className="text-center my-4">
            <h1 className="text-2xl sm:text-[28px] font-bold text-[#0D3B66] tracking-[2px] uppercase leading-tight font-display">
              Passenger Manifest
            </h1>
            <div className="text-[15px] font-bold text-slate-900 mt-1">
              {subHeaderTitle}
            </div>
            <div className="h-[2px] bg-[#0D3B66] w-full mt-3" />
          </div>

          {/* Section 1: Vessel & Trip Information Table Card (3 Rows x 3 Columns) */}
          <div className="border border-[#B8D2EB] rounded-lg overflow-hidden bg-white mb-6">
            <div className="bg-[#0D3B66] h-[38px] px-4 flex items-center">
              <span className="text-white text-[14px] font-bold">
                {isBoatDive
                  ? "Vessel & Trip Information"
                  : "Dive Site & Entry Information"}
              </span>
            </div>

            <div className="divide-y divide-[#C5D9ED] text-left">
              {isBoatDive ? (
                <>
                  {/* Boat Dive Row 1 */}
                  <div className="grid grid-cols-3 divide-x divide-[#C5D9ED]">
                    <div className="px-3.5 py-2.5">
                      <div className="text-[11.5px] font-semibold text-[#334E68]">
                        Vessel Name
                      </div>
                      <div className="text-[13.5px] font-bold text-[#0A2540] truncate mt-0.5">
                        {vesselNameDisplay}
                      </div>
                    </div>
                    <div className="px-3.5 py-2.5">
                      <div className="text-[11.5px] font-semibold text-[#334E68]">
                        Dive Site / Destination
                      </div>
                      <div className="text-[13.5px] font-bold text-[#0A2540] truncate mt-0.5">
                        {diveSiteDisplay}
                      </div>
                    </div>
                    <div className="px-3.5 py-2.5">
                      <div className="text-[11.5px] font-semibold text-[#334E68]">
                        Dive Mode &amp; Type
                      </div>
                      <div className="text-[13.5px] font-bold text-[#0A2540] truncate mt-0.5">
                        Boat Dive &bull; {diveTypeDisplay}
                      </div>
                    </div>
                  </div>

                  {/* Boat Dive Row 2 */}
                  <div className="grid grid-cols-3 divide-x divide-[#C5D9ED]">
                    <div className="px-3.5 py-2.5">
                      <div className="text-[11.5px] font-semibold text-[#334E68]">
                        Boat Captain
                      </div>
                      <div className="text-[13.5px] font-bold text-[#0A2540] truncate mt-0.5">
                        {captainDisplay}
                      </div>
                    </div>
                    <div className="px-3.5 py-2.5">
                      <div className="text-[11.5px] font-semibold text-[#334E68]">
                        Lead Divemaster / Guide
                      </div>
                      <div className="text-[13.5px] font-bold text-[#0A2540] truncate mt-0.5">
                        {leadDmDisplay}
                      </div>
                    </div>
                    <div className="px-3.5 py-2.5">
                      <div className="text-[11.5px] font-semibold text-[#334E68]">
                        Crew Members
                      </div>
                      <div className="text-[13.5px] font-bold text-[#0A2540] truncate mt-0.5">
                        {crewDisplay}
                      </div>
                    </div>
                  </div>

                  {/* Boat Dive Row 3 */}
                  <div className="grid grid-cols-3 divide-x divide-[#C5D9ED]">
                    <div className="px-3.5 py-2.5">
                      <div className="text-[11.5px] font-semibold text-[#334E68]">
                        Diver Capacity
                      </div>
                      <div className="text-[13.5px] font-bold text-[#0A2540] truncate mt-0.5">
                        {diverCount} / {maxDivers} Max Divers
                      </div>
                    </div>
                    <div className="px-3.5 py-2.5">
                      <div className="text-[11.5px] font-semibold text-[#334E68]">
                        Difficulty Tier
                      </div>
                      <div className="text-[13.5px] font-bold text-[#0A2540] truncate mt-0.5">
                        {difficultyDisplay}
                      </div>
                    </div>
                    <div className="px-3.5 py-2.5">
                      <div className="text-[11.5px] font-semibold text-[#334E68]">
                        Departure Date
                      </div>
                      <div className="text-[13.5px] font-bold text-[#0A2540] truncate mt-0.5">
                        {formattedDate}
                      </div>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  {/* Shore Dive Row 1 */}
                  <div className="grid grid-cols-3 divide-x divide-[#C5D9ED]">
                    <div className="px-3.5 py-2.5">
                      <div className="text-[11.5px] font-semibold text-[#334E68]">
                        Dive Site / Shore Entry
                      </div>
                      <div className="text-[13.5px] font-bold text-[#0A2540] truncate mt-0.5">
                        {diveSiteDisplay}
                      </div>
                    </div>
                    <div className="px-3.5 py-2.5">
                      <div className="text-[11.5px] font-semibold text-[#334E68]">
                        Dive Mode
                      </div>
                      <div className="text-[13.5px] font-bold text-[#0A2540] truncate mt-0.5">
                        Shore Entry Dive
                      </div>
                    </div>
                    <div className="px-3.5 py-2.5">
                      <div className="text-[11.5px] font-semibold text-[#334E68]">
                        Dive Type
                      </div>
                      <div className="text-[13.5px] font-bold text-[#0A2540] truncate mt-0.5">
                        {diveTypeDisplay}
                      </div>
                    </div>
                  </div>

                  {/* Shore Dive Row 2 */}
                  <div className="grid grid-cols-3 divide-x divide-[#C5D9ED]">
                    <div className="px-3.5 py-2.5">
                      <div className="text-[11.5px] font-semibold text-[#334E68]">
                        Lead Divemaster / Guide
                      </div>
                      <div className="text-[13.5px] font-bold text-[#0A2540] truncate mt-0.5">
                        {leadDmDisplay}
                      </div>
                    </div>
                    <div className="px-3.5 py-2.5">
                      <div className="text-[11.5px] font-semibold text-[#334E68]">
                        Operating Resort
                      </div>
                      <div className="text-[13.5px] font-bold text-[#0A2540] truncate mt-0.5">
                        {resolvedOperator}
                      </div>
                    </div>
                    <div className="px-3.5 py-2.5">
                      <div className="text-[11.5px] font-semibold text-[#334E68]">
                        Difficulty Tier
                      </div>
                      <div className="text-[13.5px] font-bold text-[#0A2540] truncate mt-0.5">
                        {difficultyDisplay}
                      </div>
                    </div>
                  </div>

                  {/* Shore Dive Row 3 */}
                  <div className="grid grid-cols-3 divide-x divide-[#C5D9ED]">
                    <div className="px-3.5 py-2.5">
                      <div className="text-[11.5px] font-semibold text-[#334E68]">
                        Registered Divers
                      </div>
                      <div className="text-[13.5px] font-bold text-[#0A2540] truncate mt-0.5">
                        {diverCount} Divers Registered
                      </div>
                    </div>
                    <div className="px-3.5 py-2.5">
                      <div className="text-[11.5px] font-semibold text-[#334E68]">
                        Schedule Date
                      </div>
                      <div className="text-[13.5px] font-bold text-[#0A2540] truncate mt-0.5">
                        {formattedDate}
                      </div>
                    </div>
                    <div className="px-3.5 py-2.5">
                      <div className="text-[11.5px] font-semibold text-[#334E68]">
                        Safety Protocol
                      </div>
                      <div className="text-[13.5px] font-bold text-[#0A2540] truncate mt-0.5">
                        Standard PCSSD Protocols
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Section 2: Passenger List Table Card */}
          <div className="border border-[#B8D2EB] rounded-lg overflow-hidden bg-white mb-6">
            <div className="bg-[#0D3B66] h-[38px] px-4 flex items-center">
              <span className="text-white text-[14px] font-bold">
                Passenger List
              </span>
            </div>

            {/* Ice-Blue Column Sub-Headers */}
            <div className="bg-[#C8DCF0] h-[38px] flex items-center border-b border-[#B8D2EB] text-[#0A2540] text-[13px] font-bold">
              <div className="w-16 text-center shrink-0 border-r border-[#B8D2EB]">
                No.
              </div>
              <div className="flex-1 px-4 text-left border-r border-[#B8D2EB]">
                Diver Passenger Name
              </div>
              <div className="w-44 text-center shrink-0 border-r border-[#B8D2EB]">
                Nationality
              </div>
              <div className="w-52 text-center shrink-0">ECO ID / ID No.</div>
            </div>

            {/* Active Passenger Rows */}
            <div className="divide-y divide-[#C5D9ED]">
              {normalizedDivers.map((diver, idx) => (
                <div
                  key={`diver-${idx}-${diver.name}`}
                  className="h-10 flex items-center bg-white text-[13px] text-[#0A2540]"
                >
                  <div className="w-16 text-center font-bold shrink-0 border-r border-[#C5D9ED]">
                    {idx + 1}
                  </div>
                  <div className="flex-1 px-4 font-bold text-left truncate border-r border-[#C5D9ED]">
                    {diver.name}
                  </div>
                  <div className="w-44 text-center font-medium shrink-0 truncate border-r border-[#C5D9ED]">
                    {diver.nationality || "Filipino"}
                  </div>
                  <div className="w-52 text-center font-bold font-mono text-[#0066CC] shrink-0 truncate px-2">
                    {diver.ecoId}
                  </div>
                </div>
              ))}

              {/* Padded Empty Grid Rows */}
              {Array.from({ length: emptyRowCount }).map((_, emptyIdx) => (
                <div
                  key={`empty-grid-row-${emptyIdx}`}
                  className="h-9 flex items-center bg-white"
                >
                  <div className="w-16 h-full shrink-0 border-r border-[#C5D9ED]" />
                  <div className="flex-1 h-full border-r border-[#C5D9ED]" />
                  <div className="w-44 h-full shrink-0 border-r border-[#C5D9ED]" />
                  <div className="w-52 h-full shrink-0" />
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Bottom Flowing Multi-Tone Ocean Wave Graphic Border */}
        <div
          className={
            inModal
              ? "w-[calc(100%+3rem)] sm:w-[calc(100%+5rem)] -mx-6 sm:-mx-10 mt-6 overflow-hidden leading-none pointer-events-none"
              : "w-[calc(100%+6rem)] -mx-12 mt-6 overflow-hidden leading-none pointer-events-none"
          }
        >
          <svg
            className="w-full h-20 sm:h-24 block"
            viewBox="0 0 484 57"
            preserveAspectRatio="none"
          >
            <path
              d="M0 26.7778C80 4.61481 112 43.9037 190 30.8074C260 16.7037 286 2.6 332 8.64444C375 16.7037 383 -12.5111 441 6.62963C463 14.6889 475 19.7259 484 21.7407V57H0V26.7778Z"
              fill="#EEF6FE"
            />
            <path
              d="M0 4.65804C57 -4.40114 102 26.8027 160 22.7764C223 20.7633 247 1.63831 305 17.7435C368 34.8553 412 50.9605 484 15.7304V57H0V4.65804Z"
              fill="#9CC8F1"
            />
            <path
              d="M0 4C73 -4 132 35 209 37C298 44 355 48 414 29C445 20 463 9 484 0V57H0V4Z"
              fill="#6CB0E7"
            />
            <path
              d="M0 27.0129C79 3.02321 143 28.0125 215 41.0069C295 56.0004 380 57.9996 484 27.0129V57H0V27.0129Z"
              fill="#13508B"
            />
            <path
              d="M0 25C76 26.0667 112 61.2667 194 47.4C268 35.6667 326 20.7333 378 36.7333C421 50.6 452 42.0667 484 30.3333V57H0V25Z"
              fill="#1970B9"
              opacity="0.85"
            />
          </svg>
        </div>
      </div>
    </div>
  );
}
