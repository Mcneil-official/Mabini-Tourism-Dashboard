import { createFileRoute } from "@tanstack/react-router";
import {
  useState,
  useMemo,
  useCallback,
  useEffect,
  type ReactNode,
} from "react";
import { motion, AnimatePresence } from "framer-motion";
import { z } from "zod";
import {
  LayoutDashboard,
  Users,
  Building2,
  Waves,
  CreditCard,
  BarChart3,
  Megaphone,
  Settings,
  Search,
  LogOut,
  ChevronRight,
  Sun,
  Moon,
  ShieldAlert,
  Receipt,
  MapPin,
  Clock,
  CalendarClock,
  Anchor,
  Loader2,
} from "lucide-react";
import { Toaster } from "@/components/ui/sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandShortcut,
} from "@/components/ui/command";

import { useFilters } from "@/hooks/useFilters";
import { usePermission, useRole, ROLE_META } from "@/hooks/usePermission";
import { useGlobalDateRange } from "@/hooks/useGlobalDateRange";
import { todayInManila, clampDateToToday } from "@/lib/period";
import { DataSourceBadge } from "@/components/shared";

import {
  useStaffSession,
  useStaffSessionValue,
  StaffSessionContext,
  staffInitials,
  signOutStaff,
  type StaffSession,
} from "@/lib/staff-auth";
import { pushAuditLog } from "@/lib/audit";
import {
  useLiveRealtime,
  useLiveMode,
  useDiveSitesLive,
} from "@/lib/queries";
import { toSiteView } from "@/lib/diveTaxonomy";
import { tourists, operatorApps, receipts } from "@/lib/mock-data";

import { ForcedPasswordChange } from "@/components/auth/ForcedPasswordChange";
import { Login } from "@/components/auth/Login";
import { NotificationsBell } from "@/components/NotificationsBell";
import {
  PwaInstallButton,
  PwaSidebarInstallCard,
} from "@/components/pwa/PwaInstallButton";
import { OfflineAlertBanner } from "@/components/pwa/OfflineAlertBanner";

import { OverviewPage } from "@/components/sections/OverviewPage";
import { TouristMgmtPage } from "@/components/sections/TouristMgmtPage";
import { EstablishmentsPage } from "@/components/sections/EstablishmentsPage";
import { DiveOpsPage } from "@/components/sections/DiveOpsPage";
import { DivePassPage } from "@/components/sections/DivePassPage";
import { AnalyticsPage } from "@/components/sections/AnalyticsPage";
import { AnnouncementsPage } from "@/components/sections/AnnouncementsPage";
import { SettingsPage } from "@/components/sections/SettingsPage";

/* ------------------------------ SEARCH PARAMS SCHEMA ------------------------------ */
const searchSchema = z.object({
  section: z
    .enum([
      "overview",
      "tourists",
      "establishments",
      "dive-ops",
      "dive-pass",
      "analytics",
      "announcements",
      "settings",
    ])
    .catch("overview")
    .default("overview"),
  q: z.string().default(""),
  status: z.string().default("All"),
  nationality: z.string().default("All"),
  level: z.string().default("All"),
  site: z.string().default("All"),
  difficulty: z.string().default("All"),
  siteType: z.string().default("All"),
  dateFrom: z
    .string()
    .default("")
    .transform((v) => clampDateToToday(v)),
  dateTo: z
    .string()
    .default("")
    .transform((v) => clampDateToToday(v)),
  tab: z.string().default(""),
  globalDateRange: z.enum(["today", "7d", "30d", "custom"]).default("30d"),
  globalDateFrom: z
    .string()
    .default("")
    .transform((v) => clampDateToToday(v)),
  globalDateTo: z
    .string()
    .default("")
    .transform((v) => clampDateToToday(v)),
});

type Section =
  | "overview"
  | "tourists"
  | "establishments"
  | "dive-ops"
  | "dive-pass"
  | "analytics"
  | "announcements"
  | "settings";

export const Route = createFileRoute("/")({
  component: App,
  validateSearch: (search: Record<string, unknown>) =>
    searchSchema.parse(search),
});

