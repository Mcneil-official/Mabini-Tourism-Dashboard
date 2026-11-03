import { useState, useMemo } from "react";
import { Users, Globe, Award, TrendingUp, Compass, CalendarClock, Bot, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  SectionCard,
  StatCard,
  Reveal,
  DrilldownDialog,
  chartAxisProps,
  chartTooltipStyle,
} from "@/components/shared";
import { AnalyticsState } from "@/components/AnalyticsState";
import {
  ChartEmptyState,
  isEmptyChartData,
} from "@/components/ChartEmptyState";
import { useLiveMode } from "@/lib/queries";
import { InsightWidget } from "@/components/InsightWidget";
import { buildTouristInsight } from "@/lib/insights";
import { aggregateDaily, normalizeLevel, useMetrics, useTouristPreferences, mockTouristPreferences } from "@/lib/metrics";
import type { DateRange } from "@/lib/period";
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  AreaChart,
  Area,
} from "recharts";

const nationality = [
  { name: "USA", value: 30 },
  { name: "Germany", value: 21 },
  { name: "Japan", value: 18 },
  { name: "UK", value: 13 },
  { name: "Mexico", value: 9 },
  { name: "Other", value: 9 },
];

const diveLevel = [
  { name: "Intro", value: 8 },
  { name: "Open Water", value: 40 },
  { name: "Advanced", value: 26 },
  { name: "Rescue", value: 12 },
  { name: "Divemaster", value: 8 },
  { name: "Instructor", value: 6 },
];

const monthlyRegistrations = [
  { m: "Jan", count: 32 },
  { m: "Feb", count: 28 },
  { m: "Mar", count: 41 },
  { m: "Apr", count: 55 },
  { m: "May", count: 67 },
  { m: "Jun", count: 84 },
  { m: "Jul", count: 112 },
  { m: "Aug", count: 98 },
  { m: "Sep", count: 73 },
  { m: "Oct", count: 51 },
  { m: "Nov", count: 39 },
  { m: "Dec", count: 35 },
];

const nationalityByLevel = [
  {
    nationality: "Philippines",
    domestic: true,
    intro: 20,
    openWater: 110,
    advanced: 55,
    rescue: 20,
    divemaster: 10,
    instructor: 5,
    unknown: 3,
  },
  {
    nationality: "USA",
    domestic: false,
    openWater: 145,
    advanced: 98,
    rescue: 42,
    divemaster: 31,
    instructor: 18,
  },
  {
    nationality: "Germany",
    domestic: false,
    openWater: 78,
    advanced: 62,
    rescue: 25,
    divemaster: 19,
    instructor: 10,
  },
  {
    nationality: "Japan",
    domestic: false,
    openWater: 88,
    advanced: 54,
    rescue: 20,
    divemaster: 14,
    instructor: 8,
  },
  {
    nationality: "UK",
    domestic: false,
    openWater: 56,
    advanced: 38,
    rescue: 18,
    divemaster: 12,
    instructor: 7,
  },
  {
    nationality: "Mexico",
    domestic: false,
    openWater: 42,
    advanced: 28,
    rescue: 14,
    divemaster: 9,
    instructor: 5,
  },
  {
    nationality: "Unknown",
    domestic: false,
    intro: 4,
    openWater: 14,
    advanced: 6,
    rescue: 2,
    divemaster: 1,
    instructor: 0,
    unknown: 8,
  },
  {
    nationality: "Other",
    domestic: false,
    openWater: 30,
    advanced: 18,
    rescue: 8,
    divemaster: 5,
    instructor: 3,
  },
];

type NationalityGroup = "Filipino" | "Foreign" | "Unknown";

const isUnknownNationality = (name: string | null | undefined) => {
  const value = String(name ?? "").trim();
  return value === "" || value.toLowerCase() === "unknown";
};

const nationalityGroup = (
  name: string,
  domestic: boolean,
): NationalityGroup =>
  isUnknownNationality(name) ? "Unknown" : domestic ? "Filipino" : "Foreign";

const nationalityGroups = (() => {
  const counts: Record<NationalityGroup, number> = {
    Filipino: 0,
    Foreign: 0,
    Unknown: 0,
  };
  for (const row of nationalityByLevel) {
    const total =
      (row.intro ?? 0) +
      row.openWater +
      row.advanced +
      row.rescue +
      row.divemaster +
      row.instructor +
      (row.unknown ?? 0);
    counts[nationalityGroup(row.nationality, row.domestic)] += total;
  }
  const total = counts.Filipino + counts.Foreign + counts.Unknown;
  return (["Filipino", "Foreign", "Unknown"] as const).map((name) => ({
    name,
    value: total > 0 ? Math.round((counts[name] / total) * 100) : 0,
    count: counts[name],
  }));
})();

