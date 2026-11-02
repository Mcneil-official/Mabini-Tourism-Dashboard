import { useMemo } from "react";
import { CreditCard, TrendingUp, Clock, AlertTriangle } from "lucide-react";
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
import { useLiveMode } from "@/lib/queries";
import { InsightWidget } from "@/components/InsightWidget";
import { buildDivePassInsight } from "@/lib/insights";
import { aggregateDaily, useMetrics } from "@/lib/metrics";
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
  Area,
  ComposedChart,
} from "recharts";

const CHART_COLORS = [
  "var(--color-chart-1)",
  "var(--color-chart-2)",
  "var(--color-chart-3)",
  "var(--color-chart-4)",
  "var(--color-chart-5)",
];

const MONTH_LABELS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

function periodKeyOf(t: string): "day" | "weekly" | "monthly" | "annual" | null {
  const s = t.toLowerCase();
  if (s.includes("day")) return "day";
  if (s.includes("week")) return "weekly";
  if (s.includes("month")) return "monthly";
  if (s.includes("annual") || s.includes("year")) return "annual";
  return null;
}

const passTypeDistribution = [
  { type: "Day", count: 8, amount: 240 },
  { type: "Weekly", count: 5, amount: 500 },
  { type: "Monthly", count: 10, amount: 2000 },
  { type: "Annual", count: 4, amount: 4000 },
];

const creditsUtilization = [
  { type: "Day", purchased: 24, used: 18 },
  { type: "Weekly", purchased: 50, used: 34 },
  { type: "Monthly", purchased: 200, used: 132 },
  { type: "Annual", purchased: 400, used: 198 },
];

const revenueByType = [
  { month: "Mar", day: 120, weekly: 300, monthly: 1400, annual: 3200 },
  { month: "Apr", day: 180, weekly: 400, monthly: 1600, annual: 3600 },
  { month: "May", day: 150, weekly: 350, monthly: 1800, annual: 3800 },
  { month: "Jun", day: 210, weekly: 500, monthly: 2000, annual: 4000 },
  { month: "Jul", day: 240, weekly: 500, monthly: 2200, annual: 4000 },
  { month: "Aug", day: 190, weekly: 450, monthly: 1900, annual: 3600 },
];

const revenueVsBurn = [
  { month: "Mar", revenue: 4820, burnRate: 58 },
  { month: "Apr", revenue: 5560, burnRate: 62 },
  { month: "May", revenue: 6100, burnRate: 65 },
  { month: "Jun", revenue: 6710, burnRate: 71 },
  { month: "Jul", revenue: 7140, burnRate: 74 },
  { month: "Aug", revenue: 6140, burnRate: 68 },
];

