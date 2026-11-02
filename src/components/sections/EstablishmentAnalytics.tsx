import { useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import {
  SectionCard,
  StatCard,
  Reveal,
  chartAxisProps,
  chartTooltipStyle,
} from "@/components/shared";
import { AnalyticsState } from "@/components/AnalyticsState";
import {
  ChartEmptyState,
  isEmptyChartData,
} from "@/components/ChartEmptyState";
import { Building2, MapPin, Shield, ClipboardList } from "lucide-react";
import { useLiveMode } from "@/lib/queries";
import { InsightWidget } from "@/components/InsightWidget";
import { buildEstablishmentInsight } from "@/lib/insights";
import { useMetrics } from "@/lib/metrics";
import type { DateRange } from "@/lib/period";
import { MABINI_BARANGAYS } from "@/lib/barangays";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  ComposedChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  PieChart,
  Pie,
  Cell,
} from "recharts";

const CHART_COLORS = [
  "var(--color-chart-1)",
  "var(--color-chart-2)",
  "var(--color-chart-3)",
  "var(--color-chart-4)",
  "var(--color-chart-5)",
  "oklch(0.85 0.05 250)",
];

const establishmentsByBarangay = [
  { barangay: "San Teodoro", count: 4 },
  { barangay: "Solo", count: 3 },
  { barangay: "Batas", count: 3 },
  { barangay: "San Joaquin", count: 2 },
];

const permitStatus = [
  { status: "Active", count: 9 },
  { status: "Suspended", count: 2 },
  { status: "Pending Review", count: 1 },
];

const activityLevels = [
  { name: "Deep Blue", manifestos: 128, divers: 640, credits: 2400 },
  { name: "Reef Riders", manifestos: 98, divers: 490, credits: 1860 },
  { name: "Coral Coast", manifestos: 84, divers: 420, credits: 1620 },
  { name: "Manta Expeditions", manifestos: 71, divers: 355, credits: 1440 },
  { name: "Turtle Divers", manifestos: 56, divers: 280, credits: 1080 },
  { name: "Bluefin", manifestos: 45, divers: 225, credits: 920 },
  { name: "Aqua Ventures", manifestos: 38, divers: 190, credits: 780 },
  { name: "Nautilus", manifestos: 29, divers: 145, credits: 600 },
];

const topEstablishments = [
  {
    name: "Deep Blue Charters",
    owner: "Rafael Magtibay",
    barangay: "San Teodoro",
    manifestos: 128,
    divers: 640,
    credits: 2400,
    status: "Active",
  },
  {
    name: "Reef Riders Co.",
    owner: "Carmina Villanueva",
    barangay: "Solo",
    manifestos: 98,
    divers: 490,
    credits: 1860,
    status: "Active",
  },
  {
    name: "Coral Coast Divers",
    owner: "Eduardo Santos",
    barangay: "Batas",
    manifestos: 84,
    divers: 420,
    credits: 1620,
    status: "Active",
  },
  {
    name: "Manta Expeditions",
    owner: "Liza Ramos",
    barangay: "San Teodoro",
    manifestos: 71,
    divers: 355,
    credits: 1440,
    status: "Active",
  },
  {
    name: "Turtle Bay Dive Shop",
    owner: "Marco Reyes",
    barangay: "Solo",
    manifestos: 56,
    divers: 280,
    credits: 1080,
    status: "Active",
  },
  {
    name: "Bluefin Divers",
    owner: "Antonio Cruz",
    barangay: "Batas",
    manifestos: 45,
    divers: 225,
    credits: 920,
    status: "Active",
  },
  {
    name: "Aqua Ventures PH",
    owner: "Maria Theresa Lim",
    barangay: "San Joaquin",
    manifestos: 38,
    divers: 190,
    credits: 780,
    status: "Active",
  },
  {
    name: "Nautilus Dive Co.",
    owner: "Dante Bautista",
    barangay: "San Teodoro",
    manifestos: 29,
    divers: 145,
    credits: 600,
    status: "Suspended",
  },
];

