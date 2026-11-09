import {
  useState,
  useEffect,
  useRef,
  type CSSProperties,
  type ReactNode,
} from "react";
import { motion, useInView, AnimatePresence } from "framer-motion";
import {
  ArrowUpRight,
  ArrowDownRight,
  X,
  Sparkles,
  Info,
  Lightbulb,
  type LucideIcon,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/popover";
import {
  resolveChartInsight,
  type ChartInsight,
} from "@/lib/chart-insights";
import {
  TableCell,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export const chartTooltipStyle: CSSProperties = {
  background: "var(--color-card)",
  border: "1px solid var(--color-border)",
  borderRadius: 12,
  color: "var(--color-foreground)",
  fontSize: 12,
  boxShadow: "0 10px 30px rgb(0 0 0 / 0.12)",
};

export const chartAxisProps = {
  stroke: "var(--color-muted-foreground)",
  fontSize: 12,
  tickLine: false,
  axisLine: false,
};

export function useMounted() {
  const [m, setM] = useState(false);
  useEffect(() => setM(true), []);
  return m;
}

export function useCountUp(target: number, duration = 900) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "0px" });
  const [val, setVal] = useState(target);
  useEffect(() => {
    if (!inView) {
      setVal(target);
      return;
    }
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setVal(Math.round(target * eased));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [inView, target, duration]);
  return { ref, val: inView ? val : target };
}

export function CountUp({
  value,
  className,
}: {
  value: string;
  className?: string;
}) {
  // Capture decimals so "4.9" does not animate down to "5" mid-flight.
  const m = value.match(/[\d,]+(?:\.\d+)?/);
  const num = m ? Number(m[0].replace(/,/g, "")) : NaN;
  const prefix = m ? value.slice(0, m.index) : "";
  const suffix = m ? value.slice((m.index ?? 0) + m[0].length) : "";
  const decimals = m?.[0].includes(".") ? m[0].split(".")[1].length : 0;
  const factor = 10 ** decimals;
  const { ref, val } = useCountUp(
    Number.isNaN(num) ? 0 : Math.round(num * factor),
  );
  if (Number.isNaN(num)) return <span className={className}>{value}</span>;
  return (
    <span ref={ref} className={className}>
      {prefix}
      {decimals > 0
        ? (val / factor).toFixed(decimals)
        : val.toLocaleString()}
      {suffix}
    </span>
  );
}

export function Reveal({
  children,
  delay = 0,
  className = "",
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
}) {
  // Previously used framer-motion whileInView which stays hidden (opacity 0)
  // when inside hidden TabsContent (display:none). This caused all charts
  // (Recharts ResponsiveContainer) to measure 0 and stay blank in Analytics.
  // Fix: render immediately without viewport animation. Keeps layout stable
  // for Recharts measurement.
  void delay;
  return <div className={className}>{children}</div>;
}

export function PageTransition({
  section,
  children,
}: {
  section: string;
  children: ReactNode;
}) {
  const mounted = useMounted();
  if (!mounted) return <div>{children}</div>;
  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={section}
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        transition={{ duration: 0.28, ease: "easeOut" }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}

export function StatCard({
  icon: Icon,
  label,
  value,
  delta,
  /** Period the delta compares against — never assume "last month". */
  deltaLabel = "vs previous period",
  up = true,
  sample = false,
  info,
}: {
  icon: LucideIcon;
  label: string;
  value: string | number;
  delta?: string;
  deltaLabel?: string;
  up?: boolean;
  /** Mark a demo-only figure so connected deployments cannot imply it is real. */
  sample?: boolean;
  /** Concise metric formula or analytical context displayed in a lightweight popover. */
  info?: string;
}) {
  return (
    <Card className="p-5 shadow-elegant border-border/60 hover:border-primary/30 hover:shadow-glow-sm transition-all hover-lift h-full flex flex-col">
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-1.5 text-xs uppercase tracking-wider text-muted-foreground">
            <span>{label}</span>
            {info && (
              <Popover>
                <PopoverTrigger asChild>
                  <span
                    role="button"
                    tabIndex={0}
                    onClick={(e) => e.stopPropagation()}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.stopPropagation();
                      }
                    }}
                    aria-label={`About ${label}`}
                    title="Metric definition & formula"
                    className="cursor-pointer text-muted-foreground/60 hover:text-foreground inline-flex items-center p-0.5 rounded transition-colors focus-visible:outline-none"
                  >
                    <Info className="size-3" />
                  </span>
                </PopoverTrigger>
                <PopoverContent
                  side="top"
                  align="start"
                  sideOffset={6}
                  onClick={(e) => e.stopPropagation()}
                  className="w-64 p-3 text-xs text-muted-foreground shadow-lg leading-relaxed z-50 bg-card/95 backdrop-blur-md border-border/80"
                >
                  <p className="font-semibold text-foreground text-[11px] uppercase tracking-wider mb-1">
                    {label}
                  </p>
                  <p>{info}</p>
                </PopoverContent>
              </Popover>
            )}
            {sample && (
              <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-1.5 py-0.5 text-[9px] font-semibold normal-case tracking-normal text-amber-700 dark:text-amber-400">
                Sample
              </span>
            )}
          </div>
          <div className="mt-2 text-3xl font-display font-bold tracking-tight">
            <CountUp value={String(value)} />
          </div>
        </div>
        <div className="size-10 rounded-xl bg-primary-soft text-primary flex items-center justify-center">
          <Icon className="size-5" />
        </div>
      </div>
      {delta ? (
        <div className="mt-3 flex items-center gap-1 text-xs">
          <span
            className={`inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 font-medium ${
              up
                ? "bg-success/10 text-success"
                : "bg-destructive/10 text-destructive"
            }`}
          >
            {up ? (
              <ArrowUpRight className="size-3" />
            ) : (
              <ArrowDownRight className="size-3" />
            )}
            {delta}
          </span>
          <span className="text-muted-foreground">{deltaLabel}</span>
        </div>
      ) : (
        <div className="mt-3 h-[22px]" aria-hidden />
      )}
    </Card>
  );
}

