import { keepPreviousData, useQuery } from "@tanstack/react-query";
import {
  bucketStarts,
  bucketLabel,
  type DateRange,
  type RangeGrain,
  daysBetween,
  addDaysIso,
  MONTH_LABELS,
} from "@/lib/period";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";

/* ------------------------------ SHARED SHAPES ------------------------------ */

export interface CountRow {
  name: string;
  count: number;
}

export interface DailyTourists {
  date: string;
  tourists: number;
  divers: number;
  revenue: number;
}

export interface DailyDiveActivity {
  date: string;
  manifests: number;
  divers: number;
}

export interface DailyTourist {
  date: string;
  all: number;
  domestic: number;
  international: number;
}

export interface DailyRevenue {
  date: string;
  revenue: number;
}

export interface DailyInventory {
  date: string;
  passType: string;
  purchased: number;
  remaining: number;
  amount: number;
}

export interface SiteMetric {
  id: string;
  name: string;
  barangay: string;
  types: string[];
  status: string;
  dives: number;
  description: string;
  depth: string;
  difficulty: string;
}

export interface OverviewMetrics {
  tourists: number;
  touristsPrev: number;
  activeIds: number;
  todayDivers: number;
  yesterdayDivers: number;
  approvedOperators: number;
  activeSites: number;
  revenue: number;
  revenuePrev: number;
  pendingReceipts: number;
  oldestPendingReceiptDays: number;
  pendingApplications: number;
  oldestPendingAppDays: number;
  expiringPasses: number;
  series: DailyTourists[];
  nationality: CountRow[];
  level: CountRow[];
  diveTypes: CountRow[];
  topSites: Array<{ name: string; divers: number; manifests: number }>;
  sites: SiteMetric[];
}

export interface TouristMetrics {
  total: number;
  totalPrev: number;
  divers: number;
  diversPrev: number;
  newNationalities: number;
  totals: {
    all: number;
    domestic: number;
    international: number;
    prevAll: number;
    prevDomestic: number;
    prevInternational: number;
  };
  nationalities: Array<CountRow & { domestic: boolean }>;
  levels: Array<CountRow & { domestic: boolean }>;
  nationalityLevels: Array<{
    nationality: string;
    level: string;
    domestic: boolean;
    count: number;
  }>;
  daily: DailyTourist[];
}

export interface TouristPreferenceMetrics {
  totalPlans: number;
  totalPlansPrev: number;
  avgStayDays: number;
  avgGroupSize: number;
  avgBudget: number;
  topActivity: string;
  activities: Array<{ name: string; count: number; percentage: number }>;
  stayDurations: Array<{ duration: string; count: number; percentage: number }>;
  groupSizes: Array<{ name: string; count: number; percentage: number }>;
  budgetTiers: Array<{ tier: string; count: number; percentage: number }>;
  demandTrends: Array<{ date: string; requests: number }>;
}

export interface DiveActivityMetrics {
  divers: number;
  diversPrev: number;
  manifests: number;
  manifestsPrev: number;
  sitesUsed: number;
  unverified: number;
  daily: DailyDiveActivity[];
  types: CountRow[];
  siteTypes: Array<{ site: string; type: string; divers: number }>;
  seasonal: Array<{ season: string; divers: number; trips: number }>;
  capacity: Array<{
    site: string;
    maxCapacity: number;
    actualDives: number;
  }>;
  hourly?: Array<{ hour: string; manifests: number; dives: number }>;
  depths?: Array<{ range: string; count: number; divers?: number }>;
}

export interface DivePassMetrics {
  revenue: number;
  revenuePrev: number;
  creditsUsed: number;
  creditsUsedPrev?: number;
  lifetimeUsed?: number;
  purchased: number;
  remaining: number;
  pendingReceipts: number;
  pendingAmount?: number;
  oldestPendingReceiptDays: number;
  dailyRevenue: DailyRevenue[];
  inventory: DailyInventory[];
  passTypes: Array<{
    type: string;
    purchased: number;
    used: number;
    amount: number;
  }>;
}

