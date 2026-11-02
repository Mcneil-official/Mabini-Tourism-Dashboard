import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import {
  Users,
  Waves,
  CreditCard,
  TrendingUp,
  Building2,
  CalendarClock,
  MapPin,
  Sparkles,
  CheckCircle2,
  Clock,
  ArrowUpRight,
  ArrowDownRight,
  Download,
  Search,
  Eye,
  EyeOff,
  ChevronRight,
  SlidersHorizontal,
  X,
  ShieldCheck,
  Shield,
  Loader2,
  CalendarIcon,
  FileDown,
  UserCheck,
  ScrollText,
  Plus,
  BarChart3,
} from "lucide-react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  Line,
  ComposedChart,
  RadialBarChart,
  RadialBar,
} from "recharts";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Pagination, usePagination } from "@/components/ui/pagination";
import { ActionRequiredStrip } from "@/components/sections/ActionRequiredStrip";
import { LiveDiveActivity } from "@/components/sections/LiveDiveActivity";
import { DivePassOverview } from "@/components/sections/DivePassOverview";
import { Establishments } from "@/components/sections/Establishments";
import { InsightWidget } from "@/components/InsightWidget";
import { ChartEmptyState, isEmptyChartData } from "@/components/ChartEmptyState";
import {
  SectionCard,
  StatCard,
  DrilldownDialog,
  chartAxisProps,
  chartTooltipStyle,
  StatusBadge,
  Field,
  ActiveFilterBadges,
  Reveal,
} from "@/components/shared";
import { useFilters } from "@/hooks/useFilters";
import { usePermission } from "@/hooks/usePermission";
import { buildOverviewInsight } from "@/lib/insights";
import { toSiteView } from "@/lib/diveTaxonomy";
import {
  normalizeLevel,
  topWithOther,
  useMetrics,
  useTouristSample,
  aggregateDaily,
} from "@/lib/metrics";
import { type DateRange } from "@/lib/period";
import {
  useLiveMode,
  useTouristsLive,
  useDiveSitesLive,
  useManifestsLive,
  useOperatorApplicationsLive,
  useReceiptsLive,
  bucketByMonth,
} from "@/lib/queries";
import { type StaffSession } from "@/lib/staff-auth";
import {
  monthlyTrends,
  nationality,
  diveLevel,
  diveType,
  topSites,
  tourists,
  receipts,
  manifestos,
  operatorApps,
  CHART_COLORS,
  MONTHS,
} from "@/lib/mock-data";