/* ------------------------------ THEME HOOK ------------------------------ */
function useTheme() {
  const [theme, setTheme] = useState<"light" | "dark">("light");
  useEffect(() => {
    const saved = localStorage.getItem("dive-dashboard-theme");
    const initial = saved === "dark" ? "dark" : "light";
    setTheme(initial);
    document.documentElement.classList.toggle("dark", initial === "dark");
  }, []);
  const toggle = useCallback(() => {
    setTheme((t) => {
      const next = t === "dark" ? "light" : "dark";
      document.documentElement.classList.toggle("dark", next === "dark");
      localStorage.setItem("dive-dashboard-theme", next);
      return next;
    });
  }, []);
  return { theme, toggle };
}

/* ------------------------------ ANIMATION HELPER ------------------------------ */
function PageTransition({
  section,
  children,
}: {
  section: string;
  children: ReactNode;
}) {
  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={section}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -6 }}
        transition={{ duration: 0.18, ease: "easeOut" }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}

/* ------------------------------ ROOT APP ------------------------------ */
function App() {
  const { session, checking, setSession } = useStaffSession();

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="size-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <>
      <Toaster position="top-right" richColors />
      {session ? (
        <StaffSessionContext.Provider value={session}>
          {session.mustChangePassword ? (
            <ForcedPasswordChange
              session={session}
              onDone={(s) => setSession(s)}
            />
          ) : (
            <Dashboard
              session={session}
              onLogout={async () => {
                pushAuditLog(`Signed out ${session.email}`);
                await signOutStaff();
                setSession(null);
              }}
            />
          )}
        </StaffSessionContext.Provider>
      ) : (
        <Login onLogin={(s) => setSession(s)} />
      )}
    </>
  );
}

/* ------------------------------ DASHBOARD SHELL ------------------------------ */
const NAV: { key: Section; label: string; icon: any; group: string }[] = [
  { key: "overview", label: "Dashboard", icon: LayoutDashboard, group: "Main" },
  { key: "tourists", label: "Tourists", icon: Users, group: "Main" },
  {
    key: "establishments",
    label: "Establishments",
    icon: Building2,
    group: "Main",
  },
  { key: "dive-ops", label: "Dive Operations", icon: Waves, group: "Main" },
  { key: "dive-pass", label: "Dive Pass", icon: CreditCard, group: "Main" },
  { key: "analytics", label: "Analytics", icon: BarChart3, group: "Analytics" },
  {
    key: "announcements",
    label: "Announcements",
    icon: Megaphone,
    group: "Content",
  },
  { key: "settings", label: "Settings", icon: Settings, group: "System" },
];

function Dashboard({
  session,
  onLogout,
}: {
  session: StaffSession;
  onLogout: () => void;
}) {
  useLiveRealtime();
  return <DashboardShell session={session} onLogout={onLogout} />;
}

