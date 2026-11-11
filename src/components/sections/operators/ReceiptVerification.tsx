import { useState, useEffect, useMemo, useRef } from "react";
import {
  Receipt,
  Check,
  RotateCcw,
  Download,
  Search,
  Clock,
  Sparkles,
  SlidersHorizontal,
  Eye,
  EyeOff,
  Send,
  FileDown,
  X,
  ChevronRight,
  ShieldCheck,
  Shield,
  Loader2,
  AlertCircle,
  FileImage,
  ZoomIn,
  CheckCircle2,
  XCircle,
  Image as ImageIcon,
} from "lucide-react";
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
import { ReceiptLightbox } from "@/components/ReceiptLightbox";
import { RejectReasonDialog } from "@/components/RejectReasonDialog";
import { PassPricingEditor } from "@/components/sections/DivePassPage";
import {
  StatCard,
  SectionCard,
  DataSourceBadge,
  useMounted,
  Field,
  ActiveFilterBadges,
  TableSkeletonRows,
  CardGridSkeleton,
  StatusBadge,
} from "@/components/shared";
import { useFilters } from "@/hooks/useFilters";
import { usePermission } from "@/hooks/usePermission";
import { useGlobalDateRange } from "@/hooks/useGlobalDateRange";
import { pushAuditLog } from "@/lib/audit";
import { requireLiveSession } from "@/lib/staff-auth";
import {
  useLiveMode,
  useReceiptsLive,
  useInvalidateLive,
  useLiveList,
  decideReceipt,
  getReceiptUrl,
  formatPeso,
  dbErrorMessage,
  formatPurchasedPassQuantity,
} from "@/lib/queries";
import {
  receipts,
  ALL_OPERATOR_NAMES,
} from "@/lib/mock-data";