const topTourists = [
  { name: "Emma Larsen", nationality: "USA", dives: 187, level: "Instructor" },
  {
    name: "Kenji Watanabe",
    nationality: "Japan",
    dives: 164,
    level: "Divemaster",
  },
  { name: "Marco Rossi", nationality: "Germany", dives: 142, level: "Rescue" },
  {
    name: "Viktor Petrov",
    nationality: "Germany",
    dives: 128,
    level: "Advanced",
  },
  { name: "Olivia Chen", nationality: "USA", dives: 115, level: "Advanced" },
  { name: "Nadia Al-Rashid", nationality: "UK", dives: 103, level: "Rescue" },
  { name: "David Kim", nationality: "USA", dives: 96, level: "Advanced" },
  {
    name: "Diego Alvarez",
    nationality: "Mexico",
    dives: 88,
    level: "Open Water",
  },
];

const CHART_COLORS = [
  "var(--color-chart-1)",
  "var(--color-chart-2)",
  "var(--color-chart-3)",
  "var(--color-chart-4)",
  "var(--color-chart-5)",
  "oklch(0.85 0.05 250)",
];

const LEVEL_ORDER = [
  "Intro",
  "Open Water",
  "Advanced",
  "Rescue",
  "Divemaster",
  "Instructor",
] as const;

type MarketFilter = "all" | "domestic" | "international";

type NatDatum = { name: string; value: number; count?: number };

type LevelKey =
  | "intro"
  | "openWater"
  | "advanced"
  | "rescue"
  | "divemaster"
  | "instructor"
  | "unknown";

type NatLevelRow = {
  nationality: string;
  domestic: boolean;
  intro?: number;
  openWater: number;
  advanced: number;
  rescue: number;
  divemaster: number;
  instructor: number;
  unknown?: number;
};

const emptyNatLevelRow = (
  nationality: string,
  domestic: boolean,
): NatLevelRow => ({
  nationality,
  domestic,
  intro: 0,
  openWater: 0,
  advanced: 0,
  rescue: 0,
  divemaster: 0,
  instructor: 0,
  unknown: 0,
});

const LEVEL_KEY: Record<string, LevelKey> = {
  Intro: "intro",
  "Open Water": "openWater",
  Advanced: "advanced",
  Rescue: "rescue",
  Divemaster: "divemaster",
  Instructor: "instructor",
  Unknown: "unknown",
};

const marketDomestic = (market: MarketFilter, domestic: boolean) =>
  market === "all" || (market === "domestic" ? domestic : !domestic);

const signed = (value: number) => (value > 0 ? `+${value}` : String(value));

