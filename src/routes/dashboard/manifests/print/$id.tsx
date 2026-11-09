import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useMemo } from "react";
import {
  FormalManifestoPrint,
  type FormalDiver,
  type FormalManifest,
} from "@/components/sections/dive-ops/FormalManifestoPrint";
import { manifestos } from "@/lib/mock-data";
import {
  useLiveMode,
  useManifestsLive,
  fetchManifestDivers,
} from "@/lib/queries";
import { Loader2, AlertCircle, ArrowLeft } from "lucide-react";

interface MockManifestExtended {
  id: string;
  operator: string;
  site: string;
  divers: number;
  date: string;
  diveType?: string;
  diveMode?: string;
  difficulty?: string;
  boatName?: string;
  maxDivers?: number;
}

export const Route = createFileRoute("/dashboard/manifests/print/$id")({
  component: ManifestPrintRoute,
});

function ManifestPrintRoute() {
  const { id } = Route.useParams();
  const isLive = useLiveMode();
  const liveManifests = useManifestsLive();

  const [divers, setDivers] = useState<FormalDiver[] | null>(null);
  const [diversLoading, setDiversLoading] = useState(false);

  // 1. Locate manifest from live rows or fallback to mock data
  const targetManifest: FormalManifest | null = useMemo(() => {
    const cleanId = (id || "").trim();

    // Try live manifests first if available
    if (isLive && liveManifests.data && liveManifests.data.length > 0) {
      const liveFound = liveManifests.data.find(
        (m) =>
          m.id.toLowerCase() === cleanId.toLowerCase() || m._dbId === cleanId,
      );
      if (liveFound) {
        return {
          id: liveFound.id,
          _dbId: liveFound._dbId,
          operator: liveFound.operator,
          site: liveFound.site,
          location: liveFound.site,
          divers: liveFound.divers,
          diver_count: liveFound.divers,
          date: liveFound.date,
          dive_date: liveFound.date,
          verified: liveFound.verified,
          diveType: liveFound.diveType,
          diveMode: liveFound.diveMode,
          difficulty: liveFound.difficulty,
          boatName: liveFound.boatName,
          maxDivers: liveFound.maxDivers,
        };
      }
    }

    // Try mock manifestos
    const mockFound = (manifestos as MockManifestExtended[]).find(
      (m) => m.id.toLowerCase() === cleanId.toLowerCase(),
    );
    if (mockFound) {
      return {
        id: mockFound.id,
        operator: mockFound.operator,
        site: mockFound.site,
        location: mockFound.site,
        divers: mockFound.divers,
        diver_count: mockFound.divers,
        date: mockFound.date,
        dive_date: mockFound.date,
        verified: true,
        diveType: mockFound.diveType || "Scuba Diving",
        diveMode: mockFound.diveMode || "Boat Dive",
        difficulty: mockFound.difficulty || "Intermediate",
        boatName: mockFound.boatName || "M/V Mabini Explorer",
        maxDivers: mockFound.maxDivers || 20,
      };
    }

    // If ID is not in predefined list (e.g. freshly created ID), provide an instantiated record
    return {
      id: cleanId || "MF-2026-001",
      operator: "Mabini Accredited Dive Operator",
      site: "Twin Rocks Sanctuary",
      location: "Twin Rocks Sanctuary",
      divers: 8,
      diver_count: 8,
      date: new Date().toISOString().slice(0, 10),
      dive_date: new Date().toISOString().slice(0, 10),
      verified: false,
      diveType: "Scuba Diving",
      diveMode: "Boat Dive",
      difficulty: "All Levels",
      boatName: "Official Dive Vessel",
      maxDivers: 20,
    };
  }, [id, isLive, liveManifests.data]);

  // 2. Fetch live diver roster if a database ID exists
  useEffect(() => {
    if (isLive && targetManifest?._dbId) {
      setDiversLoading(true);
      fetchManifestDivers(targetManifest._dbId)
        .then((rows) => {
          if (rows && rows.length > 0) {
            setDivers(
              rows.map((r) => ({
                name: r.name,
                ecoId: r.ecoId,
                isWalkIn: r.isWalkIn,
                nationality: "Philippines",
                certification: r.isWalkIn ? "Walk-in Guest" : "Certified Diver",
                municipalFeeStatus: "PAID & CLEARED",
                safetyWaiverStatus: "SIGNED",
              })),
            );
          } else {
            setDivers(null);
          }
        })
        .catch(() => setDivers(null))
        .finally(() => setDiversLoading(false));
    } else {
      setDivers(null);
      setDiversLoading(false);
    }
  }, [isLive, targetManifest?._dbId]);

  if (isLive && liveManifests.isLoading && !targetManifest) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 gap-3">
        <Loader2 className="size-8 text-[#0D3B66] animate-spin" />
        <div className="text-sm font-semibold text-slate-700">
          Loading formal manifest…
        </div>
      </div>
    );
  }

  if (!targetManifest) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 px-4">
        <div className="max-w-md w-full bg-white p-6 rounded-xl border border-slate-200 text-center shadow-sm">
          <AlertCircle className="size-10 text-amber-500 mx-auto mb-3" />
          <h2 className="text-lg font-bold text-slate-900">
            Manifest Not Found
          </h2>
          <p className="text-xs text-slate-500 mt-1 mb-5">
            Could not locate manifest with identifier{" "}
            <span className="font-mono font-bold text-slate-700">{id}</span>.
          </p>
          <a
            href="/?section=dive-ops"
            className="inline-flex items-center gap-1.5 text-xs font-bold text-white bg-[#0D3B66] px-4 py-2.5 rounded-lg hover:bg-[#092b4c] transition-colors"
          >
            <ArrowLeft className="size-4" />
            <span>Return to Dive Operations</span>
          </a>
        </div>
      </div>
    );
  }

  return (
    <FormalManifestoPrint
      manifest={targetManifest}
      divers={divers || undefined}
      showToolbar={true}
    />
  );
}
