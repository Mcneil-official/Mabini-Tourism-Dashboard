import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ScrollText,
  Check,
  RotateCcw,
  Download,
  Forward,
  Search,
  Users,
  CheckCircle2,
  Clock,
  Sparkles,
  SlidersHorizontal,
  Eye,
  EyeOff,
  CalendarIcon,
  Send,
  FileDown,
  X,
  ChevronRight,
  ShieldCheck,
  Shield,
  Loader2,
  AlertCircle,
  Printer,
  ExternalLink,
} from "lucide-react";
import { downloadCsv } from "@/lib/export-utils";
import {
  FormalManifestoPrint,
  type FormalDiver,
  type FormalManifest,
} from "./FormalManifestoPrint";
import { MABINI_LGU_LOGO_URI } from "@/constants/lguLogo";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Pagination, usePagination } from "@/components/ui/pagination";
import {
  StatCard,
  SectionCard,
  DataSourceBadge,
  useMounted,
  Field,
  ActiveFilterBadges,
  CardGridSkeleton,
} from "@/components/shared";
import { useFilters } from "@/hooks/useFilters";
import { usePermission } from "@/hooks/usePermission";
import { useGlobalDateRange } from "@/hooks/useGlobalDateRange";
import { todayInManila, clampDateToToday } from "@/lib/period";
import { pushAuditLog } from "@/lib/audit";
import { requireLiveSession } from "@/lib/staff-auth";
import {
  useLiveMode,
  useManifestsLive,
  useInvalidateLive,
  useLiveList,
  setManifestVerified,
  fetchManifestDivers,
  dbErrorMessage,
  type LiveDiverRow,
} from "@/lib/queries";
import {
  manifestos,
  ALL_OPERATOR_NAMES,
  ALL_SITES,
  FORWARD_RECIPIENTS,
} from "@/lib/mock-data";

