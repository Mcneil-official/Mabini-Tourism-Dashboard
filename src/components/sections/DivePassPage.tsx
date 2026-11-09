import { useEffect, useState } from "react";
import {
  CreditCard,
  CheckCircle2,
  Clock,
  Pencil,
  Ticket,
  AlertCircle,
} from "lucide-react";
import { ReceiptVerification } from "./operators/ReceiptVerification";
import { usePermission } from "@/hooks/usePermission";
import { pushAuditLog } from "@/lib/audit";
import { Reveal, StatCard } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  useLiveMode,
  useInventoryLive,
  useTouristsLive,
  usePassPricingLive,
  useInvalidateLive,
  updatePassPrice,
  validatePassPrice,
  formatPeso,
  bucketByMonth,
  dbErrorMessage,
  type LivePriceRow,
} from "@/lib/queries";
import { requireLiveSession } from "@/lib/staff-auth";
import { toast } from "sonner";

/**
 * Single dialog editing every pass price at once. A single save button for
 * the whole list keeps the mental model simple ("what does a dive pass cost?")
 * rather than N independent edit flows, and matches the app's centered-dialog
 * pattern for consequential changes.
 *
 * Only rows whose draft actually differs are written, so opening the dialog
 * and saving is a no-op — no spurious audit entries for untouched prices.
 */