function DashboardShell({
  session,
  onLogout,
}: {
  session: StaffSession;
  onLogout: () => void;
}) {
  const { search, setFilters } = useFilters();
  const [searchOpen, setSearchOpen] = useState(false);
  const liveSitesShell = useDiveSitesLive();
  const paletteSites = useMemo(
    () => (liveSitesShell.data ?? []).map(toSiteView),
    [liveSitesShell.data],
  );
  const { role, canAdmin } = useRole();
  const { theme, toggle } = useTheme();
  const section = search.section;
  const dr = useGlobalDateRange();
  const grouped = useMemo(() => {
    const g: Record<string, typeof NAV> = {};
    NAV.forEach((n) => {
      (g[n.group] ||= []).push(n);
    });
    return g;
  }, []);
  const visibleNav = useMemo(
    () => NAV.filter((n) => role === "superadmin" || n.group !== "System"),
    [role],
  );
  const isSettingsBlocked = section === "settings" && !canAdmin;
  const current = NAV.find((n) => n.key === section) ?? NAV[0];

  useEffect(() => {
    if (isSettingsBlocked) {
      setFilters({ section: "overview", tab: "" });
    }
  }, [isSettingsBlocked, setFilters]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setSearchOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="flex">
        {/* Sidebar */}
        <aside className="hidden lg:flex flex-col w-64 shrink-0 border-r border-border bg-sidebar sticky top-0 h-screen">
          <div className="h-16 flex items-center gap-2 px-5 border-b border-border">
            <img
              src="/logo.png"
              alt="Mabini, Batangas logo"
              className="size-9 rounded-xl object-contain"
            />
            <div>
              <div className="font-display font-bold text-lg text-foreground leading-none">
                Mabini, Batangas
              </div>
              <div className="text-[11px] text-muted-foreground mt-0.5">
                Dive Tourism Management
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-3 py-4 space-y-6">
            {Object.entries(grouped).map(([group, items]) => {
              const visible = items.filter(
                (item) => role === "superadmin" || item.group !== "System",
              );
              if (visible.length === 0) return null;
              return (
                <div key={group}>
                  <div className="px-3 mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    {group}
                  </div>
                  <nav className="space-y-1">
                    {visible.map((item) => {
                      const Icon = item.icon;
                      const active = section === item.key;
                      return (
                        <button
                          key={item.key}
                          onClick={() =>
                            setFilters({
                              section: item.key,
                              tab: "",
                            })
                          }
                          className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                            active
                              ? "bg-primary text-primary-foreground shadow-sm"
                              : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                          }`}
                        >
                          <Icon className="size-4 shrink-0" />
                          <span>{item.label}</span>
                        </button>
                      );
                    })}
                  </nav>
                </div>
              );
            })}
            <div className="p-3">
              <PwaSidebarInstallCard />
            </div>
          </div>

          {/* User footer */}
          <div className="p-3 border-t border-border">
            <div className="flex items-center gap-3 p-2 rounded-lg bg-secondary/50">
              <Avatar className="size-8">
                <AvatarFallback className="bg-primary text-primary-foreground text-xs font-medium">
                  {staffInitials(session.fullName)}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <div className="text-xs font-semibold truncate text-foreground">
                  {session.fullName}
                </div>
                <div className="text-[10px] text-muted-foreground truncate">
                  {session.email}
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={onLogout}
                className="size-7 text-muted-foreground hover:text-foreground"
                title="Sign out"
              >
                <LogOut className="size-3.5" />
              </Button>
            </div>
          </div>
        </aside>

        {/* Main Content */}
        <div className="flex-1 min-w-0 flex flex-col min-h-screen">
          <OfflineAlertBanner />
          {/* Topbar */}
          <header className="h-16 sticky top-0 z-20 backdrop-blur bg-background/80 border-b border-border flex items-center gap-3 px-4 md:gap-4 md:px-6">
            <div>
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <button
                  onClick={() =>
                    setFilters({
                      section: "overview",
                      tab: "",
                    })
                  }
                  className="hover:text-foreground transition-colors"
                >
                  Dashboard
                </button>
                <ChevronRight className="size-3" />
                <span className="text-foreground font-medium">
                  {current.label}
                </span>
              </div>
              <h1 className="text-lg font-display font-semibold leading-none mt-1">
                {current.label}
              </h1>
            </div>
            <div className="ml-auto flex items-center gap-3">
              <div className="flex items-center gap-1 bg-secondary/60 rounded-lg p-0.5">
                {(
                  [
                    ["today", "Today"],
                    ["7d", "7d"],
                    ["30d", "30d"],
                  ] as const
                ).map(([key, label]) => (
                  <button
                    key={key}
                    onClick={() => dr.setRange(key)}
                    className={`px-2.5 py-1 text-xs rounded-md transition-all ${dr.range === key ? "bg-background shadow-sm font-medium text-foreground" : "text-muted-foreground hover:text-foreground"}`}
                  >
                    {label}
                  </button>
                ))}
                <button
                  onClick={() =>
                    dr.setRange(
                      "custom",
                      dr.globalDateFrom || dr.from,
                      dr.globalDateTo || dr.to,
                    )
                  }
                  className={`px-2.5 py-1 text-xs rounded-md transition-all ${dr.range === "custom" ? "bg-background shadow-sm font-medium text-foreground" : "text-muted-foreground hover:text-foreground"}`}
                >
                  Custom
                </button>
              </div>
              {dr.range === "custom" && (
                <div className="flex items-center gap-1.5 animate-fade-in">
                  <Input
                    type="date"
                    max={dr.globalDateTo || todayInManila()}
                    value={dr.globalDateFrom}
                    onChange={(e) => {
                      const val = clampDateToToday(e.target.value);
                      dr.setRange("custom", val, dr.globalDateTo);
                    }}
                    className="w-[140px] h-8 text-xs"
                  />
                  <span className="text-xs text-muted-foreground">–</span>
                  <Input
                    type="date"
                    min={dr.globalDateFrom || undefined}
                    max={todayInManila()}
                    value={dr.globalDateTo}
                    onChange={(e) => {
                      const val = clampDateToToday(e.target.value);
                      dr.setRange("custom", dr.globalDateFrom, val);
                    }}
                    className="w-[140px] h-8 text-xs"
                  />
                </div>
              )}
              <div className="w-px h-5 bg-border" />
              <button
                onClick={() => setSearchOpen(true)}
                className="hidden md:flex items-center gap-2 h-9 rounded-lg border border-border bg-secondary/50 px-3 text-sm text-muted-foreground hover:bg-secondary transition-colors"
              >
                <Search className="size-3.5" />
                <span>Search…</span>
                <kbd className="ml-4 pointer-events-none inline-flex h-5 select-none items-center gap-0.5 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
                  <span className="text-xs">⌘</span>K
                </kbd>
              </button>
              <PwaInstallButton />
              <Button
                variant="outline"
                size="icon"
                onClick={toggle}
                title={
                  theme === "dark"
                    ? "Switch to light mode"
                    : "Switch to dark mode"
                }
              >
                {theme === "dark" ? (
                  <Sun className="size-4" />
                ) : (
                  <Moon className="size-4" />
                )}
              </Button>
              <NotificationsBell />
              <LiveBadge />
              <RoleBadge />
              <Avatar
                className="size-9"
                title={`${session.fullName} (${session.email})`}
              >
                <AvatarFallback className="bg-primary text-primary-foreground text-xs">
                  {staffInitials(session.fullName)}
                </AvatarFallback>
              </Avatar>
            </div>
          </header>

          <main className="p-4 pb-24 space-y-4 sm:p-6 sm:space-y-6">
            <PageTransition section={section}>
              {section === "overview" && (
                <OverviewPage session={session} range={dr.rangeData} />
              )}
              {section === "tourists" && <TouristMgmtPage session={session} />}
              {section === "establishments" && <EstablishmentsPage />}
              {section === "dive-ops" && <DiveOpsPage />}
              {section === "dive-pass" && <DivePassPage />}
              {section === "analytics" && (
                <AnalyticsPage range={dr.rangeData} />
              )}
              {section === "announcements" && <AnnouncementsPage />}
              {section === "settings" &&
                (role === "superadmin" ? (
                  <SettingsPage />
                ) : (
                  <Card className="p-12 shadow-elegant border-border/60 text-center">
                    <ShieldAlert className="size-10 mx-auto text-muted-foreground" />
                    <h2 className="mt-4 font-display text-lg font-semibold">
                      Restricted area
                    </h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Settings is limited to superadmins. Your TO Staff role
                      covers queues, registries and announcements.
                    </p>
                  </Card>
                ))}
            </PageTransition>
          </main>
        </div>
      </div>

      {/* Global Search */}
      <CommandDialog open={searchOpen} onOpenChange={setSearchOpen}>
        <CommandInput placeholder="Search tourists, operators, receipts, dive sites…" />
        <CommandList>
          <CommandEmpty>No results found.</CommandEmpty>
          <CommandGroup heading="Tourists">
            {tourists.map((t) => (
              <CommandItem
                key={t.id}
                value={`tourist ${t.name} ${t.id} ${t.nationality} ${t.level}`}
                onSelect={() => {
                  setFilters({ section: "tourists", q: t.name });
                  setSearchOpen(false);
                }}
              >
                <Users className="size-4 text-muted-foreground" />
                <span className="font-medium">{t.name}</span>
                <span className="text-muted-foreground text-xs">{t.id}</span>
                <CommandShortcut>{t.nationality}</CommandShortcut>
              </CommandItem>
            ))}
          </CommandGroup>
          <CommandGroup heading="Operators">
            {operatorApps.map((o) => (
              <CommandItem
                key={o.id}
                value={`operator ${o.name} ${o.owner} ${o.id} ${o.status}`}
                onSelect={() => {
                  setFilters({
                    section: "establishments",
                    tab: "applications",
                    q: o.name,
                  });
                  setSearchOpen(false);
                }}
              >
                <Building2 className="size-4 text-muted-foreground" />
                <span className="font-medium">{o.name}</span>
                <span className="text-muted-foreground text-xs">{o.owner}</span>
                <CommandShortcut>{o.status}</CommandShortcut>
              </CommandItem>
            ))}
          </CommandGroup>
          <CommandGroup heading="Receipts">
            {receipts.map((r) => (
              <CommandItem
                key={r.id}
                value={`receipt ${r.operator} ${r.ref} ${r.id} ${r.amount}`}
                onSelect={() => {
                  setFilters({
                    section: "dive-pass",
                    tab: "payments",
                    q: r.ref,
                  });
                  setSearchOpen(false);
                }}
              >
                <Receipt className="size-4 text-muted-foreground" />
                <span className="font-medium">{r.operator}</span>
                <span className="text-muted-foreground text-xs font-mono">
                  {r.ref}
                </span>
                <CommandShortcut>{r.amount}</CommandShortcut>
              </CommandItem>
            ))}
          </CommandGroup>
          <CommandGroup heading="Dive Sites">
            {paletteSites.map((s) => (
              <CommandItem
                key={s.id}
                value={`dive site ${s.name} ${s.id} ${s.barangay} ${s.types.join(" ")} ${s.difficulty}`}
                onSelect={() => {
                  setFilters({ section: "dive-ops", tab: "sites", q: s.name });
                  setSearchOpen(false);
                }}
              >
                <MapPin className="size-4 text-muted-foreground" />
                <span className="font-medium">{s.name}</span>
                <span className="text-muted-foreground text-xs">
                  {s.barangay}
                </span>
                <CommandShortcut>{s.depth}</CommandShortcut>
              </CommandItem>
            ))}
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </div>
  );
}

/* ------------------------------ BADGES ------------------------------ */
function RoleBadge({ compact = false }: { compact?: boolean }) {
  const { role } = useRole();
  const meta = ROLE_META[role];
  const Icon = meta.icon;
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${meta.className}`}
      title={meta.desc}
    >
      <Icon className="size-3.5" />
      {!compact && <span className="hidden md:inline">{meta.label}</span>}
    </span>
  );
}

function LiveBadge() {
  const isLive = useLiveMode();
  return <DataSourceBadge live={isLive} />;
}

/* ------------------------------ RE-EXPORTS (FOR BACKWARDS COMPATIBILITY) ------------------------------ */
export { useFilters } from "@/hooks/useFilters";
export { usePermission } from "@/hooks/usePermission";
export { DataSourceBadge } from "@/components/shared";
export { setAuditWho, pushAuditLog } from "@/lib/audit";
export { OperatorMgmt } from "@/components/sections/operators/OperatorMgmt";
export { ReceiptVerification } from "@/components/sections/operators/ReceiptVerification";
export { ManifestoView } from "@/components/sections/dive-ops/ManifestoView";
export { DiveSiteMgmt } from "@/components/sections/dive-ops/DiveSiteMgmt";
export { OperatorAnalytics } from "@/components/sections/analytics/OperatorAnalytics";
export { Reports } from "@/components/sections/analytics/Reports";
export { PassPricingEditor } from "@/components/sections/DivePassPage";
