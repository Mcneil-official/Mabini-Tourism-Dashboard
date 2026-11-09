import { useState, useEffect, useMemo } from "react";
import {
  FileBarChart,
  Download,
  CalendarIcon,
  Loader2,
  FileDown,
  Printer,
  Sparkles,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  AreaChart,
  Area,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { toast } from "sonner";
import { SectionCard, chartAxisProps, chartTooltipStyle } from "@/components/shared";
import { isEmptyChartData, ChartEmptyState } from "@/components/ChartEmptyState";
import { MetricsError } from "@/components/AnalyticsState";
import { pushAuditLog } from "@/lib/audit";
import { type DateRange, resolveDateRange, todayInManila, clampDateToToday } from "@/lib/period";
import { dbErrorMessage, useLiveMode } from "@/lib/queries";
import { useMetrics, aggregateDaily, percent } from "@/lib/metrics";
import { monthlyTrends } from "@/lib/mock-data";
import { downloadCsv, formatPhp } from "@/lib/export-utils";
import { openPrintDocument } from "@/lib/print-template";

const TYPE_COLORS = [
  "var(--color-chart-1)",
  "var(--color-chart-2)",
  "var(--color-chart-3)",
  "var(--color-chart-4)",
  "var(--color-chart-5)",
  "var(--color-chart-6)",
];

export function Reports({ range: globalRange }: { range: DateRange }) {
  const [range, setRange] = useState("monthly");
  const [dateFrom, setDateFrom] = useState(globalRange.from);
  const [dateTo, setDateTo] = useState(globalRange.to);
  const [docFormat, setDocFormat] = useState("A4");
  const [generating, setGenerating] = useState(false);
  type ReportRow = {
    period: string;
    tourists: number;
    operators: number;
    manifestos: number;
    dives: number;
    revenue: number;
  };
  const [reportData, setReportData] = useState<ReportRow[] | null>(null);
  type DiveTypeReportRow = {
    name: string;
    manifests: number;
    dives: number;
    percentage: number;
  };
  const [reportDiveTypes, setReportDiveTypes] = useState<DiveTypeReportRow[] | null>(null);

  const isLive = useLiveMode();
  useEffect(() => {
    setDateFrom(globalRange.from);
    setDateTo(globalRange.to);
    setReportData(null);
    setReportDiveTypes(null);
  }, [globalRange.from, globalRange.to]);

  const reportRange = useMemo(
    () => resolveDateRange("custom", dateFrom, dateTo),
    [dateFrom, dateTo],
  );

  const metrics = useMetrics("report", reportRange);
  const m = metrics.data;

  const filteredTrends = useMemo(() => {
    if (m) {
      return aggregateDaily(
        reportRange,
        m.daily,
        (row) => row.date,
        () => ({ dives: 0 }),
        (acc, row) => {
          acc.dives += row.divers;
        },
      ).map((bucket) => ({ m: bucket.label, dives: bucket.dives }));
    }
    if (isLive) return [];
    return aggregateDaily(
      reportRange,
      monthlyTrends.map((t, i) => ({
        date: `2026-${String(i + 1).padStart(2, "0")}-15`,
        divers: t.dives,
      })),
      (row) => row.date,
      () => ({ dives: 0 }),
      (acc, row) => {
        acc.dives += row.divers;
      },
    ).map((bucket) => ({ m: bucket.label, dives: bucket.dives }));
  }, [m, isLive, reportRange]);

  const diveTypeChartData = useMemo(() => {
    if (m?.diveTypes && m.diveTypes.length > 0) {
      const totalDivers = m.diveTypes.reduce((sum, r) => sum + r.count, 0);
      return m.diveTypes.map((row) => ({
        name: row.name,
        dives: row.count,
        manifests: row.manifests,
        value: percent(row.count, totalDivers),
      }));
    }
    if (isLive) return [];
    return [
      { name: "Scuba", dives: 638, manifests: 160, value: 38 },
      { name: "Fun Dive", dives: 403, manifests: 101, value: 24 },
      { name: "Training", dives: 235, manifests: 59, value: 14 },
      { name: "Intro Dive", dives: 235, manifests: 59, value: 14 },
      { name: "Freediver", dives: 169, manifests: 41, value: 10 },
    ];
  }, [m, isLive]);

  const applyPreset = (preset: "30d" | "thisMonth" | "lastMonth" | "ytd") => {
    const now = new Date();
    const y = now.getFullYear();
    const mIdx = now.getMonth();
    const pad = (n: number) => String(n).padStart(2, "0");

    if (preset === "30d") {
      const past = new Date(Date.now() - 30 * 86400000);
      setDateFrom(past.toISOString().slice(0, 10));
      setDateTo(now.toISOString().slice(0, 10));
    } else if (preset === "thisMonth") {
      setDateFrom(`${y}-${pad(mIdx + 1)}-01`);
      setDateTo(now.toISOString().slice(0, 10));
    } else if (preset === "lastMonth") {
      const prevM = mIdx === 0 ? 11 : mIdx - 1;
      const prevY = mIdx === 0 ? y - 1 : y;
      const lastDay = new Date(prevY, prevM + 1, 0).getDate();
      setDateFrom(`${prevY}-${pad(prevM + 1)}-01`);
      setDateTo(`${prevY}-${pad(prevM + 1)}-${pad(lastDay)}`);
    } else if (preset === "ytd") {
      setDateFrom(`${y}-01-01`);
      setDateTo(now.toISOString().slice(0, 10));
    }
    setReportData(null);
    setReportDiveTypes(null);
  };

  const generateReport = () => {
    setGenerating(true);
    if (isLive) {
      if (!m) {
        setGenerating(false);
        toast.error("Report metrics are still loading");
        return;
      }
      const rows = aggregateDaily(
        reportRange,
        m.daily,
        (row) => row.date,
        () => ({ tourists: 0, operators: 0, manifestos: 0, dives: 0, revenue: 0 }),
        (acc, row) => {
          acc.tourists += row.tourists;
          acc.operators += row.operators;
          acc.manifestos += row.manifestos;
          acc.dives += row.divers;
          acc.revenue += row.revenue;
        },
      ).map((bucket) => ({
        period: bucket.label,
        tourists: bucket.tourists,
        operators: bucket.operators,
        manifestos: bucket.manifestos,
        dives: bucket.dives,
        revenue: bucket.revenue,
      }));
      setReportData(rows);
      if (m?.diveTypes && m.diveTypes.length > 0) {
        const totalDives = m.diveTypes.reduce((s, r) => s + r.count, 0);
        const typeRows = m.diveTypes.map((t) => ({
          name: t.name,
          manifests: t.manifests,
          dives: t.count,
          percentage: percent(t.count, totalDives),
        }));
        setReportDiveTypes(typeRows);
      } else {
        const totalDives = rows.reduce((s, r) => s + r.dives, 0);
        const totalManifests = rows.reduce((s, r) => s + r.manifestos, 0);
        const ratios = [
          { name: "Scuba", p: 0.38 },
          { name: "Fun Dive", p: 0.24 },
          { name: "Training", p: 0.14 },
          { name: "Intro Dive", p: 0.14 },
          { name: "Freediver", p: 0.10 },
        ];
        setReportDiveTypes(
          ratios.map((r) => ({
            name: r.name,
            manifests: Math.max(1, Math.round(totalManifests * r.p)),
            dives: Math.round(totalDives * r.p),
            percentage: Math.round(r.p * 100),
          })),
        );
      }
      setGenerating(false);
      pushAuditLog(`Generated ${range} report for ${dateFrom} to ${dateTo}`);
      toast.success(`${range} report generated`, {
        description: `${rows.length} periods included.`,
      });
      return;
    }

    const demoRows: Record<string, ReportRow[]> = {
      daily: [
        { period: "Jul 25", tourists: 42, operators: 8, manifestos: 18, dives: 64, revenue: 126400 },
        { period: "Jul 24", tourists: 38, operators: 7, manifestos: 15, dives: 56, revenue: 112200 },
        { period: "Jul 23", tourists: 35, operators: 9, manifestos: 20, dives: 72, revenue: 138800 },
      ],
      weekly: [
        { period: "Week 30", tourists: 280, operators: 12, manifestos: 95, dives: 380, revenue: 892000 },
        { period: "Week 29", tourists: 245, operators: 11, manifestos: 82, dives: 328, revenue: 765000 },
        { period: "Week 28", tourists: 310, operators: 14, manifestos: 104, dives: 416, revenue: 948000 },
      ],
      monthly: [
        { period: "Jul 2026", tourists: 1240, operators: 18, manifestos: 420, dives: 1680, revenue: 3842000 },
        { period: "Jun 2026", tourists: 1180, operators: 17, manifestos: 398, dives: 1592, revenue: 3610000 },
        { period: "May 2026", tourists: 1050, operators: 16, manifestos: 360, dives: 1440, revenue: 3280000 },
      ],
    };
    const data = demoRows[range] ?? demoRows.monthly;
    setReportData(data);
    const totalDives = data.reduce((s, r) => s + r.dives, 0);
    const totalManifests = data.reduce((s, r) => s + r.manifestos, 0);
    const demoTypes: DiveTypeReportRow[] = [
      { name: "Scuba", manifests: Math.max(1, Math.round(totalManifests * 0.38)), dives: Math.round(totalDives * 0.38), percentage: 38 },
      { name: "Fun Dive", manifests: Math.max(1, Math.round(totalManifests * 0.24)), dives: Math.round(totalDives * 0.24), percentage: 24 },
      { name: "Training", manifests: Math.max(1, Math.round(totalManifests * 0.14)), dives: Math.round(totalDives * 0.14), percentage: 14 },
      { name: "Intro Dive", manifests: Math.max(1, Math.round(totalManifests * 0.14)), dives: Math.round(totalDives * 0.14), percentage: 14 },
      { name: "Freediver", manifests: Math.max(1, Math.round(totalManifests * 0.10)), dives: Math.round(totalDives * 0.10), percentage: 10 },
    ];
    setReportDiveTypes(demoTypes);
    setGenerating(false);
    pushAuditLog(`Generated sample ${range} report`);
    toast.success(`${range} sample report generated`, {
      description: "Connect Supabase for live report data.",
    });
  };

  const exportCsv = () => {
    if (!reportData || reportData.length === 0) {
      return toast.error("Generate a report first");
    }
    const headers = ["Period", "Tourists", "Active Operators", "Manifestos", "Dives", "Revenue (PHP)"];
    const rows: (string | number)[][] = reportData.map((r) => [r.period, r.tourists, r.operators, r.manifestos, r.dives, r.revenue]);
    if (reportDiveTypes && reportDiveTypes.length > 0) {
      rows.push(["", "", "", "", "", ""]);
      rows.push(["--- DIVE TYPE AGGREGATION ---", "", "", "", "", ""]);
      rows.push(["Dive Type", "Manifests Filed", "Total Divers", "Activity Share (%)", "", ""]);
      reportDiveTypes.forEach((dt) => {
        rows.push([dt.name, dt.manifests, dt.dives, `${dt.percentage}%`, "", ""]);
      });
    }
    downloadCsv(`mabini-tourism-report-${range}-${dateFrom || "all"}-to-${dateTo || "all"}`, headers, rows);
    pushAuditLog(`Exported ${range} report as CSV`);
    toast.success("CSV Downloaded", { description: "Spreadsheet ready." });
  };

  const printOfficialReport = () => {
    if (!reportData || reportData.length === 0) {
      return toast.error("Generate a report first");
    }

    const totals = reportData.reduce(
      (acc, r) => {
        acc.tourists += r.tourists;
        acc.operators = Math.max(acc.operators, r.operators);
        acc.manifestos += r.manifestos;
        acc.dives += r.dives;
        acc.revenue += r.revenue;
        return acc;
      },
      { tourists: 0, operators: 0, manifestos: 0, dives: 0, revenue: 0 },
    );

    const kpiHtml = `
      <div class="kpi-grid">
        <div class="kpi-card">
          <div class="kpi-label">Total Registered Tourists</div>
          <div class="kpi-value">${totals.tourists.toLocaleString()}</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-label">Total Dives Completed</div>
          <div class="kpi-value">${totals.dives.toLocaleString()}</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-label">Dive Manifestos Filed</div>
          <div class="kpi-value">${totals.manifestos.toLocaleString()}</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-label">Estimated Municipal Revenue</div>
          <div class="kpi-value">${formatPhp(totals.revenue)}</div>
        </div>
      </div>
    `;

    const rowsHtml = reportData
      .map(
        (r) => `
      <tr>
        <td class="font-semibold">${r.period}</td>
        <td class="text-center">${r.tourists.toLocaleString()}</td>
        <td class="text-center">${r.operators}</td>
        <td class="text-center">${r.manifestos.toLocaleString()}</td>
        <td class="text-center">${r.dives.toLocaleString()}</td>
        <td class="text-right font-mono">${formatPhp(r.revenue)}</td>
      </tr>`,
      )
      .join("");

    const tableHtml = `
      <table>
        <thead>
          <tr>
            <th>Period (${range})</th>
            <th class="text-center">Tourists</th>
            <th class="text-center">Active Operators</th>
            <th class="text-center">Manifestos</th>
            <th class="text-center">Total Dives</th>
            <th class="text-right">Revenue (PHP)</th>
          </tr>
        </thead>
        <tbody>
          ${rowsHtml}
        </tbody>
        <tfoot>
          <tr style="background-color: #f1f5f9; font-weight: 700;">
            <td>Total / Summary</td>
            <td class="text-center">${totals.tourists.toLocaleString()}</td>
            <td class="text-center">${totals.operators} max</td>
            <td class="text-center">${totals.manifestos.toLocaleString()}</td>
            <td class="text-center">${totals.dives.toLocaleString()}</td>
            <td class="text-right font-mono">${formatPhp(totals.revenue)}</td>
          </tr>
        </tfoot>
      </table>
    `;

    const diveTypesHtml =
      reportDiveTypes && reportDiveTypes.length > 0
        ? `
      <div style="margin-top: 24px;">
        <h3 style="font-size: 13px; font-weight: 700; color: #0f172a; margin-bottom: 8px; text-transform: uppercase; letter-spacing: 0.05em;">
          Dive Type Aggregation Summary
        </h3>
        <table>
          <thead>
            <tr>
              <th>Dive Type</th>
              <th class="text-center">Manifests Filed</th>
              <th class="text-center">Divers Logged</th>
              <th class="text-right">Activity Share (%)</th>
            </tr>
          </thead>
          <tbody>
            ${reportDiveTypes
              .map(
                (dt) => `
              <tr>
                <td class="font-semibold">${dt.name}</td>
                <td class="text-center">${dt.manifests.toLocaleString()}</td>
                <td class="text-center">${dt.dives.toLocaleString()}</td>
                <td class="text-right font-mono">${dt.percentage}%</td>
              </tr>`,
              )
              .join("")}
          </tbody>
        </table>
      </div>
    `
        : "";

    openPrintDocument({
      title: `Municipal Dive Tourism Summary Report (${range.toUpperCase()})`,
      documentType: "Executive Tourism Report",
      periodOrDate: `${dateFrom || "Start"} to ${dateTo || "Present"}`,
      bodyHtml: `${kpiHtml}${tableHtml}${diveTypesHtml}`,
      paperFormat: docFormat.trim() || "A4",
    });
    pushAuditLog(`Printed official ${range} report document`);
  };

  return (
    <div className="space-y-6">
      {isLive && metrics.isPending && (
        <p
          role="status"
          aria-live="polite"
          className="text-sm text-muted-foreground"
        >
          Loading report metrics&hellip;
        </p>
      )}
      {isLive && metrics.isError && (
        <MetricsError label="report" state={metrics} compact />
      )}
      <Card className="p-6 shadow-elegant">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h3 className="font-display font-semibold text-lg">
              Generate report
            </h3>
            <p className="text-sm text-muted-foreground">
              Aggregate municipal tourism data across configurable time windows.
            </p>
          </div>
          <Button
            className="gradient-primary text-primary-foreground shrink-0 shadow-sm"
            onClick={generateReport}
            disabled={generating || (isLive && metrics.isPending)}
          >
            {generating ? (
              <Loader2 className="size-4 mr-1.5 animate-spin" />
            ) : (
              <FileBarChart className="size-4 mr-1.5" />
            )}
            {generating ? "Generating…" : "Generate report"}
          </Button>
        </div>

        <div className="mt-5 flex flex-col gap-3 rounded-xl border border-border/60 bg-secondary/40 p-3 sm:flex-row sm:flex-wrap sm:items-center">
          <Tabs value={range} onValueChange={setRange}>
            <TabsList className="bg-secondary">
              <TabsTrigger value="daily">Daily</TabsTrigger>
              <TabsTrigger value="weekly">Weekly</TabsTrigger>
              <TabsTrigger value="monthly">Monthly</TabsTrigger>
            </TabsList>
          </Tabs>

          <div className="hidden sm:block h-6 w-px bg-border" />

          {/* Quick Presets */}
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="sm"
              onClick={() => applyPreset("30d")}
              className="h-8 text-xs px-2.5"
            >
              30d
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => applyPreset("thisMonth")}
              className="h-8 text-xs px-2.5"
            >
              This Month
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => applyPreset("lastMonth")}
              className="h-8 text-xs px-2.5"
            >
              Last Month
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => applyPreset("ytd")}
              className="h-8 text-xs px-2.5"
            >
              YTD
            </Button>
          </div>

          <div className="hidden sm:block h-6 w-px bg-border" />

          <div className="flex items-center gap-2">
            <Label className="text-xs text-muted-foreground whitespace-nowrap">
              From
            </Label>
            <Input
              type="date"
              max={dateTo || todayInManila()}
              value={dateFrom}
              onChange={(e) => {
                setDateFrom(clampDateToToday(e.target.value));
                setReportData(null);
    setReportDiveTypes(null);
              }}
              className="w-36 h-8 text-xs"
            />
          </div>
          <div className="flex items-center gap-2">
            <Label className="text-xs text-muted-foreground whitespace-nowrap">
              To
            </Label>
            <Input
              type="date"
              min={dateFrom || undefined}
              max={todayInManila()}
              value={dateTo}
              onChange={(e) => {
                setDateTo(clampDateToToday(e.target.value));
                setReportData(null);
    setReportDiveTypes(null);
              }}
              className="w-36 h-8 text-xs"
            />
          </div>
        </div>
      </Card>

      {/* Export Action Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card
          className="p-5 shadow-elegant border-border/60 hover:border-primary/40 hover:shadow-glow transition-all cursor-pointer group"
          onClick={printOfficialReport}
        >
          <div className="flex items-start gap-4">
            <div className="size-11 rounded-xl bg-primary-soft text-primary flex items-center justify-center group-hover:gradient-primary group-hover:text-primary-foreground transition-colors shrink-0 mt-0.5">
              <Printer className="size-5" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-display font-semibold text-foreground group-hover:text-primary transition-colors">
                Print PDF Report
              </div>
              <div className="text-xs text-muted-foreground mt-0.5">
                Formatted {docFormat.trim() || "A4"} document for tourism office.
              </div>
              <div
                className="flex items-center gap-2 mt-2.5"
                onClick={(e) => e.stopPropagation()}
              >
                <span className="text-[11px] text-muted-foreground whitespace-nowrap">Format:</span>
                <Input
                  value={docFormat}
                  onChange={(e) => setDocFormat(e.target.value)}
                  placeholder="e.g. A4, Letter, Legal"
                  className="h-6 w-24 text-xs px-2 py-0 bg-background"
                />
                <div className="flex items-center gap-1">
                  {["A4", "Letter", "Legal"].map((fmt) => (
                    <button
                      key={fmt}
                      type="button"
                      onClick={() => setDocFormat(fmt)}
                      className={`text-[10px] px-1.5 py-0.5 rounded border transition-colors ${
                        docFormat === fmt
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-muted/60 text-muted-foreground hover:bg-muted border-border"
                      }`}
                    >
                      {fmt}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </Card>

        <Card
          className="p-5 shadow-elegant border-border/60 hover:border-primary/40 hover:shadow-glow transition-all cursor-pointer group"
          onClick={exportCsv}
        >
          <div className="flex items-center gap-4">
            <div className="size-11 rounded-xl bg-primary-soft text-primary flex items-center justify-center group-hover:gradient-primary group-hover:text-primary-foreground transition-colors shrink-0">
              <FileDown className="size-5" />
            </div>
            <div>
              <div className="font-display font-semibold text-foreground group-hover:text-primary transition-colors">
                Export Raw Data as CSV
              </div>
              <div className="text-xs text-muted-foreground mt-0.5">
                Full tabular breakdown for Excel and Google Sheets.
              </div>
            </div>
          </div>
        </Card>
      </div>

      {reportData && (
        <div className="space-y-4">
        <SectionCard
          title={`Report preview — ${range.charAt(0).toUpperCase() + range.slice(1)} (${dateFrom || "Start"} to ${dateTo || "Present"})`}
        >
          <Table>
            <TableHeader>
              <TableRow className="bg-secondary/50">
                <TableHead>Period</TableHead>
                <TableHead>Tourists</TableHead>
                <TableHead>Operators</TableHead>
                <TableHead>Manifestos</TableHead>
                <TableHead>Dives</TableHead>
                <TableHead className="text-right">Revenue</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {reportData.map((r, i) => (
                <TableRow key={i}>
                  <TableCell className="font-medium">{r.period}</TableCell>
                  <TableCell>{r.tourists.toLocaleString()}</TableCell>
                  <TableCell>{r.operators}</TableCell>
                  <TableCell>{r.manifestos.toLocaleString()}</TableCell>
                  <TableCell>{r.dives.toLocaleString()}</TableCell>
                  <TableCell className="text-right font-mono">
                    {formatPhp(r.revenue)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </SectionCard>

        {reportDiveTypes && reportDiveTypes.length > 0 && (
          <SectionCard title="Report Dive Type Aggregation">
            <Table>
              <TableHeader>
                <TableRow className="bg-secondary/50">
                  <TableHead>Dive Type</TableHead>
                  <TableHead className="text-center">Manifests Filed</TableHead>
                  <TableHead className="text-center">Total Divers Logged</TableHead>
                  <TableHead className="text-right">Activity Share</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {reportDiveTypes.map((dt, i) => (
                  <TableRow key={i}>
                    <TableCell className="font-semibold text-foreground">
                      <div className="flex items-center gap-2">
                        <span
                          className="size-2.5 rounded-sm shrink-0"
                          style={{
                            background: TYPE_COLORS[i % TYPE_COLORS.length],
                          }}
                        />
                        {dt.name}
                      </div>
                    </TableCell>
                    <TableCell className="text-center font-mono">
                      {dt.manifests.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-center font-mono">
                      {dt.dives.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      <Badge variant="outline" className="text-xs font-bold">
                        {dt.percentage}%
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </SectionCard>
        )}
      </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <SectionCard title="Trend — Dives over time">
          <div className="h-80">
            {isEmptyChartData(filteredTrends) ? (
              <ChartEmptyState className="h-80" />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={filteredTrends} margin={{ left: -12 }}>
                  <defs>
                    <linearGradient id="rpt" x1="0" y1="0" x2="0" y2="1">
                      <stop
                        offset="0%"
                        stopColor="var(--color-primary)"
                        stopOpacity={0.4}
                      />
                      <stop
                        offset="100%"
                        stopColor="var(--color-primary)"
                        stopOpacity={0}
                      />
                    </linearGradient>
                  </defs>
                  <CartesianGrid
                    stroke="var(--color-border)"
                    strokeDasharray="3 6"
                    vertical={false}
                  />
                  <XAxis dataKey="m" {...chartAxisProps} />
                  <YAxis {...chartAxisProps} />
                  <Tooltip contentStyle={chartTooltipStyle} />
                  <Area
                    type="monotone"
                    dataKey="dives"
                    stroke="var(--color-primary)"
                    strokeWidth={2.5}
                    fill="url(#rpt)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </SectionCard>

        {/* Chart 2: NEW Chart - Dive Type Aggregation */}
        <SectionCard
          title="Dive Type Aggregation"
          insight="reports.diveTypeDistribution"
        >
          {isEmptyChartData(diveTypeChartData) ? (
            <ChartEmptyState className="h-80" />
          ) : (
            <div className="h-80 flex flex-col justify-between">
              <div className="flex-1 min-h-[210px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={diveTypeChartData}
                      cx="50%"
                      cy="50%"
                      innerRadius={55}
                      outerRadius={88}
                      paddingAngle={3}
                      dataKey="value"
                      stroke="none"
                    >
                      {diveTypeChartData.map((_, i) => (
                        <Cell
                          key={i}
                          fill={TYPE_COLORS[i % TYPE_COLORS.length]}
                        />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(val, name, item) => [
                        `${val}% (${item.payload.dives?.toLocaleString() ?? 0} divers, ${item.payload.manifests?.toLocaleString() ?? 0} manifests)`,
                        name,
                      ]}
                      contentStyle={chartTooltipStyle}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              {/* Interactive Legend Pills */}
              <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 pt-2 border-t border-border/40">
                {diveTypeChartData.map((t, i) => (
                  <div
                    key={t.name}
                    className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <span
                      className="size-2.5 rounded-sm shrink-0"
                      style={{
                        background: TYPE_COLORS[i % TYPE_COLORS.length],
                      }}
                    />
                    <span className="font-medium text-foreground">{t.name}</span>
                    <span className="text-[11px] text-muted-foreground">
                      ({t.value}%)
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </SectionCard>
      </div>
    </div>
  );
}