export interface EstablishmentMetricRow {
  name: string;
  owner: string;
  location: string;
  status: string;
  manifestos: number;
  divers?: number;
  creditBalance: number;
  remainingCredits?: number;
  createdAt: string;
}

export interface EstablishmentMetrics {
  total: number;
  active: number;
  suspended: number;
  pendingApplications: number;
  establishments: EstablishmentMetricRow[];
}

export interface OperatorMetricRow {
  name: string;
  manifestos: number;
  divers: number;
  credits: number;
  purchased: number;
  remaining: number;
  revenue: number;
  recent: Array<{
    id: string;
    site: string;
    divers: number;
    date: string;
  }>;
}

export interface OperatorMetrics {
  active: number;
  activePrev?: number;
  operators: number;
  manifestos: number;
  manifestosPrev: number;
  divers: number;
  diversPrev: number;
  revenue: number;
  revenuePrev: number;
  rows: OperatorMetricRow[];
}

export interface DailyReport {
  date: string;
  tourists: number;
  operators: number;
  manifestos: number;
  divers: number;
  revenue: number;
}

export interface DiveTypeAggregate {
  name: string;
  count: number;
  manifests: number;
  value?: number;
}

export interface ReportMetrics {
  daily: DailyReport[];
  diveTypes?: DiveTypeAggregate[];
}

export interface TouristSampleRow {
  name: string;
  nationality: string;
  level: string;
  status: string;
}

export interface MetricsBySection {
  overview: OverviewMetrics;
  tourist: TouristMetrics;
  dive_activity: DiveActivityMetrics;
  dive_pass: DivePassMetrics;
  establishment: EstablishmentMetrics;
  operator: OperatorMetrics;
  report: ReportMetrics;
}

export type MetricsSection = keyof MetricsBySection;

/* ------------------------------ DATA ACCESS ------------------------------ */

export const metricsQueryKey = (section: string, range: DateRange) =>
  ["metrics", section, range.from, range.to] as const;

async function fetchMetrics<S extends MetricsSection>(
  section: S,
  range: DateRange,
): Promise<MetricsBySection[S]> {
  const { data, error } = await supabase.rpc("to_metrics", {
    p_section: section,
    p_from: range.from,
    p_to: range.to,
  });
  if (error) throw error;
  if (!data || typeof data !== "object") {
    throw new Error("Metrics backend returned an empty response.");
  }
  return normalizeMetrics(section, data as MetricsBySection[S]);
}

export function useMetrics<S extends MetricsSection>(
  section: S,
  range: DateRange,
) {
  return useQuery({
    queryKey: metricsQueryKey(section, range),
    queryFn: () => fetchMetrics(section, range),
    enabled: isSupabaseConfigured,
    staleTime: 30_000,
    retry: 1,
    placeholderData: keepPreviousData,
  });
}

export interface TouristSampleFilter {
  nationality?: string | null;
  level?: string | null;
  excludeNationalities?: string[];
}

export function useTouristSample(
  range: DateRange,
  filter: TouristSampleFilter,
  enabled = true,
) {
  return useQuery({
    queryKey: [
      "metrics",
      "tourist_sample",
      range.from,
      range.to,
      filter.nationality ?? "",
      filter.level ?? "",
      filter.excludeNationalities?.join("|") ?? "",
    ],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("to_tourist_sample", {
        p_from: range.from,
        p_to: range.to,
        p_nationality: filter.nationality || null,
        p_level: filter.level || null,
        p_exclude_nationalities: filter.excludeNationalities ?? [],
      });
      if (error) throw error;
      const rows = (data as { rows?: TouristSampleRow[] } | null)?.rows;
      return Array.isArray(rows)
        ? rows.map((row) => ({
            ...row,
            nationality: displayNationality(row.nationality) || "Unknown",
          }))
        : [];
    },
    enabled: isSupabaseConfigured && enabled,
    staleTime: 30_000,
    retry: 1,
  });
}