export function TouristAnalytics({ range }: { range: DateRange }) {
  const [natDrilldown, setNatDrilldown] = useState<string | null>(null);
  const [levelDrilldown, setLevelDrilldown] = useState<string | null>(null);
  const [marketFilter, setMarketFilter] = useState<MarketFilter>("all");
  const [viewSection, setViewSection] = useState<"all" | "preferences" | "demographics">("all");

  const isLive = useLiveMode();
  const isDemo = !isLive;
  const metrics = useMetrics("tourist", range);
  const m = metrics.data;

  const prefQuery = useTouristPreferences(range);
  const prefs = prefQuery.data ?? mockTouristPreferences;
  const plansDelta = prefs.totalPlans - prefs.totalPlansPrev;
  const plansDeltaPct =
    prefs.totalPlansPrev > 0
      ? Math.round((plansDelta / prefs.totalPlansPrev) * 100)
      : 0;

  const filteredNationalities = useMemo(
    () =>
      (m?.nationalities ?? []).filter((row) =>
        marketDomestic(marketFilter, row.domestic),
      ),
    [m, marketFilter],
  );

  const filteredLevels = useMemo(() => {
    const counts = new Map<string, number>();
    for (const row of m?.levels ?? []) {
      if (!marketDomestic(marketFilter, row.domestic)) continue;
      const name = normalizeLevel(row.name) ?? "Unknown";
      counts.set(name, (counts.get(name) ?? 0) + row.count);
    }
    return [...counts.entries()]
      .sort(
        (a, b) =>
          LEVEL_ORDER.indexOf(a[0] as (typeof LEVEL_ORDER)[number]) -
          LEVEL_ORDER.indexOf(b[0] as (typeof LEVEL_ORDER)[number]),
      )
      .map(([name, count]) => ({ name, count }));
  }, [m, marketFilter]);

  const nationalityData = useMemo<NatDatum[]>(() => {
    if (!m) {
      if (!isDemo) return [];
      const rows = nationalityGroups.filter(
        (row) =>
          row.name === "Unknown" ||
          marketFilter === "all" ||
          (marketFilter === "domestic"
            ? row.name === "Filipino"
            : row.name === "Foreign"),
      );
      const total = rows.reduce((sum, row) => sum + row.count, 0);
      return rows.map((row) => ({
        ...row,
        value: total > 0 ? Math.round((row.count / total) * 100) : 0,
      }));
    }
    const counts: Record<NationalityGroup, number> = {
      Filipino: 0,
      Foreign: 0,
      Unknown: 0,
    };
    for (const row of m.nationalities) {
      if (
        !isUnknownNationality(row.name) &&
        !marketDomestic(marketFilter, row.domestic)
      ) {
        continue;
      }
      counts[nationalityGroup(row.name, row.domestic)] += row.count;
    }
    const total = counts.Filipino + counts.Foreign + counts.Unknown;
    return (["Filipino", "Foreign", "Unknown"] as const)
      .filter((name) => counts[name] > 0)
      .map((name) => ({
        name,
        value: total > 0 ? Math.round((counts[name] / total) * 100) : 0,
        count: counts[name],
      }));
  }, [m, isDemo, marketFilter]);

  const levelData = useMemo<NatDatum[]>(() => {
    if (!m) return isDemo ? diveLevel : [];
    const total = filteredLevels.reduce((sum, row) => sum + row.count, 0) || 1;
    return filteredLevels.map((row) => ({
      name: row.name,
      value: Math.round((row.count / total) * 100),
      count: row.count,
    }));
  }, [m, isDemo, filteredLevels]);

  const monthlyData = useMemo(() => {
    if (!m) return isDemo ? monthlyRegistrations : [];
    return aggregateDaily(
      range,
      m.daily,
      (row) => row.date,
      () => ({ count: 0 }),
      (acc, row) => {
        acc.count +=
          marketFilter === "all"
            ? row.all
            : marketFilter === "domestic"
              ? row.domestic
              : row.international;
      },
    ).map((bucket) => ({ m: bucket.label, count: bucket.count }));
  }, [m, isDemo, marketFilter, range]);

  const natByLevelData = useMemo<NatLevelRow[]>(() => {
    if (!m) return isDemo ? nationalityByLevel : [];
    const rows = new Map<string, NatLevelRow>();
    for (const item of m.nationalityLevels) {
      if (
        !isUnknownNationality(item.nationality) &&
        !marketDomestic(marketFilter, item.domestic)
      ) {
        continue;
      }
      const key = LEVEL_KEY[normalizeLevel(item.level) ?? "Unknown"];
      if (!key) continue;
      const row =
        rows.get(item.nationality) ??
        emptyNatLevelRow(item.nationality, item.domestic);
      row[key] = (row[key] ?? 0) + item.count;
      rows.set(item.nationality, row);
    }
    const sum = (row: NatLevelRow) =>
      (row.intro ?? 0) +
      row.openWater +
      row.advanced +
      row.rescue +
      row.divemaster +
      row.instructor +
      (row.unknown ?? 0);
    return [...rows.values()].sort((a, b) => sum(b) - sum(a));
  }, [m, isDemo, marketFilter]);

  const nationalities = useMemo(
    () =>
      m
        ? filteredNationalities.filter((row) => row.name !== "Unknown").length
        : isDemo
          ? nationality.length
          : 0,
    [m, isDemo, filteredNationalities],
  );

  const topLevel = m
    ? [...filteredLevels].sort((a, b) => b.count - a.count)[0]?.name ?? "Unknown"
    : "Open Water";

  const total = m
    ? marketFilter === "all"
      ? m.totals.all
      : marketFilter === "domestic"
        ? m.totals.domestic
        : m.totals.international
    : (nationalityByLevel as NatLevelRow[]).reduce(
        (sum, row) =>
          sum +
          (row.intro ?? 0) +
          row.openWater +
          row.advanced +
          row.rescue +
          row.divemaster +
          row.instructor,
        0,
      );
  const prevTotal = m
    ? marketFilter === "all"
      ? m.totals.prevAll
      : marketFilter === "domestic"
        ? m.totals.prevDomestic
        : m.totals.prevInternational
    : 0;
  const totalDelta = total - prevTotal;
  const avgDivers =
    m && m.total > 0 ? Math.round(m.divers / m.total) : isDemo ? 2 : 0;

  const filteredNatCounts = useMemo(() => {
    if (m) {
      return filteredNationalities.map((row) => ({
        name: row.name,
        count: row.count,
      }));
    }
    return nationality
      .filter((row) => row.name !== "Other")
      .map((row) => ({ name: row.name, count: row.value }));
  }, [m, filteredNationalities]);

  const topNationality = [...filteredNatCounts].sort(
    (a, b) => b.count - a.count,
  )[0];
  const natCountTotal = filteredNatCounts.reduce(
    (sum, row) => sum + row.count,
    0,
  );
  const levelCountTotal = filteredLevels.reduce(
    (sum, row) => sum + row.count,
    0,
  );
  const topLevelCount =
    [...filteredLevels].sort((a, b) => b.count - a.count)[0]?.count ?? 0;

  const touristInsight = useMemo(
    () =>
      buildTouristInsight({
        live: isLive,
        tourists: total,
        registrationsDelta: m ? totalDelta : 0,
        nationalities,
        topNationality: topNationality?.name ?? null,
        topNationalityShare:
          topNationality && natCountTotal > 0
            ? (topNationality.count / natCountTotal) * 100
            : 0,
        topLevel,
        topLevelShare:
          levelCountTotal > 0 ? (topLevelCount / levelCountTotal) * 100 : 0,
        expiringPasses: 0,
        pendingApplications: 0,
        seed: new Date().getDate(),
      }),
    [
      isLive,
      total,
      m,
      totalDelta,
      nationalities,
      topNationality,
      natCountTotal,
      topLevel,
      levelCountTotal,
      topLevelCount,
    ],
  );

  const filteredTopTourists = useMemo(() => {
    if (marketFilter === "all") return topTourists;
    const domestic = new Set(["Philippines"]);
    return topTourists.filter((tourist) =>
      marketFilter === "domestic"
        ? domestic.has(tourist.nationality)
        : !domestic.has(tourist.nationality),
    );
  }, [marketFilter]);

  const selectedNatPieRow = natDrilldown
    ? nationalityData.find((row) => row.name === natDrilldown)
    : null;
  const selectedNat = useMemo<NatLevelRow | null>(() => {
    if (!natDrilldown) return null;
    const rows = natByLevelData.filter(
      (row) =>
        nationalityGroup(row.nationality, row.domestic) === natDrilldown,
    );
    if (rows.length === 0) return null;
    return rows.reduce<NatLevelRow>(
      (acc, row) => ({
        ...acc,
        intro: (acc.intro ?? 0) + (row.intro ?? 0),
        openWater: acc.openWater + row.openWater,
        advanced: acc.advanced + row.advanced,
        rescue: acc.rescue + row.rescue,
        divemaster: acc.divemaster + row.divemaster,
        instructor: acc.instructor + row.instructor,
        unknown: (acc.unknown ?? 0) + (row.unknown ?? 0),
      }),
      emptyNatLevelRow(natDrilldown, natDrilldown === "Filipino"),
    );
  }, [natDrilldown, natByLevelData]);

  const selectedLevel = levelDrilldown
    ? natByLevelData.map((row) => {
        const key = LEVEL_KEY[normalizeLevel(levelDrilldown) ?? levelDrilldown];
        return {
          nationality: row.nationality,
          count: key ? (row as unknown as Record<LevelKey, number>)[key] ?? 0 : 0,
        };
      })
    : [];
  const levelTotal = selectedLevel.reduce((sum, row) => sum + row.count, 0);

  return (
    <AnalyticsState isLive={isLive} label="tourist" state={metrics}>
      <div className="space-y-6">
        <InsightWidget insight={touristInsight} label="Tourists" />

        {/* View switcher & Filters */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-1 bg-secondary/80 rounded-lg p-1 border border-border/50">
            <button
              onClick={() => setViewSection("all")}
              className={`px-3 py-1.5 text-xs rounded-md transition-all font-medium ${
                viewSection === "all"
                  ? "bg-background shadow-sm text-foreground font-semibold"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              All Analytics
            </button>
            <button
              onClick={() => setViewSection("preferences")}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md transition-all font-medium ${
                viewSection === "preferences"
                  ? "bg-background shadow-sm text-foreground font-semibold"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Bot className="size-3.5 text-primary" />
              AI Trip Preferences
              <Badge variant="secondary" className="text-[10px] py-0 px-1.5 h-4 ml-0.5 bg-primary/10 text-primary border-none">
                Sinsay
              </Badge>
            </button>
            <button
              onClick={() => setViewSection("demographics")}
              className={`px-3 py-1.5 text-xs rounded-md transition-all font-medium ${
                viewSection === "demographics"
                  ? "bg-background shadow-sm text-foreground font-semibold"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Demographics & Levels
            </button>
          </div>

          {viewSection !== "preferences" && (
            <div className="flex items-center gap-1 bg-secondary/60 rounded-lg p-0.5 w-fit">
              {(
                [
                  ["all", "All Tourists"],
                  ["domestic", "Domestic (PH)"],
                  ["international", "International"],
                ] as const
              ).map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => setMarketFilter(key)}
                  className={`px-3 py-1.5 text-xs rounded-md transition-all font-medium ${
                    marketFilter === key
                      ? "bg-background shadow-sm text-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* SECTION 1: AI TRIP PREFERENCES (SINSAY PLANNER) */}
        {(viewSection === "all" || viewSection === "preferences") && (
          <div className="space-y-6">
            {viewSection === "all" && (
              <div className="flex items-center justify-between pt-1">
                <div className="flex items-center gap-2">
                  <Bot className="size-4 text-primary" />
                  <h3 className="text-sm font-semibold tracking-tight text-foreground">
                    AI Dive Trip Preferences
                  </h3>
                  <Badge variant="outline" className="text-[10px] py-0 px-1.5 h-4 text-primary border-primary/30">
                    Sinsay Public App
                  </Badge>
                </div>
                <span className="text-xs text-muted-foreground">
                  Forward planning signals from tourists
                </span>
              </div>
            )}

            {/* Preference Executive KPI Strip */}
            <Reveal>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <StatCard
                  icon={Compass}
                  label="Top Desired Activity"
                  info="The most frequently selected underwater dive experience chosen by prospective visitors in the AI planner."
                  value={prefs.topActivity}
                  delta="Rank #1"
                  deltaLabel="highest interest"
                  up
                  sample={isDemo}
                />
                <StatCard
                  icon={CalendarClock}
                  label="Avg Planned Stay"
                  info="Average intended length of visit indicated by prospective divers using the Sinsay itinerary planner."
                  value={`${prefs.avgStayDays} Days`}
                  sample={isDemo}
                />
                <StatCard
                  icon={Users}
                  label="Avg Planned Group"
                  info="Average party size declared during trip planning (solo, buddies, or dive groups)."
                  value={`${prefs.avgGroupSize} Divers`}
                  sample={isDemo}
                />
                <StatCard
                  icon={Bot}
                  label="AI Plans Analyzed"
                  info="Total AI Dive Plans submitted by visitors via the Sinsay public app within the selected date window."
                  value={prefs.totalPlans.toLocaleString()}
                  delta={signed(plansDelta)}
                  deltaLabel={`${signed(plansDeltaPct)}% vs prev period`}
                  up={plansDelta >= 0}
                  sample={isDemo}
                />
              </div>
            </Reveal>

            {/* Row 1: Activities & Length of Stay */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
              <Reveal delay={60} className="h-full">
                <SectionCard
                  title="Preferred Diving Activities"
                  subtitle="Ranked demand for underwater experiences from AI Dive Planner"
                  insight="tourist.preferredActivities"
                  className="h-full flex flex-col"
                >
                  {isEmptyChartData(prefs.activities) ? (
                    <ChartEmptyState className="h-[270px]" />
                  ) : (
                    <div className="h-[270px] w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                          data={prefs.activities}
                          layout="vertical"
                          margin={{ top: 8, right: 30, left: 24, bottom: 0 }}
                        >
                          <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--border)" opacity={0.4} />
                          <XAxis type="number" {...chartAxisProps} />
                          <YAxis
                            dataKey="name"
                            type="category"
                            width={130}
                            tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                            axisLine={false}
                            tickLine={false}
                          />
                          <Tooltip
                            contentStyle={chartTooltipStyle}
                            formatter={(val: any, _n: any, item: any) => [
                              `${val} tourists (${item?.payload?.percentage ?? 0}%)`,
                              "Demand",
                            ]}
                          />
                          <Bar dataKey="count" radius={[0, 6, 6, 0]}>
                            {prefs.activities.map((_, idx) => (
                              <Cell key={idx} fill={CHART_COLORS[idx % CHART_COLORS.length]} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </SectionCard>
              </Reveal>

              <Reveal delay={100} className="h-full">
                <SectionCard
                  title="Intended Length of Stay"
                  subtitle="Duration distribution of prospective tourist visits"
                  insight="tourist.lengthOfStay"
                  className="h-full flex flex-col"
                >
                  {isEmptyChartData(prefs.stayDurations) ? (
                    <ChartEmptyState className="h-[270px]" />
                  ) : (
                    <div className="h-[270px] w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                          data={prefs.stayDurations}
                          margin={{ top: 8, right: 16, left: -16, bottom: 0 }}
                        >
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" opacity={0.4} />
                          <XAxis
                            dataKey="duration"
                            {...chartAxisProps}
                            tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                          />
                          <YAxis {...chartAxisProps} />
                          <Tooltip
                            contentStyle={chartTooltipStyle}
                            formatter={(val: any, _n: any, item: any) => [
                              `${val} tourists (${item?.payload?.percentage ?? 0}%)`,
                              "Volume",
                            ]}
                          />
                          <Bar dataKey="count" fill="var(--color-chart-2)" radius={[6, 6, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </SectionCard>
              </Reveal>
            </div>

            {/* Row 2: Group Size & Composition + Budget Tier Distribution */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
              <Reveal delay={140} className="h-full">
                <SectionCard
                  title="Group Size & Composition"
                  subtitle="Solo divers vs buddy pairs and dive groups"
                  insight="tourist.groupComposition"
                  className="h-full flex flex-col"
                >
                  <div className="flex flex-col sm:flex-row items-center justify-center gap-6 h-[250px]">
                    <div className="w-[180px] h-[180px] shrink-0">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={prefs.groupSizes}
                            cx="50%"
                            cy="50%"
                            innerRadius={50}
                            outerRadius={80}
                            paddingAngle={3}
                            dataKey="count"
                          >
                            {prefs.groupSizes.map((_, index) => (
                              <Cell key={`group-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip
                            contentStyle={chartTooltipStyle}
                            formatter={(val: any, _n: any, item: any) => [
                              `${val} (${item?.payload?.percentage ?? 0}%)`,
                              item?.payload?.name ?? "Count",
                            ]}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="space-y-2 flex-1 w-full max-w-[220px]">
                      {prefs.groupSizes.map((item, idx) => (
                        <div key={item.name} className="flex items-center justify-between text-xs">
                          <div className="flex items-center gap-2 truncate">
                            <span
                              className="size-2.5 rounded-full shrink-0"
                              style={{ backgroundColor: CHART_COLORS[idx % CHART_COLORS.length] }}
                            />
                            <span className="text-muted-foreground truncate">{item.name}</span>
                          </div>
                          <span className="font-semibold">{item.percentage}%</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </SectionCard>
              </Reveal>

              <Reveal delay={180} className="h-full">
                <SectionCard
                  title="Budget Tier Distribution"
                  subtitle="Target expenditure tier declared during planning"
                  insight="tourist.budgetDistribution"
                  className="h-full flex flex-col"
                >
                  <div className="flex flex-col sm:flex-row items-center justify-center gap-6 h-[250px]">
                    <div className="w-[180px] h-[180px] shrink-0">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={prefs.budgetTiers}
                            cx="50%"
                            cy="50%"
                            innerRadius={50}
                            outerRadius={80}
                            paddingAngle={3}
                            dataKey="count"
                          >
                            {prefs.budgetTiers.map((_, index) => (
                              <Cell
                                key={`budget-${index}`}
                                fill={CHART_COLORS[(index + 2) % CHART_COLORS.length]}
                              />
                            ))}
                          </Pie>
                          <Tooltip
                            contentStyle={chartTooltipStyle}
                            formatter={(val: any, _n: any, item: any) => [
                              `${val} (${item?.payload?.percentage ?? 0}%)`,
                              item?.payload?.tier ?? "Count",
                            ]}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="space-y-2 flex-1 w-full max-w-[220px]">
                      {prefs.budgetTiers.map((item, idx) => (
                        <div key={item.tier} className="flex items-center justify-between text-xs">
                          <div className="flex items-center gap-2 truncate">
                            <span
                              className="size-2.5 rounded-full shrink-0"
                              style={{ backgroundColor: CHART_COLORS[(idx + 2) % CHART_COLORS.length] }}
                            />
                            <span className="text-muted-foreground truncate">{item.tier}</span>
                          </div>
                          <span className="font-semibold">{item.percentage}%</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </SectionCard>
              </Reveal>
            </div>

            {/* Row 3: Forward Planning Demand Trend */}
            <Reveal delay={220}>
              <SectionCard
                title="Forward Planning Demand Trend"
                subtitle="Timeline of AI dive plan generation indicating forward tourist interest"
                insight="tourist.planningDemand"
              >
                <div className="h-[250px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart
                      data={prefs.demandTrends}
                      margin={{ top: 8, right: 16, left: -16, bottom: 0 }}
                    >
                      <defs>
                        <linearGradient id="prefDemandGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="var(--color-chart-1)" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="var(--color-chart-1)" stopOpacity={0.0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" opacity={0.4} />
                      <XAxis dataKey="date" {...chartAxisProps} />
                      <YAxis {...chartAxisProps} />
                      <Tooltip
                        contentStyle={chartTooltipStyle}
                        formatter={(val: number) => [`${val} trip plans`, "AI Planner Requests"]}
                      />
                      <Area
                        type="monotone"
                        dataKey="requests"
                        stroke="var(--color-chart-1)"
                        strokeWidth={2}
                        fillOpacity={1}
                        fill="url(#prefDemandGradient)"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </SectionCard>
            </Reveal>

            {/* RA 10173 Privacy Compliance Notice */}
            <Reveal delay={240}>
              <div className="flex items-start gap-3 p-3.5 rounded-lg border border-primary/20 bg-primary/5 text-xs text-muted-foreground leading-relaxed">
                <ShieldCheck className="size-4 text-primary shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold text-foreground">
                    Republic Act No. 10173 (Data Privacy Act of 2012) Compliance:
                  </span>{" "}
                  Tourist preference insights are generated exclusively from anonymized, non-PII trip criteria submitted via the Sinsay Public AI Dive Planner with explicit consent. All data is aggregated strictly for municipal carrying capacity planning, dive site safety, and tourism resource allocation.
                </div>
              </div>
            </Reveal>
          </div>
        )}

        {/* SECTION 2: DEMOGRAPHICS & CERTIFICATIONS */}
        {(viewSection === "all" || viewSection === "demographics") && (
          <div className="space-y-6">
            {viewSection === "all" && (
              <div className="flex items-center justify-between pt-4 border-t border-border/40">
                <div className="flex items-center gap-2">
                  <Users className="size-4 text-primary" />
                  <h3 className="text-sm font-semibold tracking-tight text-foreground">
                    Tourist Demographics & Certification
                  </h3>
                  <Badge variant="outline" className="text-[10px] py-0 px-1.5 h-4">
                    Official Registrations
                  </Badge>
                </div>
                <span className="text-xs text-muted-foreground">
                  Verified municipal guest records & dive passes
                </span>
              </div>
            )}

            {/* Registration KPI Strip */}
            <Reveal>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <StatCard
                  icon={Users}
                  label="Total Tourists"
                  info="Count of distinct registered tourist accounts created or active within the selected date range."
                  value={m || !isDemo ? (m ? total : "-") : total}
                  delta={m ? signed(totalDelta) : undefined}
                  deltaLabel="vs previous period"
                  up={totalDelta >= 0}
                  sample={isDemo}
                />
                <StatCard
                  icon={Globe}
                  label="Nationalities Represented"
                  info="Count of unique countries of origin declared across all registered visitors in this period."
                  value={m || !isDemo ? (m ? nationalities : "-") : nationalities}
                  delta={m?.newNationalities ? `+${m.newNationalities}` : undefined}
                  deltaLabel="first seen this period"
                  up
                  sample={isDemo}
                />
                <StatCard
                  icon={TrendingUp}
                  label="Avg Divers / Tourist"
                  info="Average number of active divers associated per tourist group or booking record."
                  value={m || !isDemo ? (m ? avgDivers : "-") : avgDivers}
                  sample={isDemo}
                />
                <StatCard
                  icon={Award}
                  label="Most Common Level"
                  info="The diver certification credential held by the highest percentage of registered visitors."
                  value={m || !isDemo ? (m ? topLevel : "-") : topLevel}
                  sample={isDemo}
                />
              </div>
            </Reveal>

            {/* Existing Demographics Charts and Table */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
        <Reveal delay={80} className="h-full">
          <SectionCard title="Nationality Distribution" insight="tourist.nationalities" className="h-full flex flex-col">
            {isEmptyChartData(nationalityData) ? (
              <ChartEmptyState className="h-[240px]" />
            ) : (
              <div className="flex items-center gap-6 h-[240px]">
                <div className="w-[200px] h-[200px] cursor-pointer shrink-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={nationalityData}
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={85}
                        paddingAngle={2}
                        dataKey="value"
                        onClick={(_, index) => {
                          setNatDrilldown(nationalityData[index].name);
                        }}
                      >
                        {nationalityData.map((_, i) => (
                          <Cell
                            key={i}
                            fill={CHART_COLORS[i % CHART_COLORS.length]}
                          />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(value: number) => [`${value}%`, "Share"]}
                        contentStyle={chartTooltipStyle}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex-1 space-y-2">
                  {nationalityData.map((row, i) => (
                    <button
                      key={row.name}
                      onClick={() => setNatDrilldown(row.name)}
                      className="flex items-center gap-2 w-full text-left text-sm rounded-md px-2 py-1.5 hover:bg-muted/60 transition-colors"
                    >
                      <div
                        className="size-3 rounded-sm shrink-0"
                        style={{ background: CHART_COLORS[i % CHART_COLORS.length] }}
                      />
                      <span className="flex-1">{row.name}</span>
                      <span className="text-muted-foreground">{row.value}%</span>
                      <span className="text-muted-foreground text-xs">
                        ({row.count ?? 0})
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </SectionCard>
        </Reveal>

        <Reveal delay={120} className="h-full">
          <SectionCard title="Dive Level Distribution" insight="tourist.levels" className="h-full flex flex-col">
            {isEmptyChartData(levelData) ? (
              <ChartEmptyState className="h-[240px]" />
            ) : (
              <div className="h-[240px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={levelData}
                    layout="vertical"
                    margin={{ top: 4, right: 24, left: 4, bottom: 4 }}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="var(--border)"
                      horizontal={false}
                    />
                    <XAxis
                      type="number"
                      domain={[0, 100]}
                      tickFormatter={(value: number) => `${value}%`}
                      {...chartAxisProps}
                    />
                    <YAxis
                      dataKey="name"
                      type="category"
                      width={88}
                      {...chartAxisProps}
                    />
                    <Tooltip
                      formatter={(value: number) => [`${value}%`, "Share"]}
                      contentStyle={chartTooltipStyle}
                    />
                    <Bar
                      dataKey="value"
                      name="Share"
                      radius={[0, 6, 6, 0]}
                      barSize={20}
                      onClick={(data: NatDatum) => {
                        if (data?.name) setLevelDrilldown(data.name);
                      }}
                    >
                      {levelData.map((row, i) => (
                        <Cell
                          key={row.name}
                          fill={CHART_COLORS[i % CHART_COLORS.length]}
                          className="cursor-pointer"
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
            <div className="flex flex-wrap gap-3 mt-2">
              {levelData.map((row, i) => (
                <button
                  key={row.name}
                  onClick={() => setLevelDrilldown(row.name)}
                  className="flex items-center gap-1.5 text-xs rounded-full px-2.5 py-1 hover:bg-muted/60 transition-colors"
                >
                  <div
                    className="size-2 rounded-full"
                    style={{ background: CHART_COLORS[i % CHART_COLORS.length] }}
                  />
                  <span>{row.name}</span>
                  <span className="text-muted-foreground">{row.value}%</span>
                </button>
              ))}
            </div>
          </SectionCard>
        </Reveal>
      </div>

      <Reveal delay={160}>
        <SectionCard title="Registration Trends" insight="tourist.registrationTrends">
          {isEmptyChartData(monthlyData) ? (
            <ChartEmptyState className="h-[260px]" />
          ) : (
            <div className="h-[260px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={monthlyData}
                  margin={{ top: 4, right: 4, left: -12, bottom: 0 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="var(--border)"
                    vertical={false}
                  />
                  <XAxis dataKey="m" {...chartAxisProps} />
                  <YAxis {...chartAxisProps} />
                  <Tooltip
                    contentStyle={chartTooltipStyle}
                  />
                  <Bar
                    dataKey="count"
                    fill="var(--color-chart-1)"
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </SectionCard>
      </Reveal>

      {isDemo && (
        <Reveal delay={240}>
          <SectionCard title="Top Tourists Leaderboard" sample>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">#</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Nationality</TableHead>
                  <TableHead className="text-right">Dives</TableHead>
                  <TableHead className="text-right">Level</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTopTourists.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={5}
                      className="text-center py-8 text-muted-foreground"
                    >
                      No data matches the selected filter.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredTopTourists.map((tourist, i) => (
                    <TableRow key={tourist.name}>
                      <TableCell className="font-display font-bold text-muted-foreground">
                        {i + 1}
                      </TableCell>
                      <TableCell className="font-medium">{tourist.name}</TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="gap-1">
                          <Globe className="size-3" />
                          {tourist.nationality}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-semibold">
                        {tourist.dives}
                      </TableCell>
                      <TableCell className="text-right">
                        <Badge variant="outline">{tourist.level}</Badge>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </SectionCard>
        </Reveal>
      )}
          </div>
        )}

            <DrilldownDialog
        open={!!natDrilldown}
        onOpenChange={() => setNatDrilldown(null)}
        title={`${natDrilldown ?? ""} - Tourist Breakdown`}
        subtitle={
          natDrilldown === "Filipino"
            ? "Dive level distribution for Filipino tourists"
            : natDrilldown === "Foreign"
              ? "Dive level distribution for foreign tourists"
              : "Dive level distribution for tourists with unknown nationality"
        }
        stats={
          selectedNat
            ? [
                {
                  label: "Total Tourists",
                  value: selectedNatPieRow?.count ?? 0,
                  icon: Users,
                },
                {
                  label: "Open Water",
                  value: selectedNat.openWater,
                  icon: TrendingUp,
                },
                {
                  label: "Advanced",
                  value: selectedNat.advanced,
                  icon: TrendingUp,
                },
              ]
            : undefined
        }
      >
        {selectedNat && (
          <Table className="mt-4">
            <TableHeader>
              <TableRow>
                <TableHead>Dive Level</TableHead>
                <TableHead className="text-right">Tourists</TableHead>
                <TableHead className="text-right">% of Nationality</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(
                [
                  ["Intro", selectedNat.intro ?? 0],
                  ["Open Water", selectedNat.openWater],
                  ["Advanced", selectedNat.advanced],
                  ["Rescue", selectedNat.rescue],
                  ["Divemaster", selectedNat.divemaster],
                  ["Instructor", selectedNat.instructor],
                  ["Unknown", selectedNat.unknown ?? 0],
                ] as const
              ).map(([label, count]) => {
                const selectedTotal =
                  (selectedNat.intro ?? 0) +
                  selectedNat.openWater +
                  selectedNat.advanced +
                  selectedNat.rescue +
                  selectedNat.divemaster +
                  selectedNat.instructor +
                  (selectedNat.unknown ?? 0);
                return (
                  <TableRow key={label}>
                    <TableCell className="font-medium">{label}</TableCell>
                    <TableCell className="text-right">{count}</TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      {selectedTotal > 0
                        ? Math.round((count / selectedTotal) * 100)
                        : 0}
                      %
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </DrilldownDialog>

      <DrilldownDialog
        open={!!levelDrilldown}
        onOpenChange={() => setLevelDrilldown(null)}
        title={`${levelDrilldown ?? ""} - Nationality Breakdown`}
        subtitle={`Distribution of ${levelDrilldown} certified tourists across nationalities`}
        stats={
          selectedLevel.length > 0
            ? [
                { label: "Total Tourists", value: levelTotal, icon: Award },
                {
                  label: "Top Nationality",
                  value:
                    [...selectedLevel].sort((a, b) => b.count - a.count)[0]
                      ?.nationality ?? "-",
                  icon: Globe,
                },
              ]
            : undefined
        }
      >
        {selectedLevel.length > 0 && (
          <Table className="mt-4">
            <TableHeader>
              <TableRow>
                <TableHead>Nationality</TableHead>
                <TableHead className="text-right">Tourists</TableHead>
                <TableHead className="text-right">% of Level</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {selectedLevel.map((row) => (
                <TableRow key={row.nationality}>
                  <TableCell className="font-medium">{row.nationality}</TableCell>
                  <TableCell className="text-right">{row.count}</TableCell>
                  <TableCell className="text-right text-muted-foreground">
                    {levelTotal > 0 ? Math.round((row.count / levelTotal) * 100) : 0}%
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </DrilldownDialog>
      </div>
    </AnalyticsState>
  );
}
