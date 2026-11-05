import { useEffect, useState } from "react";
import { Building2 } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { useFilters } from "@/hooks/useFilters";
import { usePermission } from "@/hooks/usePermission";
import { OperatorMgmt } from "./operators/OperatorMgmt";
import { Establishments } from "@/components/sections/Establishments";
import { Reveal, StatCard } from "@/components/shared";
import {
  useLiveMode,
  useOperatorApplicationsLive,
  useEstablishmentsLive,
  bucketByMonth,
} from "@/lib/queries";

export function EstablishmentsPage() {
  const { search, setFilters } = useFilters();
  const { canAct } = usePermission();
  // RBAC: Operator Applications is accessible to TO Staff and Super Admin to verify
  // permits, PCSSD accreditations, and DOT accreditations.
  const canViewApplications = canAct;
  // The registry is the landing view; Operator Applications is entered from
  // the stat card / tab. Only these two values are top-level now that the
  // sub-tabs (Applications / Active Operators) live on the same row.
  const rawTab = search.tab || "registered";
  const outerTab = !canViewApplications
    ? "registered"
    : rawTab === "registered"
      ? "registered"
      : "applications";
  // Sub-tab is view state, not URL-persisted (the shared `tab` param can't
  // hold both levels). Seed from a stale `?tab=active` link for back-compat.
  const [subTab, setSubTab] = useState<"applications" | "active">(() =>
    search.tab === "active" ? "active" : "applications"
  );

  // Correct direct URL access (?tab=applications / ?tab=active) for reviewers.
  useEffect(() => {
    if (!canViewApplications && rawTab !== "registered") {
      setFilters({ tab: "registered" });
    }
  }, [canViewApplications, rawTab, setFilters]);

  // Live application + registry counts (React Query cache — no extra fetch).
  const isLive = useLiveMode();
  const liveApps = useOperatorApplicationsLive();
  const liveEst = useEstablishmentsLive();
  const apps = liveApps.data;
  const isLiveData = isLive && !!apps;
  const regCountLive = isLive && !!liveEst.data;
  const regCount = liveEst.data ? liveEst.data.length : 0;
  const pendingCount = apps
    ? apps.filter((a) => a.status === "Pending").length
    : 0;
  const approvedCount = apps
    ? apps.filter((a) => a.status === "Approved").length
    : 0;
  const buckets = apps ? bucketByMonth(apps, (a) => a.submitted) : [];
  const cur = new Date().getMonth();
  const prev = (cur + 11) % 12;
  const monthDiff = buckets.length
    ? buckets[cur].count - buckets[prev].count
    : 0;
  const regBuckets = liveEst.data
    ? bucketByMonth(liveEst.data, (e) => e.createdAt)
    : [];
  const regDiff = regBuckets.length
    ? regBuckets[cur].count - regBuckets[prev].count
    : 0;

  return (
    <div className="space-y-4">
      <Reveal>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <button
            type="button"
            onClick={() => setFilters({ tab: "registered" })}
            className="text-left w-full h-full"
          >
            <StatCard
              icon={Building2}
              label="Registered Establishments"
              value={
                isLive && liveEst.isPending
                  ? "—"
                  : regCountLive
                    ? String(regCount)
                    : "12"
              }
              delta={
                isLive && liveEst.isPending
                  ? ""
                  : regCountLive
                    ? `${regDiff >= 0 ? "+" : ""}${regDiff}`
                    : "+1"
              }
              up={regCountLive ? regDiff >= 0 : true}
            />
          </button>
          {canViewApplications && (
            <>
              <button
                type="button"
                onClick={() => {
                  setFilters({ tab: "applications" });
                  setSubTab("applications");
                }}
                className="text-left w-full h-full"
              >
                <StatCard
                  icon={Building2}
                  label="Pending Applications"
                  value={
                    isLive && liveApps.isPending
                      ? "—"
                      : isLiveData
                        ? String(pendingCount)
                        : "5"
                  }
                  delta={
                    isLive && liveApps.isPending
                      ? ""
                      : isLiveData
                        ? `${monthDiff >= 0 ? "+" : ""}${monthDiff}`
                        : "+2"
                  }
                  up={isLiveData ? monthDiff >= 0 : true}
                />
              </button>
              <button
                type="button"
                onClick={() => {
                  setFilters({ tab: "applications" });
                  setSubTab("active");
                }}
                className="text-left w-full h-full"
              >
                <StatCard
                  icon={Building2}
                  label="Active Operators"
                  value={
                    isLive && liveApps.isPending
                      ? "—"
                      : isLiveData
                        ? String(approvedCount)
                        : "8"
                  }
                  delta=""
                />
              </button>
            </>
          )}
        </div>
      </Reveal>
      <Tabs value={outerTab} onValueChange={(v) => setFilters({ tab: v })}>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <TabsList className="bg-secondary">
            <TabsTrigger value="registered">
              Registered Establishments
            </TabsTrigger>
            {canViewApplications && (
              <TabsTrigger value="applications">
                Operator Applications
              </TabsTrigger>
            )}
          </TabsList>
          {outerTab === "applications" && canViewApplications && (
            <Tabs
              value={subTab}
              onValueChange={(v) => setSubTab(v as "applications" | "active")}
            >
              <TabsList className="bg-secondary">
                <TabsTrigger value="applications">
                  Applications
                  {pendingCount > 0 && (
                    <Badge className="ml-2 h-5 px-1.5 bg-primary text-primary-foreground">
                      {pendingCount}
                    </Badge>
                  )}
                </TabsTrigger>
                <TabsTrigger value="active">Active Operators</TabsTrigger>
              </TabsList>
            </Tabs>
          )}
        </div>
        {canViewApplications && (
          <TabsContent value="applications" className="mt-4">
            <OperatorMgmt subTab={subTab} />
          </TabsContent>
        )}
        <TabsContent value="registered" className="mt-4">
          <Establishments />
        </TabsContent>
      </Tabs>
    </div>
  );
}