export function DivePassAnalytics({ range }: { range: DateRange }) {
  const isLive = useLiveMode();
  const isDemo = !isLive;
  const metrics = useMetrics("dive_pass", range);
  const m = metrics.data;
  const isLiveData = m !== undefined;
  const revenueTotal = m?.revenue ?? 0;
  const revDelta = m ? m.revenue - m.revenuePrev : 0;
  const inUse = m?.creditsUsed ?? 0;
  const creditsDelta =
    m && m.creditsUsedPrev !== undefined ? m.creditsUsed - m.creditsUsedPrev : 0;
  const purchased = m?.purchased ?? 0;
  const remaining = m?.remaining ?? 0;
  const pendingReceipts = m?.pendingReceipts ?? 0;
  const pendingAmount = m?.pendingAmount ?? 0;
  const oldestPendingDays = m?.oldestPendingReceiptDays ?? 0;
  const avgCreditsUsed =
    purchased > 0 ? Math.round((inUse / purchased) * 100) : null;

  // --- Derived datasets: live rows when available, demo otherwise -------
  const passTypeData = useMemo(() => {
    if (!m) return isDemo ? passTypeDistribution : [];
    return m.passTypes.map((row) => ({
      type: row.type,
      count: row.purchased,
      amount: row.amount ?? 0,
    }));
  }, [m, isDemo]);

  const creditsData = useMemo(() => {
    if (!m) return isDemo ? creditsUtilization : [];
    return m.passTypes.map((row) => ({
      type: row.type,
      purchased: row.purchased,
      used: row.used,
    }));
  }, [m, isDemo]);

  const revenueByTypeData = useMemo(() => {
    if (!m) return isDemo ? revenueByType : [];
    return aggregateDaily(
      range,
      m.inventory,
      (row) => row.date,
      () => ({ day: 0, weekly: 0, monthly: 0, annual: 0 }),
      (acc, row) => {
        const key = periodKeyOf(row.passType ?? "");
        if (key) acc[key] += row.amount;
      },
    ).map((bucket) => ({
      month: bucket.label,
      day: bucket.day,
      weekly: bucket.weekly,
      monthly: bucket.monthly,
      annual: bucket.annual,
    }));
  }, [m, isDemo, range]);

  const revenueVsBurnData = useMemo(() => {
    if (!m) return isDemo ? revenueVsBurn : [];
    const revenue = new Map(
      aggregateDaily(
        range,
        m.dailyRevenue,
        (row) => row.date,
        () => ({ value: 0 }),
        (acc, row) => {
          acc.value += row.revenue;
        },
      ).map((bucket) => [bucket.start, bucket.value] as const),
    );
    return aggregateDaily(
      range,
      m.inventory,
      (row) => row.date,
      () => ({ purchased: 0, used: 0 }),
      (acc, row) => {
        acc.purchased += row.purchased;
        acc.used += Math.max(0, row.purchased - row.remaining);
      },
    ).map((bucket) => ({
      month: bucket.label,
      revenue: revenue.get(bucket.start) ?? 0,
      burnRate:
        bucket.purchased > 0
          ? Math.round((bucket.used / bucket.purchased) * 100)
          : 0,
    }));
  }, [m, isDemo, range]);

  // Facts for the floating insights widget — same live values as the cards.
  const passInsight = useMemo(
    () =>
      buildDivePassInsight({
        live: isLive,
        revenue: revenueTotal,
        revenueDelta: revDelta,
        passesSold: inUse,
        passesRemaining: remaining,
        pendingReceipts: m?.pendingReceipts ?? 0,
        oldestPendingDays: m?.oldestPendingReceiptDays ?? 0,
        seed: new Date().getDate(),
      }),
    [isLive, revenueTotal, revDelta, inUse, remaining, m],
  );

  return (
    <AnalyticsState isLive={isLive} label="dive pass" state={metrics}>
      <div className="space-y-6">
        <InsightWidget insight={passInsight} label="Dive Pass" />

        <Reveal>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            icon={CreditCard}
            label="Verified Revenue"
            info="Total conservation and pass fees from verified payment receipts within the date window."
            value={
              isLive
                ? isLiveData
                  ? `\u20B1${Math.round(revenueTotal).toLocaleString()}`
                  : "-"
                : "\u20B16,740"
            }
            delta={
              isLiveData
                ? `${revDelta >= 0 ? "+" : "-"}\u20B1${Math.round(Math.abs(revDelta)).toLocaleString()}`
                : undefined
            }
            deltaLabel="vs previous period"
            up={isLiveData ? revDelta >= 0 : undefined}
            sample={isDemo}
          />
          <StatCard
            icon={TrendingUp}
            label="Credits Used"
            info="Environmental pass credits burned on approved boat manifests during this period."
            value={isLive ? (isLiveData ? String(inUse) : "-") : "17"}
            delta={
              isLiveData && m?.creditsUsedPrev !== undefined
                ? `${creditsDelta >= 0 ? "+" : ""}${creditsDelta}`
                : undefined
            }
            deltaLabel="vs previous period"
            up={creditsDelta >= 0}
            sample={isDemo}
          />
          <StatCard
            icon={CreditCard}
            label="Avg Credit Utilization"
            info="Ratio of burned credits to total credits purchased across all active operators."
            value={
              isLive
                ? avgCreditsUsed != null
                  ? `${avgCreditsUsed}%`
                  : "-"
                : "68%"
            }
            sample={isDemo}
          />
          <StatCard
            icon={Clock}
            label="Pending Review Queue"
            info="Sum of unverified payment receipts submitted by operators awaiting municipal treasury clearance."
            value={
              isLive
                ? isLiveData
                  ? `\u20B1${Math.round(pendingAmount).toLocaleString()}`
                  : "-"
                : "\u20B12,400"
            }
            delta={
              isLiveData && pendingReceipts > 0
                ? `${pendingReceipts} receipt${pendingReceipts !== 1 ? "s" : ""}`
                : undefined
            }
            deltaLabel={
              oldestPendingDays > 0
                ? `oldest ${oldestPendingDays}d ago`
                : "all clear"
            }
            up={pendingReceipts === 0}
            sample={isDemo}
          />
        </div>
      </Reveal>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Reveal delay={80}>
          <SectionCard
            title="Pass Type Distribution"
            subtitle="Purchased volume and revenue contribution per tier."
            insight="divePass.passTypeDistribution"
            sample={isDemo && !m?.passTypes?.length}
          >
            {isEmptyChartData(passTypeData) ? (
              <ChartEmptyState className="h-[200px]" />
            ) : (
            <div className="flex items-center gap-6">
              <div className="w-[200px] h-[200px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={passTypeData}
                      dataKey="count"
                      nameKey="type"
                      innerRadius={55}
                      outerRadius={90}
                      paddingAngle={2}
                      stroke="var(--color-card)"
                      strokeWidth={2}
                    >
                      {passTypeData.map((_, i) => (
                        <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={chartTooltipStyle} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex-1 space-y-2">
                {passTypeData.map((p, i) => (
                  <div
                    key={p.type}
                    className="flex items-center justify-between text-sm"
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className="size-2.5 rounded-sm"
                        style={{ background: CHART_COLORS[i % CHART_COLORS.length] }}
                      />
                      <span>{p.type}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-medium">{p.count} passes</span>
                      {p.amount > 0 && (
                        <span className="text-xs text-muted-foreground font-mono">
                          ₱{Math.round(p.amount).toLocaleString()}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
            )}
          </SectionCard>
        </Reveal>

        <Reveal delay={120}>
          <SectionCard
            title="Credits Utilization"
            subtitle="Purchased volume vs redeemed credits per pass tier."
            insight="divePass.creditsUtilization"
            sample={isDemo && !m?.passTypes?.length}
          >
            {isEmptyChartData(creditsData) ? (
              <ChartEmptyState className="h-[200px]" />
            ) : (
            <div className="h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={creditsData}
                  margin={{ left: -12, right: 8 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="var(--color-border)"
                  />
                  <XAxis
                    dataKey="type"
                    {...chartAxisProps}
                  />
                  <YAxis
                    {...chartAxisProps}
                  />
                  <Tooltip contentStyle={chartTooltipStyle} />
                  <Bar
                    dataKey="purchased"
                    fill="var(--color-chart-1)"
                    radius={[6, 6, 0, 0]}
                    name="Purchased"
                  />
                  <Bar
                    dataKey="used"
                    fill="var(--color-chart-2)"
                    radius={[6, 6, 0, 0]}
                    name="Used"
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
            )}
          </SectionCard>
        </Reveal>
      </div>

      <div className="grid grid-cols-1 gap-6">
        <Reveal delay={200}>
          <SectionCard
            title="Pass Purchases by Type"
            subtitle="Purchased pass volume across time buckets."
            insight="divePass.inventoryPurchases"
            sample={isDemo && !m?.inventory?.length}
          >
            {isEmptyChartData(revenueByTypeData) ? (
              <ChartEmptyState className="h-[200px]" />
            ) : (
            <div className="h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={revenueByTypeData} margin={{ left: -12, right: 8 }}>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="var(--color-border)"
                  />
                  <XAxis
                    dataKey="month"
                    {...chartAxisProps}
                  />
                  <YAxis
                    {...chartAxisProps}
                  />
                  <Tooltip contentStyle={chartTooltipStyle} />
                  <Bar
                    dataKey="day"
                    stackId="revenue"
                    fill="var(--color-chart-1)"
                    name="Day"
                  />
                  <Bar
                    dataKey="weekly"
                    stackId="revenue"
                    fill="var(--color-chart-2)"
                    name="Weekly"
                  />
                  <Bar
                    dataKey="monthly"
                    stackId="revenue"
                    fill="var(--color-chart-3)"
                    name="Monthly"
                  />
                  <Bar
                    dataKey="annual"
                    stackId="revenue"
                    fill="var(--color-chart-4)"
                    radius={[4, 4, 0, 0]}
                    name="Annual"
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
            )}
          </SectionCard>
        </Reveal>
      </div>

      <div className="grid grid-cols-1 gap-6">
        <Reveal delay={320}>
          <SectionCard
            title="Revenue vs Credit Burn Rate"
            subtitle="Verified receipts cash inflow vs inventory utilization rate."
            insight="divePass.revenueVsBurn"
            sample={isDemo && !m?.dailyRevenue?.length}
          >
            {isEmptyChartData(revenueVsBurnData) ? (
              <ChartEmptyState className="h-[200px]" />
            ) : (
            <div className="h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart
                  data={revenueVsBurnData}
                  margin={{ left: -12, right: 8 }}
                >
                  <defs>
                    <linearGradient id="revenueFill" x1="0" y1="0" x2="0" y2="1">
                      <stop
                        offset="5%"
                        stopColor="var(--color-chart-1)"
                        stopOpacity={0.3}
                      />
                      <stop
                        offset="95%"
                        stopColor="var(--color-chart-1)"
                        stopOpacity={0}
                      />
                    </linearGradient>
                    <linearGradient id="burnFill" x1="0" y1="0" x2="0" y2="1">
                      <stop
                        offset="5%"
                        stopColor="var(--color-chart-4)"
                        stopOpacity={0.3}
                      />
                      <stop
                        offset="95%"
                        stopColor="var(--color-chart-4)"
                        stopOpacity={0}
                      />
                    </linearGradient>
                  </defs>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="var(--color-border)"
                  />
                  <XAxis
                    dataKey="month"
                    {...chartAxisProps}
                  />
                  <YAxis
                    yAxisId="left"
                    {...chartAxisProps}
                  />
                  <YAxis
                    yAxisId="right"
                    orientation="right"
                    {...chartAxisProps}
                    domain={[0, 100]}
                  />
                  <Tooltip contentStyle={chartTooltipStyle} />
                  <Area
                    yAxisId="left"
                    type="monotone"
                    dataKey="revenue"
                    stroke="var(--color-chart-1)"
                    strokeWidth={2}
                    fill="url(#revenueFill)"
                    name="Verified Revenue (₱)"
                  />
                  <Area
                    yAxisId="right"
                    type="monotone"
                    dataKey="burnRate"
                    stroke="var(--color-chart-4)"
                    strokeWidth={2}
                    fill="url(#burnFill)"
                    name="Burn Rate (%)"
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
            )}
          </SectionCard>
        </Reveal>

      </div>
      </div>
    </AnalyticsState>
  );
}
