export interface ChartInsight {
  /** Explains what the chart measures, its data source, and time scope */
  description: string;
  /** Actionable insights and observations derived from the chart data */
  insights?: string[];
  takeaways?: string[];
}

export const CHART_INSIGHTS: Record<string, ChartInsight> = {
  // ---------------------------------------------------------------------------
  // MAIN DASHBOARD (OVERVIEW)
  // ---------------------------------------------------------------------------
  "overview.monthlyTrends": {
    description:
      "Tracks monthly registered tourist footfall and divers logged on active boat manifests over the selected date range.",
    insights: [
      "Compares overall tourist volume against on-water diver conversion to identify non-diving eco-tourists vs. active divers.",
      "Highlights macro seasonality, clearly separating the Amihan dry diving peak (Nov–May) from Habagat southwest monsoon lulls (Jun–Oct).",
      "Spikes in divergence between tourists and divers suggest growing shore-based, snorkeling, or mountain trekking visitors.",
    ],
  },

  "overview.nationalityMix": {
    description:
      "Proportion of registered visitors by country of origin, highlighting the top 5 international markets plus domestic travelers.",
    insights: [
      "Tracks international recovery trends and identifies whether key Asian (Korea, China, Japan) or Western markets dominate.",
      "Domestic Filipino travelers typically peak on long weekends and summer holidays (March–May), while international divers peak Nov–Feb.",
      "A high 'Other' category indicates a widely diversified tourism demographic across niche dive travel markets.",
    ],
  },

  "overview.diveLevel": {
    description:
      "Distribution of diver certification credentials from Discover Scuba / Intro to Divemaster and Instructor tiers.",
    insights: [
      "Higher beginner (Intro & Open Water) ratios mean greater reef touch risk, requiring stricter divemaster supervision ratios (max 1:4).",
      "Advanced and technical diver prevalence signals strong demand for deeper pinnacles and macro muck sites.",
      "Changes in instructor and divemaster ratios reflect local training academy activity in Mabini dive centers.",
    ],
  },

  "overview.diveType": {
    description:
      "Classifies logged boat manifests by dive category: Recreational, Macro / Muck Photography, Night Dives, Training, and Technical.",
    insights: [
      "Anilao is globally renowned for macro photography; tracking macro trips highlights demand for sensitive muck habitats.",
      "Night diving volumes pinpoint evening boat traffic that requires Coast Guard navigation lighting and surface watch compliance.",
      "Training dives show the volume of instructional courses conducted at shallow resort house reefs.",
    ],
  },

  "overview.topSites": {
    description:
      "Ranks the top 8 most visited dive sites and marine sanctuaries by diver count in the selected period.",
    insights: [
      "Identifies marine sanctuaries carrying the highest boat traffic (e.g., Twin Rocks, Cathedral Rock, Secret Bay).",
      "Highlights site congestion that may exceed ecological carrying capacity limits and damage coral cover.",
      "A heavy concentration on 2–3 sites signals need for operator dispersion to lesser-known northern or coastal sites.",
    ],
  },

  // ---------------------------------------------------------------------------
  // DIVE ACTIVITY ANALYTICS
  // ---------------------------------------------------------------------------
  "diveActivity.hourlyLaunch": {
    description:
      "Diver departures grouped by the exact hour boat manifests are submitted and cleared for launch (5:00 AM – 6:00 PM).",
    insights: [
      "Typically reveals intense morning launch waves between 8:00 AM and 10:00 AM, with a secondary afternoon wave around 1:30 PM.",
      "Launch spikes create shoreline bottlenecks at popular resort beachfronts and boat launch corridors.",
      "Off-peak early morning departures (5:00–7:00 AM) often correlate with pelagic or dawn muck diving trips.",
    ],
  },

  "diveActivity.seasonalDistribution": {
    description:
      "Diver volume grouped by Philippine marine seasons: Amihan (Dry & Calm), Summer (Peak Season), and Habagat (Monsoon / Low).",
    insights: [
      "Amihan (Nov–Feb) delivers calm western waters ideal for Anilao macro photography and high international tourism.",
      "Summer (Mar–May) represents the absolute domestic peak with full resort occupancy and intense weekend boat traffic.",
      "Habagat (Jun–Oct) brings rough seas on exposed western points, shifting diving to sheltered eastern bays.",
    ],
  },

  "diveActivity.depthDistribution": {
    description:
      "Dive site visits grouped by maximum depth profile: 0–18m (Open Water), 18–30m (Advanced), and 30m+ (Deep / Tech).",
    insights: [
      "Validates that divers are operating within safe recreation depth ranges corresponding to their certification levels.",
      "High volumes in 0–18m shallow reefs require strict buoyancy control to prevent fin strikes on fragile branching corals.",
      "Deep visits (30m+) track wall and pinnacle diving where decompression safety and boat standby are paramount.",
    ],
  },

  "diveActivity.carryingCapacity": {
    description:
      "Compares actual logged diver visits against scientifically recommended daily carrying capacity limits for protected marine sanctuaries.",
    insights: [
      "Bars exceeding 100% capacity indicate acute ecological stress on fish populations, mooring lines, and coral structures.",
      "Consistent under-utilization of alternative sites indicates marketing opportunity to redistribute dive boat pressure.",
      "Critical flagship sanctuaries like Twin Rocks require continuous monitoring to prevent permanent reef degradation.",
    ],
  },

  "diveActivity.siteDiveType": {
    description:
      "Cross-tabulates specific dive sites with dive activity types to illustrate specialized site utilization.",
    insights: [
      "Shows which specific sites host training courses versus dedicated macro photography or night dives.",
      "Identifies whether training impact is concentrated at fragile macro nurseries or resilient sandy slopes.",
    ],
  },

  // ---------------------------------------------------------------------------
  // DIVE PASS ANALYTICS
  // ---------------------------------------------------------------------------
  "divePass.dailyRevenue": {
    description:
      "Daily trajectory of verified municipal revenue collected from dive passes and marine conservation fees in Philippine Pesos (₱).",
    insights: [
      "Measures daily cash realization velocity and treasury clearance throughput.",
      "Spikes correspond to bulk pass purchases by dive resorts ahead of major weekends and national diving holidays.",
      "Flatlines during active dive days suggest operators are burning through pre-purchased inventory rather than buying fresh passes.",
    ],
  },

  "divePass.passTypeDistribution": {
    description:
      "Proportion of dive passes purchased and total revenue generated across pass tiers: Daily, Multi-Day, Weekly, and Annual.",
    insights: [
      "Shows whether short-stay day visitors or committed long-term divers contribute the bulk of municipal revenue.",
      "Annual passes offer predictable advance municipal funding and reduce repetitive receipt verification overhead.",
      "High day-pass volumes signify heavy weekend ex-Manila excursion tourism requiring rapid checkpoint processing.",
    ],
  },

  "divePass.creditsUtilization": {
    description:
      "Tier-by-tier comparison of dive pass credits purchased versus credits actually redeemed on active boat manifests.",
    insights: [
      "The gap between purchased and used credits represents outstanding pre-paid municipal liabilities.",
      "A high unredeemed credit balance indicates operators are well-stocked and unlikely to experience trip delays.",
      "Low remaining balances warn of imminent operator pass exhaustion.",
    ],
  },

  "divePass.inventoryPurchases": {
    description:
      "Chronological timeline of bulk pass acquisitions grouped by pass tier, illustrating operator restocking frequency.",
    insights: [
      "Illustrates bulk purchasing behavior: operators tend to purchase large blocks 2–4 days before long holiday weekends.",
      "Identifies sudden shifts in pass tier preferences (e.g. operators switching from Daily to Multi-Day packages).",
    ],
  },

  "divePass.revenueVsBurn": {
    description:
      "Dual-axis composed chart comparing revenue inflow from verified payments against the daily credit burn rate on water.",
    insights: [
      "Verifies financial-to-operational synchronicity: credit burn should logically trail or mirror revenue spikes.",
      "Sustained credit burn without corresponding revenue indicates operators are exhausting older bulk reserves.",
      "A widening divergence highlights either rapid inventory depletion or pending unverified payments.",
    ],
  },

  // ---------------------------------------------------------------------------
  // ESTABLISHMENT ANALYTICS
  // ---------------------------------------------------------------------------
  "establishment.byLocation": {
    description:
      "Geographic concentration of registered dive resorts, dive lodges, and dive centers across Mabini's official 34 barangays.",
    insights: [
      "Dive establishments cluster heavily in coastal barangays such as San Teodoro, Solo, Batas, and Anilao Proper.",
      "High resort concentration intensifies demand on municipal infrastructure: coastal road traffic, water supply, and waste handling.",
      "Inland or non-coastal barangays with establishments indicate administrative offices, gear storage, or worker accommodations.",
    ],
  },

  "establishment.permitStatus": {
    description:
      "Accreditation and compliance standing of all establishments on municipal record (Active, Suspended, Pending Review).",
    insights: [
      "Active: Accredited resorts in good standing permitted to file manifests and dispatch dive boats.",
      "Suspended: Non-compliant establishments flagged for expired business permits, environmental violations, or unpaid fees.",
      "Pending Review: New resort applications awaiting municipal tourism inspection and accreditation approval.",
    ],
  },

  "establishment.manifestsAndCredits": {
    description:
      "Correlates physical boat manifest submissions filed during the date period with current dive pass credit balances per resort.",
    insights: [
      "Highlights the most commercially active dive resorts in the municipality.",
      "Operators with high manifests but critically low credit balances are at immediate risk of manifest submission lockouts.",
      "Operators with zero manifests filed during a peak period indicate dormant operations or unreported dive boat trips.",
    ],
  },

  "establishment.leaderboard": {
    description:
      "Official leaderboard ranking registered dive establishments by manifest submissions, divers accommodated, and credit reserves.",
    insights: [
      "Identifies top resort partners who drive the majority of municipal tourism volume and environmental revenue.",
      "Enables comparative analysis of divers-per-manifest efficiency across different dive resort operations.",
    ],
  },

  // ---------------------------------------------------------------------------
  // OPERATOR ANALYTICS
  // ---------------------------------------------------------------------------
  "operator.revenue": {
    description:
      "Comparative ranking of dive operators by verified payment revenue generated in Philippine Pesos (₱) during the selected period.",
    insights: [
      "Illustrates the 80/20 Pareto principle in municipal dive tourism: a small cadre of major operators generates most fee revenue.",
      "Detects revenue drops from flagship operators that could signal localized operational issues or unregistered trips.",
      "Provides transparent commercial benchmarking for municipal tourism financial reporting.",
    ],
  },

  "operator.manifestsAndCredits": {
    description:
      "Compares physical boat trips (manifestos) with environmental pass credits consumed for each active operator.",
    insights: [
      "Demonstrates operator operational velocity against prepaid fee redemption.",
      "Discrepancies where trip count is disproportionate to credit burn can indicate irregular passenger-to-pass ratios.",
      "Identifies high-volume commercial charter fleets vs. specialized boutique dive operations.",
    ],
  },

  "operator.leaderboard": {
    description:
      "Comprehensive performance and audit table detailing operator trip count, divers logged, ₱ revenue, credits used, remaining, and utilization rate.",
    insights: [
      "The primary operational audit tool for municipal officers reviewing permit renewal standing.",
      "Clicking any operator row opens a deep drilldown modal showing their 5 most recent manifests with dive sites and dates.",
      "Utilization percentages exceeding 80% indicate an operator that will need inventory replenishment in the immediate future.",
    ],
  },

  // ---------------------------------------------------------------------------
  // TOURIST ANALYTICS
  // ---------------------------------------------------------------------------
  "tourist.nationalities": {
    description:
      "Detailed demographic breakdown of all registered tourists by nationality, supporting provincial DOT tourist arrivals reporting.",
    insights: [
      "Identifies shifting travel trends between domestic weekend visitors and long-haul international divers.",
      "Helps Mabini tourism staff prepare multilingual emergency contact cards and targeted event announcements.",
    ],
  },

  "tourist.levels": {
    description:
      "Diver qualification profile categorizing registered tourists by recreational, rescue, and professional dive certifications.",
    insights: [
      "Provides vital demographic insight into whether visitors are students undertaking courses or certified hobbyist divers.",
      "Higher professional ratios (Divemaster, Instructor) correlate with photographic macro expeditions and extended multi-week stays.",
    ],
  },

  "tourist.registrationTrends": {
    description:
      "Timeline of newly registered tourist profiles created over the selected period, reflecting user onboarding momentum.",
    insights: [
      "Tracks adoption of the municipal tourist QR identification system.",
      "Surges coincide with holiday weekends, dive trade expos, and high-season commencement.",
    ],
  },
};

/**
 * Resolves a ChartInsight object from a key string or an inline object.
 */
export function resolveChartInsight(
  insight: ChartInsight | string | undefined,
): ChartInsight | undefined {
  if (!insight) return undefined;
  if (typeof insight === "string") {
    return (
      CHART_INSIGHTS[insight] ?? {
        description: insight,
        insights: [],
      }
    );
  }
  return insight;
}