export function ReceiptVerification() {
  const { canAct, deny } = usePermission();
  const { search, setFilters, resetFilters } = useFilters();
  const { inRange } = useGlobalDateRange();
  const [viewing, setViewing] = useState<any>(null);
  const [lightbox, setLightbox] = useState<any>(null);
  const [mockItems, setMockItems] = useState(receipts);
  // Live mode (Supabase configured): receipts come from
  // payment_transactions; mocks are the offline fallback.
  const isLive = useLiveMode();
  const liveReceipts = useReceiptsLive();
  const invalidateLiveReceipts = useInvalidateLive();
  const receiptsSource = useLiveList(isLive, liveReceipts, mockItems);
  const items = receiptsSource.rows;
  useEffect(() => {
    if (liveReceipts.isError) {
      toast.error("Could not load live receipts", {
        description: "Showing demo data. Check the Supabase connection.",
      });
    }
  }, [liveReceipts.isError]);

  const lightboxReqRef = useRef(0);
  const openLightbox = async (r: any) => {
    // Close the details dialog first so only one modal is ever open —
    // otherwise closing the lightbox reveals the details dialog underneath.
    setViewing(null);
    const req = ++lightboxReqRef.current;
    if (isLive && r?.receiptPath && !r?.imageUrl) {
      try {
        const url = await getReceiptUrl(r.receiptPath);
        if (req !== lightboxReqRef.current) return;
        if (url) {
          setLightbox({ ...r, imageUrl: url });
        } else {
          setLightbox({ ...r, imageError: true });
          toast.error("Could not load receipt image", {
            description: `Signed URL failed for ${r?.ref ?? r?.id}. Check the operator_uploads bucket policy.`,
          });
        }
      } catch (e) {
        if (req !== lightboxReqRef.current) return;
        setLightbox({ ...r, imageError: true });
        toast.error("Could not load receipt image", {
          description: dbErrorMessage(e),
        });
      }
      return;
    }
    setLightbox(r);
  };
  const [busy, setBusy] = useState<Record<string, "approve" | "reject" | null>>(
    {},
  );
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);
  const [rejectDialog, setRejectDialog] = useState<{
    ids: string[];
    single: string | null;
  } | null>(null);

  const filtered = useMemo(() => {
    return items.filter((r) => {
      if (search.status !== "All" && r.status !== search.status) return false;
      if (search.q) {
        const q = search.q.toLowerCase();
        if (
          !r.operator.toLowerCase().includes(q) &&
          !r.ref.toLowerCase().includes(q) &&
          !r.id.toLowerCase().includes(q)
        )
          return false;
      }
      if (!inRange(r.date)) return false;
      return true;
    });
  }, [
    items,
    search.q,
    search.status,
    inRange,
  ]);

  const {
    page: rPage,
    setPage: rSetPage,
    totalPages: rTotalPages,
    paged: rPaged,
  } = usePagination(filtered, 12);

  // Preload real signed-URL thumbnails for visible receipts (live mode only).
  // Mock rows carry no receiptPath and keep the stylized placeholder.
  const [thumbUrls, setThumbUrls] = useState<Record<string, string>>({});
  useEffect(() => {
    if (!isLive) return;
    const missing = rPaged.filter(
      (r: any) => r?.receiptPath && !thumbUrls[r.id],
    ) as any[];
    if (missing.length === 0) return;
    let cancelled = false;
    (async () => {
      const entries = await Promise.all(
        missing.map(async (r: any) => {
          try {
            const url = await getReceiptUrl(r.receiptPath);
            return [r.id, url] as const;
          } catch {
            return [r.id, null] as const;
          }
        }),
      );
      if (cancelled) return;
      const next: Record<string, string> = {};
      for (const [id, url] of entries) {
        if (url) next[id] = url;
      }
      if (Object.keys(next).length > 0) {
        setThumbUrls((prev) => ({ ...prev, ...next }));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isLive, rPaged, thumbUrls]);

  const activeFilters: { key: string; label: string }[] = [];
  if (search.status !== "All")
    activeFilters.push({ key: "status", label: `Status: ${search.status}` });
  if (search.q)
    activeFilters.push({ key: "q", label: `Search: "${search.q}"` });

  const handleRemoveFilter = (key: string) => {
    if (key === "q") setFilters({ q: "" });
    else if (key === "status") setFilters({ status: "All" });
  };

  const decide = async (
    id: string,
    decision: "Verified" | "Rejected",
    reason?: string,
  ) => {
    if (!canAct) return deny();
    if (isLive && !(await requireLiveSession())) return;
    const key = decision === "Verified" ? "approve" : "reject";
    setBusy((b) => ({ ...b, [id]: key }));
    const target = items.find((r) => r.id === id);
    // Live mode: persist to payment_transactions (030 staff policies).
    // The operator's ledger updates once status becomes verified.
    const liveRow = liveReceipts.data?.find((r) => r.id === id);
    if (isLive && liveRow) {
      try {
        await decideReceipt(
          liveRow._dbId,
          decision === "Verified" ? "verified" : "rejected",
          reason,
        );
        invalidateLiveReceipts();
        const t = decision === "Verified" ? toast.success : toast.error;
        t(decision === "Verified" ? "Receipt verified" : "Receipt rejected", {
          description: `${target?.operator} · Ref ${target?.ref} · ${target?.amount}`,
          icon:
            decision === "Verified" ? (
              <CheckCircle2 className="size-4" />
            ) : (
              <XCircle className="size-4" />
            ),
        });
        pushAuditLog(
          decision === "Verified"
            ? `Verified receipt ${id}`
            : `Rejected receipt ${id} — ${reason}`,
        );
      } catch (e) {
        toast.error("Could not save decision", {
          description: dbErrorMessage(e),
        });
      }
      setBusy((b) => ({ ...b, [id]: null }));
      setViewing((v: any) => (v && v.id === id ? null : v));
      return;
    }
    await new Promise((r) => setTimeout(r, 600));
    setMockItems((prev) =>
      prev.map((r) =>
        r.id === id
          ? {
              ...r,
              status: decision === "Verified" ? "Approved" : "Rejected",
              ...(decision === "Rejected" ? { rejectReason: reason } : {}),
            }
          : r,
      ),
    );
    setBusy((b) => ({ ...b, [id]: null }));
    setViewing((v: any) => (v && v.id === id ? null : v));
    const t = decision === "Verified" ? toast.success : toast.error;
    t(decision === "Verified" ? "Receipt verified" : "Receipt rejected", {
      description: `${target?.operator} · Ref ${target?.ref} · ${target?.amount}`,
      icon:
        decision === "Verified" ? (
          <CheckCircle2 className="size-4" />
        ) : (
          <XCircle className="size-4" />
        ),
    });
    pushAuditLog(
      decision === "Verified"
        ? `Verified receipt ${id}`
        : `Rejected receipt ${id} — ${reason}`,
    );
  };

  const selectablePending = filtered.filter((r) => r.status === "Pending");
  const allSelected =
    selectablePending.length > 0 &&
    selectablePending.every((r) => selected.has(r.id));

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
      setSelected(new Set(selectablePending.map((r) => r.id)));
    }
  };

  const bulkDecide = async (
    decision: "Approved" | "Rejected",
    reason?: string,
  ) => {
    const ids = [...selected];
    if (ids.length === 0) return;
    if (!canAct) return deny();
    setBulkBusy(true);
    const key = decision === "Approved" ? "approve" : "reject";
    setBusy((b) => {
      const n = { ...b };
      ids.forEach((id) => {
        n[id] = key as any;
      });
      return n;
    });
    await new Promise((r) => setTimeout(r, 800));
    // Live mode: persist each decision, then refetch once. Per-row results
    // via allSettled — a single row failure must not report the batch as fully saved.
    let succeeded: string[] = [];
    const failed: { id: string; message: string }[] = [];
    if (isLive && liveReceipts.data) {
      if (!(await requireLiveSession())) {
        setBusy((b) => {
          const n = { ...b };
          ids.forEach((id) => {
            n[id] = null;
          });
          return n;
        });
        setBulkBusy(false);
        return;
      }
      const byId = new Map(liveReceipts.data.map((r) => [r.id, r._dbId]));
      const results = await Promise.allSettled(
        ids.map((id) => {
          const dbId = byId.get(id);
          if (!dbId)
            return Promise.reject(new Error(`No live record for ${id}`));
          return decideReceipt(
            dbId,
            decision === "Approved" ? "verified" : "rejected",
            reason,
          );
        }),
      );
      results.forEach((res, i) => {
        if (res.status === "fulfilled") succeeded.push(ids[i]);
        else
          failed.push({
            id: ids[i],
            message: dbErrorMessage(res.reason),
          });
      });
      invalidateLiveReceipts();
    } else {
      setMockItems((prev) =>
        prev.map((r) =>
          ids.includes(r.id)
            ? {
                ...r,
                status: decision,
                ...(decision === "Rejected" ? { rejectReason: reason } : {}),
              }
            : r,
        ),
      );
      succeeded = ids;
    }
    setBusy((b) => {
      const n = { ...b };
      ids.forEach((id) => {
        n[id] = null;
      });
      return n;
    });
    setBulkBusy(false);
    const label = decision === "Approved" ? "Verified" : "Rejected";
    if (failed.length === 0) {
      setSelected(new Set());
      toast.success(
        `${succeeded.length} receipt${succeeded.length !== 1 ? "s" : ""} ${label.toLowerCase()}`,
        {
          description: `Bulk action completed.`,
          icon:
            decision === "Approved" ? (
              <CheckCircle2 className="size-4" />
            ) : (
              <XCircle className="size-4" />
            ),
        },
      );
    } else if (succeeded.length === 0) {
      // Keep the selection so the batch can be retried.
      toast.error("Could not save bulk decision", {
        description: `${failed.length} of ${ids.length} failed. First error: ${failed[0].message}`,
      });
      return;
    } else {
      setSelected(new Set(failed.map((f) => f.id)));
      toast.error(
        `${succeeded.length} of ${ids.length} receipts ${label.toLowerCase()}`,
        {
          description: `Failed: ${failed.map((f) => f.id).join(", ")}. First error: ${failed[0].message}`,
        },
      );
    }
    if (decision === "Rejected") {
      succeeded.forEach((id) =>
        pushAuditLog(`Rejected receipt ${id} — ${reason}`),
      );
    } else {
      succeeded.forEach((id) => pushAuditLog(`Verified receipt ${id}`));
    }
  };

  return (
    <div className="space-y-4">
      {/* Search & Filters */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <DataSourceBadge
            live={isLive}
            isError={liveReceipts.isError}
            isLoading={receiptsSource.isLoading}
          />
        </div>
        <div className="flex flex-col md:flex-row gap-3 md:items-center">
          <div className="relative flex-1 max-w-md">
            <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search by operator, ref #, or receipt ID…"
              value={search.q}
              onChange={(e) => setFilters({ q: e.target.value })}
              className="pl-9"
            />
          </div>
          <Select
            value={search.status}
            onValueChange={(v) => setFilters({ status: v })}
          >
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              {["All", "Pending", "Approved", "Rejected"].map((s) => (
                <SelectItem key={s} value={s}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <PassPricingEditor />
          {activeFilters.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={resetFilters}
              className="text-muted-foreground"
            >
              <X className="size-3.5 mr-1" /> Clear all
            </Button>
          )}
        </div>
        <ActiveFilterBadges
          filters={activeFilters}
          onRemove={handleRemoveFilter}
        />
      </div>

      <div className="text-xs text-muted-foreground">
        {receiptsSource.isLoading
          ? "Loading receipts…"
          : `${filtered.length} of ${items.length} receipt${
              items.length !== 1 ? "s" : ""
            }`}
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
              variant="ghost"
              className="h-7 px-2.5 text-success hover:bg-success/10"
              disabled={bulkBusy}
              onClick={() => bulkDecide("Approved")}
            >
              {bulkBusy ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Check className="size-3.5" />
              )}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 px-2.5 text-destructive hover:bg-destructive/10"
              disabled={bulkBusy}
              onClick={() =>
                setRejectDialog({ ids: [...selected], single: null })
              }
            >
              {bulkBusy ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <X className="size-3.5" />
              )}
            </Button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {receiptsSource.isLoading ? (
          <CardGridSkeleton count={6} />
        ) : filtered.length === 0 ? (
          <div className="col-span-full text-center py-12 text-muted-foreground">
            No receipts match the current filters.
          </div>
        ) : (
          rPaged.map((r) => {
            const settled = r.status !== "Pending";
            const b = busy[r.id];
            const approved = r.status === "Approved";
            return (
              <Card
                key={r.id}
                className={`p-0 overflow-hidden shadow-elegant border-border/60 transition-all ${
                  approved
                    ? "border-success/40"
                    : r.status === "Rejected"
                      ? "border-destructive/40 opacity-80"
                      : selected.has(r.id)
                        ? "ring-2 ring-primary/40"
                        : "hover:shadow-glow"
                }`}
              >
                <div className="relative">
                  <button
                    onClick={() => openLightbox(r)}
                    aria-label={`Open receipt ${r.id} image`}
                    className="block w-full aspect-[4/3] bg-gradient-to-br from-primary-soft to-secondary relative cursor-zoom-in"
                  >
                    {thumbUrls[r.id] ? (
                      <img
                        src={thumbUrls[r.id]}
                        alt={`Receipt ${r.ref}`}
                        className="absolute inset-0 h-full w-full object-cover"
                      />
                    ) : (
                      <span className="absolute inset-0 flex items-center justify-center text-primary/40">
                        <ImageIcon className="size-16" />
                      </span>
                    )}
                    <span
                      aria-hidden
                      className="absolute bottom-3 right-3 z-10 rounded-full bg-background/90 backdrop-blur border border-border/60 p-2 text-muted-foreground shadow-sm"
                    >
                      <ZoomIn className="size-4" />
                    </span>
                    {r.rejectReason && (
                      <div className="absolute bottom-14 left-3 right-3 z-10 rounded-lg bg-destructive/90 backdrop-blur text-destructive-foreground text-[11px] px-3 py-1.5 shadow-glow">
                        Rejected: {r.rejectReason}
                      </div>
                    )}
                    {settled && (
                      <div className="absolute inset-0 flex items-center justify-center backdrop-blur-[2px] bg-background/40 pointer-events-none">
                        <div
                          className={`flex items-center gap-2 px-4 py-2 rounded-full font-semibold text-sm shadow-glow ${
                            approved
                              ? "bg-success text-success-foreground"
                              : "bg-destructive text-destructive-foreground"
                          }`}
                        >
                          {approved ? (
                            <CheckCircle2 className="size-4" />
                          ) : (
                            <XCircle className="size-4" />
                          )}
                          {approved ? "Verified" : "Rejected"}
                        </div>
                      </div>
                    )}
                    <div className="absolute top-3 right-3 pointer-events-none">
                      <StatusBadge status={r.status} />
                    </div>
                  </button>
                </div>
                <div className="p-4 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-2 min-w-0">
                      <Checkbox
                        checked={selected.has(r.id)}
                        onCheckedChange={() => toggleSelect(r.id)}
                        disabled={r.status !== "Pending"}
                        aria-label={`Select receipt ${r.id}`}
                        className="mt-0.5"
                      />
                      <div className="min-w-0">
                        <button
                          type="button"
                          onClick={() => setViewing(r)}
                          title="View dive pass & receipt details"
                          className="font-medium truncate text-left block hover:text-primary hover:underline underline-offset-2 transition-colors max-w-[170px] sm:max-w-[210px]"
                        >
                          {r.operator}
                        </button>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="font-display font-bold leading-tight tabular-nums">{r.amount}</div>
                      <div className="text-[11px] font-semibold text-primary">
                        {formatPurchasedPassQuantity(r.passCount, r.passType, r.passLabel)}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-xs text-muted-foreground pt-1">
                    <span className="font-mono truncate">Ref: {r.ref}</span>
                    <span className="shrink-0">{r.date}</span>
                  </div>
                  <div className="flex gap-2 pt-2">
                    {settled ? (
                      <div
                        className={`flex-1 inline-flex items-center justify-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium ${
                          approved
                            ? "bg-success/10 text-success"
                            : "bg-destructive/10 text-destructive"
                        }`}
                      >
                        {approved ? (
                          <CheckCircle2 className="size-4" />
                        ) : (
                          <XCircle className="size-4" />
                        )}
                        {approved ? "Marked verified" : "Marked rejected"}
                      </div>
                    ) : (
                      <>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={!!b}
                          className="flex-1 border-destructive/30 text-destructive hover:bg-destructive/10"
                          onClick={() =>
                            setRejectDialog({ ids: [r.id], single: r.id })
                          }
                        >
                          {b === "reject" ? (
                            <Loader2 className="size-4 mr-1 animate-spin" />
                          ) : (
                            <X className="size-4 mr-1" />
                          )}
                          Reject
                        </Button>
                        <Button
                          size="sm"
                          disabled={!!b}
                          className="flex-1 bg-success text-success-foreground hover:opacity-90"
                          onClick={() => decide(r.id, "Verified")}
                        >
                          {b === "approve" ? (
                            <Loader2 className="size-4 mr-1 animate-spin" />
                          ) : (
                            <Check className="size-4 mr-1" />
                          )}
                          Verify
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              </Card>
            );
          })
        )}
      </div>

      <Dialog open={!!viewing} onOpenChange={(o) => !o && setViewing(null)}>
        <DialogContent className="w-[min(92vw,24rem)] sm:w-[min(92vw,28rem)] max-w-none max-h-[90dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Payment Details — Receipt {viewing?.id}</DialogTitle>
          </DialogHeader>
          {viewing && (
            <div className="space-y-4">
              <button
                onClick={() => viewing && openLightbox(viewing)}
                aria-label={`Open receipt ${viewing?.id} image`}
                className="aspect-video max-h-[32dvh] w-full rounded-xl bg-gradient-to-br from-primary-soft to-secondary flex items-center justify-center text-primary/40 relative cursor-zoom-in overflow-hidden"
              >
                {thumbUrls[viewing?.id] ? (
                  <img
                    src={thumbUrls[viewing?.id]}
                    alt={`Receipt ${viewing?.ref}`}
                    className="absolute inset-0 h-full w-full object-cover"
                  />
                ) : (
                  <ImageIcon className="size-20" />
                )}
                <div className="absolute bottom-3 right-3 rounded-full bg-background/90 backdrop-blur border border-border/60 p-2 text-muted-foreground shadow-sm">
                  <ZoomIn className="size-4" />
                </div>
              </button>
              {viewing.rejectReason && (
                <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive flex items-start gap-2">
                  <XCircle className="size-4 mt-0.5 shrink-0" />
                  <span>
                    <strong>Rejection note:</strong> {viewing.rejectReason}
                  </span>
                </div>
              )}
              <div className="rounded-lg border border-primary/20 bg-primary-soft/60 p-3 flex items-start gap-2 text-sm">
                <AlertCircle className="size-4 text-primary mt-0.5 shrink-0" />
                <span className="text-primary">
                  Verify the reference number and amount match the bank
                  statement before approving.
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3">
                <Field label="Operator" value={viewing.operator} />
                <Field label="Reference #" value={viewing.ref} />
                <Field
                  label="Purchased Quantity"
                  value={
                    <span className="font-medium text-foreground">
                      Quantity: {formatPurchasedPassQuantity(viewing.passCount, viewing.passType, viewing.passLabel)}
                    </span>
                  }
                />
                <Field
                  label="Total Amount"
                  value={<span className="font-bold text-foreground tabular-nums">{viewing.amount}</span>}
                />
                <Field
                  label="Price Per Pass"
                  value={
                    viewing.amountNum && (viewing.passCount ?? 1) > 1
                      ? `${formatPeso(Math.round(viewing.amountNum / (viewing.passCount || 1)))} / pass`
                      : viewing.amount
                  }
                />
                <Field label="Status" value={<StatusBadge status={viewing.status} />} />
                <Field label="Submitted" value={viewing.date} />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              className="border-destructive/30 text-destructive"
              disabled={!viewing || !!busy[viewing?.id]}
              onClick={() =>
                viewing &&
                setRejectDialog({ ids: [viewing.id], single: viewing.id })
              }
            >
              <X className="size-4 mr-1" />
              Reject
            </Button>
            <Button
              className="bg-success text-success-foreground"
              disabled={!viewing || !!busy[viewing?.id]}
              onClick={() => viewing && decide(viewing.id, "Verified")}
            >
              {viewing && busy[viewing.id] === "approve" ? (
                <Loader2 className="size-4 mr-1 animate-spin" />
              ) : (
                <Check className="size-4 mr-1" />
              )}
              Verify
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <RejectReasonDialog
        open={!!rejectDialog}
        onOpenChange={(o) => !o && setRejectDialog(null)}
        title="Reject receipt"
        itemLabel="receipt"
        count={rejectDialog?.ids.length}
        onConfirm={(reason) => {
          const d = rejectDialog!;
          setRejectDialog(null);
          if (d.single) decide(d.single, "Rejected", reason);
          else bulkDecide("Rejected", reason);
        }}
      />
      <ReceiptLightbox
        open={!!lightbox}
        onOpenChange={(o) => {
          if (!o) {
            // Invalidate any in-flight signed-URL fetch so it can't
            // reopen the modal seconds after close.
            lightboxReqRef.current++;
            setLightbox(null);
          }
        }}
        receipt={lightbox}
      />
    </div>
  );
}