export const DIVE_PLAN_ACTIVITIES = [
  "Fun / Reef Diving",
  "Macro & Muck Photography",
  "Introductory / Discover Scuba",
  "Night Diving",
  "Wreck & Deep Diving",
  "Snorkeling & Freediving",
  "Marine Life & Turtles",
  "Coral Conservation / Eco-Dive",
] as const;

export const DIVE_PLAN_STAY_DURATIONS = [
  "Day Trip (1 Day)",
  "2 Days (Weekend)",
  "3 Days (Long Weekend)",
  "4–5 Days",
  "1 Week (7 Days)",
  "Extended Stay (8+ Days)",
] as const;

export const mockTouristPreferences: TouristPreferenceMetrics = {
  totalPlans: 428,
  totalPlansPrev: 382,
  avgStayDays: 2.8,
  avgGroupSize: 2.6,
  avgBudget: 8500,
  topActivity: "Fun / Reef Diving",
  activities: [
    { name: "Fun / Reef Diving", count: 125, percentage: 29 },
    { name: "Macro & Muck Photography", count: 98, percentage: 23 },
    { name: "Introductory / Discover Scuba", count: 64, percentage: 15 },
    { name: "Night Diving", count: 42, percentage: 10 },
    { name: "Wreck & Deep Diving", count: 35, percentage: 8 },
    { name: "Marine Life & Turtles", count: 28, percentage: 7 },
    { name: "Snorkeling & Freediving", count: 21, percentage: 5 },
    { name: "Coral Conservation / Eco-Dive", count: 15, percentage: 3 },
  ],
  stayDurations: [
    { duration: "2 Days (Weekend)", count: 172, percentage: 40 },
    { duration: "3 Days (Long Weekend)", count: 110, percentage: 26 },
    { duration: "Day Trip (1 Day)", count: 58, percentage: 14 },
    { duration: "4–5 Days", count: 45, percentage: 10 },
    { duration: "1 Week (7 Days)", count: 28, percentage: 7 },
    { duration: "Extended Stay (8+ Days)", count: 15, percentage: 3 },
  ],
  groupSizes: [
    { name: "Buddy Pair (2)", count: 197, percentage: 46 },
    { name: "Small Group (3–5)", count: 133, percentage: 31 },
    { name: "Solo Diver (1)", count: 64, percentage: 15 },
    { name: "Large Group (6+)", count: 34, percentage: 8 },
  ],
  budgetTiers: [
    { tier: "Moderate (₱5,000 - ₱10,000)", count: 215, percentage: 50 },
    { tier: "Budget (< ₱5,000)", count: 105, percentage: 25 },
    { tier: "Premium (₱10,000 - ₱20,000)", count: 72, percentage: 17 },
    { tier: "Luxury (> ₱20,000)", count: 36, percentage: 8 },
  ],
  demandTrends: [
    { date: "Oct 01", requests: 8 },
    { date: "Oct 05", requests: 12 },
    { date: "Oct 10", requests: 15 },
    { date: "Oct 15", requests: 14 },
    { date: "Oct 20", requests: 21 },
    { date: "Oct 25", requests: 28 },
    { date: "Oct 30", requests: 24 },
    { date: "Nov 02", requests: 31 },
  ],
};