function PricingDialog({
  rows,
  open,
  onClose,
  onSaved,
}: {
  rows: LivePriceRow[];
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<Record<string, string | null>>({});
  const [busy, setBusy] = useState(false);

  // Seed from live data each time the dialog opens, so a price changed in
  // another tab between openings never gets clobbered by a stale draft.
  useEffect(() => {
    if (!open) return;
    const seed: Record<string, string> = {};
    for (const r of rows) seed[r._dbId] = String(r.price);
    setDrafts(seed);
    setErrors({});
    setBusy(false);
  }, [open, rows]);

  /** Rows whose draft is valid AND differs from the persisted price. */
  const changed = rows.filter((r) => {
    const draft = (drafts[r._dbId] ?? "").trim();
    if (validatePassPrice(draft)) return false;
    return Number(draft) !== r.price;
  });
  const hasChanges = changed.length > 0;

  const save = async () => {
    // Validate every row up front so nothing is written from a half-valid form.
    const nextErrors: Record<string, string | null> = {};
    for (const r of rows) {
      nextErrors[r._dbId] = validatePassPrice((drafts[r._dbId] ?? "").trim());
    }
    setErrors(nextErrors);
    if (Object.values(nextErrors).some(Boolean)) {
      toast.error("Fix the highlighted prices", {
        description: "Each price must be greater than zero.",
      });
      return;
    }
    if (!hasChanges) return;

    setBusy(true);
    const saved: LivePriceRow[] = [];
    let failure: { label: string; message: string } | null = null;

    try {
      if (!(await requireLiveSession())) return;
      // Sequential in display order keeps failure attribution exact and
      // avoids two writes racing the same audit/refetch window.
      for (const row of changed) {
        const next = Number((drafts[row._dbId] ?? "").trim());
        try {
          await updatePassPrice(row._dbId, next);
          saved.push(row);
        } catch (e) {
          const raw = dbErrorMessage(e);
          // A row-security rejection applies to every row, so stop rather
          // than hammering the endpoint once per pass type.
          if (
            /row-level security|permission denied|not authorized/i.test(raw)
          ) {
            failure = {
              label: row.label,
              message: "Only Super Admin can change pass prices.",
            };
            break;
          }
          failure = { label: row.label, message: raw };
        }
      }

      // Always refresh: even a partial save changed real data. This is also
      // the refresh that shows the admin the true resulting state.
      onSaved();

      if (failure) {
        toast.error(
          saved.length > 0
            ? "Some prices were not saved"
            : "Could not update pricing",
          {
            description:
              saved.length > 0
                ? `Saved ${saved.map((s) => s.label).join(", ")}. ${failure.label} failed: ${failure.message}`
                : failure.message,
          },
        );
        if (!saved.length) return;
      } else {
        toast.success("Pricing updated", {
          description: saved
            .map(
              (s) =>
                `${s.label} — ${formatPeso(Number((drafts[s._dbId] ?? "").trim()))}`,
            )
            .join(" · "),
        });
      }

      for (const row of saved) {
        const next = Number((drafts[row._dbId] ?? "").trim());
        pushAuditLog(`Updated ${row.label} price to ${formatPeso(next)}`);
      }
      if (!failure) onClose();
    } catch (e) {
      toast.error("Could not update pricing", {
        description: dbErrorMessage(e),
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o && !busy) onClose();
      }}
    >
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-xl bg-primary-soft text-primary">
              <Ticket className="size-5" />
            </div>
            <DialogTitle className="font-display">
              Edit pass pricing
            </DialogTitle>
          </div>
          <DialogDescription className="pt-3">
            These are the prices shown to tourists in the booking app. Saving
            takes effect for every new purchase immediately — passes already
            sold keep the price they were bought at.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {rows.map((row) => {
            const draft = drafts[row._dbId] ?? "";
            const err = errors[row._dbId] ?? null;
            const parsed = validatePassPrice(draft.trim())
              ? null
              : Number(draft.trim());
            const isChanged = parsed !== null && parsed !== row.price;
            return (
              <div key={row._dbId} className="space-y-1.5">
                <div className="flex items-baseline justify-between gap-2">
                  <label
                    htmlFor={`price-${row._dbId}`}
                    className="text-sm font-medium leading-none"
                  >
                    {row.label}
                  </label>
                  <span className="text-xs tabular-nums text-muted-foreground">
                    {isChanged ? (
                      <>
                        <span className="line-through">
                          {formatPeso(row.price)}
                        </span>{" "}
                        → {formatPeso(parsed)}
                      </>
                    ) : (
                      formatPeso(row.price)
                    )}
                  </span>
                </div>
                <div className="relative">
                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                    ₱
                  </span>
                  <Input
                    id={`price-${row._dbId}`}
                    value={draft}
                    onChange={(e) => {
                      const v = e.target.value;
                      setDrafts((d) => ({ ...d, [row._dbId]: v }));
                      setErrors((er) => ({ ...er, [row._dbId]: null }));
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        void save();
                      }
                    }}
                    inputMode="decimal"
                    autoComplete="off"
                    disabled={busy}
                    aria-invalid={!!err}
                    className="h-11 pl-7 font-display text-lg tabular-nums"
                  />
                </div>
                {err && (
                  <p className="flex items-center gap-1.5 text-xs text-destructive">
                    <AlertCircle className="size-3.5 shrink-0" />
                    {err}
                  </p>
                )}
              </div>
            );
          })}
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            className="h-11"
            disabled={busy}
            onClick={onClose}
          >
            Cancel
          </Button>
          <Button
            type="button"
            className="h-11 gradient-primary text-primary-foreground"
            disabled={busy || !hasChanges}
            onClick={save}
          >
            {busy ? "Saving…" : "Save changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function DivePassPage() {
  const isLive = useLiveMode();
  const liveInventory = useInventoryLive();
  const liveTourists = useTouristsLive();

  const inv = liveInventory.data;
  const tourists = liveTourists.data;
  const isPending = isLive && (liveInventory.isPending || liveTourists.isPending);
  const isLiveData = isLive && (!!inv || !!tourists);

  // Total passes: prioritize allocated inventory packages, fallback to tourist dive passes
  const invTotal = inv ? inv.reduce((a, r) => a + r.totalPasses, 0) : 0;
  const touristPassesTotal = tourists
    ? tourists.filter((t) => t.dive_pass_type || t.status === "Active").length
    : 0;
  const totalPasses = invTotal > 0 ? invTotal : touristPassesTotal;

  // Active passes: consumed inventory, or active diver passes in the municipality
  const inUse = inv
    ? inv.reduce((a, r) => a + (r.totalPasses - r.remainingPasses), 0)
    : 0;
  const activeTourists = tourists
    ? tourists.filter((t) => t.status === "Active").length
    : 0;
  const activePasses = inUse > 0 ? inUse : activeTourists;

  // Monthly deltas
  const cur = new Date().getMonth();
  const prev = (cur + 11) % 12;

  const invBuckets = inv
    ? bucketByMonth(
        inv,
        (r) => r.createdAt,
        (r) => r.totalPasses,
      )
    : [];
  const touristBuckets = tourists
    ? bucketByMonth(
        tourists,
        (t) => t.dateAccredited || t.createdAt,
        () => 1,
      )
    : [];
  const totalDiff = invTotal > 0 && invBuckets.length
    ? invBuckets[cur].total - invBuckets[prev].total
    : touristBuckets.length
      ? touristBuckets[cur].total - touristBuckets[prev].total
      : 0;

  const useBuckets = inv
    ? bucketByMonth(
        inv,
        (r) => r.createdAt,
        (r) => r.totalPasses - r.remainingPasses,
      )
    : [];
  const activeTouristBuckets = tourists
    ? bucketByMonth(
        tourists.filter((t) => t.status === "Active"),
        (t) => t.dateAccredited || t.createdAt,
        () => 1,
      )
    : [];
  const useDiff = inUse > 0 && useBuckets.length
    ? useBuckets[cur].total - useBuckets[prev].total
    : activeTouristBuckets.length
      ? activeTouristBuckets[cur].total - activeTouristBuckets[prev].total
      : 0;

  // Expiring passes (within 30 days)
  const now = new Date();
  const in30d = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  const expiringCount = tourists
    ? tourists.filter((t) => {
        if (t.status !== "Active" || !t.expires || t.expires === "—") return false;
        const exp = new Date(
          t.expires.length <= 10 ? t.expires + "T00:00:00" : t.expires,
        );
        if (Number.isNaN(exp.getTime())) return false;
        return exp > now && exp <= in30d;
      }).length
    : 0;

  return (
    <div className="space-y-4">
      <Reveal>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <StatCard
            icon={CreditCard}
            label="Total Passes"
            value={
              isPending
                ? "—"
                : isLiveData
                  ? String(totalPasses)
                  : "25"
            }
            delta={
              isPending
                ? ""
                : isLiveData
                  ? `${totalDiff >= 0 ? "+" : ""}${totalDiff}`
                  : "+3"
            }
            up={isLiveData ? totalDiff >= 0 : true}
          />
          <StatCard
            icon={CheckCircle2}
            label="Active Passes"
            value={
              isPending
                ? "—"
                : isLiveData
                  ? String(activePasses)
                  : "17"
            }
            delta={
              isPending
                ? ""
                : isLiveData
                  ? `${useDiff >= 0 ? "+" : ""}${useDiff}`
                  : "+1"
            }
            up={isLiveData ? useDiff >= 0 : true}
          />
          <StatCard
            icon={Clock}
            label="Expiring Soon"
            value={
              isPending
                ? "—"
                : isLiveData
                  ? String(expiringCount)
                  : "4"
            }
            delta={
              isPending
                ? ""
                : isLiveData
                  ? expiringCount > 0
                    ? `${expiringCount}`
                    : "0"
                  : "-1"
            }
            deltaLabel={isLiveData ? "within 30 days" : "vs previous period"}
            up={expiringCount === 0}
          />
        </div>
      </Reveal>

      <ReceiptVerification />
    </div>
  );
}

/**
 * Toolbar entry point for pass pricing. Lives in this file so the button, the
 * dialog, and the pass_pricing queries stay co-located, but renders nothing
 * on the page itself — ReceiptVerification places it in its filter row.
 * Renders null for non-superadmins (034 restricts pricing writes).
 */
export function PassPricingEditor() {
  const { canAdmin } = usePermission();
  const pricing = usePassPricingLive();
  const invalidateLive = useInvalidateLive();
  const rows = pricing.data ?? [];
  const [open, setOpen] = useState(false);

  if (!canAdmin) return null;

  return (
    <>
      <Button
        className="gradient-primary text-primary-foreground whitespace-nowrap"
        onClick={() => setOpen(true)}
        disabled={pricing.isLoading}
      >
        <Pencil className="size-4 mr-1.5" /> Edit pricing
      </Button>
      <PricingDialog
        rows={rows}
        open={open}
        onClose={() => setOpen(false)}
        onSaved={invalidateLive}
      />
    </>
  );
}
