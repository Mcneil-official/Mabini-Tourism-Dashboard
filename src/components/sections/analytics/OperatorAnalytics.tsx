import { useState, useMemo } from "react";
import {
  Building2,
  CreditCard,
  TrendingUp,
  ScrollText,
  Users,
  Waves,
} from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Cell,
  ComposedChart,
  Line,
} from "recharts";
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
import { InsightWidget } from "@/components/InsightWidget";
import { AnalyticsState } from "@/components/AnalyticsState";
import {
  SectionCard,
  StatCard,
  DrilldownDialog,
  chartAxisProps,
  chartTooltipStyle,
} from "@/components/shared";
import { isEmptyChartData, ChartEmptyState } from "@/components/ChartEmptyState";
import { useMetrics } from "@/lib/metrics";
import { type DateRange } from "@/lib/period";
import { useLiveMode } from "@/lib/queries";
import { buildOperatorInsight } from "@/lib/insights";
import { operatorActivity, CHART_COLORS } from "@/lib/mock-data";
import { useFilters } from "@/hooks/useFilters";

export function OperatorAnalytics({ range }: { range: DateRange }) {
  const { setFilters } = useFilters();
  const isLive = useLiveMode();
  const [drillOperator, setDrillOperator] = useState<any>(null);
  const metrics = useMetrics("operator", range);
  const m = metrics.data;

  const scaledOperatorActivity = useMemo(() => {
    if (m) return m.rows;
    if (isLive) return [];
    return operatorActivity.map((operator) => {
      const credits = operator.credits;
      const divers = Math.round(operator.manifestos * 7.2);
      const revenue = operator.manifestos * 4200;
      const purchased = Math.round(credits / 0.7);
      const remaining = Math.max(0, purchased - credits);
      return {
        ...operator,
        divers,
        purchased,
        remaining,
        revenue,
        recent: [
          { id: "MNF-081", site: "Cathedral Rock", divers: 6, date: "2026-10-31" },
          { id: "MNF-074", site: "Twin Rocks", divers: 8, date: "2026-10-28" },
          { id: "MNF-062", site: "Secret Bay", divers: 4, date: "2026-10-25" },
        ],
      };
    });
  }, [m, isLive]);

  const revenueSortedOperators = useMemo(() => {
    return [...scaledOperatorActivity]
      .sort((a, b) => (b.revenue ?? 0) - (a.revenue ?? 0))
      .slice(0, 8);
  }, [scaledOperatorActivity]);

  const operatorInsight = useMemo(() => {
    const rows = m?.rows ?? [];
    const withManifests = rows.filter((row) => row.manifestos > 0);
    const totalManifestos = rows.reduce((sum, row) => sum + row.manifestos, 0);
    const top = withManifests[0];
    return buildOperatorInsight({
      live: isLive,
      operatorsWithManifests: m?.active ?? withManifests.length,
      idleOperators: m ? Math.max(0, m.operators - m.active) : 0,
      topOperator: top?.name ?? null,
      topOperatorShare:
        top && totalManifestos > 0
          ? (top.manifestos / totalManifestos) * 100
          : 0,
      exhaustedOperators: rows.filter(
        (row) => row.purchased > 0 && row.remaining <= 0,
      ).length,
      seed: new Date().getDate(),
    });
  }, [isLive, m]);

  const opKpis = useMemo(() => {
    if (m) {
      const activePrev = m.activePrev ?? 0;
      return {
        live: true,
        active: m.active,
        total: m.operators,
        manifestos: m.manifestos,
        divers: m.divers,
        revenue: m.revenue,
        aDelta: m.active - activePrev,
        mDelta: m.manifestos - m.manifestosPrev,
        dDelta: m.divers - m.diversPrev,
        rDelta: m.revenue - m.revenuePrev,
      };
    }
    if (isLive) {
      return {
        live: true,
        active: 0,
        total: 0,
        manifestos: 0,
        divers: 0,
        revenue: 0,
        aDelta: 0,
        mDelta: 0,
        dDelta: 0,
        rDelta: 0,
      };
    }
    const totalManifestos = operatorActivity.reduce(
      (sum, operator) => sum + operator.manifestos,
      0,
    );
    return {
      live: false,
      active: operatorActivity.length,
      total: operatorActivity.length + 4,
      manifestos: totalManifestos,
      divers: Math.round(totalManifestos * 7.2),
      revenue: totalManifestos * 4200,
      aDelta: 2,
      mDelta: 14,
      dDelta: 80,
      rDelta: 32000,
    };
  }, [m, isLive]);

  const kpiDelta = (delta: number) =>
    delta === 0 && !opKpis.live ? "" : `${delta >= 0 ? "+" : ""}${delta}`;

  return (
    <AnalyticsState isLive={isLive} label="operator" state={metrics}>
      <div className="relative">
        <InsightWidget insight={operatorInsight} label="Operators" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <StatCard
            icon={Users}
            label="Active Operators"
            info="Operators who submitted at least one manifest during the selected period vs total registered operators."
            value={opKpis.total > 0 ? `${opKpis.active} of ${opKpis.total}` : String(opKpis.active)}
            delta={opKpis.live ? kpiDelta(opKpis.aDelta) : "+2"}
            deltaLabel="vs previous period"
            up={opKpis.aDelta >= 0}
            sample={!isLive}
          />
          <StatCard
            icon={ScrollText}
            label="Manifestos Filed"
            info="Total boat manifests officially submitted and approved within this time window."
            value={opKpis.manifestos.toLocaleString()}
            delta={opKpis.live ? kpiDelta(opKpis.mDelta) : "+14"}
            deltaLabel="vs previous period"
            up={opKpis.mDelta >= 0}
            sample={!isLive}
          />
          <StatCard
            icon={Waves}
            label="Divers Logged"
            info="Total individual diver entries recorded on submitted manifests for this period."
            value={opKpis.divers.toLocaleString()}
            delta={opKpis.live ? kpiDelta(opKpis.dDelta) : "+80"}
            deltaLabel="vs previous period"
            up={opKpis.dDelta >= 0}
            sample={!isLive}
          />
          <StatCard
            icon={CreditCard}
            label="Revenue Generated"
            info="Municipal pass and conservation fee revenue collected and verified for these operators."
            value={`\u20B1${Math.round(opKpis.revenue).toLocaleString()}`}
            delta={
              opKpis.live
                ? opKpis.rDelta !== 0
                  ? `${opKpis.rDelta >= 0 ? "+" : "-"}\u20B1${Math.round(
                      Math.abs(opKpis.rDelta),
                    ).toLocaleString()}`
                  : ""
                : "+\u20B132,000"
            }
            deltaLabel="vs previous period"
            up={opKpis.rDelta >= 0}
            sample={!isLive}
          />
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          <SectionCard title="Operator Revenue Contribution (₱)" insight="operator.revenue" sample={!isLive}>
            <div className="h-80">
              {isEmptyChartData(revenueSortedOperators) ? (
                <ChartEmptyState className="h-80" />
              ) : (
                <ResponsiveContainer>
                  <BarChart
                    data={revenueSortedOperators}
                    layout="vertical"
                    margin={{ left: 20, right: 24 }}
                  >
                    <CartesianGrid
                      stroke="var(--color-border)"
                      strokeDasharray="3 6"
                      horizontal={false}
                    />
                    <XAxis
                      type="number"
                      {...chartAxisProps}
                      tickFormatter={(v: number) => `₱${(v / 1000).toFixed(0)}k`}
                    />
                    <YAxis
                      dataKey="name"
                      type="category"
                      {...chartAxisProps}
                      width={110}
                    />
                    <Tooltip
                      contentStyle={chartTooltipStyle}
                      formatter={(value: number) => [
                        `₱${Math.round(value).toLocaleString()}`,
                        "Verified Revenue",
                      ]}
                    />
                    <Bar
                      dataKey="revenue"
                      radius={[0, 8, 8, 0]}
                      onClick={(data: any) => data && setDrillOperator(data)}
                      className="cursor-pointer"
                    >
                      {revenueSortedOperators.map((_, i) => (
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

          <SectionCard title="Manifestos & Credits by Operator" insight="operator.manifestsAndCredits" sample={!isLive}>
            <div className="h-80">
              {isEmptyChartData(scaledOperatorActivity) ? (
                <ChartEmptyState className="h-80" />
              ) : (
                <ResponsiveContainer>
                  <ComposedChart
                    data={scaledOperatorActivity}
                    margin={{ left: -12, right: 12 }}
                    onClick={(e) =>
                      e?.activePayload?.[0]?.payload &&
                      setDrillOperator(e.activePayload[0].payload)
                    }
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
                      label={{
                        value: "Manifests",
                        angle: -90,
                        position: "insideLeft",
                        offset: 14,
                        style: { fontSize: 11, fill: "var(--color-muted-foreground)" },
                      }}
                    />
                    <YAxis
                      yAxisId="right"
                      orientation="right"
                      {...chartAxisProps}
                      label={{
                        value: "Credits used",
                        angle: 90,
                        position: "insideRight",
                        offset: 14,
                        style: { fontSize: 11, fill: "var(--color-muted-foreground)" },
                      }}
                    />
                    <Tooltip
                      contentStyle={chartTooltipStyle}
                      formatter={(value: number, name: string) => [
                        value.toLocaleString(),
                        name,
                      ]}
                    />
                    <Bar
                      yAxisId="left"
                      dataKey="manifestos"
                      name="Manifestos"
                      fill="var(--color-primary)"
                      radius={[4, 4, 0, 0]}
                      barSize={18}
                    />
                    <Line
                      yAxisId="right"
                      type="monotone"
                      dataKey="credits"
                      name="Credits used"
                      stroke="var(--color-chart-2)"
                      strokeWidth={2.5}
                      dot={{ r: 3, fill: "var(--color-chart-2)" }}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              )}
            </div>
          </SectionCard>

          <SectionCard
            title="Operator Leaderboard"
            insight="operator.leaderboard"
            className="xl:col-span-2"
            sample={!isLive}
          >
            <Table>
              <TableHeader>
                <TableRow className="bg-secondary/50">
                  <TableHead>Operator</TableHead>
                  <TableHead>Manifestos</TableHead>
                  <TableHead>Divers Logged</TableHead>
                  <TableHead>Revenue (₱)</TableHead>
                  <TableHead>Credits Used</TableHead>
                  <TableHead>Remaining</TableHead>
                  <TableHead>Credit Utilization</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {scaledOperatorActivity.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={7}
                      className="text-center py-8 text-muted-foreground"
                    >
                      No operator activity for the selected period.
                    </TableCell>
                  </TableRow>
                )}
                {scaledOperatorActivity.map((o) => {
                  const util =
                    o.purchased > 0
                      ? Math.round((o.credits / o.purchased) * 100)
                      : 0;
                  return (
                    <TableRow
                      key={o.name}
                      className="cursor-pointer hover:bg-secondary/50 transition-colors"
                      onClick={() => setDrillOperator(o)}
                    >
                      <TableCell className="font-medium">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setFilters({
                              section: "establishments",
                              tab: "registered",
                              q: o.name,
                            });
                          }}
                          className="flex items-center gap-2 underline decoration-dotted underline-offset-2 hover:text-primary hover:decoration-solid transition-colors"
                        >
                          <Building2 className="size-4 text-primary" /> {o.name}
                        </button>
                      </TableCell>
                      <TableCell>{o.manifestos.toLocaleString()}</TableCell>
                      <TableCell className="font-medium">{(o.divers ?? 0).toLocaleString()}</TableCell>
                      <TableCell className="font-mono text-sm">
                        ₱{Math.round(o.revenue ?? 0).toLocaleString()}
                      </TableCell>
                      <TableCell>{o.credits.toLocaleString()}</TableCell>
                      <TableCell className="font-mono text-sm">
                        {(o.remaining ?? 0).toLocaleString()}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="w-28 h-2 rounded-full bg-secondary overflow-hidden">
                            <div
                              className="h-full gradient-primary"
                              style={{ width: `${Math.min(100, util)}%` }}
                            />
                          </div>
                          <span className="text-xs text-muted-foreground tabular-nums">
                            {o.purchased > 0 ? `${util}%` : "—"}
                          </span>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </SectionCard>

          <DrilldownDialog
            open={!!drillOperator}
            onOpenChange={(o) => !o && setDrillOperator(null)}
            title={drillOperator?.name ?? ""}
            subtitle="Operator performance detail"
            stats={
              drillOperator
                ? [
                    {
                      label: "Manifestos",
                      value: drillOperator.manifestos,
                      icon: ScrollText,
                    },
                    {
                      label: "Divers Logged",
                      value: (drillOperator.divers ?? 0).toLocaleString(),
                      icon: Waves,
                    },
                    {
                      label: "Credits used",
                      value: drillOperator.credits.toLocaleString(),
                      icon: CreditCard,
                    },
                    {
                      label: "Credit Utilization",
                      value: drillOperator.purchased
                        ? `${Math.round((drillOperator.credits / drillOperator.purchased) * 100)}%`
                        : "—",
                      icon: TrendingUp,
                    },
                  ]
                : undefined
            }
          >
            {drillOperator && (
              <div className="space-y-4 mt-2">
                <Card className="p-4 shadow-elegant">
                  <h4 className="font-display font-semibold text-sm mb-3">
                    Operator summary
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
                          Total manifestos filed
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {drillOperator.manifestos}
                        </TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell className="text-muted-foreground">
                          Divers logged
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {(drillOperator.divers ?? 0).toLocaleString()}
                        </TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell className="text-muted-foreground">
                          Avg divers per manifest
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {drillOperator.manifestos > 0
                            ? (
                                (drillOperator.divers ?? 0) /
                                drillOperator.manifestos
                              ).toFixed(1)
                            : "0.0"}
                        </TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell className="text-muted-foreground">
                          Credits used
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {(drillOperator.credits ?? 0).toLocaleString()}
                        </TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell className="text-muted-foreground">
                          Credits remaining
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {(drillOperator.remaining ?? 0).toLocaleString()}
                        </TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell className="text-muted-foreground">
                          Revenue generated
                        </TableCell>
                        <TableCell className="text-right font-medium font-mono">
                          {`\u20B1${Math.round(drillOperator.revenue ?? 0).toLocaleString()}`}
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </Card>
                <Card className="p-4 shadow-elegant">
                  <h4 className="font-display font-semibold text-sm mb-3">
                    Recent manifestos
                  </h4>
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-secondary/50">
                        <TableHead>ID</TableHead>
                        <TableHead>Site</TableHead>
                        <TableHead>Divers</TableHead>
                        <TableHead>Date</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(!drillOperator.recent || drillOperator.recent.length === 0) && (
                        <TableRow>
                          <TableCell
                            colSpan={4}
                            className="text-center py-6 text-muted-foreground text-sm"
                          >
                            No manifest history on record.
                          </TableCell>
                        </TableRow>
                      )}
                      {(drillOperator.recent ?? []).map((row: any) => (
                        <TableRow key={row.id}>
                          <TableCell className="font-mono text-xs">
                            {row.id}
                          </TableCell>
                          <TableCell className="font-medium">{row.site}</TableCell>
                          <TableCell>{row.divers}</TableCell>
                          <TableCell className="text-muted-foreground">
                            {row.date}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </Card>
              </div>
            )}
          </DrilldownDialog>
        </div>
      </div>
    </AnalyticsState>
  );
}