export function normalizeActivity(str: string | null | undefined): string {
  if (!str) return "Fun / Reef Diving";
  const s = String(str).trim();
  const lower = s.toLowerCase();
  if (lower.includes("macro") || lower.includes("muck") || lower.includes("photo")) {
    return "Macro & Muck Photography";
  }
  if (
    lower.includes("intro") ||
    lower.includes("discover") ||
    lower.includes("beginner") ||
    lower.includes("training") ||
    lower.includes("course") ||
    lower.includes("scuba")
  ) {
    return "Introductory / Discover Scuba";
  }
  if (lower.includes("night")) return "Night Diving";
  if (lower.includes("wreck") || lower.includes("deep")) return "Wreck & Deep Diving";
  if (lower.includes("snorkel") || lower.includes("freediv")) return "Snorkeling & Freediving";
  if (
    lower.includes("turtle") ||
    lower.includes("marine life") ||
    lower.includes("pelagic") ||
    lower.includes("shark")
  ) {
    return "Marine Life & Turtles";
  }
  if (lower.includes("coral") || lower.includes("conservation") || lower.includes("eco")) {
    return "Coral Conservation / Eco-Dive";
  }
  if (lower.includes("fun") || lower.includes("reef")) return "Fun / Reef Diving";
  return "Fun / Reef Diving";
}

export function parseStayDays(str: string | null | undefined): number {
  if (!str) return 2;
  const s = String(str).toLowerCase();
  if (s.includes("day trip") || s.includes("1 day")) return 1;
  if (s.includes("2 day") || (s.includes("weekend") && !s.includes("long") && !s.includes("3"))) return 2;
  if (s.includes("3 day") || s.includes("long weekend") || s.includes("2–3") || s.includes("2-3")) return 3;
  if (s.includes("4–5") || s.includes("4-5")) return 4.5;
  if (s.includes("week") || s.includes("7 day") || s.includes("7")) return 7;
  if (s.includes("extended") || s.includes("8")) return 8;
  const match = s.match(/\d+(\.\d+)?/);
  return match ? Number(match[0]) : 2;
}

export function normalizeStayDuration(str: string | null | undefined): string {
  if (!str) return "2 Days (Weekend)";
  const s = String(str).trim();
  const lower = s.toLowerCase();
  if (lower.includes("day trip") || lower.includes("1 day")) return "Day Trip (1 Day)";
  if (lower.includes("2 day") || (lower.includes("weekend") && !lower.includes("long") && !lower.includes("3"))) {
    return "2 Days (Weekend)";
  }
  if (lower.includes("3 day") || lower.includes("long weekend") || lower.includes("2–3") || lower.includes("2-3")) {
    return "3 Days (Long Weekend)";
  }
  if (lower.includes("4–5") || lower.includes("4-5") || lower.includes("4") || lower.includes("5")) {
    return "4–5 Days";
  }
  if (lower.includes("week") || lower.includes("7 day") || lower.includes("7")) {
    return "1 Week (7 Days)";
  }
  if (lower.includes("extended") || lower.includes("8") || lower.includes("long stay")) {
    return "Extended Stay (8+ Days)";
  }
  return "2 Days (Weekend)";
}

export function parseBudgetNumber(str: string | null | undefined): number | null {
  if (!str) return null;
  const cleaned = String(str).replace(/[^\d.]/g, "");
  const num = parseFloat(cleaned);
  return !isNaN(num) && num > 0 ? num : null;
}

export function parseBudgetTier(str: string | null | undefined): string {
  const num = parseBudgetNumber(str);
  if (num !== null) {
    if (num < 5000) return "Budget (< ₱5,000)";
    if (num <= 10000) return "Moderate (₱5,000 - ₱10,000)";
    if (num <= 20000) return "Premium (₱10,000 - ₱20,000)";
    return "Luxury (> ₱20,000)";
  }
  const s = String(str || "").toLowerCase();
  if (s.includes("budget") || s.includes("economy")) return "Budget (< ₱5,000)";
  if (s.includes("luxury") || s.includes("resort") || s.includes("high")) return "Luxury (> ₱20,000)";
  if (s.includes("premium")) return "Premium (₱10,000 - ₱20,000)";
  return "Moderate (₱5,000 - ₱10,000)";
}

