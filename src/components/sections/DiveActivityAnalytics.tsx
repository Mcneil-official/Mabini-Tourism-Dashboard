import { useState, useMemo } from "react";
import { Waves, TrendingUp, BarChart3 } from "lucide-react";
import { Card } from "@/components/ui/card";
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
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
} from "recharts";
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
  DIVING_TYPE_KEYS,
  DIVING_TYPE_LABELS,
  type DivingTypeKey,
} from "@/lib/diveTaxonomy";
import {
  ChartEmptyState,
  isEmptyChartData,
} from "@/components/ChartEmptyState";
import { useLiveMode } from "@/lib/queries";
import { InsightWidget } from "@/components/InsightWidget";
import { buildDiveActivityInsight } from "@/lib/insights";
import { normalizeDiveType, normalizeSeason, useMetrics } from "@/lib/metrics";
import type { DateRange } from "@/lib/period";

const diveType = [
  { name: "Scuba", value: 38 },
  { name: "Fun Dive", value: 24 },
  { name: "Training", value: 14 },
  { name: "Intro Dive", value: 14 },
  { name: "Freediver", value: 10 },
];

const depthDistribution = [
  { range: "0–10m", count: 450 },
  { range: "10–20m", count: 680 },
  { range: "20–30m", count: 520 },
  { range: "30–40m", count: 310 },
  { range: "40m+", count: 120 },
];

const hourlyActivity = [
  { hour: "05:00", dives: 4 },
  { hour: "06:00", dives: 12 },
  { hour: "07:00", dives: 28 },
  { hour: "08:00", dives: 64 },
  { hour: "09:00", dives: 78 },
  { hour: "10:00", dives: 82 },
  { hour: "11:00", dives: 56 },
  { hour: "12:00", dives: 34 },
  { hour: "13:00", dives: 22 },
  { hour: "14:00", dives: 18 },
  { hour: "15:00", dives: 14 },
  { hour: "16:00", dives: 10 },
  { hour: "17:00", dives: 6 },
  { hour: "18:00", dives: 3 },
];

const seasonalTrends = [
  { season: "Amihan (Dry & Calm)", dives: 2480, tourists: 560 },
  { season: "Summer (Peak Season)", dives: 1840, tourists: 420 },
  { season: "Habagat (Monsoon/Low)", dives: 880, tourists: 210 },
];

const siteByType = [
  { site: "Blue Hole", scuba: 42, introDive: 10, funDive: 48, training: 12, freediver: 6 },
  { site: "Coral Gardens", scuba: 30, introDive: 34, funDive: 40, training: 18, freediver: 4 },
  { site: "Shark Point", scuba: 44, introDive: 6, funDive: 36, training: 10, freediver: 8 },
  { site: "Loyzaga Wreck", scuba: 38, introDive: 4, funDive: 22, training: 26, freediver: 6 },
  { site: "Sepoc Point", scuba: 24, introDive: 28, funDive: 30, training: 32, freediver: 5 },
];

const capacityData = [
  { site: "Blue Hole", maxCapacity: 120, actualDives: 90 },
  { site: "Coral Gardens", maxCapacity: 100, actualDives: 92 },
  { site: "Shark Point", maxCapacity: 80, actualDives: 78 },
  { site: "Loyzaga Wreck", maxCapacity: 60, actualDives: 72 },
  { site: "Sepoc Point", maxCapacity: 90, actualDives: 84 },
];

const TYPE_COLORS = [
  "var(--color-chart-1)",
  "var(--color-chart-2)",
  "var(--color-chart-3)",
  "var(--color-chart-4)",
  "var(--color-chart-5)",
];

