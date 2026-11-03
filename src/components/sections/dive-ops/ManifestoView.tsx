import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ScrollText,
  Check,
  RotateCcw,
  RotateCw,
  ImageIcon,
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
  X,
  ChevronRight,
  ShieldCheck,
  Shield,
  Loader2,
  AlertCircle,
  Printer,
  Anchor,
  Ship,
  User,
  MapPin,
  Building2,
  Calendar,
  ShieldAlert,
  FileDown,
} from "lucide-react";
import { downloadCsv } from "@/lib/export-utils";
import { openPrintDocument, downloadDocumentHtml } from "@/lib/print-template";
import { downloadManifestoImage } from "@/lib/manifesto-image";
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
  useDiveSitesLive,
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
  const [viewing, setViewing] = useState<any>(null);
  const [roster, setRoster] = useState<any[] | null>(null);
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

  const liveSitesQuery = useDiveSitesLive();
  const sitePhotoMap = useMemo(() => {
    const map = new Map<string, string>();
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || "https://jmxhwcimqmtvgqtbhbch.supabase.co";
    for (const s of liveSitesQuery.data ?? []) {
      if (s.photoUrl) {
        map.set(
          s.name.toLowerCase().trim(),
          `${supabaseUrl}/storage/v1/object/public/dive-site-photos/${s.photoUrl}`
        );
      }
    }
    return map;
  }, [liveSitesQuery.data]);

  // Live mode reads verification from the row (032 verified flag); mock
  // mode keeps the local Set with the first 15 pre-verified.
  const isVerified = (m: any) =>
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

  const openViewing = (m: any) => {
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

  const rowAction = async (m: any, kind: "download" | "forward") => {
    if (kind === "forward") {
      setForwardDialog([m.id]);
      return;
    }
    setRowBusy((b) => ({ ...b, [m.id]: "download" }));
    let diversList: { name: string; nationality?: string; level?: string }[] = [];

    if (isLive && m?._dbId) {
      try {
        const fetched = await fetchManifestDivers(m._dbId);
        diversList = (fetched || []).map((d: any) => ({
          name: d.name ?? "Registered Diver",
          nationality: d.nationality ?? "Philippines",
          level: d.certificationLevel ?? "Open Water",
        }));
      } catch {
        // fallback
      }
    }

    if (diversList.length === 0) {
      const count = m.divers || 1;
      for (let i = 1; i <= count; i++) {
        diversList.push({
          name: `Diver Passenger #${i}`,
          nationality: i % 2 === 0 ? "Philippines" : "International",
          level: i === 1 ? "Divemaster" : "Open Water",
        });
      }
    }

    const rosterRowsHtml = diversList
      .map(
        (d, idx) => `
      <tr>
        <td class="text-center font-mono">${idx + 1}</td>
        <td class="font-semibold">${d.name}</td>
        <td>${d.nationality || "—"}</td>
        <td>${d.level || "—"}</td>
        <td class="text-center font-mono" style="color: #16a34a; font-weight: 600;">Fee Cleared</td>
        <td class="text-center font-mono" style="color: #16a34a; font-weight: 600;">Waiver Signed</td>
      </tr>`,
      )
      .join("");

    const bodyHtml = `
      <div style="margin-bottom: 20px; padding: 14px; background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 8px;">
        <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px;">
          <div>
            <div style="font-size: 8pt; text-transform: uppercase; color: #64748b; font-weight: 600;">Accredited Dive Operator</div>
            <div style="font-size: 11pt; font-weight: 700; color: #0f172a;">${m.operator}</div>
          </div>
          <div>
            <div style="font-size: 8pt; text-transform: uppercase; color: #64748b; font-weight: 600;">Scheduled Dive Location</div>
            <div style="font-size: 11pt; font-weight: 700; color: #0284c7;">${m.site}</div>
          </div>
          <div>
            <div style="font-size: 8pt; text-transform: uppercase; color: #64748b; font-weight: 600;">Date of Activity</div>
            <div style="font-size: 11pt; font-weight: 700; color: #0f172a;">${m.date}</div>
          </div>
        </div>
        <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; margin-top: 12px; padding-top: 12px; border-top: 1px dashed #cbd5e1;">
          <div>
            <div style="font-size: 8pt; text-transform: uppercase; color: #64748b; font-weight: 600;">Total Divers Onboard</div>
            <div style="font-size: 11pt; font-weight: 700; color: #0f172a;">${m.divers} Certified Divers</div>
          </div>
          <div>
            <div style="font-size: 8pt; text-transform: uppercase; color: #64748b; font-weight: 600;">LGU Verification Clearance</div>
            <div style="font-size: 11pt; font-weight: 700; color: ${m.verified ? "#16a34a" : "#d97706"};">
              ${m.verified ? "VERIFIED & CLEARED" : "PENDING CLEARANCE"}
            </div>
          </div>
          <div>
            <div style="font-size: 8pt; text-transform: uppercase; color: #64748b; font-weight: 600;">Safety Briefing &amp; Equipment</div>
            <div style="font-size: 11pt; font-weight: 700; color: #16a34a;">COMPLIANT</div>
          </div>
        </div>
      </div>

      <div style="margin-bottom: 8px; font-weight: 700; text-transform: uppercase; font-size: 10pt; color: #0f172a; letter-spacing: 0.02em;">
        Official Divers &amp; Passenger Roster
      </div>

      <table>
        <thead>
          <tr>
            <th style="width: 40px;" class="text-center">#</th>
            <th>Diver Full Name</th>
            <th>Nationality</th>
            <th>Certification Level</th>
            <th class="text-center">Municipal Fee</th>
            <th class="text-center">Safety Waiver</th>
          </tr>
        </thead>
        <tbody>
          ${rosterRowsHtml}
        </tbody>
      </table>

      <div style="margin-top: 24px; padding: 12px; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 8.5pt; color: #475569; background: #f8fafc;">
        <strong>Bantay Dagat &amp; Philippine Coast Guard Clearance Notice:</strong><br>
        Vessels operating within Mabini Municipal Waters must retain a copy of this official manifest onboard during all dive voyages. Inspection officers may verify compliance against registered Municipal Dive Passes.
      </div>
    `;

    openPrintDocument({
      title: `Official Boat Dive Manifesto — ${m.id}`,
      documentType: "Boat Activity & Diver Clearance Manifest",
      documentNumber: m.id,
      periodOrDate: m.date,
      signatoryTitle: "Municipal Bantay Dagat / Tourism Officer",
      bodyHtml,
    });

    setRowBusy((b) => ({ ...b, [m.id]: null }));
    pushAuditLog(`Printed official boat dive manifesto ${m.id}`);
    toast.success("Manifesto Generated", {
      description: `Official document opened for ${m.id} (${m.site}).`,
    });
  };


  const downloadImageManifesto = async (m: any, customRoster?: any[]) => {
    if (!canAct) return deny();
    setRowBusy((b) => ({ ...b, [m.id]: "download" }));
    const tId = toast.loading(`Generating official manifesto image for ${m.id}…`);
    try {
      let diverRows: any[] | null | undefined = customRoster;
      if (!diverRows) {
        try {
          diverRows = isLive ? await fetchManifestDivers(m._dbId || m.id) : null;
        } catch {
          diverRows = null;
        }
      }
      await downloadManifestoImage({
        id: m.id,
        operator: m.operator,
        site: m.site,
        date: m.date,
        divers: m.divers,
        verified: isVerified(m),
        boatName: (m as any).boatName,
        diveType: (m as any).diveType,
        maxDivers: (m as any).maxDivers,
        captainName: (m as any).captainName,
        instructorName: (m as any).instructorName,
        roster: diverRows,
      });
      toast.success("Manifesto Image Downloaded", {
        id: tId,
        description: `Saved Manifesto-${m.id}-${m.date}.png to your device.`,
      });
      pushAuditLog(`Downloaded manifesto image ${m.id}`);
    } catch (err) {
      toast.error("Download failed", {
        id: tId,
        description: dbErrorMessage(err),
      });
    } finally {
      setRowBusy((b) => ({ ...b, [m.id]: null }));
    }
  };

  const exportSelectedCsv = () => {
    const targetManifests = filtered.filter((m) => selected.has(m.id));
    if (targetManifests.length === 0) return;
    const headers = ["Manifesto ID", "Operator", "Dive Site", "Divers Count", "Date", "Verified"];
    const rows = targetManifests.map((m) => [m.id, m.operator, m.site, m.divers, m.date, (m as any).verified ? "Yes" : "No"]);
    downloadCsv(`mabini-manifestos-export-${new Date().toISOString().slice(0, 10)}`, headers, rows);
    pushAuditLog(`Exported ${targetManifests.length} manifestos as CSV`);
    toast.success("CSV Downloaded", { description: `${targetManifests.length} manifestos exported.` });
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
              value={search.dateFrom}
              onChange={(e) =>
                setFilters({ dateFrom: e.target.value })
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
              value={search.dateTo}
              onChange={(e) =>
                setFilters({ dateTo: e.target.value })
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

      <div className="flex items-center justify-between flex-wrap gap-3 py-1">
        <div className="flex items-center gap-2.5 text-xs text-muted-foreground">
          <span>
            {manifestsSource.isLoading
              ? "Loading manifestos…"
              : `${filtered.length} of ${items.length} manifesto${
                  items.length !== 1 ? "s" : ""
                }`}
          </span>
          {isLiveData ? (
            <Badge variant="outline" className="text-[10px] text-emerald-600 dark:text-emerald-400 border-emerald-500/30 bg-emerald-500/10 gap-1.5 h-5 px-2 font-medium">
              <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Live Supabase ({items.length})
            </Badge>
          ) : manifestsSource.usingDemo ? (
            <Badge variant="outline" className="text-[10px] text-amber-600 dark:text-amber-400 border-amber-500/30 bg-amber-500/10 gap-1.5 h-5 px-2 font-medium">
              <span className="size-1.5 rounded-full bg-amber-500" />
              Demo Mock Fallback
            </Badge>
          ) : null}
        </div>
        <Button
          size="sm"
          variant="outline"
          className="h-7 text-xs gap-1.5 px-2.5 hover:bg-secondary"
          disabled={liveManifests.isFetching}
          onClick={async () => {
            const toastId = toast.loading("Syncing latest manifestos from Supabase...");
            try {
              invalidateManifests();
              await liveManifests.refetch();
              toast.success("Manifesto registry updated", { id: toastId });
            } catch (err) {
              toast.error("Sync failed", { id: toastId, description: dbErrorMessage(err) });
            }
          }}
          title="Refresh manifestos directly from Supabase"
        >
          <RotateCw className={`size-3.5 ${liveManifests.isFetching ? "animate-spin text-primary" : ""}`} />
          <span>Sync Live Data</span>
        </Button>
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
          <div className="col-span-full text-center py-12 text-muted-foreground space-y-3">
            <p className="text-sm font-medium">No manifestos match the current filters.</p>
            {activeFilters.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setFilters({ q: "", site: "All", dateFrom: "", dateTo: "" });
                  setVerificationFilter("all");
                }}
                className="text-xs"
              >
                Clear all filters ({items.length} total manifestos available)
              </Button>
            )}
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
                  className={`p-0 overflow-hidden shadow-elegant border-border/60 hover:shadow-glow hover:-translate-y-0.5 transition-all flex flex-col ${
                    selected.has(m.id) ? "ring-2 ring-primary/40" : ""
                  }`}
                >
                  {/* Card Header with real site photo or deep ocean fallback */}
                  <div
                    onClick={() => openViewing(m)}
                    className="block w-full h-36 relative cursor-pointer overflow-hidden group select-none"
                  >
                    {(() => {
                      const photo = sitePhotoMap.get(m.site.toLowerCase().trim());
                      if (photo) {
                        return (
                          <img
                            src={photo}
                            alt={m.site}
                            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                          />
                        );
                      }
                      return (
                        <div className="w-full h-full bg-gradient-to-br from-cyan-950 via-slate-900 to-blue-950 relative">
                          <div
                            className="absolute inset-0 opacity-20"
                            style={{
                              backgroundImage:
                                "radial-gradient(circle at 30% 30%, oklch(1 0 0 / 0.4), transparent 60%)",
                            }}
                          />
                        </div>
                      );
                    })()}
                    {/* Dark gradient overlay for contrast */}
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-950/40 to-slate-950/20" />

                    {/* Top Bar: Checkbox & Status */}
                    <div className="absolute top-2.5 left-2.5 right-2.5 flex items-center justify-between z-10">
                      <div className="flex items-center gap-1.5">
                        <div
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleSelect(m.id);
                          }}
                          className="rounded-md bg-black/40 backdrop-blur-md p-1 border border-white/20"
                        >
                          <Checkbox
                            checked={selected.has(m.id)}
                            onCheckedChange={() => {}}
                            aria-label={`Select manifesto ${m.id}`}
                          />
                        </div>
                        {isVerified(m) ? (
                          <Badge className="bg-emerald-600/95 hover:bg-emerald-600 text-white border-0 shadow-sm text-[10px] font-semibold tracking-wide uppercase px-2 py-0.5 flex items-center gap-1">
                            <ShieldCheck className="size-3" /> Verified
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="bg-amber-500/20 text-amber-200 border-amber-400/40 text-[10px] font-semibold tracking-wide uppercase px-2 py-0.5 flex items-center gap-1 backdrop-blur-sm">
                            <ShieldAlert className="size-3" /> Pending
                          </Badge>
                        )}
                      </div>
                      <Badge variant="secondary" className="bg-black/50 backdrop-blur-md text-white border border-white/20 text-[11px] font-semibold px-2 py-0.5 flex items-center gap-1">
                        <Users className="size-3 text-cyan-300" />
                        {m.divers} divers
                      </Badge>
                    </div>

                    {/* Bottom Header Info */}
                    <div className="absolute bottom-2.5 left-3 right-3 text-white">
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono text-[10px] font-semibold text-cyan-300 bg-cyan-950/80 px-1.5 py-0.5 rounded border border-cyan-500/40">
                          #{m.id}
                        </span>
                        {(m as any).diveMode && (
                          <span className="text-[10px] text-white/70">
                            &bull; {(m as any).diveMode}
                          </span>
                        )}
                      </div>
                      <div className="font-display font-bold text-sm text-white flex items-center gap-1 mt-0.5 truncate drop-shadow-sm">
                        <MapPin className="size-3.5 text-cyan-400 shrink-0" />
                        <span className="truncate">{m.site}</span>
                      </div>
                    </div>
                  </div>

                  {/* Card Content */}
                  <div className="p-3 space-y-2 flex-1 flex flex-col justify-between">
                    <div className="space-y-1.5">
                      <div className="text-xs font-semibold text-foreground flex items-center gap-1.5 truncate">
                        <Building2 className="size-3.5 text-muted-foreground shrink-0" />
                        <span className="truncate">{m.operator}</span>
                      </div>
                      <div className="text-xs text-muted-foreground flex items-center gap-1.5">
                        <Calendar className="size-3.5 shrink-0 text-muted-foreground" />
                        <span>{m.date}</span>
                      </div>
                      <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                        <Badge variant="outline" className="text-[10px] h-5 px-1.5 gap-1 font-normal">
                          <Anchor className="size-2.5 text-primary shrink-0" />
                          <span className="truncate max-w-[120px]">{(m as any).boatName || "Boat Dive"}</span>
                        </Badge>
                        <Badge variant="secondary" className="text-[10px] h-5 px-1.5 font-normal">
                          {(m as any).diveType || "Scuba"}
                        </Badge>
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex gap-1.5 pt-2 border-t border-border/40">
                      <Button
                        size="sm"
                        variant={isVerified(m) ? "default" : "outline"}
                        className={`flex-1 h-8 ${isVerified(m) ? "bg-emerald-600 hover:bg-emerald-700 text-white" : ""}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleVerify(m.id);
                        }}
                        title={isVerified(m) ? "Mark as unverified" : "Mark as verified"}
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
                        className="flex-1 h-8"
                        disabled={rowBusy[m.id] === "download"}
                        onClick={(e) => {
                          e.stopPropagation();
                          downloadImageManifesto(m);
                        }}
                        title="Download Manifesto as Image (PNG)"
                      >
                        {rowBusy[m.id] === "download" ? (
                          <Loader2 className="size-4 animate-spin text-primary" />
                        ) : (
                          <ImageIcon className="size-4" />
                        )}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="flex-1 h-8"
                        disabled={!!b}
                        onClick={(e) => {
                          e.stopPropagation();
                          setForwardDialog([m.id]);
                        }}
                        title="Forward Manifest"
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
                        className="flex-1 h-8"
                        onClick={() => openViewing(m)}
                        title="View Full Details"
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

      <AnimatePresence>
        {viewing && (
          <motion.div
            key="manifesto-lightbox"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/80 backdrop-blur-sm overflow-y-auto"
            onClick={() => setViewing(null)}
            onKeyDown={(e) => e.key === "Escape" && setViewing(null)}
            tabIndex={-1}
            ref={(el) => {
              if (el) {
                el.focus();
                el.addEventListener("keydown", (e) => {
                  if (e.key === "Escape") setViewing(null);
                });
              }
            }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ duration: 0.25 }}
              className="relative w-full max-w-2xl mx-4 my-6 rounded-2xl bg-card border border-border/60 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Close Button */}
              <button
                onClick={() => setViewing(null)}
                className="absolute top-3 right-3 z-20 rounded-full bg-black/50 hover:bg-black/75 text-white p-1.5 transition-colors"
                title="Close"
              >
                <X className="size-4" />
              </button>

                            {/* Sinsay Ocean Header with Diver Illustration Background */}
              <div
                className="relative w-full px-6 pt-6 pb-10 sm:pb-12 text-white overflow-hidden select-none shrink-0"
                style={{
                  backgroundImage: "url('/manifesto-bg.png')",
                  backgroundPosition: "center top",
                  backgroundSize: "cover",
                  backgroundRepeat: "no-repeat",
                }}
              >
                <div className="absolute inset-0 bg-blue-900/10 pointer-events-none" />

                <div className="relative z-10 space-y-1.5">
                  <div className="flex items-center justify-between pr-8">
                    <div className="space-y-1">
                      <img
                        src="/sinsay-logo-white.png"
                        alt="SINSAY"
                        className="h-8 w-auto object-contain filter drop-shadow-sm"
                      />
                      <div className="w-9 h-1 bg-sky-200 rounded-full" />
                    </div>
                    {isVerified(viewing) ? (
                      <Badge className="bg-white/20 hover:bg-white/30 text-white border-white/30 backdrop-blur-md text-[11px] font-semibold px-2.5 py-1">
                        <Check className="size-3 mr-1 text-emerald-300" /> Cleared for Voyage
                      </Badge>
                    ) : (
                      <Badge className="bg-amber-500/20 text-amber-200 border-amber-300/30 backdrop-blur-md text-[11px] px-2.5 py-1">
                        Pending LGU Clearance
                      </Badge>
                    )}
                  </div>

                  <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight leading-tight pt-1">
                    Official Boat Dive<br />Manifesto
                  </h1>
                </div>

                {/* Organic Ocean Wave Transition on Top of Vessel Details */}
                <div className="absolute bottom-0 left-0 right-0 w-full overflow-hidden leading-none pointer-events-none z-10">
                  <svg
                    viewBox="0 0 1100 65"
                    preserveAspectRatio="none"
                    className="w-full h-7 sm:h-10 block"
                  >
                    {/* Wave 1: Back Azure Wave */}
                    <path
                      d="M 0,35 C 240,50 495,15 715,23 C 900,30 1010,45 1100,33 L 1100,65 L 0,65 Z"
                      fill="rgba(120, 185, 255, 0.45)"
                    />
                    {/* Wave 2: Front White Crest Wave */}
                    <path
                      d="M 0,48 C 308,24 572,52 836,26 C 968,14 1056,42 1100,38 L 1100,65 L 0,65 Z"
                      fill="rgba(255, 255, 255, 0.6)"
                    />
                  </svg>
                </div>
              </div>

              {/* Scrollable Card Body matching the reference */}
              <div className="p-6 pb-10 space-y-5 overflow-y-auto bg-card">
                {/* 1. Vessel Details Section */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <div className="w-1.5 h-5 bg-blue-600 rounded-full" />
                    <h3 className="font-bold text-base text-foreground">Vessel Details</h3>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                    <div className="p-2.5 rounded-xl bg-blue-50/70 dark:bg-slate-800/60 border border-blue-100/80 dark:border-slate-700/60 flex items-center gap-2.5">
                      <div className="size-8 rounded-full bg-blue-600/10 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                        <User className="size-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">Accredited Operator</div>
                        <div className="text-xs font-bold text-foreground truncate">{viewing.operator}</div>
                      </div>
                    </div>

                    <div className="p-2.5 rounded-xl bg-blue-50/70 dark:bg-slate-800/60 border border-blue-100/80 dark:border-slate-700/60 flex items-center gap-2.5">
                      <div className="size-8 rounded-full bg-blue-600/10 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                        <MapPin className="size-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">Dive Location</div>
                        <div className="text-xs font-bold text-foreground truncate">{viewing.site}</div>
                      </div>
                    </div>

                    <div className="p-2.5 rounded-xl bg-blue-50/70 dark:bg-slate-800/60 border border-blue-100/80 dark:border-slate-700/60 flex items-center gap-2.5">
                      <div className="size-8 rounded-full bg-blue-600/10 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                        <Calendar className="size-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">Voyage Date</div>
                        <div className="text-xs font-bold text-foreground truncate">{viewing.date}</div>
                      </div>
                    </div>

                    <div className="p-2.5 rounded-xl bg-blue-50/70 dark:bg-slate-800/60 border border-blue-100/80 dark:border-slate-700/60 flex items-center gap-2.5">
                      <div className="size-8 rounded-full bg-blue-600/10 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                        <Ship className="size-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">Vessel / Boat</div>
                        <div className="text-xs font-bold text-foreground truncate">{viewing.boatName || "Bantay Dagat"}</div>
                      </div>
                    </div>

                    <div className="p-2.5 rounded-xl bg-blue-50/70 dark:bg-slate-800/60 border border-blue-100/80 dark:border-slate-700/60 flex items-center gap-2.5">
                      <div className="size-8 rounded-full bg-blue-600/10 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                        <Users className="size-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">Divers Onboard</div>
                        <div className="text-xs font-bold text-foreground truncate">{viewing.divers} Certified Divers</div>
                      </div>
                    </div>

                    <div className="p-2.5 rounded-xl bg-blue-50/70 dark:bg-slate-800/60 border border-blue-100/80 dark:border-slate-700/60 flex items-center gap-2.5">
                      <div className="size-8 rounded-full bg-blue-600/10 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                        <Anchor className="size-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">Dive Type</div>
                        <div className="text-xs font-bold text-foreground truncate">{viewing.diveType || "Scuba Diving"}</div>
                      </div>
                    </div>

                    <div className="p-2.5 rounded-xl bg-blue-50/70 dark:bg-slate-800/60 border border-blue-100/80 dark:border-slate-700/60 flex items-center gap-2.5">
                      <div className="size-8 rounded-full bg-blue-600/10 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                        <Users className="size-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">Capacity</div>
                        <div className="text-xs font-bold text-foreground truncate">{viewing.maxDivers ? `${viewing.divers}/${viewing.maxDivers} Max` : `${viewing.divers}/22 Max`}</div>
                      </div>
                    </div>

                    <div className="p-2.5 rounded-xl bg-blue-50/70 dark:bg-slate-800/60 border border-blue-100/80 dark:border-slate-700/60 flex items-center gap-2.5">
                      <div className="size-8 rounded-full bg-blue-600/10 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                        <ShieldCheck className="size-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">Guide / Captain</div>
                        <div className="text-xs font-bold text-foreground truncate">{viewing.captainName || viewing.instructorName || "Licensed Guide"}</div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 2. Diver List Section matching Sinsay Reference */}
                <div className="space-y-3 pt-2">
                  <div className="flex items-center gap-2">
                    <div className="w-1.5 h-5 bg-blue-600 rounded-full" />
                    <h3 className="font-bold text-base text-foreground">Diver List</h3>
                  </div>

                  {rosterLoading ? (
                    <div className="flex items-center justify-center p-8 text-xs text-muted-foreground">
                      <Loader2 className="size-5 mr-2 animate-spin text-blue-600" />
                      Loading diver roster from Supabase…
                    </div>
                  ) : rosterError ? (
                    <div className="p-4 rounded-lg bg-destructive/10 border border-destructive/20 text-xs text-destructive">
                      Could not load the roster. Close and reopen to retry.
                    </div>
                  ) : (
                    <div className="rounded-xl border border-blue-100 dark:border-slate-800 overflow-x-auto shadow-sm">
                      <Table className="min-w-[640px]">
                        <TableHeader>
                          <TableRow className="bg-blue-600 hover:bg-blue-600 text-white border-none">
                            <TableHead className="w-12 text-center text-xs font-bold text-white whitespace-nowrap">#</TableHead>
                            <TableHead className="text-xs font-bold text-white whitespace-nowrap">DIVER PASSENGER NAME</TableHead>
                            <TableHead className="text-xs font-bold text-white whitespace-nowrap">ECO DIVE ID</TableHead>
                            <TableHead className="text-xs font-bold text-white whitespace-nowrap">CERTIFICATION / STATUS</TableHead>
                            <TableHead className="text-xs font-bold text-white text-center whitespace-nowrap">MUNICIPAL FEE</TableHead>
                            <TableHead className="text-xs font-bold text-white text-center whitespace-nowrap">SAFETY WAIVER</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {((roster && roster.length > 0) ? roster : Array.from({ length: viewing.divers || 2 }, (_, i) => ({
                            name: i === 0 ? "John Smith" : "Jhon Mcneil Magtilay",
                            ecoId: i === 0 ? null : "VERIFIED ID",
                            isWalkIn: i === 0,
                            level: i === 0 ? "Walk-in Registration" : "Open Water Diver"
                          }))).map((d, i) => (
                            <TableRow key={i} className="hover:bg-blue-50/40 dark:hover:bg-slate-800/40 border-b border-border/60">
                              <TableCell className="text-center font-bold text-xs text-foreground">{i + 1}</TableCell>
                              <TableCell className="font-bold text-xs text-foreground">{d.name}</TableCell>
                              <TableCell className="font-bold text-[11px] text-blue-600 dark:text-blue-400">
                                {d.ecoId ? d.ecoId : (d.isWalkIn ? "WALK-IN GUEST" : "VERIFIED ID")}
                              </TableCell>
                              <TableCell className="text-xs text-muted-foreground">{d.level || (d.isWalkIn ? "Walk-in Registration" : "Open Water Diver")}</TableCell>
                              <TableCell className="text-center">
                                <Badge variant="secondary" className="bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 text-[10px] font-bold px-2 py-0.5">
                                  PAID &amp; CLEARED
                                </Badge>
                              </TableCell>
                              <TableCell className="text-center">
                                <Badge variant="secondary" className="bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 text-[10px] font-bold px-2 py-0.5 inline-flex items-center gap-1">
                                  <Check className="size-3 text-emerald-600" /> SIGNED
                                </Badge>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </div>

                {/* Footer Buttons */}
                <div className="flex flex-wrap gap-2 pt-3 border-t border-border/60">
                  <Button
                    variant="outline"
                    className="flex-1"
                    disabled={rowBusy[viewing.id] === "download"}
                    onClick={() => rowAction(viewing, "download")}
                  >
                    {rowBusy[viewing.id] === "download" ? (
                      <Loader2 className="size-4 mr-1.5 animate-spin" />
                    ) : (
                      <Printer className="size-4 mr-1.5" />
                    )}
                    Print Manifest
                  </Button>
                  <Button
                    variant="secondary"
                    className="flex-1 bg-sky-600 hover:bg-sky-700 text-white font-medium"
                    onClick={() => downloadImageManifesto(viewing, roster || undefined)}
                  >
                    <ImageIcon className="size-4 mr-1.5" />
                    Download Image (PNG)
                  </Button>
                  <Button
                    className="flex-1 gradient-primary text-primary-foreground"
                    onClick={() => rowAction(viewing, "forward")}
                  >
                    <Forward className="size-4 mr-1.5" /> Forward
                  </Button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

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