export function useTouristPreferences(range: DateRange) {
  return useQuery({
    queryKey: ["metrics", "tourist_preferences", range.from, range.to],
    queryFn: async (): Promise<TouristPreferenceMetrics> => {
      if (!isSupabaseConfigured) return mockTouristPreferences;
      try {
        // Query real rows from dive_plan_inputs (populated by Sinsay AI Dive Planner)
        const { data: rows, error } = await supabase
          .from("dive_plan_inputs")
          .select("id, budget, group_size, preferred_activities, length_of_stay, created_at")
          .order("created_at", { ascending: true });

        if (error || !rows) {
          return mockTouristPreferences;
        }

        const days = daysBetween(range.from, range.to);
        const prevTo = addDaysIso(range.from, -1);
        const prevFrom = addDaysIso(prevTo, -(days - 1));

        // Filter for current and previous periods
        const currentRows = rows.filter((r) => {
          const day = String(r.created_at).slice(0, 10);
          return day >= range.from && day <= range.to;
        });

        const prevRows = rows.filter((r) => {
          const day = String(r.created_at).slice(0, 10);
          return day >= prevFrom && day <= prevTo;
        });

        // If the selected window has 0 rows, return accurate empty metrics
        if (currentRows.length === 0) {
          return {
            totalPlans: 0,
            totalPlansPrev: prevRows.length,
            avgStayDays: 0,
            avgGroupSize: 0,
            avgBudget: 0,
            topActivity: "None",
            activities: [],
            stayDurations: [],
            groupSizes: [],
            budgetTiers: [],
            demandTrends: [],
          };
        }

        const totalPlans = currentRows.length;
        const totalPlansPrev = prevRows.length;

        // 1. Average Group Size
        const avgGroupSize =
          Math.round(
            (currentRows.reduce((sum, r) => sum + (Number(r.group_size) || 1), 0) / totalPlans) * 10
          ) / 10;

        // 2. Average Stay Days
        const avgStayDays =
          Math.round(
            (currentRows.reduce((sum, r) => sum + parseStayDays(r.length_of_stay), 0) / totalPlans) * 10
          ) / 10;

        // 3. Average Planned Budget (PHP)
        const validBudgets = currentRows
          .map((r) => parseBudgetNumber(r.budget))
          .filter((b): b is number => b !== null);
        const avgBudget =
          validBudgets.length > 0
            ? Math.round(validBudgets.reduce((a, b) => a + b, 0) / validBudgets.length)
            : 8500;

        // 4. Preferred Activities (Canonical 8 Activities)
        const actCounts = new Map<string, number>();
        for (const r of currentRows) {
          const act = normalizeActivity(r.preferred_activities);
          actCounts.set(act, (actCounts.get(act) ?? 0) + 1);
        }
        const activities = [...actCounts.entries()]
          .sort((a, b) => b[1] - a[1])
          .map(([name, count]) => ({
            name,
            count,
            percentage: Math.round((count / totalPlans) * 100),
          }));
        const topActivity = activities[0]?.name ?? "None";

        // 5. Stay Durations (Canonical 6 Tiers)
        const stayCounts = new Map<string, number>();
        for (const r of currentRows) {
          const dur = normalizeStayDuration(r.length_of_stay);
          stayCounts.set(dur, (stayCounts.get(dur) ?? 0) + 1);
        }
        const stayDurations = [...stayCounts.entries()]
          .sort((a, b) => b[1] - a[1])
          .map(([duration, count]) => ({
            duration,
            count,
            percentage: Math.round((count / totalPlans) * 100),
          }));

        // 6. Group Sizes
        const groupBins: Record<string, number> = {
          "Solo Diver (1)": 0,
          "Buddy Pair (2)": 0,
          "Small Group (3-5)": 0,
          "Large Group (6+)": 0,
        };
        for (const r of currentRows) {
          const sz = Number(r.group_size) || 1;
          if (sz <= 1) groupBins["Solo Diver (1)"]++;
          else if (sz === 2) groupBins["Buddy Pair (2)"]++;
          else if (sz <= 5) groupBins["Small Group (3-5)"]++;
          else groupBins["Large Group (6+)"]++;
        }
        const groupSizes = Object.entries(groupBins)
          .filter(([_, count]) => count > 0)
          .map(([name, count]) => ({
            name,
            count,
            percentage: Math.round((count / totalPlans) * 100),
          }));

        // 7. Budget Tiers
        const budgetBins: Record<string, number> = {
          "Budget (< ₱5,000)": 0,
          "Moderate (₱5,000 - ₱10,000)": 0,
          "Premium (₱10,000 - ₱20,000)": 0,
          "Luxury (> ₱20,000)": 0,
        };
        for (const r of currentRows) {
          const tier = parseBudgetTier(r.budget);
          budgetBins[tier] = (budgetBins[tier] ?? 0) + 1;
        }
        const budgetTiers = Object.entries(budgetBins)
          .filter(([_, count]) => count > 0)
          .map(([tier, count]) => ({
            tier,
            count,
            percentage: Math.round((count / totalPlans) * 100),
          }));

        // 8. Daily Demand Trends
        const dayCounts = new Map<string, number>();
        for (const r of currentRows) {
          const day = String(r.created_at).slice(0, 10);
          dayCounts.set(day, (dayCounts.get(day) ?? 0) + 1);
        }
        const demandTrends = [...dayCounts.entries()]
          .sort((a, b) => a[0].localeCompare(b[0]))
          .map(([isoDate, requests]) => {
            const [, m, d] = isoDate.split("-");
            const monthName = MONTH_LABELS[Number(m) - 1] ?? m;
            return { date: `${monthName} ${d}`, requests };
          });

        return {
          totalPlans,
          totalPlansPrev,
          avgStayDays,
          avgGroupSize,
          avgBudget,
          topActivity,
          activities,
          stayDurations,
          groupSizes,
          budgetTiers,
          demandTrends,
        };
      } catch {
        return mockTouristPreferences;
      }
    },
    enabled: true,
    staleTime: 30_000,
    placeholderData: keepPreviousData,
  });
}