export function OverviewPage({
  session,
  range,
}: {
  session?: StaffSession | null;
  range: DateRange;
}) {
  const { setFilters } = useFilters();
  const isLive = useLiveMode();
  const metrics = useMetrics("overview", range);
  const m = metrics.data;
  const ovError = isLive && metrics.isError;
  const ovReady = !isLive || !!m;
  const ovLive = isLive && !!m;
  const [drillMonth, setDrillMonth] = useState<any>(null);
  const [drillNationality, setDrillNationality] = useState<any>(null);
  const [drillSite, setDrillSite] = useState<any>(null);
  const [drillDiveType, setDrillDiveType] = useState<any>(null);
  const [drillLevel, setDrillLevel] = useState<any>(null);
  const [trendMetric, setTrendMetric] = useState<"tourists" | "dives">(
    "tourists",
  );

  // Demo-only row sets keep the drilldown tables populated when Supabase is
  // not configured. Live drilldowns come from to_tourist_sample below.
  const ovApps = isLive ? [] : operatorApps;
  const ovReceipts = isLive ? [] : receipts;
  const ovManifests = isLive ? [] : manifestos;
  const ovSites = useMemo(
    () =>
      m ? m.sites.map(toSiteView) : [],
    [m],
  );
  const ovSitesLive = !!m;

  const topNatNames = useMemo(() => {
    if (!ovLive)
      return nationality.filter((n) => n.name !== "Other").map((n) => n.name);
    return m
      ? topWithOther(m.nationality, 5)
          .filter((n) => n.name !== "Other")
          .map((n) => n.name)
      : [];
  }, [m, ovLive]);
  const sampleFilter = drillNationality
    ? {
        nationality:
          drillNationality.name === "Other" ? null : drillNationality.name,
        excludeNationalities:
          drillNationality.name === "Other" ? topNatNames : [],
      }
    : drillLevel
      ? { level: drillLevel.name as string }
      : {};
  const touristSample = useTouristSample(
    range,
    sampleFilter,
    ovLive && (!!drillNationality || !!drillLevel),
  );
  const ovTourists = ovLive ? (touristSample.data ?? []) : tourists;

  const todayDivers = ovLive ? (m?.todayDivers ?? 0) : (m?.todayDivers ?? 28);
  const yesterdayDivers = ovLive ? (m?.yesterdayDivers ?? 0) : (m?.yesterdayDivers ?? 24);
  const trendData = useMemo(() => {
    if (!m) {
      const start = new Date(`${range.from}T00:00:00Z`);
      const end = new Date(`${range.to}T00:00:00Z`);
      const months = new Set<string>();
      const cursor = new Date(start);
      cursor.setUTCDate(1);
      while (cursor <= end) {
        months.add(MONTHS[cursor.getUTCMonth()]);
        cursor.setUTCMonth(cursor.getUTCMonth() + 1);
      }
      return monthlyTrends.filter((d) => months.has(d.m));
    }
    return aggregateDaily(
      range,
      m.series,
      (row) => row.date,
      () => ({ m: "", tourists: 0, dives: 0, revenue: 0 }),
      (acc, row) => {
        acc.tourists += row.tourists;
        acc.dives += row.divers;
        acc.revenue += row.revenue;
      },
    ).map((row) => ({
      m: row.label,
      tourists: row.tourists,
      dives: row.dives,
      revenue: row.revenue,
    }));
  }, [m, range]);
  const monthRevenueOf = (label: string) => {
    const row = trendData.find((d) => d.m === label) as any;
    if (ovLive) return row?.revenue ?? 0;
    return (row?.dives ?? 0) * 120;
  };
  const demoRevenue = !ovLive
    ? monthRevenueOf(MONTHS[new Date().getUTCMonth()])
    : 0;

  const scaledNationality = useMemo(() => {
    if (!ovLive) return nationality;
    return m ? topWithOther(m.nationality, 5) : [];
  }, [m, ovLive]);
  const scaledDiveLevel = useMemo(() => {
    if (!ovLive) return diveLevel;
    const counts = new Map<string, number>();
    for (const row of m?.level ?? []) {
      const name = normalizeLevel(row.name) ?? "Other";
      counts.set(name, (counts.get(name) || 0) + row.count);
    }
    const total = [...counts.values()].reduce((a, c) => a + c, 0);
    if (total === 0) return [];
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([name, count]) => ({
        name,
        value: Math.round((count / total) * 100),
      }));
  }, [m, ovLive]);
  const scaledDiveType = useMemo(() => {
    if (!ovLive) return diveType;
    return m ? topWithOther(m.diveTypes, 5) : [];
  }, [m, ovLive]);
  const scaledTopSites = useMemo(() => {
    if (!ovLive) return topSites;
    return (m?.topSites ?? []).slice(0, 8).map((s) => ({
      name: s.name,
      value: s.divers,
    }));
  }, [m, ovLive]);
  const liveTotalDivers = useMemo(() => {
    if (m) return m.series.reduce((a, row) => a + row.divers, 0);
    return monthlyTrends.reduce((a, row) => a + row.dives, 0);
  }, [m]);

  // Facts for the floating insights widget (src/lib/insights.ts). Derived from
  // the same metrics payload feeding the StatCards so the prose can never
  // contradict the numbers beside it.
  const insightFacts = useMemo(() => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const topSiteRow = scaledTopSites[0];
    const matchingTypes = new Map<string, number>();
    if (ovLive) {
      for (const row of m?.diveTypes ?? [])
        matchingTypes.set(row.name, row.count);
    } else {
      for (const row of manifestos as any[]) {
        const t = row.diveType;
        if (t) matchingTypes.set(t, (matchingTypes.get(t) || 0) + 1);
      }
    }
    const topType = [...matchingTypes.entries()].sort(
      (a, b) => b[1] - a[1],
    )[0];
    const totalTyped = [...matchingTypes.values()].reduce((a, c) => a + c, 0);
    const demoPendingReceipts = receipts.filter(
      (r: any) => r.status === "Pending",
    ).length;
    const demoPendingApps = operatorApps.filter(
      (a: any) => a.status === "Pending",
    ).length;
    const demoExpiring = tourists.filter((t: any) => {
      if (t.status !== "Active" || !t.expires || t.expires === "\u2014")
        return false;
      const exp = new Date(t.expires + "T00:00:00");
      if (Number.isNaN(exp.getTime())) return false;
      const diff = (exp.getTime() - now.getTime()) / 86400000;
      return diff > 0 && diff <= 30;
    }).length;

    return {
      live: ovLive,
      tourists: ovLive ? (m?.tourists ?? 0) : 810,
      activeIds: ovLive ? (m?.activeIds ?? 0) : 358,
      touristDelta: ovLive
        ? (m?.tourists ?? 0) - (m?.touristsPrev ?? 0)
        : 47,
      todayDives: todayDivers,
      dayDelta: todayDivers - yesterdayDivers,
      monthRevenue: ovLive ? (m?.revenue ?? 0) : demoRevenue,
      revenueDelta: ovLive ? (m?.revenue ?? 0) - (m?.revenuePrev ?? 0) : 0,
      pendingReceipts: ovLive
        ? (m?.pendingReceipts ?? 0)
        : demoPendingReceipts,
      oldestPendingReceiptDays: ovLive
        ? (m?.oldestPendingReceiptDays ?? 0)
        : 0,
      pendingApplications: ovLive
        ? (m?.pendingApplications ?? 0)
        : demoPendingApps,
      oldestPendingAppDays: ovLive ? (m?.oldestPendingAppDays ?? 0) : 0,
      expiringPasses: ovLive ? (m?.expiringPasses ?? 0) : demoExpiring,
      topSite: topSiteRow?.name ?? null,
      topSiteShare:
        topSiteRow && liveTotalDivers > 0
          ? (topSiteRow.value / liveTotalDivers) * 100
          : 0,
      topDiveType: topType?.[0] ?? null,
      topDiveTypeShare:
        topType && totalTyped > 0 ? (topType[1] / totalTyped) * 100 : 0,
      activeSites: ovLive ? (m?.activeSites ?? 0) : 12,
      // Deterministic per-day variant rotation (no randomness -> reproducible).
      seed: now.getDate(),
    };
  }, [
    ovLive,
    m,
    todayDivers,
    yesterdayDivers,
    scaledTopSites,
    liveTotalDivers,
    demoRevenue,
  ]);

  const overviewInsight = useMemo(
    () => buildOverviewInsight(insightFacts),
    [insightFacts],
  );

  // In live mode, never paint benchmark numbers while queries are in flight.
  if (isLive && !ovReady) {
    return (
      <div className="space-y-6">
        <div className="h-32 rounded-2xl bg-secondary/70 animate-pulse" />
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <Card key={i} className="h-28 animate-pulse bg-secondary/60" />
          ))}
        </div>
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          <Card className="xl:col-span-2 h-80 animate-pulse bg-secondary/60" />
          <Card className="h-80 animate-pulse bg-secondary/60" />
        </div>
        {ovError && (
          <p className="text-sm text-destructive">
            Live data unavailable — check the Supabase connection and reload.
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <InsightWidget insight={overviewInsight} label="Overview" />
      {/* Hero banner */}
      <Reveal>
        <div className="relative overflow-hidden rounded-2xl gradient-primary text-primary-foreground p-6 md:p-8 shadow-glow">
          <div
            className="absolute inset-0 opacity-20"
            style={{
              backgroundImage:
                "radial-gradient(circle at 90% 10%, oklch(1 0 0 / 0.5), transparent 40%), radial-gradient(circle at 10% 90%, oklch(1 0 0 / 0.3), transparent 40%)",
            }}
          />
          <div className="relative flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <div className="text-sm text-primary-foreground/80">
                {(() => {
                  const h = new Date().getHours();
                  const part =
                    h < 12 ? "morning" : h < 18 ? "afternoon" : "evening";
                  const first =
                    session?.fullName?.trim().split(/\s+/)?.[0] ?? "Admin";
                  return `Good ${part}, ${first}`;
                })()}
              </div>
              <h2 className="mt-1 text-2xl md:text-3xl font-display font-bold">
                {ovLive ? (
                  <>
                    {todayDivers} divers on the water{" "}
                    <span className="underline decoration-white/40">today</span>
                  </>
                ) : (
                  <>
                    Today's dive activity is up{" "}
                    <span className="underline decoration-white/40">+18%</span>
                  </>
                )}
              </h2>
              <p className="mt-1 text-primary-foreground/80 max-w-xl">
                {(() => {
                  const pendingApps = ovLive
                    ? (m?.pendingApplications ?? 0)
                    : ovApps.filter((a: any) => a.status === "Pending").length;
                  const pendingReceipts = ovLive
                    ? (m?.pendingReceipts ?? 0)
                    : ovReceipts.filter((r: any) => r.status === "Pending")
                        .length;
                  return `${pendingApps} operator application${pendingApps !== 1 ? "s" : ""} and ${pendingReceipts} receipt${pendingReceipts !== 1 ? "s" : ""} are waiting on your review.`;
                })()}
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                variant="secondary"
                className="bg-white/15 hover:bg-white/25 text-primary-foreground border-0 backdrop-blur"
                onClick={() =>
                  setFilters({
                    section: "dive-ops",
                    tab: "manifestos",
                    q: "",
                    status: "All",
                    nationality: "All",
                    level: "All",
                    site: "All",
                    difficulty: "All",
                    siteType: "All",
                    dateFrom: "",
                    dateTo: "",
                  })
                }
              >
                <ScrollText className="size-4 mr-1.5" /> View manifestos
              </Button>
              <Button
                className="bg-white text-primary hover:bg-white/90"
                onClick={() =>
                  setFilters({
                    section: "announcements",
                    q: "",
                    status: "All",
                    nationality: "All",
                    level: "All",
                    site: "All",
                    difficulty: "All",
                    siteType: "All",
                    dateFrom: "",
                    dateTo: "",
                    tab: "",
                  })
                }
              >
                <Plus className="size-4 mr-1.5" /> New announcement
              </Button>
            </div>
          </div>
        </div>
      </Reveal>

      {/* Stats */}
      <Reveal>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {(() => {
            const tDelta =
              ovLive && m ? m.tourists - m.touristsPrev : undefined;
            const dayDiff = todayDivers - yesterdayDivers;
            const sample = !ovLive;
            const approvedCount =
              ovLive && m
                ? m.approvedOperators
                : operatorApps.filter((a: any) => a.status === "Approved")
                    .length;
            const cards = [
              {
                icon: Users,
                label: "Tourists",
                value: ovLive ? String(m?.tourists ?? 0) : "810",
                delta:
                  tDelta != null
                    ? `${tDelta >= 0 ? "+" : ""}${tDelta.toLocaleString()}`
                    : undefined,
                deltaLabel: "vs previous period",
                up: tDelta != null ? tDelta >= 0 : undefined,
                sample,
                info: "Total tourist profiles registered in the system within the selected date range vs the preceding equivalent duration.",
                target: {
                  section: "tourists",
                  q: "",
                  status: "All",
                  nationality: "All",
                  level: "All",
                  tab: "",
                },
              },
              {
                icon: UserCheck,
                label: "Active Users",
                value: ovLive ? String(m?.activeIds ?? 0) : "358",
                sample,
                info: "Tourists with at least one validated dive pass or recorded activity within the last 30 days.",
                target: { section: "tourists", status: "Active", q: "" },
              },
              {
                icon: Waves,
                label: "Divers Today",
                value: ovLive ? String(todayDivers) : "28",
                delta: ovLive
                  ? `${dayDiff >= 0 ? "+" : ""}${dayDiff}`
                  : undefined,
                deltaLabel: "vs yesterday",
                up: ovLive ? dayDiff >= 0 : undefined,
                sample,
                info: "Total divers recorded on boat manifests submitted and cleared for today's calendar date.",
                target: { section: "dive-ops", tab: "manifestos" },
              },
              {
                icon: Building2,
                label: "Approved Operators",
                value: String(approvedCount),
                sample,
                info: "Accredited dive resorts and boat operators holding active municipal permits.",
                target: { section: "establishments", tab: "registered" },
              },
              {
                icon: MapPin,
                label: "Active Sites",
                value: ovLive ? String(m?.activeSites ?? 0) : "12",
                sample: !ovSitesLive,
                info: "Marine sanctuaries and dive sites with at least one logged boat manifest in the selected period.",
                target: { section: "dive-ops", tab: "sites", q: "" },
              },
            ];
            return cards.map((s) => (
              <div
                key={s.label}
                role="button"
                tabIndex={0}
                aria-label={`View ${s.label}`}
                onClick={() => setFilters(s.target)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setFilters(s.target);
                  }
                }}
                className="text-left w-full h-full cursor-pointer rounded-xl focus-visible:outline-2 focus-visible:outline-primary"
              >
                <StatCard
                  icon={s.icon}
                  label={s.label}
                  value={s.value}
                  delta={s.delta}
                  deltaLabel={s.deltaLabel}
                  up={s.up}
                  sample={s.sample}
                  info={s.info}
                />
              </div>
            ));
          })()}
        </div>
      </Reveal>

      {/* Action Required Strip */}
      <ActionRequiredStrip
        receipts={ovReceipts}
        operatorApps={ovApps}
        manifestos={ovManifests}
        tourists={ovTourists}
        pendingApplications={ovLive ? m?.pendingApplications : undefined}
        pendingReceipts={ovLive ? m?.pendingReceipts : undefined}
        expiringPasses={ovLive ? (m?.expiringPasses ?? 0) : undefined}
        setFilters={setFilters}
      />

      {/* Charts row 1 */}
      <Reveal>
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          <SectionCard
            title="Monthly Trends"
            subtitle="Grouped by manifest record date"
            insight="overview.monthlyTrends"
            className="xl:col-span-2"
            action={
              <Tabs
                value={trendMetric}
                onValueChange={(v) =>
                  setTrendMetric(v === "dives" ? "dives" : "tourists")
                }
              >
                <TabsList className="bg-secondary">
                  <TabsTrigger value="tourists">Tourists</TabsTrigger>
                  <TabsTrigger value="dives">Divers</TabsTrigger>
                </TabsList>
              </Tabs>
            }
          >
            <div className="h-72">
              {isEmptyChartData(trendData) ? (
                <ChartEmptyState className="h-72" />
              ) : (
                <ResponsiveContainer>
                  <AreaChart
                    data={trendData}
                    margin={{ left: -12, right: 8, top: 8 }}
                    onClick={(e) =>
                      e?.activePayload?.[0]?.payload &&
                      setDrillMonth(e.activePayload[0].payload)
                    }
                  >
                    <defs>
                      <linearGradient id="areaP" x1="0" y1="0" x2="0" y2="1">
                        <stop
                          offset="0%"
                          stopColor="var(--color-primary)"
                          stopOpacity={0.35}
                        />
                        <stop
                          offset="100%"
                          stopColor="var(--color-primary)"
                          stopOpacity={0}
                        />
                      </linearGradient>
                      <linearGradient id="areaS" x1="0" y1="0" x2="0" y2="1">
                        <stop
                          offset="0%"
                          stopColor="var(--color-primary-glow)"
                          stopOpacity={0.25}
                        />
                        <stop
                          offset="100%"
                          stopColor="var(--color-primary-glow)"
                          stopOpacity={0}
                        />
                      </linearGradient>
                    </defs>
                    <CartesianGrid
                      stroke="var(--color-border)"
                      strokeDasharray="3 6"
                      vertical={false}
                    />
                    <XAxis
                      dataKey="m"
                      {...chartAxisProps}
                    />
                    <YAxis
                      {...chartAxisProps}
                    />
                    <Tooltip
                      contentStyle={chartTooltipStyle}
                    />
                    <Area
                      type="monotone"
                      dataKey={trendMetric}
                      stroke={
                        trendMetric === "tourists"
                          ? "var(--color-primary)"
                          : "var(--color-primary-glow)"
                      }
                      strokeWidth={2.5}
                      fill={
                        trendMetric === "tourists"
                          ? "url(#areaP)"
                          : "url(#areaS)"
                      }
                    />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>
          </SectionCard>

          <SectionCard title="Nationality Mix" insight="overview.nationalityMix">
            <div className="h-72">
              {isEmptyChartData(scaledNationality) ? (
                <ChartEmptyState className="h-72" />
              ) : (
                <ResponsiveContainer>
                  <PieChart>
                    <Pie
                      data={scaledNationality}
                      dataKey="value"
                      nameKey="name"
                      innerRadius={55}
                      outerRadius={90}
                      paddingAngle={2}
                      stroke="var(--color-card)"
                      strokeWidth={2}
                      onClick={(_, i) =>
                        setDrillNationality(scaledNationality[i])
                      }
                      className="cursor-pointer"
                    >
                      {scaledNationality.map((_, i) => (
                        <Cell
                          key={i}
                          fill={CHART_COLORS[i % CHART_COLORS.length]}
                        />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={chartTooltipStyle}
                    />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
            <div className="mt-2 grid grid-cols-2 gap-1.5">
              {scaledNationality.map((n, i) => (
                <div key={n.name} className="flex items-center gap-2 text-xs">
                  <span
                    className="size-2.5 rounded-sm"
                    style={{
                      background: CHART_COLORS[i % CHART_COLORS.length],
                    }}
                  />
                  <span className="text-muted-foreground">{n.name}</span>
                  <span className="ml-auto font-medium">{n.value}%</span>
                </div>
              ))}
            </div>
          </SectionCard>
        </div>
      </Reveal>

      {/* Charts row 2 */}
      <Reveal>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
          <SectionCard title="Dive Level" insight="overview.diveLevel">
            <div className="h-56">
              {isEmptyChartData(scaledDiveLevel) ? (
                <ChartEmptyState className="h-56" />
              ) : (
                <ResponsiveContainer>
                  <RadialBarChart
                    innerRadius="30%"
                    outerRadius="100%"
                    data={scaledDiveLevel}
                    startAngle={90}
                    endAngle={-270}
                  >
                    <RadialBar
                      dataKey="value"
                      background
                      cornerRadius={8}
                      onClick={(_, i) => setDrillLevel(scaledDiveLevel[i])}
                      className="cursor-pointer"
                    >
                      {scaledDiveLevel.map((_, i) => (
                        <Cell key={i} fill={CHART_COLORS[i]} />
                      ))}
                    </RadialBar>
                    <Tooltip
                      contentStyle={chartTooltipStyle}
                    />
                  </RadialBarChart>
                </ResponsiveContainer>
              )}
            </div>
            <div className="space-y-1.5 mt-1">
              {scaledDiveLevel.map((d, i) => (
                <div key={d.name} className="flex items-center gap-2 text-xs">
                  <span
                    className="size-2.5 rounded-sm"
                    style={{ background: CHART_COLORS[i] }}
                  />
                  <span className="text-muted-foreground">{d.name}</span>
                  <span className="ml-auto font-medium">{d.value}%</span>
                </div>
              ))}
            </div>
          </SectionCard>

          <SectionCard title="Dive Type" insight="overview.diveType">
            <div className="h-56">
              {isEmptyChartData(scaledDiveType) ? (
                <ChartEmptyState className="h-56" />
              ) : (
                <ResponsiveContainer>
                  <BarChart
                    data={scaledDiveType}
                    margin={{ left: -20, right: 8 }}
                  >
                    <CartesianGrid
                      stroke="var(--color-border)"
                      strokeDasharray="3 6"
                      vertical={false}
                    />
                    <XAxis
                      dataKey="name"
                      {...chartAxisProps}
                    />
                    <YAxis
                      {...chartAxisProps}
                    />
                    <Tooltip
                      contentStyle={chartTooltipStyle}
                    />
                    <Bar
                      dataKey="value"
                      fill="var(--color-primary)"
                      radius={[8, 8, 0, 0]}
                      onClick={(_, i) => setDrillDiveType(scaledDiveType[i])}
                      className="cursor-pointer"
                    />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </SectionCard>

          <SectionCard title="Top Dive Sites" insight="overview.topSites" className="xl:col-span-2">
            <div className="h-56">
              {isEmptyChartData(scaledTopSites) ? (
                <ChartEmptyState className="h-56" />
              ) : (
                <ResponsiveContainer>
                  <BarChart
                    data={scaledTopSites}
                    layout="vertical"
                    margin={{ left: 8, right: 8 }}
                  >
                    <CartesianGrid
                      stroke="var(--color-border)"
                      strokeDasharray="3 6"
                      horizontal={false}
                    />
                    <XAxis
                      type="number"
                      {...chartAxisProps}
                    />
                    <YAxis
                      dataKey="name"
                      type="category"
                      {...chartAxisProps}
                      width={100}
                    />
                    <Tooltip
                      contentStyle={chartTooltipStyle}
                    />
                    <Bar
                      dataKey="value"
                      radius={[0, 8, 8, 0]}
                      onClick={(_, i) => setDrillSite(scaledTopSites[i])}
                      className="cursor-pointer"
                    >
                      {scaledTopSites.map((_, i) => (
                        <Cell
                          key={i}
                          fill={CHART_COLORS[i % CHART_COLORS.length]}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </SectionCard>
        </div>
      </Reveal>

      {/* Drill-down dialogs */}
      <DrilldownDialog
        open={!!drillMonth}
        onOpenChange={(o) => !o && setDrillMonth(null)}
        title={`${drillMonth?.m ?? ""} Overview`}
        subtitle="Monthly tourism activity breakdown"
        stats={
          drillMonth
            ? [
                {
                  label: "Tourists",
                  value: drillMonth.tourists.toLocaleString(),
                  icon: Users,
                },
                {
                  label: "Divers logged",
                  value: drillMonth.dives.toLocaleString(),
                  icon: Waves,
                },
                {
                  label: "Divers per tourist",
                  value: (
                    drillMonth.dives / (drillMonth.tourists || 1)
                  ).toFixed(1),
                  icon: TrendingUp,
                },
              ]
            : undefined
        }
      >
        {drillMonth && (
          <Card className="p-4 shadow-elegant mt-2">
            <h4 className="font-display font-semibold text-sm mb-3">
              Monthly breakdown
            </h4>
            <Table>
              <TableHeader>
                <TableRow className="bg-secondary/50">
                  <TableHead>Metric</TableHead>
                  <TableHead className="text-right">Value</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow>
                  <TableCell className="text-muted-foreground">
                    Tourists registered
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {drillMonth.tourists.toLocaleString()}
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="text-muted-foreground">
                    Divers logged
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {drillMonth.dives.toLocaleString()}
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="text-muted-foreground">
                    Divers per tourist
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {(drillMonth.dives / (drillMonth.tourists || 1)).toFixed(1)}
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="text-muted-foreground">
                    {ovLive ? "Verified revenue" : "Estimated revenue (sample)"}
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    ₱{Math.round(monthRevenueOf(drillMonth.m)).toLocaleString()}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </Card>
        )}
      </DrilldownDialog>

      <DrilldownDialog
        open={!!drillNationality}
        onOpenChange={(o) => !o && setDrillNationality(null)}
        title={`${drillNationality?.name ?? ""} Tourists`}
        subtitle="Tourist breakdown by nationality"
        stats={
          drillNationality
            ? [
                {
                  label: "Share",
                  value: `${drillNationality.value}%`,
                  icon: Users,
                },
                {
                  label: "Est. count",
                  value: Math.round(
                    ((ovLive ? (m?.tourists ?? 0) : 810) *
                      drillNationality.value) /
                      100,
                  ).toLocaleString(),
                  icon: TrendingUp,
                },
              ]
            : undefined
        }
      >
        {drillNationality && (
          <Card className="p-4 shadow-elegant mt-2">
            <h4 className="font-display font-semibold text-sm mb-3">
              Top tourists from {drillNationality.name}
            </h4>
            <Table>
              <TableHeader>
                <TableRow className="bg-secondary/50">
                  <TableHead>Name</TableHead>
                  <TableHead>Level</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ovTourists
                  .filter((t: any) => {
                    const nat = t.nationality ?? "";
                    if (drillNationality.name === "Other") {
                      return !scaledNationality
                        .map((n) => n.name)
                        .includes(nat);
                    }
                    return nat === drillNationality.name;
                  })
                  .slice(0, 5)
                  .map((t: any) => (
                    <TableRow key={t.id}>
                      <TableCell className="font-medium">{t.name}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-[10px]">
                          {t.level ?? "—"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {t.status === "Active" ? (
                          <Badge className="bg-success/15 text-success border-success/20 text-[10px]">
                            Active
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-[10px]">
                            {t.status}
                          </Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                {ovTourists.filter((t: any) => {
                  const nat = t.nationality ?? "";
                  if (drillNationality.name === "Other") {
                    return !scaledNationality.map((n) => n.name).includes(nat);
                  }
                  return nat === drillNationality.name;
                }).length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={3}
                      className="text-center text-muted-foreground py-4"
                    >
                      No tourists in this group.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </Card>
        )}
      </DrilldownDialog>

      <DrilldownDialog
        open={!!drillSite}
        onOpenChange={(o) => !o && setDrillSite(null)}
        title={drillSite?.name ?? ""}
        subtitle="Dive site activity details"
        stats={
          drillSite
            ? [
                {
                  label: "Divers logged",
                  value: drillSite.value,
                  icon: Waves,
                },
                {
                  label: "Rank",
                  value: `#${scaledTopSites.indexOf(drillSite) + 1}`,
                  icon: TrendingUp,
                },
                {
                  label: "Share",
                  value: `${((drillSite.value / scaledTopSites.reduce((a, s) => a + s.value, 0)) * 100).toFixed(1)}%`,
                  icon: BarChart3,
                },
              ]
            : undefined
        }
      >
        {drillSite &&
          (() => {
            const site = ovSites.find((s) => s.name === drillSite.name);
            return site ? (
              <Card className="p-4 shadow-elegant mt-2">
                <h4 className="font-display font-semibold text-sm mb-3">
                  Site details
                </h4>
                <Table>
                  <TableHeader>
                    <TableRow className="bg-secondary/50">
                      <TableHead>Property</TableHead>
                      <TableHead>Value</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <TableRow>
                      <TableCell className="text-muted-foreground">
                        Barangay
                      </TableCell>
                      <TableCell className="font-medium">
                        {site.barangay}
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="text-muted-foreground">
                        Depth range
                      </TableCell>
                      <TableCell className="font-medium">
                        {site.depth}
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="text-muted-foreground">
                        Difficulty
                      </TableCell>
                      <TableCell className="font-medium">
                        {site.difficulty}
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="text-muted-foreground">
                        Type
                      </TableCell>
                      <TableCell className="font-medium">
                        {site.types?.length ? site.types.join(", ") : site.type}
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="text-muted-foreground">
                        Status
                      </TableCell>
                      <TableCell className="font-medium">
                        {site.status}
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="text-muted-foreground">
                        Description
                      </TableCell>
                      <TableCell className="text-sm">
                        {site.description}
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </Card>
            ) : (
              <Card className="p-4 shadow-elegant mt-2 text-center text-muted-foreground">
                Site data not found in registry.
              </Card>
            );
          })()}
      </DrilldownDialog>

      <DrilldownDialog
        open={!!drillDiveType}
        onOpenChange={(o) => !o && setDrillDiveType(null)}
        title={`${drillDiveType?.name ?? ""} Dives`}
        subtitle="Dive type breakdown"
        stats={
          drillDiveType
            ? [
                {
                  label: "Share",
                  value: `${drillDiveType.value}%`,
                  icon: Waves,
                },
                {
                  label: "Est. dives",
                  value: Math.round(
                    ((ovLive ? liveTotalDivers : 2140) * drillDiveType.value) /
                      100,
                  ).toLocaleString(),
                  icon: TrendingUp,
                },
              ]
            : undefined
        }
      >
        {drillDiveType && (
          <Card className="p-4 shadow-elegant mt-2">
            <h4 className="font-display font-semibold text-sm mb-3">
              Top sites for {drillDiveType.name} diving
            </h4>
            <Table>
              <TableHeader>
                <TableRow className="bg-secondary/50">
                  <TableHead>Site</TableHead>
                  <TableHead>Type match</TableHead>
                  <TableHead>Dives</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ovSites
                  .filter((s) => s.types.includes(drillDiveType.name))
                  .map((s) => (
                    <TableRow key={s.id}>
                      <TableCell className="font-medium">
                        <MapPin className="size-3.5 inline mr-1 text-primary" />
                        {s.name}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-[10px]">
                          {s.types.join(", ")}
                        </Badge>
                      </TableCell>
                      <TableCell>{s.dives}</TableCell>
                    </TableRow>
                  ))}
                {ovSites.filter((s) => s.types.includes(drillDiveType.name))
                  .length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={3}
                      className="text-center text-muted-foreground py-4"
                    >
                      No registered sites of this type.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </Card>
        )}
      </DrilldownDialog>

      <DrilldownDialog
        open={!!drillLevel}
        onOpenChange={(o) => !o && setDrillLevel(null)}
        title={`${drillLevel?.name ?? ""} Divers`}
        subtitle="Diver certification level breakdown"
        stats={
          drillLevel
            ? [
                {
                  label: "Share",
                  value: `${drillLevel.value}%`,
                  icon: ShieldCheck,
                },
                {
                  label: "Est. divers",
                  value: Math.round(
                    ((ovLive ? liveTotalDivers : 12480) * drillLevel.value) /
                      100,
                  ).toLocaleString(),
                  icon: Users,
                },
              ]
            : undefined
        }
      >
        {drillLevel && (
          <Card className="p-4 shadow-elegant mt-2">
            <h4 className="font-display font-semibold text-sm mb-3">
              Sample {drillLevel.name} divers
            </h4>
            <Table>
              <TableHeader>
                <TableRow className="bg-secondary/50">
                  <TableHead>Name</TableHead>
                  <TableHead>Nationality</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ovTourists
                  .filter((t: any) => (t.level ?? "") === drillLevel.name)
                  .map((t: any) => (
                    <TableRow key={t.id}>
                      <TableCell className="font-medium">{t.name}</TableCell>
                      <TableCell>{t.nationality ?? "—"}</TableCell>
                      <TableCell>
                        {t.status === "Active" ? (
                          <Badge className="bg-success/15 text-success border-success/20 text-[10px]">
                            Active
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-[10px]">
                            {t.status}
                          </Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          </Card>
        )}
      </DrilldownDialog>
    </div>
  );
}