export function DiveActivityAnalytics({ range }: { range: DateRange }) {
  const [drilldown, setDrilldown] = useState<string | null>(null);

  const isLive = useLiveMode();
  const isDemo = !isLive;
  const metrics = useMetrics("dive_activity", range);
  const m = metrics.data;
  const isLiveData = m !== undefined;
  const totalDivers = m?.divers ?? 0;
  const diversDelta = m ? m.divers - m.diversPrev : 0;
  const topType = useMemo(() => {
    if (!m || m.types.length === 0) return null;
    const counts = new Map<DivingTypeKey, number>();
    let total = 0;
    for (const row of m.types) {
      const key = normalizeDiveType(row.name);
      if (!key) continue;
      counts.set(key, (counts.get(key) ?? 0) + row.count);
      total += row.count;
    }
    const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1]);
    const best = sorted[0];
    if (!best || total === 0) return null;
    return {
      name: DIVING_TYPE_LABELS[best[0]],
      share: Math.round((best[1] / total) * 100),
    };
  }, [m]);


  // --- Derived datasets: live rows when available, demo otherwise -------
  const diveTypeData = useMemo(() => {
    if (!m) return isDemo ? diveType : [];
    const counts = new Map<DivingTypeKey, number>();
    for (const row of m.types) {
      const key = normalizeDiveType(row.name);
      if (key) counts.set(key, (counts.get(key) ?? 0) + row.count);
    }
    const total = [...counts.values()].reduce((a, c) => a + c, 0) || 1;
    return DIVING_TYPE_KEYS.filter((k) => counts.has(k)).map((k) => ({
      name: DIVING_TYPE_LABELS[k],
      value: Math.round((counts.get(k)! / total) * 100),
    }));
  }, [m, isDemo]);

  const siteByTypeData = useMemo(() => {
    if (!m) return isDemo ? siteByType : [];
    type Row = Record<DivingTypeKey, number> & { site: string };
    const rows = new Map<string, Row>();
    for (const item of m.siteTypes) {
      const key = normalizeDiveType(item.type);
      if (!key || !item.site) continue;
      const row =
        rows.get(item.site) ??
        ({
          site: item.site,
          scuba: 0,
          introDive: 0,
          funDive: 0,
          training: 0,
          freediver: 0,
        } as Row);
      row[key] += item.divers;
      rows.set(item.site, row);
    }
    const sum = (row: Row) =>
      DIVING_TYPE_KEYS.reduce((total, key) => total + row[key], 0);
    return [...rows.values()].sort((a, b) => sum(b) - sum(a));
  }, [m, isDemo]);

  const seasonalData = useMemo(() => {
    if (!m) return isDemo ? seasonalTrends : [];
    return m.seasonal.map((row) => ({
      season: normalizeSeason(row.season),
      dives: row.divers,
      tourists: row.trips,
    }));
  }, [m, isDemo]);

  const capacityDataLive = m ? m.capacity : isDemo ? capacityData : [];

  const hourlyData = useMemo(() => {
    if (m?.hourly && m.hourly.length > 0) {
      return m.hourly;
    }
    return isDemo ? hourlyActivity : [];
  }, [m?.hourly, isDemo]);

  const depthData = useMemo(() => {
    if (m?.depths && m.depths.length > 0) {
      return m.depths;
    }
    return isDemo ? depthDistribution : [];
  }, [m?.depths, isDemo]);

  const maxSeasonDives = Math.max(1, ...seasonalData.map((s) => s.dives));

  const selectedType = drilldown
    ? diveTypeData.find((t) => t.name === drilldown)
    : null;
  const drillKey = (drilldown
    ? (Object.keys(DIVING_TYPE_LABELS) as DivingTypeKey[]).find(
        (k) => DIVING_TYPE_LABELS[k] === drilldown,
      )
    : undefined) as DivingTypeKey | undefined;
  const typeSites =
    selectedType && drillKey
      ? siteByTypeData
          .map((s) => ({
            site: s.site,
            dives: s[drillKey],
          }))
          .filter((s) => s.dives > 0)
          .sort((a, b) => b.dives - a.dives)
      : [];

  const activityInsight = useMemo(
    () =>
      buildDiveActivityInsight({
        live: isLive,
        totalDives: totalDivers,
        divesDelta: diversDelta,
        topType: topType?.name ?? null,
        topTypeShare: topType?.share ?? 0,
        unverifiedManifests: m?.unverified ?? 0,
        sitesUsed: m?.sitesUsed ?? 0,
        seed: new Date().getDate(),
      }),
    [isLive, totalDivers, diversDelta, topType, m],
  );


  return (
    <AnalyticsState isLive={isLive} label="dive activity" state={metrics}>
      <div className="space-y-6">
        <InsightWidget insight={activityInsight} label="Dive Activity" />

        <Reveal>
        <div className="grid grid-cols-2 gap-4">
            <StatCard
              icon={Waves}
              label="Total Divers"
              info="Total individual diver entries logged on boat manifests submitted during this period."
              value={
                isLive
                  ? isLiveData
                    ? totalDivers.toLocaleString()
                    : "—"
                  : "2,082"
              }
              delta={
                isLiveData
                  ? `${diversDelta > 0 ? "+" : ""}${diversDelta}`
                  : undefined
              }
              deltaLabel="vs previous period"
              up={diversDelta >= 0}
              sample={isDemo}
            />
            <StatCard
              icon={BarChart3}
              label="Most Popular Type"
              info="The predominant dive category (e.g. Scuba, Free Diving, Macro) by share of filed manifests."
              value={
                isLive
                  ? isLiveData && topType
                    ? topType.name
                    : "—"
                  : "Scuba"
              }
              delta={
                isLiveData && topType
                  ? `${topType.share}% of manifests`
                  : undefined
              }
              deltaLabel="share of all manifests"
              sample={isDemo}
            />
        </div>
      </Reveal>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Reveal delay={80}>
          <SectionCard title="Dive Type Breakdown" insight="overview.diveType">
            {isEmptyChartData(diveTypeData) ? (
              <ChartEmptyState className="h-[300px]" />
            ) : (
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={diveTypeData}
                    cx="50%"
                    cy="50%"
                    innerRadius={65}
                    outerRadius={105}
                    paddingAngle={3}
                    dataKey="value"
                    stroke="none"
                    onClick={(_, index) => setDrilldown(diveTypeData[index].name)}
                    className="cursor-pointer"
                  >
                    {diveTypeData.map((_, i) => (
                      <Cell key={i} fill={TYPE_COLORS[i]} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value: number) => [`${value}%`, "Share"]}
                    contentStyle={chartTooltipStyle}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            )}
            <div className="flex items-center justify-center gap-4 mt-2">
              {diveTypeData.map((t, i) => (
                <button
                  key={t.name}
                  onClick={() => setDrilldown(t.name)}
                  className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  <span
                    className="size-2.5 rounded-sm"
                    style={{ background: TYPE_COLORS[i] }}
                  />
                  {t.name} ({t.value}%)
                </button>
              ))}
            </div>
          </SectionCard>
        </Reveal>

        <Reveal delay={120}>
          <SectionCard
            title="Depth Distribution"
            subtitle="Dives grouped by destination site depth rating."
            insight="diveActivity.depthDistribution"
            sample={isDemo && !m?.depths?.length}
          >
            {isEmptyChartData(depthData) ? (
              <ChartEmptyState className="h-[300px]" />
            ) : (
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={depthData}
                  layout="vertical"
                  margin={{ left: 10, right: 20 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="var(--border)"
                    horizontal={false}
                  />
                  <XAxis type="number" {...chartAxisProps} />
                  <YAxis
                    dataKey="range"
                    type="category"
                    width={90}
                    {...chartAxisProps}
                  />
                  <Tooltip
                    formatter={(value: number) => [`${value} dives`, "Count"]}
                    contentStyle={chartTooltipStyle}
                  />
                  <Bar
                    dataKey="count"
                    fill="var(--color-chart-2)"
                    radius={[0, 4, 4, 0]}
                    barSize={22}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
            )}
          </SectionCard>
        </Reveal>
      </div>

      <Reveal delay={160}>
        <SectionCard
          title="Hourly Activity Pattern"
          subtitle="Boat departure hours from filed manifests (Asia/Manila)."
          insight="diveActivity.hourlyLaunch"
          sample={isDemo && !m?.hourly?.length}
        >
          {isEmptyChartData(hourlyData) ? (
            <ChartEmptyState className="h-[260px]" />
          ) : (
          <div className="h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={hourlyData}
                margin={{ top: 5, right: 10, left: 0, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="diveArea" x1="0" y1="0" x2="0" y2="1">
                    <stop
                      offset="5%"
                      stopColor="var(--color-chart-1)"
                      stopOpacity={0.3}
                    />
                    <stop
                      offset="95%"
                      stopColor="var(--color-chart-1)"
                      stopOpacity={0.02}
                    />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="var(--border)"
                  vertical={false}
                />
                <XAxis dataKey="hour" {...chartAxisProps} />
                <YAxis {...chartAxisProps} />
                <Tooltip
                  formatter={(value: number) => [`${value} dives`, "Dives"]}
                  contentStyle={chartTooltipStyle}
                />
                <Area
                  type="monotone"
                  dataKey="dives"
                  stroke="var(--color-chart-1)"
                  strokeWidth={2}
                  fill="url(#diveArea)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          )}
        </SectionCard>
      </Reveal>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Reveal delay={200}>
          <SectionCard title="Site × Dive Type" insight="diveActivity.siteDiveType">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Site</TableHead>
                  {DIVING_TYPE_KEYS.map((k) => (
                    <TableHead key={k} className="text-center">
                      {DIVING_TYPE_LABELS[k]}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {siteByTypeData.map((row) => (
                  <TableRow key={row.site}>
                    <TableCell className="font-medium text-sm">
                      {row.site}
                    </TableCell>
                    {DIVING_TYPE_KEYS.map((k) => (
                      <TableCell key={k} className="text-center">
                        <Badge variant="secondary" className="font-mono text-xs">
                          {row[k]}
                        </Badge>
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </SectionCard>
        </Reveal>

        <Reveal delay={240}>
          <SectionCard
            title="Seasonal Trends"
            subtitle="Philippine monsoon and tropical tourism cycles."
            insight="diveActivity.seasonalDistribution"
          >
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {seasonalData.map((s) => (
                <Card
                  key={s.season}
                  className="p-4 shadow-elegant border-border/60 hover:border-primary/30 hover:shadow-glow-sm transition-all"
                >
                  <div className="text-xs uppercase tracking-wider text-muted-foreground mb-2">
                    {s.season}
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Divers</span>
                      <span className="font-display font-semibold">
                        {s.dives.toLocaleString()}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Manifests</span>
                      <span className="font-display font-semibold">
                        {s.tourists.toLocaleString()}
                      </span>
                    </div>
                    <div className="mt-2 h-1.5 w-full rounded-full bg-secondary overflow-hidden">
                      <div
                        className="h-full rounded-full bg-primary transition-all"
                        style={{ width: `${(s.dives / maxSeasonDives) * 100}%` }}
                      />
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </SectionCard>
        </Reveal>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Reveal delay={280}>
          <SectionCard
            title="Dive Site Capacity Utilization"
            subtitle="Divers logged vs the maximum recorded per manifest, summed by site."
            insight="diveActivity.carryingCapacity"
          >
            {isEmptyChartData(capacityDataLive) ? (
              <ChartEmptyState className="h-[300px]" />
            ) : (
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={capacityDataLive}
                  margin={{ top: 5, right: 10, left: 0, bottom: 0 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="var(--border)"
                    vertical={false}
                  />
                  <XAxis dataKey="site" {...chartAxisProps} />
                  <YAxis {...chartAxisProps} />
                  <Tooltip
                    contentStyle={chartTooltipStyle}
                    formatter={(value, name, entry) => {
                      const divers = Number(value);
                      if (name === "Max Capacity")
                        return [`${divers} divers`, "Max Capacity"];
                      const max =
                        (
                          entry.payload as
                            | { maxCapacity?: number }
                            | undefined
                        )?.maxCapacity ?? 0;
                      return [
                        max > 0
                          ? `${divers} divers (${Math.round((divers / max) * 100)}%)`
                          : `${divers} divers`,
                        "Divers",
                      ];
                    }}
                  />
                  <Bar
                    dataKey="maxCapacity"
                    name="Max Capacity"
                    fill="var(--color-chart-3)"
                    fillOpacity={0.25}
                    radius={[4, 4, 0, 0]}
                    barSize={22}
                  />
                  <Bar
                    dataKey="actualDives"
                    name="Divers"
                    radius={[4, 4, 0, 0]}
                    barSize={22}
                  >
                    {capacityDataLive.map((entry, i) => (
                      <Cell
                        key={i}
                        fill={
                          entry.maxCapacity > 0 &&
                          entry.actualDives > entry.maxCapacity
                            ? "oklch(0.634 0.171 25.331)"
                            : "var(--color-chart-1)"
                        }
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            )}
          </SectionCard>
        </Reveal>

      </div>

      <DrilldownDialog
        open={!!drilldown}
        onOpenChange={(o) => {
          if (!o) setDrilldown(null);
        }}
        title={`${drilldown ?? ""} Divers`}
        subtitle={`${selectedType?.value ?? 0}% of recorded manifests`}
        stats={
          selectedType
            ? [
                {
                  label: "Share",
                  value: `${selectedType.value}%`,
                  icon: Waves,
                },
                { label: "Sites", value: typeSites.length, icon: BarChart3 },
                {
                  label: "Top Site",
                  value: typeSites[0]?.site ?? "—",
                  icon: TrendingUp,
                },
              ]
            : undefined
        }
      >
        {typeSites.length > 0 && (
          <div className="mt-4">
            <h4 className="text-sm font-medium mb-2">Divers by Site</h4>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Site</TableHead>
                  <TableHead className="text-right">Divers</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {typeSites.map((s) => (
                  <TableRow key={s.site}>
                    <TableCell className="font-medium text-sm">
                      {s.site}
                    </TableCell>
                    <TableCell className="text-right">
                      <Badge variant="secondary" className="font-mono text-xs">
                        {s.dives}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </DrilldownDialog>
      </div>
    </AnalyticsState>
  );
}