/* ------------------------------ NORMALISERS ------------------------------ */

export function displayNationality(value: string | null | undefined): string {
  const text = String(value ?? "").trim();
  return text ? text.charAt(0).toUpperCase() + text.slice(1) : "";
}

function normalizeMetrics<S extends MetricsSection>(
  section: S,
  metrics: MetricsBySection[S],
): MetricsBySection[S] {
  if (section === "overview") {
    const overview = metrics as OverviewMetrics;
    return {
      ...overview,
      nationality: overview.nationality.map((row) => ({
        ...row,
        name: displayNationality(row.name) || "Unknown",
      })),
    } as MetricsBySection[S];
  }
  if (section === "tourist") {
    const tourist = metrics as TouristMetrics;
    return {
      ...tourist,
      nationalities: tourist.nationalities.map((row) => ({
        ...row,
        name: displayNationality(row.name) || "Unknown",
      })),
      nationalityLevels: tourist.nationalityLevels.map((row) => ({
        ...row,
        nationality: displayNationality(row.nationality) || "Unknown",
      })),
    } as MetricsBySection[S];
  }
  return metrics;
}

export const DOMESTIC_NATIONALITIES = new Set([
  "philippines",
  "ph",
  "pilipinas",
  "filipino",
  "filipina",
]);

export function isDomesticNationality(
  value: string | null | undefined,
): boolean {
  return DOMESTIC_NATIONALITIES.has(
    String(value ?? "")
      .trim()
      .toLowerCase(),
  );
}

export const LEVEL_ORDER = [
  "Intro",
  "Open Water",
  "Advanced",
  "Rescue",
  "Divemaster",
  "Instructor",
] as const;

/** Map free-text certification levels to the dashboard's canonical buckets. */
export function normalizeLevel(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const s = raw.toLowerCase();
  if (s.includes("intro")) return "Intro";
  if (s.includes("open")) return "Open Water";
  if (s.includes("advanced")) return "Advanced";
  if (s.includes("rescue")) return "Rescue";
  if (s.includes("master")) return "Divemaster";
  if (s.includes("instructor")) return "Instructor";
  return null;
}

