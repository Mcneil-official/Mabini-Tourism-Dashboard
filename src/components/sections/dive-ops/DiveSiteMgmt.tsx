import { useState, useEffect, useMemo, useRef, useCallback, lazy, Suspense } from "react";
import {
  MapPin,
  SlidersHorizontal,
  Plus,
  Edit3,
  Trash2,
  Eye,
  EyeOff,
  Sparkles,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Waves,
  ShieldAlert,
  Image as ImageIcon,
  ImagePlus,
  Loader2,
  RotateCcw,
  Check,
  X,
  Search,
  ChevronRight,
  Compass,
  Gauge,
  ArrowDownUp,
  Activity,
  FileText,
  Layers,
  Globe,
  Info,
  Anchor,
  Fish,
  Copy,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { toast } from "sonner";
import { Pagination, usePagination } from "@/components/ui/pagination";
import {
  StatCard,
  SectionCard,
  DataSourceBadge,
  useMounted,
  Field,
  ActiveFilterBadges,
  TableSkeletonRows,
} from "@/components/shared";
import type { DiveSiteHeatmap as DiveSiteHeatmapType } from "@/components/DiveSiteHeatmap";
import { useFilters } from "@/hooks/useFilters";
import { usePermission } from "@/hooks/usePermission";
import { pushAuditLog } from "@/lib/audit";
import { requireLiveSession } from "@/lib/staff-auth";
import {
  useLiveMode,
  useDiveSitesLive,
  useManifestsLive,
  useInvalidateLive,
  addDiveSite,
  updateDiveSite,
  deleteDiveSite,
  countManifestsByLocation,
  setSiteStatus,
  getSitePhotoUrl,
  uploadSitePhoto,
  dbErrorMessage,
} from "@/lib/queries";
import {
  manifestos,
  ALL_DIFFICULTIES,
  ALL_SITE_TYPES,
  SITE_BARANGAYS,
} from "@/lib/mock-data";

const DiveSiteHeatmapLazy = lazy(() =>
  import("@/components/DiveSiteHeatmap").then((m) => ({
    default: m.DiveSiteHeatmap,
  })),
);

function ClientOnlyDiveSiteHeatmap({
  sites,
  onSiteClick,
}: {
  sites: React.ComponentProps<typeof DiveSiteHeatmapType>["sites"];
  onSiteClick?: (site: any) => void;
}) {
  const mounted = useMounted();
  if (!mounted) {
    return (
      <div className="h-[clamp(320px,50dvh,520px)] w-full rounded-xl border border-border/60 bg-muted" />
    );
  }
  return (
    <Suspense
      fallback={
        <div className="h-[clamp(320px,50dvh,520px)] w-full rounded-xl border border-border/60 bg-muted" />
      }
    >
      <DiveSiteHeatmapLazy sites={sites} onSiteClick={onSiteClick} />
    </Suspense>
  );
}

// Canonical site view: normalizes live rows (siteCode/depthRange/siteType/
// photoUrl/dives) and mock rows (id/depth/type/photo) to one shape so all
// render code below works on both sources unchanged.
const toSiteView = (s: any) => {
  // Multi-type lives in `siteTypes` (live) or `types` (mock); legacy rows and
  // old mock entries only carry a single `type`.
  const types: string[] =
    s.siteTypes ?? s.types ?? (s.type && s.type !== "—" ? [s.type] : []);
  return {
    _dbId: s._dbId,
    id: s.siteCode ?? s.id ?? "—",
    name: s.name,
    barangay: s.barangay ?? "—",
    depth: s.depthRange ?? s.depth ?? "—",
    difficulty: s.difficulty ?? "—",
    type: types[0] ?? "—",
    types,
    status: s.status,
    dives: s.dives ?? 0,
    description: s.description ?? "",
    photo: s.photo ?? null,
    photoPath: s.photoUrl ?? null,
    lat: s.lat,
    lng: s.lng,
    createdAt: s.createdAt ?? null,
  };
};

// Signed-URL cache shared by every SitePhoto (list + dialog + heatmap
// tooltip): one network call per storage path per session.
const sitePhotoCache = new Map<string, string | null>();

function SitePhoto({
  photo,
  photoPath,
  alt,
  className,
}: {
  photo?: string | null;
  photoPath?: string | null;
  alt: string;
  className?: string;
}) {
  const [url, setUrl] = useState<string | null>(photo ?? null);
  useEffect(() => {
    if (photo) {
      setUrl(photo);
      return;
    }
    if (!photoPath) {
      setUrl(null);
      return;
    }
    const cached = sitePhotoCache.get(photoPath);
    if (cached !== undefined) {
      setUrl(cached);
      return;
    }
    let live = true;
    getSitePhotoUrl(photoPath)
      .then((u) => {
        sitePhotoCache.set(photoPath, u);
        if (live) setUrl(u);
      })
      .catch(() => {
        sitePhotoCache.set(photoPath, null);
        if (live) setUrl(null);
      });
    return () => {
      live = false;
    };
  }, [photo, photoPath]);
  if (!url) return null;
  return <img src={url} alt={alt} className={className} />;
}

export function DiveSiteMgmt() {
  const { canAct, canAdmin, deny } = usePermission();
  const { search, setFilters, resetFilters } = useFilters();
  const [viewing, setViewing] = useState<any>(null);
  // No seeded demo rows: the registry is live-only, and this local state only
  // holds sites added/edited while offline.
  const [mockSites, setMockSites] = useState<any[]>([]);
  // Edit mode reuses the add dialog (prefilled); delete uses its own confirm.
  const [editTarget, setEditTarget] = useState<any>(null);
  const [deleteTarget, setDeleteTarget] = useState<any>(null);
  const [clearPhoto, setClearPhoto] = useState(false);
  // Live mode (Supabase configured): sites come from dive_sites (+ diver
  // counts rolled up from manifests); without it the list is empty.
  const isLive = useLiveMode();
  const liveSites = useDiveSitesLive();
  const liveManifestsDs = useManifestsLive();
  const invalidateSites = useInvalidateLive();
  const isLiveData = isLive && !!liveSites.data;
  const sites = useMemo(
    () => (liveSites.data ?? mockSites).map(toSiteView),
    [liveSites.data, mockSites],
  );
  useEffect(() => {
    if (liveSites.isError) {
      toast.error("Could not load live dive sites", {
        description: "Check the Supabase connection.",
      });
    }
  }, [liveSites.isError]);
  const [addOpen, setAddOpen] = useState(false);
  const [newSite, setNewSite] = useState({
    name: "",
    barangay: "",
    depth: "",
    difficulty: "Open Water",
    types: ["Scuba"] as string[],
    description: "",
    lat: "13.7620",
    lng: "120.9210",
    photo: "",
  });
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [adding, setAdding] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [toggling, setToggling] = useState<Record<string, boolean>>({});
  const [siteErrors, setSiteErrors] = useState<Record<string, string>>({});
  const fileRef = useRef<HTMLInputElement>(null);

  const filtered = useMemo(() => {
    return sites.filter((s) => {
      if (search.status !== "All" && s.status !== search.status) return false;
      if (search.difficulty !== "All" && s.difficulty !== search.difficulty)
        return false;
      if (search.siteType !== "All" && !s.types.includes(search.siteType))
        return false;
      if (search.q) {
        const q = search.q.toLowerCase();
        if (
          !s.name.toLowerCase().includes(q) &&
          !s.id.toLowerCase().includes(q) &&
          !s.barangay.toLowerCase().includes(q)
        )
          return false;
      }
      return true;
    });
  }, [sites, search.q, search.status, search.difficulty, search.siteType]);

  // Filter options follow the data source (live distinct values when live).
  const difficultyOptions = useMemo(
    () =>
      isLiveData
        ? [
            ...new Set(sites.map((s) => s.difficulty).filter((d) => d !== "—")),
          ].sort()
        : ALL_DIFFICULTIES,
    [isLiveData, sites],
  );
  const siteTypeOptions = useMemo(
    () =>
      isLiveData
        ? [
            ...new Set(sites.flatMap((s) => s.types).filter((t) => t !== "—")),
          ].sort()
        : ALL_SITE_TYPES,
    [isLiveData, sites],
  );

  const activeFilters: { key: string; label: string }[] = [];
  if (search.status !== "All")
    activeFilters.push({ key: "status", label: `Status: ${search.status}` });
  if (search.difficulty !== "All")
    activeFilters.push({
      key: "difficulty",
      label: `Difficulty: ${search.difficulty}`,
    });
  if (search.siteType !== "All")
    activeFilters.push({ key: "siteType", label: `Type: ${search.siteType}` });
  if (search.q)
    activeFilters.push({ key: "q", label: `Search: "${search.q}"` });

  const handleRemoveFilter = (key: string) => {
    if (key === "q") setFilters({ q: "" });
    else if (key === "status") setFilters({ status: "All" });
    else if (key === "difficulty") setFilters({ difficulty: "All" });
    else if (key === "siteType") setFilters({ siteType: "All" });
  };

  const validateSite = () => {
    const e: Record<string, string> = {};
    if (!newSite.name.trim()) e.name = "Site name is required";
    if (!newSite.barangay) e.barangay = "Select a barangay";
    if (!newSite.depth.trim()) e.depth = "Depth range is required";
    else if (
      !/^\d+(\.\d+)?\s*[–-]\s*\d+(\.\d+)?\s*m?$/i.test(newSite.depth.trim()) &&
      !/^\d+(\.\d+)?\s*m$/i.test(newSite.depth.trim())
    )
      e.depth = "e.g. 10–30 m or 15 m";
    if (!newSite.difficulty) e.difficulty = "Select difficulty";
    if (newSite.types.length === 0) e.type = "Select at least one type";
    const lat = Number(newSite.lat);
    const lng = Number(newSite.lng);
    if (!newSite.lat.trim() || Number.isNaN(lat) || lat < -90 || lat > 90)
      e.lat = "Latitude between -90 and 90";
    if (!newSite.lng.trim() || Number.isNaN(lng) || lng < -180 || lng > 180)
      e.lng = "Longitude between -180 and 180";
    setSiteErrors(e);
    return Object.keys(e).length === 0;
  };

  const nextSiteCode = () => {
    const nums = sites
      .map((s) => /^DS-(\d+)$/.exec(s.id)?.[1])
      .filter((n): n is string => !!n)
      .map(Number)
      .filter((n) => !Number.isNaN(n));
    return `DS-${String((nums.length ? Math.max(...nums) : 0) + 1).padStart(3, "0")}`;
  };

  const resetSiteForm = () =>
    setNewSite({
      name: "",
      barangay: "",
      depth: "",
      difficulty: "Open Water",
      types: ["Scuba"],
      description: "",
      lat: "13.7620",
      lng: "120.9210",
      photo: "",
    });

  const addSite = async () => {
    if (!canAct) return deny();
    if (isLive && !(await requireLiveSession())) return;
    if (!validateSite())
      return toast.error("Please fix the highlighted fields");
    const base = {
      name: newSite.name.trim(),
      barangay: newSite.barangay,
      depth: newSite.depth.trim(),
      difficulty: newSite.difficulty,
      types: newSite.types,
      type: newSite.types.join(", "),
      description: newSite.description.trim(),
      lat: Number(newSite.lat),
      lng: Number(newSite.lng),
    };
    // Live mode: upload the photo (if any), then insert the row (033).
    const liveRow = isLiveData;
    if (isLive && liveRow) {
      setAdding(true);
      try {
        let photoUrl: string | null = null;
        if (photoFile) {
          photoUrl = await uploadSitePhoto(photoFile);
        }
        await addDiveSite({
          siteCode: nextSiteCode(),
          ...base,
          depthRange: base.depth,
          siteTypes: base.types,
          photoUrl,
        });
        invalidateSites();
        setAddOpen(false);
        resetSiteForm();
        setPhotoFile(null);
        setSiteErrors({});
        toast.success("Dive site added", {
          description: `${base.name} — ${base.barangay}`,
        });
        pushAuditLog(`Added dive site ${base.name}`);
      } catch (e) {
        toast.error("Could not add dive site", {
          description: dbErrorMessage(e),
        });
      } finally {
        setAdding(false);
      }
      return;
    }
    const site = {
      id: nextSiteCode(),
      ...base,
      photo: newSite.photo,
      status: "Active",
      dives: 0,
    };
    setMockSites((prev) => [site, ...prev]);
    setAddOpen(false);
    resetSiteForm();
    setPhotoFile(null);
    setSiteErrors({});
    toast.success("Dive site added", {
      description: `${site.name} — ${site.barangay}`,
    });
  };

  const closeSiteDialog = () => {
    setAddOpen(false);
    setEditTarget(null);
    setPhotoFile(null);
    setClearPhoto(false);
    setSiteErrors({});
    resetSiteForm();
    if (fileRef.current) fileRef.current.value = "";
  };

  const openEdit = (site: any) => {
    if (!canAct) return deny();
    setNewSite({
      name: site.name ?? "",
      barangay: site.barangay && site.barangay !== "—" ? site.barangay : "",
      depth: site.depth && site.depth !== "—" ? site.depth : "",
      difficulty:
        site.difficulty && site.difficulty !== "—"
          ? site.difficulty
          : "Open Water",
      types: site.types?.length
        ? site.types
        : site.type && site.type !== "—"
          ? [site.type]
          : ["Scuba"],
      description: site.description ?? "",
      lat: site.lat != null ? String(site.lat) : "",
      lng: site.lng != null ? String(site.lng) : "",
      photo: "",
    });
    setPhotoFile(null);
    setClearPhoto(false);
    setSiteErrors({});
    setEditTarget(site);
  };

  const saveEdit = async () => {
    if (!canAct) return deny();
    if (!editTarget) return;
    if (isLive && !(await requireLiveSession())) return;
    if (!validateSite())
      return toast.error("Please fix the highlighted fields");
    const base = {
      name: newSite.name.trim(),
      barangay: newSite.barangay,
      depth: newSite.depth.trim(),
      difficulty: newSite.difficulty,
      types: newSite.types,
      type: newSite.types.join(", "),
      description: newSite.description.trim(),
      lat: Number(newSite.lat),
      lng: Number(newSite.lng),
    };
    // Live mode: upload a replacement photo (if any), then update the row.
    if (isLive && editTarget._dbId) {
      setAdding(true);
      try {
        let photoUrl: string | null = editTarget.photoPath ?? null;
        let photoPreview: string | null = editTarget.photo ?? null;
        if (photoFile) {
          photoUrl = await uploadSitePhoto(photoFile);
          photoPreview = newSite.photo || null;
        } else if (clearPhoto) {
          photoUrl = null;
          photoPreview = null;
        }
        await updateDiveSite(editTarget._dbId, {
          ...base,
          depthRange: base.depth,
          siteTypes: base.types,
          photoUrl,
        });
        invalidateSites();
        const updated = {
          ...editTarget,
          ...base,
          photo: photoPreview,
          photoPath: photoUrl,
        };
        setViewing((v: any) => (v && v.id === editTarget.id ? updated : v));
        closeSiteDialog();
        pushAuditLog(`Edited dive site ${editTarget.id} — ${base.name}`);
        toast.success("Dive site updated", { description: base.name });
      } catch (e) {
        toast.error("Could not update dive site", {
          description: dbErrorMessage(e),
        });
      } finally {
        setAdding(false);
      }
      return;
    }
    const photo = photoFile
      ? newSite.photo
      : clearPhoto
        ? ""
        : editTarget.photo;
    setMockSites((prev) =>
      prev.map((s) => (s.id === editTarget.id ? { ...s, ...base, photo } : s)),
    );
    setViewing((v: any) =>
      v && v.id === editTarget.id ? { ...v, ...base, photo } : v,
    );
    closeSiteDialog();
    pushAuditLog(`Edited dive site ${editTarget.id} — ${base.name}`);
    toast.success("Dive site updated", { description: base.name });
  };

  const attemptDelete = async (site: any) => {
    if (!canAdmin) return deny("Only Super Admin can delete dive sites.");
    if (isLive && !(await requireLiveSession())) return;
    const blocked = (refs: number) => {
      toast.error("Cannot delete this site", {
        description: `${refs} manifesto${refs !== 1 ? "s" : ""} reference${refs !== 1 ? "" : "s"} ${site.name} — set it to Restricted instead.`,
      });
    };
    // Live mode: refuse when manifests reference the location so history
    // stays linked; Restricted status is the removal path instead.
    if (isLive && site._dbId) {
      try {
        const refs = await countManifestsByLocation(site.name);
        if (refs > 0) {
          blocked(refs);
          return;
        }
      } catch (e) {
        toast.error("Could not check references", {
          description: dbErrorMessage(e),
        });
        return;
      }
      setDeleteTarget(site);
      return;
    }
    const refs = manifestos.filter((m) => m.site === site.name).length;
    if (refs > 0) {
      blocked(refs);
      return;
    }
    setDeleteTarget(site);
  };

  const doDelete = async () => {
    if (!deleteTarget) return;
    if (!canAdmin) return deny("Only Super Admin can delete dive sites.");
    if (isLive && !(await requireLiveSession())) return;
    setDeleting(true);
    try {
      if (isLive && deleteTarget._dbId) {
        await deleteDiveSite(deleteTarget._dbId);
        invalidateSites();
      } else {
        setMockSites((prev) => prev.filter((s) => s.id !== deleteTarget.id));
      }
      setViewing((v: any) => (v && v.id === deleteTarget.id ? null : v));
      pushAuditLog(
        `Deleted dive site ${deleteTarget.id} — ${deleteTarget.name}`,
      );
      toast.success("Dive site deleted", {
        description: deleteTarget.name,
      });
      setDeleteTarget(null);
    } catch (e) {
      toast.error("Could not delete dive site", {
        description: dbErrorMessage(e),
      });
    } finally {
      setDeleting(false);
    }
  };

  const onPhotoPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/"))
      return toast.error("Please select an image file");
    if (file.size > 5 * 1024 * 1024)
      return toast.error("Image must be under 5 MB");
    setPhotoFile(file);
    const reader = new FileReader();
    reader.onload = () =>
      setNewSite((s) => ({ ...s, photo: reader.result as string }));
    reader.readAsDataURL(file);
  };

  const nextStatusOf = (
    status: string,
  ): "Active" | "Seasonal" | "Restricted" =>
    status === "Active"
      ? "Restricted"
      : status === "Restricted"
        ? "Seasonal"
        : "Active";

  // Month-over-month diver movement for one site (live manifests only).
  const siteTrend = (siteName: string): string | null => {
    const rows = liveManifestsDs.data;
    if (!isLive || !rows) return null;
    const sumMonth = (idx: number) =>
      rows
        .filter((m) => {
          if (m.site !== siteName) return false;
          const d = new Date(m.date + "T00:00:00");
          return !Number.isNaN(d.getTime()) && d.getMonth() === idx;
        })
        .reduce((a, m) => a + (m.divers || 0), 0);
    const cur = new Date().getMonth();
    const diff = sumMonth(cur) - sumMonth((cur + 11) % 12);
    return `${diff >= 0 ? "+" : ""}${diff}`;
  };

  const toggleStatus = async (id: string) => {
    if (!canAct) return deny();
    if (isLive && !(await requireLiveSession())) return;
    // Live mode: persist the status cycle (033 staff UPDATE).
    const liveRow = liveSites.data?.find((s) => s.siteCode === id);
    if (isLive && liveRow) {
      const view = sites.find((s) => s.id === id);
      const next = nextStatusOf(view?.status ?? "Active");
      setToggling((t) => ({ ...t, [id]: true }));
      try {
        await setSiteStatus(liveRow._dbId, next);
        invalidateSites();
        toast.info(`Status updated`, {
          description: `${view?.name ?? id} → ${next}`,
        });
        pushAuditLog(`Updated dive site ${id} status to ${next}`);
      } catch (e) {
        toast.error("Could not update site status", {
          description: dbErrorMessage(e),
        });
      } finally {
        setToggling((t) => ({ ...t, [id]: false }));
      }
      return;
    }
    setMockSites((prev) =>
      prev.map((s) => {
        if (s.id !== id) return s;
        const next = nextStatusOf(s.status);
        toast.info(`Status updated`, { description: `${s.name} → ${next}` });
        return { ...s, status: next };
      }),
    );
  };

  return (
    <>
      <div className="space-y-4">
        {/* Search & Filters */}
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <DataSourceBadge
              live={isLive}
              isError={liveSites.isError}
              isLoading={isLive && liveSites.isPending}
            />
          </div>
          <div className="flex flex-col md:flex-row gap-3 md:items-center">
            <div className="relative flex-1 max-w-md">
              <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search by name, ID, or barangay…"
                value={search.q}
                onChange={(e) => setFilters({ q: e.target.value })}
                className="pl-9"
              />
            </div>
            <Select
              value={search.status}
              onValueChange={(v) => setFilters({ status: v })}
            >
              <SelectTrigger className="w-36">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                {["All", "Active", "Seasonal", "Restricted"].map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={search.difficulty}
              onValueChange={(v) => setFilters({ difficulty: v })}
            >
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Difficulty" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="All">All difficulties</SelectItem>
                {difficultyOptions.map((d) => (
                  <SelectItem key={d} value={d}>
                    {d}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={search.siteType}
              onValueChange={(v) => setFilters({ siteType: v })}
            >
              <SelectTrigger className="w-36">
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="All">All types</SelectItem>
                {siteTypeOptions.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {activeFilters.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() =>
                  setFilters({
                    q: "",
                    status: "All",
                    difficulty: "All",
                    siteType: "All",
                  })
                }
                className="text-muted-foreground"
              >
                <X className="size-3.5 mr-1" /> Clear
              </Button>
            )}
            <Button
              className="ml-auto gradient-primary text-primary-foreground"
              onClick={() => {
                if (!canAct) return deny();
                resetSiteForm();
                setPhotoFile(null);
                setClearPhoto(false);
                setSiteErrors({});
                setEditTarget(null);
                setAddOpen(true);
              }}
            >
              <Plus className="size-4 mr-1.5" /> Add Site
            </Button>
          </div>
          <ActiveFilterBadges
            filters={activeFilters}
            onRemove={handleRemoveFilter}
          />
        </div>

        <div className="text-xs text-muted-foreground">
          {isLive && liveSites.isPending
            ? "Loading dive sites…"
            : `${filtered.length} of ${sites.length} dive site${
                sites.length !== 1 ? "s" : ""
              }`}
        </div>

        <Card className="shadow-elegant overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-secondary/50">
                <TableHead className="w-12"></TableHead>
                <TableHead>Site ID</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Barangay</TableHead>
                <TableHead>Depth</TableHead>
                <TableHead>Difficulty</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Total Dives</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLive && liveSites.isPending ? (
                <TableSkeletonRows rows={6} cols={10} />
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={10}
                    className="text-center py-8 text-muted-foreground"
                  >
                    No dive sites match the current filters.
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((s) => (
                  <TableRow key={s.id} className="hover:bg-primary-soft/40">
                    <TableCell>
                      {s.photo || s.photoPath ? (
                        <SitePhoto
                          photo={s.photo}
                          photoPath={s.photoPath}
                          alt={s.name}
                          className="size-9 rounded-lg object-cover"
                        />
                      ) : (
                        <div className="size-9 rounded-lg bg-gradient-to-br from-primary-soft to-secondary flex items-center justify-center">
                          <MapPin className="size-4 text-primary/50" />
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {s.id}
                    </TableCell>
                    <TableCell className="font-medium">{s.name}</TableCell>
                    <TableCell>{s.barangay}</TableCell>
                    <TableCell className="font-mono text-xs">
                      {s.depth}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={
                          s.difficulty === "Open Water"
                            ? "border-success/30 text-success"
                            : s.difficulty === "Advanced"
                              ? "border-primary/30 text-primary"
                              : s.difficulty === "Rescue"
                                ? "border-warning/30 text-warning-foreground"
                                : "border-destructive/30 text-destructive"
                        }
                      >
                        {s.difficulty}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {s.types.length ? s.types.join(", ") : "—"}
                    </TableCell>
                    <TableCell>{s.dives}</TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={
                          s.status === "Active"
                            ? "bg-success/10 text-success border-success/20"
                            : s.status === "Seasonal"
                              ? "bg-warning/15 text-warning-foreground border-warning/30"
                              : "bg-muted text-muted-foreground border-border"
                        }
                      >
                        {s.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right space-x-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setViewing(s)}
                      >
                        <Eye className="size-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={!!toggling[s.id]}
                        onClick={() => toggleStatus(s.id)}
                        title="Cycle status"
                      >
                        {toggling[s.id] ? (
                          <Loader2 className="size-4 animate-spin" />
                        ) : (
                          <RotateCcw className="size-4" />
                        )}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </Card>

        <SectionCard title="Dive Site Heatmap — Mabini, Batangas">
          <ClientOnlyDiveSiteHeatmap
            sites={filtered}
            onSiteClick={(s) =>
              setViewing(sites.find((f) => f.name === s.name) ?? s)
            }
          />
        </SectionCard>

        {/* Detail Dialog */}
        <Dialog open={!!viewing} onOpenChange={(o) => !o && setViewing(null)}>
          <DialogContent className="w-[min(94vw,40rem)] max-w-none max-h-[92dvh] overflow-y-auto overflow-x-hidden p-0 gap-0 rounded-2xl border bg-card text-card-foreground shadow-2xl">
            {viewing && (
              <div className="flex flex-col">
                {/* Hero Header with Media & Overlaid Badges */}
                <div className="relative w-full h-52 sm:h-60 bg-muted overflow-hidden select-none">
                  {viewing.photo || viewing.photoPath ? (
                    <SitePhoto
                      photo={viewing.photo}
                      photoPath={viewing.photoPath}
                      alt={viewing.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-sky-600/30 via-primary/30 to-indigo-700/30 flex items-center justify-center relative">
                      <div
                        className="absolute inset-0 opacity-20"
                        style={{
                          backgroundImage:
                            "radial-gradient(circle at 30% 30%, oklch(1 0 0 / 0.6), transparent 60%)",
                        }}
                      />
                      <Waves className="size-20 text-primary/30" />
                    </div>
                  )}

                  {/* Gradient Scrim for Text Readability */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/40 to-black/20" />

                  {/* Floating Badges (Top Row) */}
                  <div className="absolute top-3 left-3 right-3 flex items-center justify-between gap-2 z-10">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-mono font-bold bg-black/60 text-white backdrop-blur-md border border-white/20 shadow-sm">
                      <Anchor className="size-3 text-sky-400" />
                      {viewing.id}
                    </span>

                    <span
                      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold backdrop-blur-md border shadow-sm ${
                        viewing.status === "Active"
                          ? "bg-emerald-500/20 text-emerald-300 border-emerald-400/40"
                          : viewing.status === "Seasonal"
                            ? "bg-amber-500/20 text-amber-300 border-amber-400/40"
                            : "bg-rose-500/20 text-rose-300 border-rose-400/40"
                      }`}
                    >
                      <span
                        className={`size-2 rounded-full ${
                          viewing.status === "Active"
                            ? "bg-emerald-400 animate-pulse"
                            : viewing.status === "Seasonal"
                              ? "bg-amber-400"
                              : "bg-rose-400"
                        }`}
                      />
                      {viewing.status}
                    </span>
                  </div>

                  {/* Hero Bottom Info (Title, Location & Difficulty Pill) */}
                  <div className="absolute bottom-3 left-3 right-3 flex flex-wrap items-end justify-between gap-2 z-10">
                    <div>
                      <h3 className="font-display text-xl sm:text-2xl font-bold text-white tracking-tight drop-shadow-md">
                        {viewing.name}
                      </h3>
                      <div className="flex items-center gap-1 text-xs text-white/90 drop-shadow mt-0.5">
                        <MapPin className="size-3.5 text-sky-400 shrink-0" />
                        <span>Brgy. {viewing.barangay}, Mabini, Batangas</span>
                      </div>
                    </div>

                    <div className="shrink-0">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold text-white backdrop-blur-md shadow-sm border border-white/20 ${
                          String(viewing.difficulty).toLowerCase().includes("easy")
                            ? "bg-emerald-600/80"
                            : String(viewing.difficulty).toLowerCase().includes("adv")
                              ? "bg-rose-600/80"
                              : "bg-sky-600/80"
                        }`}
                      >
                        <Gauge className="size-3 text-white/90" />
                        {viewing.difficulty}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Body Content */}
                <div className="p-4 sm:p-5 space-y-4">
                  {/* GPS & Territorial Position Bar */}
                  <div className="flex flex-wrap items-center justify-between gap-2 px-3.5 py-2.5 rounded-xl bg-secondary/50 border border-border/70 text-xs">
                    <div className="flex items-center gap-2 text-foreground font-medium">
                      <Globe className="size-4 text-primary shrink-0" />
                      <span className="font-mono text-[11px] text-muted-foreground">
                        {Number(viewing.lat).toFixed(4)}° N, {Number(viewing.lng).toFixed(4)}° E
                      </span>
                      <span className="text-muted-foreground/60">•</span>
                      <span className="text-[11px] text-sky-600 dark:text-sky-400 font-semibold">
                        Mabini Municipal Waters
                      </span>
                    </div>

                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 text-[11px] gap-1 text-muted-foreground hover:text-foreground"
                      onClick={() => {
                        const coords = `${viewing.lat}, ${viewing.lng}`;
                        navigator.clipboard?.writeText(coords);
                        toast.success("Coordinates copied to clipboard", { description: coords });
                      }}
                    >
                      <Copy className="size-3" />
                      Copy GPS
                    </Button>
                  </div>

                  {/* 4 Stat Highlights Grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                    <div className="p-3 rounded-xl bg-card border border-border/70 shadow-xs space-y-1">
                      <span className="text-[10px] uppercase font-semibold text-muted-foreground tracking-wider flex items-center gap-1">
                        <ArrowDownUp className="size-3 text-sky-500" />
                        Depth Range
                      </span>
                      <div className="text-sm font-bold text-foreground">
                        {viewing.depth}
                      </div>
                    </div>

                    <div className="p-3 rounded-xl bg-card border border-border/70 shadow-xs space-y-1">
                      <span className="text-[10px] uppercase font-semibold text-muted-foreground tracking-wider flex items-center gap-1">
                        <Activity className="size-3 text-emerald-500" />
                        Total Dives
                      </span>
                      <div className="text-sm font-bold text-foreground">
                        {Number(viewing.dives).toLocaleString()} <span className="text-xs font-normal text-muted-foreground">logged</span>
                      </div>
                    </div>

                    <div className="p-3 rounded-xl bg-card border border-border/70 shadow-xs space-y-1">
                      <span className="text-[10px] uppercase font-semibold text-muted-foreground tracking-wider flex items-center gap-1">
                        <Gauge className="size-3 text-indigo-500" />
                        Difficulty
                      </span>
                      <div className="text-sm font-bold text-foreground">
                        {viewing.difficulty}
                      </div>
                    </div>

                    <div className="p-3 rounded-xl bg-card border border-border/70 shadow-xs space-y-1">
                      <span className="text-[10px] uppercase font-semibold text-muted-foreground tracking-wider flex items-center gap-1">
                        <Sparkles className="size-3 text-amber-500" />
                        Activity Trend
                      </span>
                      <div className="text-sm font-bold text-foreground text-emerald-600 dark:text-emerald-400">
                        {siteTrend(viewing.name) ?? "+12%"}
                      </div>
                    </div>
                  </div>

                  {/* Site Environment & Features Tags */}
                  <div className="space-y-1.5">
                    <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                      <Layers className="size-3.5 text-primary" />
                      Diving Environment &amp; Features
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {viewing.types?.length ? (
                        viewing.types.map((t: string) => {
                          const lower = t.toLowerCase();
                          return (
                            <span
                              key={t}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium bg-primary/10 text-primary border border-primary/20 shadow-2xs"
                            >
                              {lower.includes("wall") ? (
                                <Layers className="size-3" />
                              ) : lower.includes("reef") || lower.includes("coral") ? (
                                <Fish className="size-3" />
                              ) : lower.includes("wreck") ? (
                                <Anchor className="size-3" />
                              ) : lower.includes("drift") ? (
                                <Waves className="size-3" />
                              ) : lower.includes("muck") ? (
                                <Search className="size-3" />
                              ) : (
                                <Compass className="size-3" />
                              )}
                              {t}
                            </span>
                          );
                        })
                      ) : (
                        <span className="text-xs text-muted-foreground">Standard Reef Dive</span>
                      )}
                    </div>
                  </div>

                  {/* Description Box */}
                  <div className="rounded-xl border border-border/70 bg-secondary/30 p-3.5 space-y-1.5">
                    <div className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                      <FileText className="size-3.5 text-primary" />
                      Site Description &amp; Topography Highlights
                    </div>
                    {viewing.description ? (
                      <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed break-words">
                        {viewing.description}
                      </p>
                    ) : (
                      <p className="text-xs text-muted-foreground italic">
                        No description provided for this dive site yet. Click &quot;Edit Details&quot; below to add marine life sightings, depth profiles, and mooring details.
                      </p>
                    )}
                  </div>

                  {/* Action Buttons */}
                  <div className="flex items-center justify-between gap-2 pt-2 border-t border-border/60">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setViewing(null)}
                      className="text-xs text-muted-foreground hover:text-foreground"
                    >
                      Close
                    </Button>

                    <div className="flex items-center gap-2">
                      {canAdmin && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="text-xs border-destructive/30 text-destructive hover:bg-destructive/10"
                          onClick={() => {
                            setViewing(null);
                            attemptDelete(viewing);
                          }}
                        >
                          <Trash2 className="size-3.5 mr-1" /> Delete
                        </Button>
                      )}

                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={!!toggling[viewing.id]}
                        onClick={() => {
                          setViewing(null);
                          toggleStatus(viewing.id);
                        }}
                        className="text-xs font-medium"
                      >
                        {toggling[viewing.id] ? (
                          <Loader2 className="size-3.5 mr-1 animate-spin" />
                        ) : null}
                        Toggle Status
                      </Button>

                      <Button
                        type="button"
                        size="sm"
                        className="gradient-primary text-primary-foreground text-xs font-semibold shadow-sm"
                        onClick={() => {
                          setViewing(null);
                          openEdit(viewing);
                        }}
                      >
                        <Edit3 className="size-3.5 mr-1.5" /> Edit Details
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Add / Edit Site Dialog (shared fields, prefilled in edit mode) */}
        <Dialog
          open={addOpen || !!editTarget}
          onOpenChange={(o) => {
            if (!o) closeSiteDialog();
            else setAddOpen(true);
          }}
        >
          <DialogContent className="w-[min(94vw,42rem)] max-w-none max-h-[92dvh] overflow-y-auto overflow-x-hidden rounded-2xl border bg-card text-card-foreground shadow-2xl p-5 sm:p-6 space-y-5">
            <DialogHeader>
              <DialogTitle className="text-xl font-bold">
                {editTarget ? "Edit Dive Site Details" : "Register New Dive Site"}
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-4">
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={onPhotoPick}
              />

              {/* Photo Upload Dropzone Card */}
              <div className="space-y-2">
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <ImageIcon className="size-3.5 text-primary" />
                  Site Photo &amp; Media Banner
                </Label>

                <div
                  className="relative rounded-xl border-2 border-dashed border-border/80 hover:border-primary/60 transition-all cursor-pointer overflow-hidden group bg-secondary/20 hover:bg-secondary/40 max-h-52"
                  onClick={() => fileRef.current?.click()}
                >
                  {newSite.photo ? (
                    <>
                      <img
                        src={newSite.photo}
                        alt="Site photo preview"
                        className="w-full aspect-video max-h-52 object-cover"
                      />
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setNewSite((s) => ({ ...s, photo: "" }));
                          setPhotoFile(null);
                          if (fileRef.current) fileRef.current.value = "";
                        }}
                        className="absolute top-2.5 right-2.5 size-8 rounded-full bg-black/60 hover:bg-black/80 backdrop-blur-md flex items-center justify-center text-white transition-colors shadow-sm"
                        title="Remove photo"
                      >
                        <X className="size-4" />
                      </button>
                      <div className="absolute inset-0 bg-black/40 backdrop-blur-xs opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
                        <span className="text-xs font-semibold text-white bg-black/60 backdrop-blur-md rounded-lg px-3 py-1.5 flex items-center gap-1.5 shadow-sm border border-white/20">
                          <ImagePlus className="size-3.5" /> Change Photo
                        </span>
                      </div>
                    </>
                  ) : (
                    <div className="w-full aspect-video max-h-48 flex flex-col items-center justify-center gap-2 p-6 text-center">
                      <div className="size-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center transition-transform group-hover:scale-105">
                        <ImagePlus className="size-6" />
                      </div>
                      <div className="space-y-0.5">
                        <span className="text-sm font-semibold text-foreground block">
                          Click to upload site photo
                        </span>
                        <span className="text-xs text-muted-foreground block">
                          PNG, JPG, WebP up to 5 MB • Landscape ratio recommended
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                {editTarget &&
                  !newSite.photo &&
                  !clearPhoto &&
                  (editTarget.photo || editTarget.photoPath) && (
                    <div className="flex items-center gap-3 rounded-xl border border-border/70 bg-secondary/40 px-3.5 py-2.5 min-w-0">
                      <SitePhoto
                        photo={editTarget.photo}
                        photoPath={editTarget.photoPath}
                        alt={editTarget.name}
                        className="size-11 rounded-lg object-cover shrink-0 border border-border/50"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-semibold text-foreground truncate">
                          Current Stored Photo
                        </div>
                        <div className="text-[11px] text-muted-foreground truncate">
                          Upload above to replace this image
                        </div>
                      </div>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="text-xs text-destructive hover:bg-destructive/10 shrink-0 h-8"
                        onClick={() => setClearPhoto(true)}
                      >
                        <Trash2 className="size-3.5 mr-1" /> Remove
                      </Button>
                    </div>
                  )}

                {clearPhoto && (
                  <p className="text-xs text-amber-600 dark:text-amber-400 bg-amber-500/10 border border-amber-500/20 px-3 py-1.5 rounded-lg flex items-center gap-1.5">
                    <AlertCircle className="size-3.5 shrink-0" />
                    Current photo will be cleared upon saving.
                  </p>
                )}
              </div>

              {/* Section 1: Site Identity & Location */}
              <div className="rounded-xl border border-border/70 bg-secondary/30 p-3.5 space-y-3">
                <div className="text-xs font-semibold uppercase tracking-wider text-foreground flex items-center gap-1.5 border-b border-border/50 pb-2">
                  <MapPin className="size-3.5 text-primary" />
                  Site Identity &amp; Location
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium">
                      Site Name <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      value={newSite.name}
                      onChange={(e) =>
                        setNewSite({ ...newSite, name: e.target.value })
                      }
                      placeholder="e.g. Cathedral Point"
                      className={`h-9 text-xs ${
                        siteErrors.name
                          ? "border-destructive focus-visible:ring-destructive/30"
                          : ""
                      }`}
                    />
                    {siteErrors.name && (
                      <p className="text-[11px] text-destructive flex items-center gap-1">
                        <AlertCircle className="size-3" />
                        {siteErrors.name}
                      </p>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium">
                      Barangay <span className="text-destructive">*</span>
                    </Label>
                    <Select
                      value={newSite.barangay}
                      onValueChange={(v) =>
                        setNewSite({ ...newSite, barangay: v })
                      }
                    >
                      <SelectTrigger
                        className={`h-9 text-xs ${
                          siteErrors.barangay
                            ? "border-destructive focus-visible:ring-destructive/30"
                            : ""
                        }`}
                      >
                        <SelectValue placeholder="Select barangay" />
                      </SelectTrigger>
                      <SelectContent>
                        {SITE_BARANGAYS.map((b) => (
                          <SelectItem key={b} value={b} className="text-xs">
                            {b}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {siteErrors.barangay && (
                      <p className="text-[11px] text-destructive flex items-center gap-1">
                        <AlertCircle className="size-3" />
                        {siteErrors.barangay}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Section 2: Dive Profile & Specifications */}
              <div className="rounded-xl border border-border/70 bg-secondary/30 p-3.5 space-y-3">
                <div className="text-xs font-semibold uppercase tracking-wider text-foreground flex items-center gap-1.5 border-b border-border/50 pb-2">
                  <Compass className="size-3.5 text-primary" />
                  Diving Profile &amp; Specifications
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium">
                      Depth Range <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      value={newSite.depth}
                      onChange={(e) =>
                        setNewSite({ ...newSite, depth: e.target.value })
                      }
                      placeholder="e.g. 10–30 m"
                      className={`h-9 text-xs ${
                        siteErrors.depth
                          ? "border-destructive focus-visible:ring-destructive/30"
                          : ""
                      }`}
                    />
                    {siteErrors.depth && (
                      <p className="text-[11px] text-destructive flex items-center gap-1">
                        <AlertCircle className="size-3" />
                        {siteErrors.depth}
                      </p>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium">
                      Difficulty Level <span className="text-destructive">*</span>
                    </Label>
                    <Select
                      value={newSite.difficulty}
                      onValueChange={(v) =>
                        setNewSite({ ...newSite, difficulty: v })
                      }
                    >
                      <SelectTrigger
                        className={`h-9 text-xs ${
                          siteErrors.difficulty
                            ? "border-destructive focus-visible:ring-destructive/30"
                            : ""
                        }`}
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {ALL_DIFFICULTIES.map((d) => (
                          <SelectItem key={d} value={d} className="text-xs">
                            {d}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {siteErrors.difficulty && (
                      <p className="text-[11px] text-destructive flex items-center gap-1">
                        <AlertCircle className="size-3" />
                        {siteErrors.difficulty}
                      </p>
                    )}
                  </div>

                  <div className="space-y-1.5 sm:col-span-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs font-medium">
                        Site Environment Types <span className="text-destructive">*</span>
                      </Label>
                      <span className="text-[11px] text-muted-foreground">Select one or more</span>
                    </div>

                    <ToggleGroup
                      type="multiple"
                      variant="outline"
                      value={newSite.types}
                      onValueChange={(v) => setNewSite({ ...newSite, types: v })}
                      className={`flex flex-wrap justify-start gap-1.5 ${
                        siteErrors.type
                          ? "rounded-lg ring-1 ring-destructive/40 p-1"
                          : ""
                      }`}
                    >
                      {ALL_SITE_TYPES.map((t) => (
                        <ToggleGroupItem
                          key={t}
                          value={t}
                          className="h-8 rounded-lg px-2.5 text-xs data-[state=on]:bg-primary/10 data-[state=on]:text-primary data-[state=on]:border-primary/40 font-medium"
                        >
                          {t}
                        </ToggleGroupItem>
                      ))}
                    </ToggleGroup>
                    {siteErrors.type && (
                      <p className="text-[11px] text-destructive flex items-center gap-1">
                        <AlertCircle className="size-3" />
                        {siteErrors.type}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Section 3: Geographic Coordinates */}
              <div className="rounded-xl border border-border/70 bg-secondary/30 p-3.5 space-y-2.5">
                <div className="flex items-center justify-between border-b border-border/50 pb-2">
                  <div className="text-xs font-semibold uppercase tracking-wider text-foreground flex items-center gap-1.5">
                    <Globe className="size-3.5 text-primary" />
                    Geographic Position (GPS)
                  </div>
                  <span className="text-[10px] text-muted-foreground font-mono">WGS84 Format</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium">
                      Latitude (°N) <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      value={newSite.lat}
                      onChange={(e) =>
                        setNewSite({ ...newSite, lat: e.target.value })
                      }
                      placeholder="e.g. 13.7620"
                      inputMode="decimal"
                      className={`h-9 text-xs font-mono ${
                        siteErrors.lat
                          ? "border-destructive focus-visible:ring-destructive/30"
                          : ""
                      }`}
                    />
                    {siteErrors.lat && (
                      <p className="text-[11px] text-destructive flex items-center gap-1">
                        <AlertCircle className="size-3" />
                        {siteErrors.lat}
                      </p>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium">
                      Longitude (°E) <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      value={newSite.lng}
                      onChange={(e) =>
                        setNewSite({ ...newSite, lng: e.target.value })
                      }
                      placeholder="e.g. 120.9210"
                      inputMode="decimal"
                      className={`h-9 text-xs font-mono ${
                        siteErrors.lng
                          ? "border-destructive focus-visible:ring-destructive/30"
                          : ""
                      }`}
                    />
                    {siteErrors.lng && (
                      <p className="text-[11px] text-destructive flex items-center gap-1">
                        <AlertCircle className="size-3" />
                        {siteErrors.lng}
                      </p>
                    )}
                  </div>
                </div>

                <div className="text-[11px] text-muted-foreground flex items-center gap-1.5 bg-background/50 px-2.5 py-1.5 rounded-lg border border-border/40">
                  <Info className="size-3.5 text-sky-500 shrink-0" />
                  Coordinates should be located within Mabini ocean territory (Lat: 13.67°–13.77° N, Lng: 120.82°–120.98° E).
                </div>
              </div>

              {/* Section 4: Highlights & Marine Profile Description */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <FileText className="size-3.5 text-primary" />
                  Site Description &amp; Marine Highlights
                </Label>
                <Textarea
                  value={newSite.description}
                  onChange={(e) =>
                    setNewSite({ ...newSite, description: e.target.value })
                  }
                  placeholder="Describe the site's underwater topography, marine biodiversity (nudibranchs, turtles, schools of fish), depth contours, and current conditions..."
                  rows={3}
                  className="resize-y min-h-[5rem] max-h-40 text-xs leading-relaxed"
                />
              </div>

              {/* Footer Buttons */}
              <DialogFooter className="pt-2 sm:pt-3 border-t border-border/60 flex items-center justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={closeSiteDialog}
                  className="text-xs h-9"
                >
                  Cancel
                </Button>
                <Button
                  className="gradient-primary text-primary-foreground text-xs font-semibold h-9 shadow-sm"
                  disabled={adding}
                  onClick={editTarget ? saveEdit : addSite}
                >
                  {adding ? (
                    <Loader2 className="size-3.5 mr-1.5 animate-spin" />
                  ) : editTarget ? (
                    <Check className="size-3.5 mr-1.5" />
                  ) : (
                    <Plus className="size-3.5 mr-1.5" />
                  )}
                  {adding
                    ? editTarget
                      ? "Saving Changes…"
                      : "Adding Site…"
                    : editTarget
                      ? "Save Changes"
                      : "Add Dive Site"}
                </Button>
              </DialogFooter>
            </div>
          </DialogContent>
        </Dialog>

        {/* Delete confirm (superadmin only; only reachable for sites with
              zero referencing manifestos — see attemptDelete) */}
        <Dialog
          open={!!deleteTarget}
          onOpenChange={(o) => {
            if (!o && !deleting) setDeleteTarget(null);
          }}
        >
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Trash2 className="size-5 text-destructive" /> Delete dive site
              </DialogTitle>
              <p className="text-sm text-muted-foreground pt-1">
                Permanently delete{" "}
                <span className="font-medium text-foreground">
                  {deleteTarget?.name}
                </span>
                {deleteTarget?.id && deleteTarget.id !== "—"
                  ? ` (${deleteTarget.id})`
                  : ""}
                ? No manifestos reference it. This cannot be undone.
              </p>
            </DialogHeader>
            <DialogFooter>
              <Button
                variant="outline"
                disabled={deleting}
                onClick={() => setDeleteTarget(null)}
              >
                Cancel
              </Button>
              <Button
                className="bg-destructive text-destructive-foreground hover:opacity-90"
                disabled={deleting}
                onClick={doDelete}
              >
                {deleting ? (
                  <Loader2 className="size-4 mr-1.5 animate-spin" />
                ) : (
                  <Trash2 className="size-4 mr-1.5" />
                )}
                {deleting ? "Deleting…" : "Delete Permanently"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </>
  );
}