export function TableSkeletonRows({
  rows = 5,
  cols,
}: {
  rows?: number;
  cols: number;
}) {
  return (
    <>
      {Array.from({ length: rows }).map((_, row) => (
        <TableRow key={row}>
          {Array.from({ length: cols }).map((_, col) => (
            <TableCell key={col} className="py-3">
              <Skeleton className="h-5 w-full" />
            </TableCell>
          ))}
        </TableRow>
      ))}
    </>
  );
}

export function CardGridSkeleton({ count = 3 }: { count?: number }) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <Card
          key={i}
          className="p-0 overflow-hidden shadow-elegant border-border/60"
        >
          <Skeleton className="aspect-[4/3] rounded-none" />
          <div className="p-3 space-y-2">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-1/3" />
            <div className="flex gap-1.5 pt-1">
              <Skeleton className="h-8 flex-1" />
              <Skeleton className="h-8 flex-1" />
            </div>
          </div>
        </Card>
      ))}
    </>
  );
}

export function ChartInsightButton({
  title,
  insight,
}: {
  title?: ReactNode;
  insight: ChartInsight | string;
}) {
  const data = resolveChartInsight(insight);
  if (!data) return null;

  const displayTitle = typeof title === "string" ? title : "Chart Guide & Insights";

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={`Guide & Insights for ${displayTitle}`}
          title="Chart Guide & Insights"
          className="inline-flex items-center justify-center size-6 rounded-md text-muted-foreground/80 hover:text-primary hover:bg-primary/10 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary cursor-pointer shrink-0"
        >
          <Sparkles className="size-3.5 text-primary" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        sideOffset={6}
        className="w-80 sm:w-96 p-4 shadow-xl border-border/80 bg-card/95 backdrop-blur-md rounded-xl space-y-3 z-50 text-left"
      >
        <div className="flex items-center justify-between gap-2 border-b border-border/60 pb-2.5">
          <div className="flex items-center gap-2 min-w-0">
            <div className="size-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
              <Sparkles className="size-4" />
            </div>
            <div className="min-w-0">
              <h4 className="font-display font-semibold text-xs truncate leading-tight">
                {displayTitle}
              </h4>
              <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">
                Guide & Analytical Insights
              </p>
            </div>
          </div>
          <Badge variant="outline" className="text-[9px] font-medium bg-secondary/50 shrink-0">
            MTO Guide
          </Badge>
        </div>

        {/* Section 1: About this chart */}
        <div className="space-y-1">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
            <Info className="size-3.5 text-primary shrink-0" />
            <span>About this chart</span>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed pl-5">
            {data.description}
          </p>
        </div>

        {/* Section 2: Insights */}
        {((data.insights && data.insights.length > 0) || (data.takeaways && data.takeaways.length > 0)) && (
          <div className="space-y-1.5 pt-1 border-t border-border/40">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
              <Lightbulb className="size-3.5 text-amber-500 shrink-0" />
              <span>Insights we can get from this chart</span>
            </div>
            <ul className="text-xs text-muted-foreground space-y-1.5 pl-5 list-disc marker:text-primary/60 leading-relaxed">
              {(data.insights ?? data.takeaways ?? []).map((point, i) => (
                <li key={i}>{point}</li>
              ))}
            </ul>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

export function SectionCard({
  title,
  subtitle,
  action,
  insight,
  sample = false,
  children,
  className = "",
}: {
  title: ReactNode;
  subtitle?: string;
  action?: ReactNode;
  insight?: ChartInsight | string;
  /** Panel is rendered from demo fixtures, not the live database. */
  sample?: boolean;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <Card className={`p-5 shadow-elegant border-border/60 ${className}`}>
      <div className="flex items-start justify-between gap-3 mb-4">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="font-display font-semibold">{title}</h3>
            {insight && <ChartInsightButton title={title} insight={insight} />}
            {sample && (
              <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-400">
                Sample data
              </span>
            )}
          </div>
          {subtitle && (
            <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p>
          )}
        </div>
        {action}
      </div>
      {children}
    </Card>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    Active: "bg-success/10 text-success border-success/20",
    Approved: "bg-success/10 text-success border-success/20",
    Completed: "bg-success/10 text-success border-success/20",
    Published: "bg-success/10 text-success border-success/20",
    Pending: "bg-warning/15 text-warning-foreground border-warning/30",
    Scheduled: "bg-warning/15 text-warning-foreground border-warning/30",
    Expiring: "bg-warning/15 text-warning-foreground border-warning/30",
    Draft: "bg-muted text-muted-foreground border-border",
    Expired: "bg-muted text-muted-foreground border-border",
    Archived: "bg-muted text-muted-foreground border-border",
    Rejected: "bg-destructive/10 text-destructive border-destructive/20",
    Suspended: "bg-destructive/10 text-destructive border-destructive/20",
    Overdue: "bg-destructive/10 text-destructive border-destructive/20",
    Active_dives: "bg-info/10 text-info border-info/20",
  };
  return (
    <Badge variant="outline" className={`${map[status] ?? ""} font-medium`}>
      {status}
    </Badge>
  );
}

export function Field({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="rounded-lg bg-secondary/60 px-3 py-2 min-w-0 overflow-hidden">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div className="font-medium mt-0.5 break-words">{value}</div>
    </div>
  );
}

export function ActiveFilterBadges({
  filters,
  onRemove,
}: {
  filters: { key: string; label: string }[];
  onRemove: (key: string) => void;
}) {
  if (filters.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1.5">
      {filters.map((f) => (
        <Badge
          key={f.key}
          variant="secondary"
          className="gap-1 pl-2 pr-1 py-0.5 text-xs"
        >
          {f.label}
          <button
            onClick={() => onRemove(f.key)}
            className="ml-0.5 rounded-full hover:bg-muted p-0.5"
          >
            <X className="size-3" />
          </button>
        </Badge>
      ))}
    </div>
  );
}

export function EntityLink({
  onClick,
  children,
  className = "",
}: {
  onClick: () => void;
  children: ReactNode;
  className?: string;
}) {
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className={`text-foreground underline decoration-dotted underline-offset-2 hover:text-primary hover:decoration-solid transition-colors ${className}`}
    >
      {children}
    </button>
  );
}

export function DrilldownDialog({
  open,
  onOpenChange,
  title,
  subtitle,
  stats,
  children,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  title: string;
  subtitle?: string;
  stats?: { label: string; value: string | number; icon?: LucideIcon }[];
  children?: React.ReactNode;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display text-lg">{title}</DialogTitle>
          {subtitle && (
            <p className="text-sm text-muted-foreground">{subtitle}</p>
          )}
        </DialogHeader>
        {stats && stats.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {stats.map((s) => (
              <Card key={s.label} className="p-3 shadow-elegant">
                <div className="flex items-center gap-2">
                  {s.icon && (
                    <div className="size-8 rounded-lg bg-primary-soft text-primary flex items-center justify-center">
                      <s.icon className="size-4" />
                    </div>
                  )}
                  <div>
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                      {s.label}
                    </div>
                    <div className="text-lg font-display font-bold">
                      {s.value}
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
        {children}
      </DialogContent>
    </Dialog>
  );
}


export function DataSourceBadge({
  live,
  isError = false,
  isLoading = false,
}: {
  live: boolean;
  isError?: boolean;
  isLoading?: boolean;
}) {
  if (!live) {
    return (
      <span
        title="Supabase is not configured — showing built-in demo data"
        className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-xs font-medium text-amber-700 dark:text-amber-400"
      >
        <span className="size-1.5 rounded-full bg-amber-500" />
        Demo data
      </span>
    );
  }
  if (isError) {
    return (
      <span
        title="Live query failed — showing demo fallback. Check the Supabase connection."
        className="inline-flex items-center gap-1.5 rounded-full border border-destructive/30 bg-destructive/10 px-2.5 py-1 text-xs font-medium text-destructive"
      >
        <span className="size-1.5 rounded-full bg-destructive" />
        Live error — demo fallback
      </span>
    );
  }
  return (
    <span
      title={
        isLoading
          ? "Connected to Supabase — loading live data"
          : "Connected to Supabase — showing live data"
      }
      className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-700 dark:text-emerald-400"
    >
      <span
        className={`size-1.5 rounded-full bg-emerald-500 ${isLoading ? "animate-pulse" : ""}`}
      />
      Live
    </span>
  );
}