export const DIVING_TYPE_KEYS = [
  "scuba",
  "introDive",
  "funDive",
  "training",
  "freediver",
] as const;

export type DivingTypeKey = (typeof DIVING_TYPE_KEYS)[number];

export const DIVING_TYPE_LABELS: Record<DivingTypeKey, string> = {
  scuba: "Scuba",
  introDive: "Intro Dive",
  funDive: "Fun Dive",
  training: "Training",
  freediver: "Freediver",
};

export function normalizeDiveType(
  raw: string | null | undefined,
): DivingTypeKey | null {
  if (!raw) return null;
  const s = raw.toLowerCase();
  if (s.includes("scuba")) return "scuba";
  if (s.includes("intro")) return "introDive";
  if (s.includes("fun")) return "funDive";
  if (s.includes("train")) return "training";
  if (s.includes("free")) return "freediver";
  return null;
}

export function normalizeSeason(raw: string | null | undefined): string {
  const s = String(raw ?? "").toLowerCase();
  if (s.includes("amihan")) return "Amihan (Dry & Calm)";
  if (s.includes("habagat")) return "Habagat (Monsoon/Low)";
  if (s.includes("summer")) return "Summer (Peak Season)";
  if (s.startsWith("win")) return "Amihan (Dry & Calm)";
  if (s.startsWith("spr")) return "Summer (Peak Season)";
  if (s.startsWith("aut")) return "Habagat (Monsoon/Low)";
  return raw || "Unknown";
}

export function percent(count: number, total: number): number {
  return total > 0 ? Math.round((count / total) * 100) : 0;
}

/** Collapse a count list into top-N rows plus an "Other" bucket. */
export function topWithOther(
  rows: CountRow[],
  topN = 5,
): Array<CountRow & { value: number }> {
  const total = rows.reduce((sum, row) => sum + row.count, 0);
  const sorted = [...rows].sort((a, b) => b.count - a.count);
  const head = sorted.slice(0, topN).map((row) => ({
    ...row,
    value: percent(row.count, total),
  }));
  const rest = sorted.slice(topN).reduce((sum, row) => sum + row.count, 0);
  if (rest > 0) {
    head.push({ name: "Other", count: rest, value: percent(rest, total) });
  }
  return head;
}

/* ------------------------------ BUCKET HELPERS ------------------------------ */

export interface BucketBase {
  start: string;
  label: string;
}

/**
 * Zero-fill the selected range and fold daily RPC rows into its display grain.
 * Keeping aggregation in SQL and only bucketing labels client-side avoids two
 * different date-window implementations.
 */
export function aggregateDaily<Row, Acc extends object>(
  range: DateRange,
  rows: Row[],
  getDate: (row: Row) => string,
  create: () => Acc,
  add: (acc: Acc, row: Row) => void,
): Array<Acc & BucketBase> {
  const starts = bucketStarts(range.from, range.to, range.grain);
  const buckets = new Map<string, Acc & BucketBase>();
  for (const start of starts) {
    buckets.set(start, {
      start,
      label: bucketLabel(start, range.grain),
      ...create(),
    });
  }
  for (const row of rows) {
    const start = bucketStartOf(getDate(row), range.grain);
    const bucket = buckets.get(start);
    if (bucket) add(bucket, row);
  }
  return [...buckets.values()];
}

function bucketStartOf(date: string, grain: RangeGrain): string {
  const d = new Date(`${String(date).slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return "";
  if (grain === "month") d.setUTCDate(1);
  else if (grain === "week") {
    const day = d.getUTCDay();
    d.setUTCDate(d.getUTCDate() - ((day + 6) % 7));
  }
  return d.toISOString().slice(0, 10);
}

export function sumBy<T>(rows: T[], getValue: (row: T) => number): number {
  return rows.reduce((sum, row) => sum + (getValue(row) || 0), 0);
}