const TOTAL = establishmentsByBarangay.reduce((a, b) => a + b.count, 0);
const ACTIVE_PERMITS =
  permitStatus.find((p) => p.status === "Active")?.count ?? 0;
const TOP_BARANGAY = establishmentsByBarangay.sort(
  (a, b) => b.count - a.count,
)[0].barangay;

function extractBarangay(location: string | null | undefined): string {
  if (!location) return "Unspecified";
  const clean = location.trim();
  const lower = clean.toLowerCase();
  for (const b of MABINI_BARANGAYS) {
    if (lower.includes(b.toLowerCase())) return b;
  }
  const m = /barangay\s+([^,]+)/i.exec(clean);
  if (m && m[1]) return m[1].trim();
  const first = clean.split(",")[0].trim();
  return first || "Unspecified";
}

export function EstablishmentAnalytics({ range }: { range: DateRange }) {
  const isLive = useLiveMode();
  const isDemo = !isLive;
  const metrics = useMetrics("establishment", range);
  const m = metrics.data;
  const isLiveData = m !== undefined;
  const rows = useMemo(() => m?.establishments ?? [], [m]);

  const byBarangayData = useMemo(() => {
    if (!m) return isDemo ? establishmentsByBarangay : [];
    const map = new Map<string, number>();
    for (const row of rows) {
      const barangay = extractBarangay(row.location);
      map.set(barangay, (map.get(barangay) ?? 0) + 1);
    }
    return [...map.entries()]
      .map(([barangay, count]) => ({ barangay, count }))
      .sort((a, b) => b.count - a.count);
  }, [m, isDemo, rows]);

  const permitStatusData = useMemo(() => {
    if (!m) return isDemo ? permitStatus : [];
    const items = [
      { status: "Active", count: m.active },
      { status: "Suspended", count: m.suspended },
    ];
    if (m.pendingApplications > 0) {
      items.push({ status: "Pending Review", count: m.pendingApplications });
    }
    return items.filter((item) => item.count > 0);
  }, [m, isDemo]);

  const activityData = useMemo(() => {
    if (!m) return isDemo ? activityLevels : [];
    return [...rows]
      .sort((a, b) => b.manifestos - a.manifestos)
      .slice(0, 10)
      .map((row) => ({
        name: row.name,
        manifestos: row.manifestos,
        divers: row.divers ?? 0,
        credits: row.creditBalance,
      }));
  }, [m, isDemo, rows]);

  const topEstData = useMemo<
    Array<{
      name: string;
      owner?: string;
      barangay: string;
      manifestos: number;
      divers: number;
      credits: number;
      status: string;
    }>
  >(() => {
    if (!m) return isDemo ? topEstablishments : [];
    return [...rows]
      .sort((a, b) => b.manifestos - a.manifestos)
      .slice(0, 10)
      .map((row) => ({
        name: row.name,
        owner: row.owner,
        barangay: extractBarangay(row.location),
        manifestos: row.manifestos,
        divers: row.divers ?? 0,
        credits: row.creditBalance,
        status: row.status,
      }));
  }, [m, isDemo, rows]);

  const totalEstablishments = m ? m.total : TOTAL;
  const activePermits = m ? m.active : ACTIVE_PERMITS;
  const topBarangay =
    m && byBarangayData.length ? byBarangayData[0].barangay : m ? "-" : TOP_BARANGAY;
  const topMaxManifestos = topEstData[0]?.manifestos || 1;
  const pendingApplications = m?.pendingApplications ?? (isDemo ? 1 : 0);

  const establishmentInsight = useMemo(() => {
    const total = m?.total ?? TOTAL;
    const active = m?.active ?? ACTIVE_PERMITS;
    const suspended = m?.suspended ?? 0;
    const topShare =
      total > 0 && byBarangayData[0]
        ? (byBarangayData[0].count / total) * 100
        : 0;

    return buildEstablishmentInsight({
      live: isLive,
      total,
      active,
      suspended,
      barangays: byBarangayData.length,
      topBarangay:
        m && byBarangayData.length
          ? byBarangayData[0].barangay
          : m
            ? null
            : TOP_BARANGAY,
      topBarangayShare: topShare,
      idleEstablishments: rows.filter((row) => row.manifestos === 0).length,
      totalCredits: rows.reduce(
        (sum, row) => sum + (row.creditBalance || 0),
        0,
      ),
      pendingApplications,
      seed: new Date().getDate(),
    });
  }, [m, isLive, rows, byBarangayData, pendingApplications]);

  return (
    <AnalyticsState isLive={isLive} label="establishment" state={metrics}>
      <div className="space-y-6">
        <InsightWidget
          insight={establishmentInsight}
          label="Establishments"
        />

        <Reveal>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard
              icon={Building2}
              label="Total Establishments"
              info="Total registered resorts, dive centers, and boat operators on municipal record."
              value={String(totalEstablishments)}
              sample={isDemo}
            />
            <StatCard
              icon={Shield}
              label="Active Permits"
              info="Establishments holding active, compliant business and municipal tourism accreditation permits."
              value={isLive ? (isLiveData ? String(activePermits) : "—") : String(activePermits)}
              sample={isDemo}
            />
            <StatCard
              icon={MapPin}
              label="Top Barangay"
              info="The coastal barangay hosting the highest concentration of registered dive businesses."
              value={topBarangay}
              sample={isDemo}
            />
            <StatCard
              icon={ClipboardList}
              label="Pending Applications"
              info="New resort or operator registration applications submitted and awaiting tourism office review."
              value={isLive ? (isLiveData ? String(pendingApplications) : "—") : String(pendingApplications)}
              delta={
                pendingApplications > 0
                  ? `${pendingApplications} awaiting`
                  : undefined
              }
              deltaLabel={
                pendingApplications > 0
                  ? "review required"
                  : undefined
              }
              up={false}
              sample={isDemo}
            />
          </div>
        </Reveal>

        <Reveal delay={80}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <SectionCard title="Establishments by Location" insight="establishment.byLocation" sample={isDemo}>
              {isEmptyChartData(byBarangayData) ? (
                <ChartEmptyState className="h-64" />
              ) : (
                <div className="h-64">
                  <ResponsiveContainer>
                    <BarChart
                      data={byBarangayData}
                      margin={{ left: -20, right: 8 }}
                    >
                      <CartesianGrid
                        stroke="var(--color-border)"
                        strokeDasharray="3 6"
                        vertical={false}
                      />
                      <XAxis
                        dataKey="barangay"
                        {...chartAxisProps}
                      />
                      <YAxis
                        {...chartAxisProps}
                      />
                      <Tooltip contentStyle={chartTooltipStyle} />
                      <Bar dataKey="count" radius={[8, 8, 0, 0]}>
                        {byBarangayData.map((_, i) => (
                          <Cell
                            key={i}
                            fill={CHART_COLORS[i % CHART_COLORS.length]}
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </SectionCard>

            <SectionCard title="Compliance & Permit Status" insight="establishment.permitStatus" sample={isDemo}>
              {isEmptyChartData(permitStatusData) ? (
                <ChartEmptyState className="h-64" />
              ) : (
                <div className="h-64">
                  <ResponsiveContainer>
                    <PieChart>
                      <Pie
                        data={permitStatusData}
                        dataKey="count"
                        nameKey="status"
                        innerRadius={55}
                        outerRadius={90}
                        paddingAngle={2}
                        stroke="var(--color-card)"
                        strokeWidth={2}
                      >
                        {permitStatusData.map((_, i) => (
                          <Cell
                            key={i}
                            fill={CHART_COLORS[i % CHART_COLORS.length]}
                          />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={chartTooltipStyle} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              )}
              <div className="mt-2 grid grid-cols-3 gap-1.5">
                {permitStatusData.map((p, i) => (
                  <div key={p.status} className="flex items-center gap-2 text-xs">
                    <span
                      className="size-2.5 rounded-sm"
                      style={{
                        background: CHART_COLORS[i % CHART_COLORS.length],
                      }}
                    />
                    <span className="text-muted-foreground">{p.status}</span>
                    <span className="ml-auto font-medium">{p.count}</span>
                  </div>
                ))}
              </div>
            </SectionCard>
          </div>
        </Reveal>

        <Reveal delay={160}>
          <SectionCard
            title="Manifests & Credits by Establishment"
            insight="establishment.manifestsAndCredits"
            sample={isDemo}
          >
            {isEmptyChartData(activityData) ? (
              <ChartEmptyState className="h-80" />
            ) : (
              <div className="h-80">
                <ResponsiveContainer>
                  <ComposedChart
                    data={activityData}
                    margin={{ left: -10, right: 30 }}
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
                      yAxisId="left"
                      {...chartAxisProps}
                      label={{ value: "Manifests", angle: -90, position: "insideLeft", offset: 10, style: { fontSize: 11, fill: "var(--color-muted-foreground)" } }}
                    />
                    <YAxis
                      yAxisId="right"
                      orientation="right"
                      {...chartAxisProps}
                      label={{ value: "Credits remaining", angle: 90, position: "insideRight", offset: 10, style: { fontSize: 11, fill: "var(--color-muted-foreground)" } }}
                    />
                    <Tooltip
                      contentStyle={chartTooltipStyle}
                      formatter={(value: number, name: string) => {
                        if (name === "Credits remaining")
                          return [value.toLocaleString(), "Credits remaining"];
                        return [value.toLocaleString(), "Manifestos"];
                      }}
                    />
                    <Bar
                      yAxisId="left"
                      dataKey="manifestos"
                      name="Manifestos"
                      fill="var(--color-chart-1)"
                      radius={[8, 8, 0, 0]}
                      opacity={0.8}
                    />
                    <Line
                      yAxisId="right"
                      type="monotone"
                      dataKey="credits"
                      name="Credits remaining"
                      stroke="var(--color-chart-2)"
                      strokeWidth={2.5}
                      dot={{ r: 4, fill: "var(--color-chart-2)" }}
                      activeDot={{ r: 6 }}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            )}
            <div className="mt-3 flex items-center gap-4 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <span className="inline-block size-2.5 rounded-sm" style={{ background: "var(--color-chart-1)" }} />
                Manifestos
              </span>
              <span className="flex items-center gap-1.5">
                <span className="inline-block w-4 h-0.5 rounded" style={{ background: "var(--color-chart-2)" }} />
                Credits remaining
              </span>
            </div>
          </SectionCard>
        </Reveal>

        <Reveal delay={240}>
          <SectionCard title="Top Establishments Leaderboard" insight="establishment.leaderboard" sample={isDemo}>
            <Table>
              <TableHeader>
                <TableRow className="bg-secondary/50">
                  <TableHead className="w-12">#</TableHead>
                  <TableHead>Establishment</TableHead>
                  <TableHead>Barangay</TableHead>
                  <TableHead>Manifests</TableHead>
                  <TableHead className="text-right">Divers</TableHead>
                  <TableHead className="text-right">Credits</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {topEstData.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={7}
                      className="text-center py-8 text-muted-foreground"
                    >
                      No establishments on record.
                    </TableCell>
                  </TableRow>
                )}
                {topEstData.map((e, i) => (
                  <TableRow
                    key={e.name}
                    className="hover:bg-secondary/50 transition-colors"
                  >
                    <TableCell className="font-mono text-sm text-muted-foreground">
                      {i + 1}
                    </TableCell>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        <Building2 className="size-4 text-primary shrink-0" />
                        <div>
                          <div>{e.name}</div>
                          {e.owner && (
                            <div className="text-xs text-muted-foreground font-normal">
                              {e.owner}
                            </div>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {e.barangay}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2 min-w-[120px]">
                        <Progress
                          value={(e.manifestos / topMaxManifestos) * 100}
                          className="h-1.5 flex-1"
                        />
                        <span className="text-xs text-muted-foreground whitespace-nowrap">
                          {e.manifestos}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {e.divers.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm">
                      ₱{e.credits.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge
                        variant="outline"
                        className={
                          e.status === "Active"
                            ? "bg-success/10 text-success border-success/20"
                            : "bg-muted text-muted-foreground border-border"
                        }
                      >
                        {e.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </SectionCard>
        </Reveal>
      </div>
    </AnalyticsState>
  );
}