export function ManifestoView() {
  const { canAct, deny } = usePermission();
  const { search, setFilters, resetFilters } = useFilters();
  const { inRange } = useGlobalDateRange();
  const [viewing, setViewing] = useState<FormalManifest | null>(null);
  const [roster, setRoster] = useState<LiveDiverRow[] | null>(null);

  const modalDivers: FormalDiver[] | undefined = useMemo(() => {
    if (roster && roster.length > 0) {
      return roster.map((r) => ({
        name: r.name,
        ecoId: r.ecoId,
        isWalkIn: r.isWalkIn,
        nationality: "Philippines",
        certification: r.isWalkIn ? "Walk-in Guest" : "Certified Diver",
        municipalFeeStatus: "PAID & CLEARED",
        safetyWaiverStatus: "SIGNED",
      }));
    }
    return undefined;
  }, [roster]);
  const [rosterLoading, setRosterLoading] = useState(false);
  const [rosterError, setRosterError] = useState(false);
  const [mockItems, setMockItems] = useState(manifestos);
  // Live mode (Supabase configured): manifests come from dive_manifests
  // (+ manifest_divers counts); mocks are the offline fallback. Generate
  // stays mock-only (operator-side creation, no staff INSERT grant).
  const isLive = useLiveMode();
  const liveManifests = useManifestsLive();
  const invalidateManifests = useInvalidateLive();
  const isLiveData = isLive && !!liveManifests.data;
  const manifestsSource = useLiveList(isLive, liveManifests, mockItems);
  const items = manifestsSource.rows;
  useEffect(() => {
    if (liveManifests.isError) {
      toast.error("Could not load live manifestos", {
        description: "Showing demo data. Check the Supabase connection.",
      });
    }
  }, [liveManifests.isError]);
  const [rowBusy, setRowBusy] = useState<
    Record<string, "download" | "forward" | null>
  >({});
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [forwardDialog, setForwardDialog] = useState<string[] | null>(null);
  const [forwardBusy, setForwardBusy] = useState(false);
  const [verifiedIds, setVerifiedIds] = useState<Set<string>>(() => {
    const preverified = new Set<string>();
    manifestos.slice(0, 15).forEach((m) => preverified.add(m.id));
    return preverified;
  });
  const [verificationFilter, setVerificationFilter] = useState<
    "all" | "verified" | "unverified"
  >("all");

  // Live mode reads verification from the row (032 verified flag); mock
  // mode keeps the local Set with the first 15 pre-verified.
  const isVerified = (m: { id: string; verified?: boolean }) =>
    isLiveData ? m.verified === true : verifiedIds.has(m.id);

  const toggleVerify = async (id: string) => {
    if (!canAct) return deny();
    if (isLive && !(await requireLiveSession())) return;
    // Live mode: persist to dive_manifests (032 verified + staff UPDATE).
    const liveRow = liveManifests.data?.find((m) => m.id === id);
    if (isLive && liveRow) {
      const next = !liveRow.verified;
      try {
        await setManifestVerified(liveRow._dbId, next);
        invalidateManifests();
        if (next) {
          toast.success(`Manifesto ${id} verified`);
          pushAuditLog(`Verified manifesto ${id}`);
        } else {
          toast.info(`Manifesto ${id} marked as unverified`);
          pushAuditLog(`Unverified manifesto ${id}`);
        }
      } catch (e) {
        toast.error("Could not update manifesto", {
          description: dbErrorMessage(e),
        });
      }
      return;
    }
    setVerifiedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
        toast.info(`Manifesto ${id} marked as unverified`);
      } else {
        next.add(id);
        toast.success(`Manifesto ${id} verified`);
        pushAuditLog(`Verified manifesto ${id}`);
      }
      return next;
    });
  };

  const filtered = useMemo(() => {
    return items.filter((m) => {
      if (search.site !== "All" && m.site !== search.site) return false;
      if (search.q) {
        const q = search.q.toLowerCase();
        if (
          !m.operator.toLowerCase().includes(q) &&
          !m.site.toLowerCase().includes(q) &&
          !m.id.toLowerCase().includes(q)
        )
          return false;
      }
      if (search.dateFrom && m.date < search.dateFrom) return false;
      if (search.dateTo && m.date > search.dateTo) return false;
      if (!inRange(m.date)) return false;
      if (verificationFilter === "verified" && !isVerified(m)) return false;
      if (verificationFilter === "unverified" && isVerified(m)) return false;
      return true;
    });
  }, [
    items,
    isLiveData,
    verifiedIds,
    verificationFilter,
    search.q,
    search.site,
    search.dateFrom,
    search.dateTo,
    inRange,
  ]);

  // Site options follow the data source: live locations when live, mock
  // constants otherwise.
  const siteOptions = useMemo(
    () =>
      isLiveData
        ? [...new Set(items.map((m) => m.site).filter(Boolean))].sort()
        : ALL_SITES,
    [isLiveData, items],
  );

  const {
    page: mPage,
    setPage: mSetPage,
    totalPages: mTotalPages,
    paged: mPaged,
  } = usePagination(filtered, 12);

  const activeFilters: { key: string; label: string }[] = [];
  if (search.site !== "All")
    activeFilters.push({ key: "site", label: `Site: ${search.site}` });
  if (search.q)
    activeFilters.push({ key: "q", label: `Search: "${search.q}"` });
  if (search.dateFrom)
    activeFilters.push({ key: "dateFrom", label: `From: ${search.dateFrom}` });
  if (search.dateTo)
    activeFilters.push({ key: "dateTo", label: `To: ${search.dateTo}` });
  if (verificationFilter !== "all")
    activeFilters.push({
      key: "verification",
      label: `Verification: ${verificationFilter}`,
    });

  const handleRemoveFilter = (key: string) => {
    if (key === "q") setFilters({ q: "" });
    else if (key === "site") setFilters({ site: "All" });
    else if (key === "dateFrom") setFilters({ dateFrom: "" });
    else if (key === "dateTo") setFilters({ dateTo: "" });
    else if (key === "verification") setVerificationFilter("all");
  };

  const openViewing = (m: FormalManifest) => {
    setViewing(m);
    // Live mode: resolve the diver roster on demand from manifest_divers.
    // Mock rows carry no _dbId and keep the count-only view.
    if (isLive && m?._dbId) {
      setRoster(null);
      setRosterError(false);
      setRosterLoading(true);
      fetchManifestDivers(m._dbId)
        .then((rows) => setRoster(rows))
        .catch(() => setRosterError(true))
        .finally(() => setRosterLoading(false));
    } else {
      setRoster(null);
      setRosterError(false);
      setRosterLoading(false);
    }
  };

  const rowAction = async (m: FormalManifest, kind: "download" | "forward") => {
    if (kind === "forward") {
      setForwardDialog([m.id]);
      return;
    }
    setRowBusy((b) => ({ ...b, [m.id]: "download" }));
    const printUrl = `/dashboard/manifests/print/${encodeURIComponent(m.id)}`;
    window.open(printUrl, "_blank");
    setRowBusy((b) => ({ ...b, [m.id]: null }));
    pushAuditLog(`Printed official boat dive manifesto ${m.id}`);
    toast.success("Manifesto Generated", {
      description: `Official printable manifesto opened for ${m.id} (${m.site}).`,
    });
  };

  const exportSelectedCsv = () => {
    const targetManifests = filtered.filter((m) => selected.has(m.id));
    if (targetManifests.length === 0) return;
    const headers = [
      "Manifesto ID",
      "Operator",
      "Dive Site",
      "Divers Count",
      "Date",
      "Verified",
    ];
    const rows = targetManifests.map((m) => [
      m.id,
      m.operator,
      m.site,
      m.divers,
      m.date,
      isVerified(m) ? "Yes" : "No",
    ]);
    downloadCsv(
      `mabini-manifestos-export-${new Date().toISOString().slice(0, 10)}`,
      headers,
      rows,
    );
    pushAuditLog(`Exported ${targetManifests.length} manifestos as CSV`);
    toast.success("CSV Downloaded", {
      description: `${targetManifests.length} manifestos exported.`,
    });
  };

  const allSelected =
    filtered.length > 0 && filtered.every((m) => selected.has(m.id));
  const toggleSelect = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const toggleSelectAll = () => {
    if (allSelected) {
      setSelected(new Set());
    } else {
      setSelected(new Set(filtered.map((m) => m.id)));
    }
  };

  const doForward = async (
    ids: string[],
    recipients: string[],
    message: string,
  ) => {
    if (!canAct) return deny();
    setForwardBusy(true);
    const tId = toast.loading(
      `Forwarding ${ids.length} manifesto${ids.length > 1 ? "s" : ""}…`,
    );
    await new Promise((r) => setTimeout(r, 900));
    setForwardBusy(false);
    toast.success(
      `Forwarded to ${recipients.length} recipient${recipients.length > 1 ? "s" : ""}`,
      {
        id: tId,
        description: `${ids.length} manifesto${ids.length > 1 ? "s" : ""} · ${recipients.join(", ")}${message ? " · with note" : ""}`,
        icon: <Forward className="size-4" />,
      },
    );
    setForwardDialog(null);
    setSelected(new Set());
    ids.forEach((id) => pushAuditLog(`Forwarded manifesto ${id}`));
  };

  return (
    <div className="space-y-4">
      {/* Search & Filters */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <DataSourceBadge
            live={isLive}
            isError={liveManifests.isError}
            isLoading={manifestsSource.isLoading}
          />
        </div>
        <div className="flex flex-col md:flex-row gap-3 md:items-center">
          <div className="relative flex-1 max-w-md">
            <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search by operator, site, or ID…"
              value={search.q}
              onChange={(e) => setFilters({ q: e.target.value })}
              className="pl-9"
            />
          </div>
          <Select
            value={search.site}
            onValueChange={(v) => setFilters({ site: v })}
          >
            <SelectTrigger className="w-44">
              <SelectValue placeholder="Dive site" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="All">All sites</SelectItem>
              {siteOptions.map((s) => (
                <SelectItem key={s} value={s}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="flex items-center gap-2">
            <Label className="text-xs text-muted-foreground whitespace-nowrap">
              From
            </Label>
            <Input
              type="date"
              max={search.dateTo || todayInManila()}
              value={search.dateFrom}
              onChange={(e) =>
                setFilters({ dateFrom: clampDateToToday(e.target.value) })
              }
              className="w-40"
            />
          </div>
          <div className="flex items-center gap-2">
            <Label className="text-xs text-muted-foreground whitespace-nowrap">
              To
            </Label>
            <Input
              type="date"
              min={search.dateFrom || undefined}
              max={todayInManila()}
              value={search.dateTo}
              onChange={(e) =>
                setFilters({ dateTo: clampDateToToday(e.target.value) })
              }
              className="w-40"
            />
          </div>
          {activeFilters.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setFilters({ q: "", site: "All", dateFrom: "", dateTo: "" });
                setVerificationFilter("all");
              }}
              className="text-muted-foreground"
            >
              <X className="size-3.5 mr-1" /> Clear
            </Button>
          )}
        </div>
        <ActiveFilterBadges
          filters={activeFilters}
          onRemove={handleRemoveFilter}
        />
      </div>

      <div className="text-xs text-muted-foreground">
        {manifestsSource.isLoading
          ? "Loading manifestos…"
          : `${filtered.length} of ${items.length} manifesto${
              items.length !== 1 ? "s" : ""
            }`}
      </div>

      <div className="flex items-center gap-1 bg-secondary/60 rounded-lg p-0.5 w-fit">
        {(
          [
            ["all", "All"],
            ["verified", "Verified"],
            ["unverified", "Unverified"],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setVerificationFilter(key)}
            className={`px-3 py-1.5 text-xs rounded-md transition-all font-medium ${
              verificationFilter === key
                ? "bg-background shadow-sm text-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {selected.size > 0 && (
        <div className="flex items-center gap-2 px-4 py-2.5 rounded-lg border border-primary/20 bg-primary-soft/30 animate-fade-in">
          <Checkbox
            checked={allSelected}
            onCheckedChange={toggleSelectAll}
            aria-label="Select all"
          />
          <span className="text-sm text-muted-foreground">
            {selected.size} selected
          </span>
          <div className="ml-auto flex items-center gap-1">
            <Button
              size="sm"
              variant="ghost"
              className="h-7 px-2 text-muted-foreground"
              onClick={() => setSelected(new Set())}
            >
              <X className="size-3.5" />
            </Button>
            <div className="w-px h-4 bg-border" />
            <Button
              size="sm"
              variant="outline"
              className="h-7 px-2.5 text-xs"
              onClick={exportSelectedCsv}
            >
              <FileDown className="size-3.5 mr-1" />
              <span>Export CSV</span>
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 px-2.5"
              onClick={() => setForwardDialog([...selected])}
            >
              <Forward className="size-3.5" />{" "}
              <span className="ml-1 text-xs">Forward</span>
            </Button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {manifestsSource.isLoading ? (
          <CardGridSkeleton count={8} />
        ) : filtered.length === 0 ? (
          <div className="col-span-full text-center py-12 text-muted-foreground">
            No manifestos match the current filters.
          </div>
        ) : (
          mPaged.map((m, idx) => {
            const b = rowBusy[m.id];
            return (
              <div
                key={m.id}
                className="animate-fade-in"
                style={{ animationDelay: `${idx * 40}ms` }}
              >
                <Card
                  className={`p-0 overflow-hidden shadow-elegant border-border/60 hover:shadow-glow hover:-translate-y-0.5 transition-all ${
                    selected.has(m.id) ? "ring-2 ring-primary/40" : ""
                  }`}
                >
                  <ManifestoMiniPreview
                    manifest={m}
                    isVerified={isVerified(m)}
                    onClick={() => openViewing(m)}
                  />
                  <div className="p-3 space-y-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setFilters({
                          section: "establishments",
                          tab: "registered",
                          q: m.operator,
                        });
                      }}
                      className="text-sm font-medium text-left underline decoration-dotted underline-offset-2 hover:text-primary hover:decoration-solid transition-colors"
                    >
                      {m.operator}
                    </button>
                    <div className="text-xs text-muted-foreground">
                      {m.date}
                    </div>
                    <div className="flex gap-1.5 pt-1">
                      <Button
                        size="sm"
                        variant={isVerified(m) ? "default" : "outline"}
                        className="flex-1"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleVerify(m.id);
                        }}
                        title={
                          isVerified(m)
                            ? "Mark as unverified"
                            : "Mark as verified"
                        }
                      >
                        {isVerified(m) ? (
                          <ShieldCheck className="size-4" />
                        ) : (
                          <Shield className="size-4" />
                        )}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="flex-1"
                        disabled={!!b}
                        onClick={() => openViewing(m)}
                        title="Preview & download"
                      >
                        <Download className="size-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="flex-1"
                        disabled={!!b}
                        onClick={() => setForwardDialog([m.id])}
                        title="Forward"
                      >
                        {b === "forward" ? (
                          <Loader2 className="size-4 animate-spin" />
                        ) : (
                          <Forward className="size-4" />
                        )}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="flex-1"
                        onClick={() => openViewing(m)}
                        title="View"
                      >
                        <Eye className="size-4" />
                      </Button>
                    </div>
                  </div>
                </Card>
              </div>
            );
          })
        )}
      </div>
      <Pagination
        page={mPage}
        totalPages={mTotalPages}
        onPageChange={mSetPage}
        className="mt-4"
      />

      <Dialog
        open={!!viewing}
        onOpenChange={(open) => !open && setViewing(null)}
      >
        <DialogContent className="w-[min(96vw,66rem)] max-w-5xl h-[min(94vh,58rem)] flex flex-col p-0 gap-0 overflow-hidden bg-background border-border shadow-2xl sm:rounded-2xl">
          <DialogHeader className="px-5 sm:px-6 py-3.5 border-b border-border bg-card/60 shrink-0">
            <div className="flex items-center justify-between pr-8">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
                  <ScrollText className="size-4 text-primary" />
                </div>
                <div className="min-w-0">
                  <DialogTitle className="font-display text-base font-bold flex items-center gap-2 truncate">
                    <span>Passenger Manifest {viewing?.id}</span>
                    {viewing && isVerified(viewing) ? (
                      <Badge
                        variant="outline"
                        className="text-[10px] bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 gap-1 font-semibold"
                      >
                        <ShieldCheck className="size-3" /> Verified
                      </Badge>
                    ) : (
                      <Badge
                        variant="outline"
                        className="text-[10px] bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30 gap-1 font-semibold"
                      >
                        <Shield className="size-3" /> Unverified
                      </Badge>
                    )}
                  </DialogTitle>
                  <DialogDescription className="text-xs text-muted-foreground mt-0.5 truncate">
                    {viewing?.operator} &bull; {viewing?.site} &bull;{" "}
                    {viewing?.date}
                  </DialogDescription>
                </div>
              </div>
            </div>
          </DialogHeader>

          {/* Scrollable Document Canvas Container */}
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain bg-muted/40 dark:bg-muted/10 p-3 sm:p-6 md:p-8 flex justify-center">
            {viewing && (
              <div className="w-full max-w-4xl bg-white shadow-xl rounded-xl overflow-hidden border border-slate-200 self-start">
                <FormalManifestoPrint
                  manifest={viewing}
                  divers={modalDivers}
                  inModal={true}
                  showToolbar={false}
                />
              </div>
            )}
          </div>

          {/* Sticky Modal Action Footer */}
          {viewing && (
            <DialogFooter className="border-t border-border bg-card/60 px-4 sm:px-6 py-3 flex flex-row items-center justify-between gap-2 shrink-0 sm:justify-between">
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant={isVerified(viewing) ? "secondary" : "outline"}
                  onClick={() => toggleVerify(viewing.id)}
                  className="h-8 text-xs font-semibold"
                >
                  {isVerified(viewing) ? (
                    <>
                      <ShieldCheck className="size-3.5 mr-1.5 text-emerald-500" />
                      <span>Verified</span>
                    </>
                  ) : (
                    <>
                      <Shield className="size-3.5 mr-1" />
                      <span>Mark as Verified</span>
                    </>
                  )}
                </Button>
                <span className="text-xs text-muted-foreground hidden sm:inline">
                  {modalDivers
                    ? `${modalDivers.length} Divers Listed`
                    : `${viewing.divers || viewing.diver_count || 0} Divers Listed`}
                </span>
              </div>

              <div className="flex items-center gap-1.5 sm:gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 text-xs font-semibold"
                  onClick={() => {
                    const id = viewing.id;
                    setViewing(null);
                    setForwardDialog([id]);
                  }}
                >
                  <Forward className="size-3.5 mr-1" />
                  <span className="hidden xs:inline">Forward</span>
                </Button>

                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 text-xs font-semibold"
                  onClick={() => rowAction(viewing, "download")}
                >
                  <ExternalLink className="size-3.5 mr-1" />
                  <span className="hidden sm:inline">Open in Tab</span>
                </Button>

                <Button
                  size="sm"
                  variant="default"
                  className="h-8 text-xs font-semibold"
                  onClick={() => {
                    window.open(
                      `/dashboard/manifests/print/${encodeURIComponent(viewing.id)}`,
                      "_blank",
                    );
                  }}
                >
                  <Printer className="size-3.5 mr-1" />
                  <span>Print / PDF</span>
                </Button>
              </div>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!forwardDialog}
        onOpenChange={(o) => !o && setForwardDialog(null)}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Forward className="size-5 text-primary" /> Forward manifestos
            </DialogTitle>
          </DialogHeader>
          {forwardDialog && (
            <ForwardForm
              ids={forwardDialog}
              busy={forwardBusy}
              onConfirm={doForward}
              onCancel={() => setForwardDialog(null)}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ForwardForm({
  ids,
  busy,
  onConfirm,
  onCancel,
}: {
  ids: string[];
  busy: boolean;
  onConfirm: (ids: string[], recipients: string[], message: string) => void;
  onCancel: () => void;
}) {
  const [selectedRecipients, setSelectedRecipients] = useState<Set<string>>(
    new Set(),
  );
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const toggleRecipient = (email: string) =>
    setSelectedRecipients((prev) => {
      const next = new Set(prev);
      if (next.has(email)) next.delete(email);
      else next.add(email);
      return next;
    });

  const confirm = () => {
    if (selectedRecipients.size === 0) {
      setError("Select at least one recipient.");
      return;
    }
    onConfirm(ids, [...selectedRecipients], message.trim());
  };

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Forward{" "}
        <span className="font-medium text-foreground">
          {ids.length} manifesto{ids.length > 1 ? "s" : ""}
        </span>{" "}
        to selected recipients.
      </p>
      <div className="max-h-52 overflow-y-auto rounded-lg border border-border/70 divide-y divide-border/60">
        {FORWARD_RECIPIENTS.map((r) => {
          const checked = selectedRecipients.has(r.email);
          return (
            <label
              key={r.email}
              className="flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-primary-soft/40 transition-colors"
            >
              <Checkbox
                checked={checked}
                onCheckedChange={() => toggleRecipient(r.email)}
              />
              <div className="min-w-0">
                <div className="text-sm font-medium truncate">{r.name}</div>
                <div className="text-xs text-muted-foreground font-mono truncate">
                  {r.email}
                </div>
              </div>
            </label>
          );
        })}
      </div>
      {error && (
        <p className="text-xs text-destructive flex items-center gap-1">
          <AlertCircle className="size-3" />
          {error}
        </p>
      )}
      <div className="space-y-1.5">
        <Label>Optional note</Label>
        <Textarea
          rows={2}
          placeholder="Add a message for the recipient…"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
        />
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onCancel} disabled={busy}>
          Cancel
        </Button>
        <Button
          className="gradient-primary text-primary-foreground"
          onClick={confirm}
          disabled={busy}
        >
          {busy ? (
            <Loader2 className="size-4 mr-1.5 animate-spin" />
          ) : (
            <Forward className="size-4 mr-1.5" />
          )}
          Forward to {selectedRecipients.size || ""} recipient
          {selectedRecipients.size !== 1 ? "s" : ""}
        </Button>
      </DialogFooter>
    </div>
  );
}

interface ManifestoMiniPreviewProps {
  manifest: FormalManifest;
  isVerified: boolean;
  onClick: () => void;
}

function ManifestoMiniPreview({
  manifest,
  isVerified,
  onClick,
}: ManifestoMiniPreviewProps) {
  const diverCount = manifest.divers ?? manifest.diver_count ?? 6;
  const rawId = manifest.id || "0001";
  const manifestNumber = rawId.startsWith("MF-")
    ? rawId
    : `2026-${rawId.length > 8 ? rawId.slice(0, 5).toUpperCase() : rawId.toUpperCase()}`;

  const boatName =
    manifest.boatName ||
    manifest.boat_name ||
    (manifest.operator ? `${manifest.operator} Vessel` : "Standard Vessel");

  const siteName =
    manifest.site || manifest.location || "Mabini Marine Sanctuary";
  const rawDate = manifest.date || manifest.dive_date || "2026-07-22";

  return (
    <div
      onClick={onClick}
      className="relative w-full aspect-[4/3] bg-white text-slate-900 border-b border-border/50 select-none overflow-hidden cursor-pointer group flex flex-col justify-between"
    >
      {/* Document Sheet Interior */}
      <div className="p-3 sm:p-3.5 pb-0 flex flex-col h-full justify-between z-0">
        <div>
          {/* Header: Mabini LGU Emblem + Republic Letterhead + Manifest No. */}
          <div className="flex items-start justify-between gap-2 mb-2">
            <div className="flex items-center gap-2">
              <img
                src={MABINI_LGU_LOGO_URI}
                alt="Mabini Emblem"
                className="w-7 h-7 object-contain shrink-0 drop-shadow-sm"
              />
              <div className="leading-tight text-left">
                <div className="text-[7px] font-bold text-slate-500 tracking-wider uppercase">
                  Republic of the Philippines
                </div>
                <div className="text-[8.5px] font-extrabold text-[#0D3B66] uppercase tracking-tight">
                  Municipality of Mabini
                </div>
              </div>
            </div>

            <div className="text-right shrink-0">
              <span className="inline-block bg-[#0066CC]/10 text-[#0066CC] font-mono text-[8px] font-bold px-1.5 py-0.5 rounded border border-[#0066CC]/20">
                {manifestNumber}
              </span>
              <div className="text-[7px] text-slate-400 mt-0.5">{rawDate}</div>
            </div>
          </div>

          {/* Micro Vessel / Trip Metadata Box */}
          <div className="border border-[#C5D9ED] rounded bg-[#F4F8FC] p-1.5 mb-2 grid grid-cols-2 gap-x-2 gap-y-0.5 text-[7.5px] text-[#0A2540]">
            <div className="truncate">
              <span className="text-slate-400 uppercase text-[6.5px] font-bold">
                Vessel:{" "}
              </span>
              <span className="font-semibold">{boatName}</span>
            </div>
            <div className="truncate">
              <span className="text-slate-400 uppercase text-[6.5px] font-bold">
                Mode:{" "}
              </span>
              <span className="font-semibold">
                {manifest.diveMode || manifest.dive_mode || "Boat Dive"}
              </span>
            </div>
            <div className="truncate">
              <span className="text-slate-400 uppercase text-[6.5px] font-bold">
                Site:{" "}
              </span>
              <span className="font-semibold text-[#0066CC]">{siteName}</span>
            </div>
            <div className="truncate">
              <span className="text-slate-400 uppercase text-[6.5px] font-bold">
                Operator:{" "}
              </span>
              <span className="font-semibold">
                {manifest.operator || "Accredited"}
              </span>
            </div>
          </div>

          {/* Micro Diver Roster Table */}
          <div className="border border-[#C5D9ED] rounded overflow-hidden bg-white text-[7.5px]">
            <div className="bg-[#D3E5F5] px-1.5 py-0.5 flex items-center justify-between font-bold text-[#0A2540] text-[6.5px] uppercase border-b border-[#C5D9ED]">
              <span># Diver Passenger</span>
              <span>ECO / ID</span>
            </div>
            <div className="divide-y divide-[#E2EEF8]">
              <div className="px-1.5 py-0.5 flex items-center justify-between text-[#0A2540]">
                <span className="font-medium truncate max-w-[110px]">
                  1. Registered Diver
                </span>
                <span className="font-mono text-[#0066CC] font-bold text-[7px]">
                  ECO-2026-1041
                </span>
              </div>
              <div className="px-1.5 py-0.5 flex items-center justify-between text-[#0A2540]">
                <span className="font-medium truncate max-w-[110px]">
                  2. Registered Diver
                </span>
                <span className="font-mono text-[#0066CC] font-bold text-[7px]">
                  ECO-2026-1042
                </span>
              </div>
              {diverCount > 2 && (
                <div className="px-1.5 py-0.5 text-[6.5px] text-center text-slate-500 bg-slate-50 font-medium">
                  + {diverCount - 2} more registered divers cleared
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Flowing Ocean Wave Graphic at bottom */}
        <div className="w-[calc(100%+2rem)] -mx-4 -mb-1 mt-1 overflow-hidden leading-none pointer-events-none shrink-0">
          <svg
            className="w-full h-8 sm:h-9 block"
            viewBox="0 0 484 57"
            preserveAspectRatio="none"
          >
            <path
              d="M0 26.7778C80 4.61481 112 43.9037 190 30.8074C260 16.7037 286 2.6 332 8.64444C375 16.7037 383 -12.5111 441 6.62963C463 14.6889 475 19.7259 484 21.7407V57H0V26.7778Z"
              fill="#EEF6FE"
            />
            <path
              d="M0 4.65804C57 -4.40114 102 26.8027 160 22.7764C223 20.7633 247 1.63831 305 17.7435C368 34.8553 412 50.9605 484 15.7304V57H0V4.65804Z"
              fill="#9CC8F1"
            />
            <path
              d="M0 4C73 -4 132 35 209 37C298 44 355 48 414 29C445 20 463 9 484 0V57H0V4Z"
              fill="#6CB0E7"
            />
            <path
              d="M0 27.0129C79 3.02321 143 28.0125 215 41.0069C295 56.0004 380 57.9996 484 27.0129V57H0V27.0129Z"
              fill="#13508B"
            />
            <path
              d="M0 25C76 26.0667 112 61.2667 194 47.4C268 35.6667 326 20.7333 378 36.7333C421 50.6 452 42.0667 484 30.3333V57H0V25Z"
              fill="#1970B9"
              opacity="0.85"
            />
          </svg>
        </div>
      </div>

      {/* Floating UI Elements & Overlay */}
      {/* Diver count tag */}
      <div className="absolute top-2.5 right-2.5 z-10 rounded-full bg-slate-900/80 text-white backdrop-blur text-[10px] font-medium px-2 py-0.5 shadow-sm">
        {diverCount} divers
      </div>

      {/* Verified Badge */}
      {isVerified && (
        <div className="absolute top-2.5 left-2.5 z-10 rounded-full bg-emerald-600 text-white text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 flex items-center gap-1 shadow-sm">
          <ShieldCheck className="size-2.5" /> Verified
        </div>
      )}

      {/* Hover action overlay */}
      <div className="absolute inset-0 z-20 bg-slate-900/20 backdrop-blur-[1px] opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
        <span className="px-3 py-1.5 rounded-full bg-white/95 text-slate-900 text-xs font-semibold shadow-lg flex items-center gap-1.5 backdrop-blur transform -translate-y-1 group-hover:translate-y-0 transition-transform">
          <Eye className="size-3.5 text-[#0066CC]" /> View Manifesto
        </span>
      </div>
    </div>
  );
}
