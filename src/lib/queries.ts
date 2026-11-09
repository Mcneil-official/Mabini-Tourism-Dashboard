import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase, isSupabaseConfigured } from "./supabase";
import { displayNationality } from "./metrics";

/**
 * Live data layer for the TO dashboard (reads-first scope).
 *
 * The dashboard sits behind the staff login gate, so any active session is
 * a verified superadmin (see staff-auth.ts + migration 030 in the sinsay
 * repo). Live mode is therefore just "client configured" (see `useLiveMode()`)
 * — every hook below stays disabled when Supabase isn't configured, and
 * callers fall back to the built-in mock arrays.
 */

/**
 * @deprecated Import-time snapshot — prefer `useLiveMode()` in components so
 * the data-source check is evaluated at render time, not module load.
 */
export const liveMode = isSupabaseConfigured;

/** Render-time data-source check. Re-evaluated on every render. */
export function useLiveMode(): boolean {
  return isSupabaseConfigured;
}

/** Non-hook equivalent for event handlers / async callbacks. */
export const isLiveMode = (): boolean => isSupabaseConfigured;

type LiveListQuery<T> = {
  data: T[] | undefined;
  isPending: boolean;
  isError: boolean;
};

export function useLiveList<TLive, TDemo>(
  isLive: boolean,
  query: LiveListQuery<TLive>,
  demoRows: TDemo[],
): {
  rows: Array<TLive | TDemo>;
  isLoading: boolean;
  isError: boolean;
  usingDemo: boolean;
} {
  const isLoading = isLive && query.isPending;
  const usingDemo = !isLive || (query.isError && query.data === undefined);
  return {
    rows: usingDemo ? demoRows : (query.data ?? []),
    isLoading,
    isError: query.isError,
    usingDemo,
  };
}

/**
 * Human-readable message for anything a live write can throw: Error
 * instances, Supabase PostgREST/storage error objects ({ message, code,
 * details, hint }), and anything else. A bare `e instanceof Error` check
 * swallows Supabase rejections into a generic fallback — never use that.
 */
export function dbErrorMessage(e: unknown): string {
  const hintFor = (code: string, text: string): string | null => {
    // Actionable next steps per Postgres/PostgREST code — learned from real
    // production drift (missing helpers, grants, columns). The verbatim
    // message always comes first; the hint only orients the fix.
    if (code === "42883" || /function .* does not exist/i.test(text)) {
      return "A database helper is missing — backend migrations may not be fully applied.";
    }
    if (/row-level security|row security|policy/i.test(text)) {
      return "Row-security denial — sign out and back in first; if it persists, an RLS policy or helper is missing.";
    }
    if (code === "42501" || /permission denied/i.test(text)) {
      return "Missing table grant — backend migrations may be incomplete.";
    }
    if (code === "23505" || /duplicate key|already exists/i.test(text)) {
      return "This record already exists.";
    }
    if (
      code === "42703" ||
      code === "PGRST204" ||
      /column .* does not exist|could not find/i.test(text)
    ) {
      return "Table schema mismatch — backend migrations may be behind.";
    }
    if (code === "23514" || /check constraint|violates check/i.test(text)) {
      return "A value breaks a database rule — check the allowed values.";
    }
    return null;
  };
  if (e instanceof Error && e.message) {
    const hint = hintFor((e as any).code ?? "", e.message);
    return hint ? `${e.message} — ${hint}` : e.message;
  }
  if (typeof e === "object" && e !== null) {
    const o = e as Record<string, unknown>;
    const parts = [o.message, o.details, o.hint].filter(
      (p): p is string => typeof p === "string" && p.length > 0
    );
    if (parts.length > 0) {
      const code = typeof o.code === "string" ? o.code : "";
      const base = parts.join(" — ") + (code ? ` (${code})` : "");
      const hint = hintFor(code, parts.join(" "));
      return hint ? `${base} — ${hint}` : base;
    }
    try {
      const json = JSON.stringify(e);
      if (json && json !== "{}") return json;
    } catch {
      /* fall through to generic text */
    }
  }
  if (typeof e === "string" && e) return e;
  return "Please try again.";
}

const shortId = (uuid: string) => uuid.replace(/-/g, "").slice(0, 8).toUpperCase();
const dayOf = (iso: string | null) => (iso ? iso.slice(0, 10) : "—");
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();

export interface LiveAppRow {
  _dbId: string;
  id: string;
  name: string;
  owner: string;
  submitted: string;
  status: "Pending" | "Approved" | "Rejected";
  rejectReason?: string;
  resort_location: string | null;
  role: string | null;
  contact_number: string | null;
  business_permit_url: string | null;
  pcss_url: string | null;
  dot_accreditation_url: string | null;
  website: string | null;
  tourist_id: string;
}

/** Tourist email + name for graduation writes (establishment owner/contact). */
export async function getTouristContact(
  touristId: string
): Promise<{ email: string | null; fullName: string | null }> {
  const { data, error } = await supabase
    .from("tourists")
    .select("email, full_name")
    .eq("id", touristId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return { email: null, fullName: null };
  return { email: data.email ?? null, fullName: data.full_name ?? null };
}

async function fetchOperatorApplications(): Promise<LiveAppRow[]> {
  const { data: apps, error } = await supabase
    .from("operator_applications")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) throw error;
  const ids = [...new Set((apps || []).map((a: any) => a.tourist_id))];
  let names = new Map<string, string>();
  if (ids.length > 0) {
    const { data: tourists, error: tErr } = await supabase
      .from("tourists")
      .select("id, full_name")
      .in("id", ids);
    if (tErr) throw tErr;
    names = new Map((tourists || []).map((t: any) => [t.id, t.full_name]));
  }
  return (apps || []).map((a: any) => ({
    _dbId: a.id,
    id: shortId(a.id),
    name: a.resort_name,
    owner: names.get(a.tourist_id) || "Unknown",
    submitted: dayOf(a.created_at),
    status: cap(a.status) as LiveAppRow["status"],
    rejectReason: a.rejection_reason || undefined,
    resort_location: a.resort_location ?? null,
    role: a.role ?? null,
    contact_number: a.contact_number ?? null,
    business_permit_url: a.business_permit_url ?? null,
    pcss_url: a.pcss_url ?? null,
    dot_accreditation_url: a.dot_accreditation_url ?? a.dot_url ?? null,
    website: a.website_url ?? null,
    tourist_id: a.tourist_id,
  }));
}

export async function decideApplication(
  dbId: string,
  decision: "approved" | "rejected" | "pending",
  reason?: string
): Promise<void> {
  const { error } = await supabase
    .from("operator_applications")
    .update({
      status: decision,
      rejection_reason: decision === "rejected" ? reason || null : null,
    })
    .eq("id", dbId);
  if (error) throw error;
}

export function useOperatorApplicationsLive() {
  return useQuery({
    queryKey: ["live", "operator_applications"],
    queryFn: fetchOperatorApplications,
    enabled: isSupabaseConfigured,
    staleTime: 30_000,
    retry: 1,
  });
}

export interface LiveReceiptRow {
  _dbId: string;
  id: string;
  operator: string;
  ref: string;
  amount: string;
  amountNum: number;
  date: string;
  status: "Pending" | "Approved" | "Rejected";
  rejectReason?: string;
  receiptPath: string | null;
  passLabel: string;
  passCount: number;
  remainingPasses?: number;
  passType?: string;
}

async function fetchReceipts(): Promise<LiveReceiptRow[]> {
  const { data: txs, error } = await supabase
    .from("payment_transactions")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) throw error;
  const invIds = [...new Set((txs || []).map((t: any) => t.dive_pass_inventory_id).filter(Boolean))];
  const opIds = [...new Set((txs || []).map((t: any) => t.operator_id).filter(Boolean))];
  let invById = new Map<string, any>();
  let nameById = new Map<string, string>();
  if (invIds.length > 0) {
    const { data: inv, error: iErr } = await supabase
      .from("dive_pass_inventory")
      .select("id, pass_label, pass_type, total_passes, remaining_passes, amount")
      .in("id", invIds);
    if (iErr) throw iErr;
    invById = new Map((inv || []).map((r: any) => [r.id, r]));
  }
  if (opIds.length > 0) {
    const { data: ops, error: oErr } = await supabase
      .from("tourists")
      .select("id, full_name")
      .in("id", opIds);
    if (oErr) throw oErr;
    nameById = new Map((ops || []).map((t: any) => [t.id, t.full_name]));
  }
  const statusMap: Record<string, LiveReceiptRow["status"]> = {
    pending: "Pending",
    verified: "Approved",
    rejected: "Rejected",
  };
  return (txs || []).map((t: any) => {
    const inv = invById.get(t.dive_pass_inventory_id);
    const passCount = Number(inv?.total_passes ?? t.quantity) || 1;
    const passLabel =
      inv?.pass_label ||
      (passCount > 1 ? `${passCount}-Dive Package` : "Standard Dive Pass");
    return {
      _dbId: t.id,
      id: shortId(t.id),
      operator: nameById.get(t.operator_id) || "Unknown operator",
      ref: t.reference_number || t.ref_number || "—",
      amount: `₱${Number(t.amount).toLocaleString()}`,
      amountNum: Number(t.amount) || 0,
      date: dayOf(t.created_at),
      status: statusMap[t.status] || "Pending",
      rejectReason: t.rejection_reason || undefined,
      receiptPath: t.receipt_url ?? null,
      passLabel,
      passCount,
      remainingPasses: typeof inv?.remaining_passes === "number" ? inv.remaining_passes : undefined,
      passType: inv?.pass_type,
    };
  });
}

export async function decideReceipt(
  dbId: string,
  decision: "verified" | "rejected",
  reason?: string
): Promise<void> {
  const { error } = await supabase
    .from("payment_transactions")
    .update({
      status: decision,
      rejection_reason: decision === "rejected" ? reason || null : null,
    })
    .eq("id", dbId);
  if (error) throw error;
}

export function useReceiptsLive() {
  return useQuery({
    queryKey: ["live", "payment_transactions"],
    queryFn: fetchReceipts,
    enabled: isSupabaseConfigured,
    staleTime: 30_000,
    retry: 1,
  });
}

export interface LiveTouristRow {
  _dbId: string;
  id: string;
  name: string;
  nationality: string | null;
  level: string | null;
  status: "Active" | "Expired" | "Suspended";
  registered: string;
  expires: string;
  createdAt: string;
  agency?: string | null;
  license_number?: string | null;
  credentials_url?: string | null;
  affiliated_operator?: string | null;
  pro_verified?: boolean;
  dateAccredited?: string | null;
  dive_pass_type?: "annual" | "one-day" | string | null;
  // Diver Profile Checklist Fields
  emergency_contact_name?: string | null;
  emergency_contact_phone?: string | null;
  type_of_dive?: string | null;
  diver_type?: string | null;
  pcssd_number?: string | null;
  pcssd_certificate_url?: string | null;
  pcssd_url?: string | null;
  pcssd_accreditation_no?: string | null;
  pto_number?: string | null;
  pto_url?: string | null;
  permit_to_operate_url?: string | null;
  permit_to_operate_no?: string | null;
  emergency_contact_number?: string | null;
  data_privacy_consent?: boolean;
}

async function fetchTourists(): Promise<LiveTouristRow[]> {
  const { data: rows, error } = await supabase
    .from("tourists")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(500);
  if (error) throw error;
  // Status overlay: the stored column carries operator intent
  // (Active/Suspended per 031); expiry is derived — a lapsed renewal_date
  // reads Expired even when the stored value is still Active.
  const today = new Date().toISOString().slice(0, 10);
  return (rows || []).map((t: any) => {
    const stored = String(t.status || "Active").toLowerCase();
    const renewal = dayOf(t.renewal_date ?? null);
    const status: LiveTouristRow["status"] =
      stored === "suspended"
        ? "Suspended"
        : renewal !== "—" && renewal < today
          ? "Expired"
          : "Active";

    const pcssdNum =
      t.pcssd_accreditation_no ??
      t.pcssd_number ??
      t.pcssd_no ??
      null;
    let pcssdUrl =
      t.pcssd_url ??
      t.pcssd_certificate_url ??
      t.pcss_url ??
      null;
    const ptoNum =
      t.permit_to_operate_no ??
      t.pto_number ??
      t.permit_to_operate_number ??
      t.pto_no ??
      t.permit_number ??
      null;
    let ptoUrl =
      t.permit_to_operate_url ??
      t.pto_url ??
      null;

    // Graceful routing for single-upload registrations where credentials_url holds the file:
    if (!pcssdUrl && !ptoUrl && t.credentials_url) {
      if (ptoNum && !pcssdNum) {
        ptoUrl = t.credentials_url;
      } else {
        pcssdUrl = t.credentials_url;
      }
    }
    const diverType = t.certification_level ?? t.diver_type ?? null;
    const typeOfDive = t.type_of_dive ?? t.dive_type ?? null;
    const emName = t.emergency_contact_name ?? t.emergency_name ?? null;
    const emPhone =
      t.emergency_contact_number ??
      t.emergency_contact_phone ??
      t.emergency_phone ??
      null;

    return {
      _dbId: t.id,
      id: shortId(t.id),
      name: t.full_name,
      nationality: displayNationality(t.nationality) || null,
      level: diverType,
      status,
      registered: dayOf(t.date_accredited || t.created_at),
      expires: renewal,
      createdAt: dayOf(t.created_at),
      agency: t.agency ?? null,
      license_number: t.license_number ?? null,
      credentials_url: t.credentials_url ?? null,
      affiliated_operator: t.affiliated_operator ?? null,
      pro_verified: Boolean(t.pro_verified),
      dateAccredited: t.date_accredited ? dayOf(t.date_accredited) : null,
      dive_pass_type: t.dive_pass_type ?? null,
      emergency_contact_name: emName,
      emergency_contact_phone: emPhone,
      type_of_dive: typeOfDive,
      diver_type: diverType,
      pcssd_number: pcssdNum,
      pcssd_certificate_url: pcssdUrl,
      pcssd_url: pcssdUrl,
      pcssd_accreditation_no: pcssdNum,
      pto_number: ptoNum,
      pto_url: ptoUrl,
      permit_to_operate_url: ptoUrl,
      permit_to_operate_no: ptoNum,
      emergency_contact_number: emPhone,
      data_privacy_consent: t.data_privacy_consent ?? true,
    };
  });
}

export function useTouristsLive() {
  return useQuery({
    queryKey: ["live", "tourists"],
    queryFn: fetchTourists,
    enabled: isSupabaseConfigured,
    staleTime: 30_000,
    retry: 1,
  });
}

/** Suspend or reactivate a tourist. Requires 031 (status + staff UPDATE). */
export async function setTouristStatus(
  dbId: string,
  decision: "suspended" | "active"
): Promise<void> {
  const { error } = await supabase
    .from("tourists")
    .update({ status: decision === "suspended" ? "Suspended" : "Active" })
    .eq("id", dbId);
  if (error) throw error;
}

/** Extend a tourist's ID by one year from today. */
export async function renewTourist(dbId: string): Promise<string> {
  const next = new Date();
  next.setFullYear(next.getFullYear() + 1);
  const renewalDate = next.toISOString().slice(0, 10);
  const { error } = await supabase
    .from("tourists")
    .update({ renewal_date: renewalDate })
    .eq("id", dbId);
  if (error) throw error;
  return renewalDate;
}

/** Verify or revoke a dive professional's submitted credentials.
 * Note: Does not set date_accredited. date_accredited is stamped when a dive pass is issued.
 */
export async function verifyTouristProCredentials(
  dbId: string,
  verified: boolean = true
): Promise<void> {
  const { error } = await supabase
    .from("tourists")
    .update({
      pro_verified: verified,
    })
    .eq("id", dbId);
  if (error) throw error;
}

/** Issue an official Municipal Dive Pass (Annual or One-Day) to a diver account.
 * Stamped date_accredited upon pass issuance, sets renewal_date, pass type, and Active status.
 */
export async function issueTouristDivePass(
  dbId: string,
  passType: "annual" | "one-day" = "annual"
): Promise<{ dateAccredited: string; renewalDate: string; passType: string }> {
  const today = new Date().toISOString().slice(0, 10);
  const next = new Date();
  if (passType === "annual") {
    next.setFullYear(next.getFullYear() + 1);
  } else {
    next.setDate(next.getDate() + 1);
  }
  const renewalDate = next.toISOString().slice(0, 10);

  const { error } = await supabase
    .from("tourists")
    .update({
      dive_pass_type: passType,
      renewal_date: renewalDate,
      date_accredited: today,
      status: "Active",
    })
    .eq("id", dbId);
  if (error) throw error;

  return { dateAccredited: today, renewalDate, passType };
}

export interface LiveManifestRow {
  _dbId: string;
  id: string;
  operator: string;
  site: string;
  divers: number;
  date: string;
  verified: boolean;
  diveType: string | null;
  diveMode: string | null;
  difficulty: string | null;
  boatName: string | null;
  maxDivers: number | null;
  captainName?: string | null;
  boatContact?: string | null;
  crewCount?: number | null;
  instructorName?: string | null;
}

export interface LiveDiverRow {
  name: string;
  ecoId: string | null;
  isWalkIn: boolean;
}

async function fetchManifests(): Promise<LiveManifestRow[]> {
  const { data: manifests, error } = await supabase
    .from("dive_manifests")
    .select(
      "id, operator_id, location, created_at, verified, dive_type, dive_mode, difficulty, boat_name, max_divers"
    )
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) throw error;
  const mIds = [...new Set((manifests || []).map((m: any) => m.id))];
  const opIds = [
    ...new Set((manifests || []).map((m: any) => m.operator_id).filter(Boolean)),
  ];
  let diversByManifest = new Map<string, number>();
  let resortByTourist = new Map<string, string>();
  let nameById = new Map<string, string>();
  if (mIds.length > 0) {
    const { data: divers, error: dErr } = await supabase
      .from("manifest_divers")
      .select("manifest_id")
      .in("manifest_id", mIds);
    if (dErr) throw dErr;
    for (const d of divers || []) {
      diversByManifest.set(
        (d as any).manifest_id,
        (diversByManifest.get((d as any).manifest_id) || 0) + 1
      );
    }
  }
  if (opIds.length > 0) {
    const [{ data: apps }, { data: tourists }] = await Promise.all([
      supabase
        .from("operator_applications")
        .select("tourist_id, resort_name, status")
        .in("tourist_id", opIds),
      supabase.from("tourists").select("id, full_name").in("id", opIds),
    ]);
    // Prefer the approved resort name; fall back to any application name.
    for (const a of apps || []) {
      const key = (a as any).tourist_id as string;
      if ((a as any).status === "approved" || !resortByTourist.has(key)) {
        resortByTourist.set(key, (a as any).resort_name);
      }
    }
    nameById = new Map((tourists || []).map((t: any) => [t.id, t.full_name]));
  }
  return (manifests || []).map((m: any) => ({
    _dbId: m.id,
    id: shortId(m.id),
    operator:
      resortByTourist.get(m.operator_id) ||
      nameById.get(m.operator_id) ||
      "Unknown operator",
    site: m.location,
    divers: diversByManifest.get(m.id) || 0,
    date: dayOf(m.created_at),
    verified: m.verified === true,
    diveType: m.dive_type ?? null,
    diveMode: m.dive_mode ?? null,
    difficulty: m.difficulty ?? null,
    boatName: m.boat_name ?? null,
    maxDivers: m.max_divers ?? null,
    captainName: m.captain_name ?? null,
    boatContact: m.boat_contact ?? null,
    crewCount: m.crew_count ?? null,
    instructorName: m.instructor_name ?? null,
  }));
}

export function useManifestsLive() {
  return useQuery({
    queryKey: ["live", "dive_manifests"],
    queryFn: fetchManifests,
    enabled: isSupabaseConfigured,
    staleTime: 30_000,
    retry: 1,
  });
}

/** Staff verify/unverify. Requires 032 (verified + staff UPDATE). */
export async function setManifestVerified(
  dbId: string,
  verified: boolean
): Promise<void> {
  const { error } = await supabase
    .from("dive_manifests")
    .update({
      verified,
      verified_at: verified ? new Date().toISOString() : null,
    })
    .eq("id", dbId);
  if (error) {
    if (error.message?.includes("eco_dive_ids") && error.message?.includes("updated_at")) {
      throw new Error(
        "Database requires migration 050_eco_dive_ids_updated_at.sql in Supabase SQL Editor: 'ALTER TABLE public.eco_dive_ids ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();'"
      );
    }
    throw error;
  }
}

/** Diver roster for one manifest (lightbox detail). */
export async function fetchManifestDivers(
  manifestId: string
): Promise<LiveDiverRow[]> {
  const { data, error } = await supabase
    .from("manifest_divers")
    .select("name, eco_id, is_walk_in")
    .eq("manifest_id", manifestId)
    .order("created_at", { ascending: true })
    .limit(200);
  if (error) throw error;
  return (data || []).map((d: any) => ({
    name: d.name,
    ecoId: d.eco_id ?? null,
    isWalkIn: d.is_walk_in === true,
  }));
}

/** Signed (1h) URL for a private-bucket receipt path. Staff-only via 030. */
export async function getReceiptUrl(path: string): Promise<string | null> {
  const { data, error } = await supabase.storage
    .from("operator_uploads")
    .createSignedUrl(path, 3600);
  if (error || !data?.signedUrl) return null;
  return data.signedUrl;
}

/** Determine if a document URL points to a PDF. */
export function isPdfUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  const clean = url.split("?")[0].toLowerCase();
  return clean.endsWith(".pdf") || url.includes("application/pdf");
}

/**
 * Resolves a storage path or document URL into an authenticated signed URL.
 * Handles:
 * - Data URIs (data:image/...) -> returned directly
 * - Local mock paths (/mock-docs/...) -> returned directly
 * - Supabase storage private URLs (operator_uploads / tourist_uploads) -> signed (1h)
 * - Plain storage paths (permits/..., operator_uploads/...) -> signed (1h)
 * - Fallbacks to public URL or original URL
 */
export async function resolveDocumentUrl(
  rawPathOrUrl: string | null | undefined,
  defaultBucket = "operator_uploads",
): Promise<string | null> {
  if (!rawPathOrUrl) return null;
  const trimmed = rawPathOrUrl.trim();
  if (!trimmed) return null;

  if (trimmed.startsWith("data:") || trimmed.startsWith("blob:")) {
    return trimmed;
  }

  let bucket = defaultBucket;
  let path = trimmed;

  if (path.includes("/storage/v1/object/")) {
    const match = path.match(
      /\/storage\/v1\/object\/(?:public|authenticated|sign)\/([^/]+)\/(.+)$/,
    );
    if (match) {
      bucket = match[1];
      path = decodeURIComponent(match[2].split("?")[0]);
    }
  } else if (path.startsWith("operator_uploads/")) {
    bucket = "operator_uploads";
    path = path.slice("operator_uploads/".length);
  } else if (path.startsWith("tourist_uploads/")) {
    bucket = "tourist_uploads";
    path = path.slice("tourist_uploads/".length);
  }

  // If path is a full external URL (not Supabase storage), return it
  if (path.startsWith("http://") || path.startsWith("https://")) {
    return path;
  }

  // If path is a local route (like /mock-docs/...)
  if (path.startsWith("/")) {
    return path;
  }

  try {
    const { data, error } = await supabase.storage
      .from(bucket)
      .createSignedUrl(path, 3600);
    if (!error && data?.signedUrl) {
      return data.signedUrl;
    }
  } catch (err) {
    console.warn("Could not create signed URL for", trimmed, err);
  }

  try {
    const { data } = supabase.storage.from(bucket).getPublicUrl(path);
    if (data?.publicUrl) return data.publicUrl;
  } catch {}

  return trimmed;
}

export function useInvalidateLive() {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: ["live"] });
  };
}

/* ------------------------------ DIVE PASS INVENTORY ------------------------------ */

export interface LiveInventoryRow {
  _dbId: string;
  operatorId: string;
  operator: string;
  passType: string;
  passLabel: string;
  totalPasses: number;
  remainingPasses: number;
  amount: number;
  createdAt: string;
}

async function fetchInventory(): Promise<LiveInventoryRow[]> {
  const { data: rows, error } = await supabase
    .from("dive_pass_inventory")
    .select(
      "id, operator_id, pass_type, pass_label, total_passes, remaining_passes, amount, created_at"
    )
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) throw error;
  const opIds = [
    ...new Set((rows || []).map((r: any) => r.operator_id).filter(Boolean)),
  ];
  let resortByTourist = new Map<string, string>();
  let nameById = new Map<string, string>();
  if (opIds.length > 0) {
    const [{ data: apps }, { data: tourists }] = await Promise.all([
      supabase
        .from("operator_applications")
        .select("tourist_id, resort_name, status")
        .in("tourist_id", opIds),
      supabase.from("tourists").select("id, full_name").in("id", opIds),
    ]);
    for (const a of apps || []) {
      const key = (a as any).tourist_id as string;
      if ((a as any).status === "approved" || !resortByTourist.has(key)) {
        resortByTourist.set(key, (a as any).resort_name);
      }
    }
    nameById = new Map((tourists || []).map((t: any) => [t.id, t.full_name]));
  }
  return (rows || []).map((r: any) => ({
    _dbId: r.id,
    operatorId: r.operator_id,
    operator:
      resortByTourist.get(r.operator_id) ||
      nameById.get(r.operator_id) ||
      "Unknown operator",
    passType: r.pass_type,
    passLabel: r.pass_label,
    totalPasses: Number(r.total_passes) || 0,
    remainingPasses: Number(r.remaining_passes) || 0,
    amount: Number(r.amount) || 0,
    createdAt: dayOf(r.created_at),
  }));
}

export function useInventoryLive() {
  return useQuery({
    queryKey: ["live", "dive_pass_inventory"],
    queryFn: fetchInventory,
    enabled: isSupabaseConfigured,
    staleTime: 30_000,
    retry: 1,
  });
}

/* ------------------------------ PASS PRICING ------------------------------ */

/**
 * Authoritative price list. This table is the single source of truth for
 * what a dive pass costs: the dashboard writes it from Dive Pass → Pass
 * Pricing, and the tourist-facing app reads the same rows from the same
 * Supabase project, so a committed edit is the whole propagation step —
 * there is no sync job or webhook on either side. Anything already sold
 * (dive_pass_inventory.amount) is left untouched, keeping past revenue
 * figures honest.
 */
export interface LivePriceRow {
  _dbId: string;
  code: string | null;
  label: string;
  passes: number;
  price: number;
  description: string | null;
  sortOrder: number;
}

async function fetchPassPricing(): Promise<LivePriceRow[]> {
  const { data: rows, error } = await supabase
    .from("pass_pricing")
    .select("id, code, label, passes, price, description, sort_order")
    .order("sort_order", { ascending: true })
    .limit(50);
  if (error) throw error;
  return (rows || []).map((p: any) => ({
    _dbId: p.id,
    code: p.code ?? null,
    label: p.label || "Dive Pass",
    passes: Number(p.passes) || 1,
    price: Number(p.price) || 0,
    description: p.description ?? null,
    sortOrder: Number(p.sort_order) || 0,
  }));
}

export function usePassPricingLive() {
  return useQuery({
    queryKey: ["live", "pass_pricing"],
    queryFn: fetchPassPricing,
    enabled: isSupabaseConfigured,
    staleTime: 30_000,
    retry: 1,
  });
}

/** Upper bound for an editable price — generous headroom over today's rates. */
export const MAX_PASS_PRICE = 1_000_000;

/**
 * Client-side validation, applied before any network call so a typo never
 * reaches the database. Returns an error message, or null when acceptable.
 * Prices are pesos with at most two decimal places.
 */
export function validatePassPrice(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return "Enter a price.";
  if (!/^\d*\.?\d{1,2}$/.test(trimmed)) {
    return "Use a number with up to 2 decimal places.";
  }
  const value = Number(trimmed);
  if (!Number.isFinite(value)) return "Enter a valid number.";
  if (value <= 0) return "Price must be greater than zero.";
  if (value > MAX_PASS_PRICE) {
    return `Price must not exceed ₱${MAX_PASS_PRICE.toLocaleString("en-PH")}.`;
  }
  return null;
}

/**
 * Persists a new price for one pass_pricing row. Superadmin-only via 034
 * (RLS rejects anyone else); the caller maps that error to a denial message.
 */
export async function updatePassPrice(
  dbId: string,
  price: number
): Promise<void> {
  const { error } = await supabase
    .from("pass_pricing")
    .update({ price })
    .eq("id", dbId);
  if (error) throw error;
}

/** Peso formatting for display (e.g. ₱1,500 / ₱1,500.50). */
export function formatPeso(value: number): string {
  return `₱${value.toLocaleString("en-PH", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}`;
}

/* ------------------------------ DIVE SITES ------------------------------ */

export interface LiveSiteRow {
  _dbId: string;
  id: string;
  siteCode: string;
  name: string;
  barangay: string;
  depthRange: string;
  difficulty: string;
  siteType: string;
  siteTypes: string[];
  status: "Active" | "Seasonal" | "Restricted";
  description: string | null;
  photoUrl: string | null;
  lat: number;
  lng: number;
  dives: number;
  createdAt: string;
}

async function fetchDiveSites(): Promise<LiveSiteRow[]> {
  const { data: sites, error } = await supabase
    .from("dive_sites")
    .select("*")
    .order("name", { ascending: true })
    .limit(500);
  if (error) throw error;
  // Diver counts roll up from manifests matched by location = site name
  // (the same fuzzy match the drill dialog already uses).
  const names = [...new Set((sites || []).map((s: any) => s.name))];
  let diversBySite = new Map<string, number>();
  if (names.length > 0) {
    const { data: manifests, error: mErr } = await supabase
      .from("dive_manifests")
      .select("id, location")
      .in("location", names);
    if (mErr) throw mErr;
    const mIds = [...new Set((manifests || []).map((m: any) => m.id))];
    const locById = new Map((manifests || []).map((m: any) => [m.id, m.location]));
    if (mIds.length > 0) {
      const { data: divers, error: dErr } = await supabase
        .from("manifest_divers")
        .select("manifest_id")
        .in("manifest_id", mIds);
      if (dErr) throw dErr;
      for (const d of divers || []) {
        const loc = locById.get((d as any).manifest_id);
        if (loc) diversBySite.set(loc, (diversBySite.get(loc) || 0) + 1);
      }
    }
  }
  const capStatus = (s: string): LiveSiteRow["status"] => {
    const v = String(s || "Active").toLowerCase();
    if (v === "restricted") return "Restricted";
    if (v === "seasonal") return "Seasonal";
    return "Active";
  };
  return (sites || []).map((s: any) => ({
    _dbId: s.id,
    id: s.site_code,
    siteCode: s.site_code,
    name: s.name,
    barangay: s.barangay,
    depthRange: s.depth_range,
    difficulty: s.difficulty,
    siteType: s.site_type,
    // Multi-type lives in `site_types` (migration 042); legacy rows and any
    // writer that only set the single column fall back to a one-item array.
    siteTypes: s.site_types ?? (s.site_type ? [s.site_type] : []),
    status: capStatus(s.status),
    description: s.description ?? null,
    photoUrl: s.photo_url ?? null,
    lat: Number(s.lat),
    lng: Number(s.lng),
    dives: diversBySite.get(s.name) || 0,
    createdAt: dayOf(s.created_at),
  }));
}

export function useDiveSitesLive() {
  return useQuery({
    queryKey: ["live", "dive_sites"],
    queryFn: fetchDiveSites,
    enabled: isSupabaseConfigured,
    staleTime: 30_000,
    retry: 1,
  });
}

export interface NewDiveSite {
  siteCode: string;
  name: string;
  barangay: string;
  depthRange: string;
  difficulty: string;
  siteTypes: string[];
  description?: string;
  photoUrl?: string | null;
  lat: number;
  lng: number;
}

/** Insert a site. Requires 033 (staff INSERT grant). */
export async function addDiveSite(site: NewDiveSite): Promise<void> {
  const { error } = await supabase.from("dive_sites").insert({
    site_code: site.siteCode,
    name: site.name,
    barangay: site.barangay,
    depth_range: site.depthRange,
    difficulty: site.difficulty,
    // `site_type` keeps its single-value CHECK, so it mirrors the first type;
    // the full list goes in `site_types` (migration 042).
    site_type: site.siteTypes[0],
    site_types: site.siteTypes,
    description: site.description || null,
    photo_url: site.photoUrl || null,
    lat: site.lat,
    lng: site.lng,
    status: "Active",
  });
  if (error) throw error;
}

/** Cycle site status. Requires 033 (staff UPDATE grant). */
export async function setSiteStatus(
  dbId: string,
  status: "Active" | "Seasonal" | "Restricted"
): Promise<void> {
  const { error } = await supabase
    .from("dive_sites")
    .update({ status })
    .eq("id", dbId);
  if (error) throw error;
}

export interface SiteFieldUpdates {
  name: string;
  barangay: string;
  depthRange: string;
  difficulty: string;
  siteTypes: string[];
  description?: string | null;
  lat: number;
  lng: number;
  photoUrl?: string | null;
}

/** Full field edit. Requires 033 (staff UPDATE grant). */
export async function updateDiveSite(
  dbId: string,
  fields: SiteFieldUpdates
): Promise<void> {
  const { error } = await supabase
    .from("dive_sites")
    .update({
      name: fields.name,
      barangay: fields.barangay,
      depth_range: fields.depthRange,
      difficulty: fields.difficulty,
      // Single-value mirror + full list — see addDiveSite.
      site_type: fields.siteTypes[0],
      site_types: fields.siteTypes,
      description: fields.description || null,
      lat: fields.lat,
      lng: fields.lng,
      photo_url: fields.photoUrl || null,
    })
    .eq("id", dbId);
  if (error) throw error;
}

/**
 * Hard delete. Superadmin-only via the 033 amendment (no staff DELETE path
 * exists by design). Manifests reference sites by free-text location, so
 * nothing cascades — but the UI blocks deleting referenced sites anyway to
 * keep history linked.
 */
export async function deleteDiveSite(dbId: string): Promise<void> {
  const { error } = await supabase.from("dive_sites").delete().eq("id", dbId);
  if (error) throw error;
}

/** How many manifests reference a site location (delete guard). */
export async function countManifestsByLocation(
  location: string
): Promise<number> {
  const { count, error } = await supabase
    .from("dive_manifests")
    .select("id", { count: "exact", head: true })
    .eq("location", location);
  if (error) throw error;
  return count || 0;
}

/** Signed (1h) URL for a site photo. Staff-only via 033. */
export async function getSitePhotoUrl(path: string): Promise<string | null> {
  const { data, error } = await supabase.storage
    .from("dive-site-photos")
    .createSignedUrl(path, 3600);
  if (error || !data?.signedUrl) return null;
  return data.signedUrl;
}

/** Upload a site photo. Staff-only via 033. Returns the storage path. */
export async function uploadSitePhoto(file: File): Promise<string> {
  const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
  const path = `sites/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage
    .from("dive-site-photos")
    .upload(path, file, { contentType: file.type || `image/${ext}` });
  if (error) throw error;
  return path;
}

/* ------------------------------ ESTABLISHMENTS ------------------------------ */

export interface LiveEstablishmentRow {
  _dbId: string;
  id: string;
  name: string;
  owner: string;
  location: string | null;
  barangay: string;
  contactEmail: string | null;
  contactPhone: string | null;
  status: "Active" | "Suspended";
  dateRegistered: string;
  totalManifestos: number;
  creditBalance: number;
  website: string | null;
  facebook: string | null;
  description: string | null;
  imageUrl: string | null;
  createdAt: string;
  business_permit_url?: string | null;
  pcss_url?: string | null;
  dot_accreditation_url?: string | null;
}

function barangayOf(location: string | null): string {
  if (!location) return "—";
  const m = /barangay\s+([^,]+)/i.exec(location);
  return m ? m[1].trim() : "—";
}

async function fetchEstablishments(): Promise<LiveEstablishmentRow[]> {
  const { data: rows, error } = await supabase
    .from("establishments")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) throw error;
  const names = [...new Set((rows || []).map((r: any) => r.name))];
  // Owner: approved application with matching resort_name → tourist name.
  // Name-based match is fragile on renames (same caveat as the manifest
  // operator resolution) — documented, not hidden.
  let ownerByResort = new Map<string, string>();
  // totalManifestos: manifest counts grouped by operator name.
  let manifestsByOperator = new Map<string, number>();
  // creditBalance: in-use pass value grouped by operator name.
  let creditByOperator = new Map<string, number>();
  const [appsRes, manifestsRes, invRes] = await Promise.all([
    names.length > 0
      ? supabase
          .from("operator_applications")
          .select("resort_name, tourist_id, status, business_permit_url, pcss_url, dot_accreditation_url")
          .in("resort_name", names)
      : Promise.resolve({ data: [], error: null }),
    supabase.from("dive_manifests").select("id, operator_id"),
    supabase
      .from("dive_pass_inventory")
      .select("operator_id, total_passes, remaining_passes, amount"),
  ]);
  if (appsRes.error) throw appsRes.error;
  if (manifestsRes.error) throw manifestsRes.error;
  if (invRes.error) throw invRes.error;
  const touristIds = [
    ...new Set(
      ((appsRes.data || []) as any[])
        .map((a) => a.tourist_id)
        .filter(Boolean)
    ),
  ];
  const opIds = [
    ...new Set([
      ...((manifestsRes.data || []) as any[]).map((m) => m.operator_id),
      ...((invRes.data || []) as any[]).map((r) => r.operator_id),
    ]),
  ].filter(Boolean) as string[];
  let nameById = new Map<string, string>();
  const allIds = [...new Set([...touristIds, ...opIds])];
  if (allIds.length > 0) {
    const { data: tourists, error: tErr } = await supabase
      .from("tourists")
      .select("id, full_name")
      .in("id", allIds);
    if (tErr) throw tErr;
    nameById = new Map((tourists || []).map((t: any) => [t.id, t.full_name]));
  }
  const docsByResort = new Map<string, { permit: string | null; pcss: string | null; dot: string | null }>();
  for (const a of (appsRes.data || []) as any[]) {
    if (a.status === "approved" || !ownerByResort.has(a.resort_name)) {
      ownerByResort.set(
        a.resort_name,
        nameById.get(a.tourist_id) || "Unknown owner"
      );
    }
    if (a.resort_name && !docsByResort.has(a.resort_name)) {
      docsByResort.set(a.resort_name, {
        permit: a.business_permit_url || null,
        pcss: a.pcss_url || null,
        dot: a.dot_accreditation_url || a.dot_url || null,
      });
    }
  }
  // Manifest/credit rollups keyed by operator PERSON id can't join to
  // resort names directly — resolve each manifest/inventory row's operator
  // through its approved application instead.
  const resortByTourist = new Map<string, string>();
  if (allIds.length > 0) {
    const { data: allApps, error: aErr } = await supabase
      .from("operator_applications")
      .select("tourist_id, resort_name, status")
      .in("tourist_id", allIds);
    if (aErr) throw aErr;
    for (const a of (allApps || []) as any[]) {
      if (a.status === "approved" || !resortByTourist.has(a.tourist_id)) {
        resortByTourist.set(a.tourist_id, a.resort_name);
      }
    }
  }
  for (const m of (manifestsRes.data || []) as any[]) {
    const resort = resortByTourist.get(m.operator_id);
    if (resort)
      manifestsByOperator.set(resort, (manifestsByOperator.get(resort) || 0) + 1);
  }
  for (const r of (invRes.data || []) as any[]) {
    const resort = resortByTourist.get(r.operator_id);
    if (resort) {
      const used =
        (Number(r.total_passes) || 0) - (Number(r.remaining_passes) || 0);
      const value = used * (Number(r.amount) || 0);
      creditByOperator.set(resort, (creditByOperator.get(resort) || 0) + value);
    }
  }
  return (rows || []).map((e: any) => ({
    _dbId: e.id,
    id: shortId(e.id),
    name: e.name,
    owner: ownerByResort.get(e.name) || "Unknown owner",
    location: e.location ?? null,
    barangay: barangayOf(e.location ?? null),
    contactEmail: e.email ?? null,
    contactPhone: e.phone ?? null,
    // No status column exists: accredited=false reads Suspended (which also
    // hides the row from public reads by design of the RLS policy).
    status: e.accredited === false ? "Suspended" : "Active",
    dateRegistered: dayOf(e.created_at),
    totalManifestos: manifestsByOperator.get(e.name) || 0,
    creditBalance: creditByOperator.get(e.name) || 0,
    website: e.website ?? null,
    facebook: e.facebook ?? null,
    description: e.description ?? null,
    imageUrl: e.image_url ?? null,
    createdAt: dayOf(e.created_at),
    business_permit_url: e.business_permit_url ?? docsByResort.get(e.name)?.permit ?? null,
    pcss_url: e.pcss_url ?? docsByResort.get(e.name)?.pcss ?? null,
    dot_accreditation_url: e.dot_accreditation_url ?? docsByResort.get(e.name)?.dot ?? null,
  }));
}

export function useEstablishmentsLive() {
  return useQuery({
    queryKey: ["live", "establishments"],
    queryFn: fetchEstablishments,
    enabled: isSupabaseConfigured,
    staleTime: 30_000,
    retry: 1,
  });
}

/**
 * Suspend/reactivate by flipping `accredited` (035 staff UPDATE). False
 * doubles as public-read hiding per the RLS policy — intended, not a hack.
 */
export async function setEstablishmentSuspended(
  dbId: string,
  suspended: boolean
): Promise<void> {
  const { error } = await supabase
    .from("establishments")
    .update({ accredited: !suspended })
    .eq("id", dbId);
  if (error) throw error;
}

export interface NewEstablishmentFromApp {
  resortName: string;
  resortLocation: string | null;
  contactNumber: string | null;
  touristEmail: string | null;
  website?: string | null;
  business_permit_url?: string | null;
  pcss_url?: string | null;
  dot_accreditation_url?: string | null;
}

/**
 * Graduation write: insert the establishment row for an approved
 * application. Transfers verified business permit, PCSSD, and DOT document photo URLs.
 */
export async function createEstablishmentFromApplication(
  app: NewEstablishmentFromApp
): Promise<void> {
  const { error } = await supabase.from("establishments").insert({
    name: app.resortName,
    location: app.resortLocation,
    email: app.touristEmail,
    phone: app.contactNumber,
    website: app.website || null,
    accredited: true,
    business_permit_url: app.business_permit_url || null,
    pcss_url: app.pcss_url || null,
    dot_accreditation_url: app.dot_accreditation_url || null,
  });
  if (error) throw error;
}

/* ------------------------------ STAFF ROSTER ------------------------------ */

export interface LiveStaffRow {
  _dbId: string;
  email: string;
  fullName: string;
  role: "staff" | "superadmin";
  isActive: boolean;
  /** 043: superadmin-set handover password not yet replaced by the staffer. */
  mustChangePassword: boolean;
  createdAt: string;
}

async function fetchStaff(): Promise<LiveStaffRow[]> {
  const { data: rows, error } = await supabase
    .from("to_staff")
    .select(
      "id, email, full_name, role, is_active, created_at, must_change_password"
    )
    .order("created_at", { ascending: true })
    .limit(100);
  if (error) {
    // Pre-043 database (no must_change_password column): retry without it
    // rather than showing an error — the flag simply can't exist yet.
    if (/must_change_password/i.test(error.message)) {
      const legacy = await supabase
        .from("to_staff")
        .select("id, email, full_name, role, is_active, created_at")
        .order("created_at", { ascending: true })
        .limit(100);
      if (legacy.error) throw legacy.error;
      return (legacy.data || []).map((s: any) => ({
        _dbId: s.id,
        email: s.email,
        fullName: s.full_name,
        role: s.role === "superadmin" ? "superadmin" : "staff",
        isActive: s.is_active !== false,
        mustChangePassword: false,
        createdAt: dayOf(s.created_at),
      }));
    }
    throw error;
  }
  return (rows || []).map((s: any) => ({
    _dbId: s.id,
    email: s.email,
    fullName: s.full_name,
    role: s.role === "superadmin" ? "superadmin" : "staff",
    isActive: s.is_active !== false,
    mustChangePassword: s.must_change_password === true,
    createdAt: dayOf(s.created_at),
  }));
}

export function useStaffLive() {
  return useQuery({
    queryKey: ["live", "to_staff"],
    queryFn: fetchStaff,
    enabled: isSupabaseConfigured,
    staleTime: 30_000,
    retry: 1,
  });
}

/**
 * Deactivate/reactivate a staffer. Superadmin-only via 034 — RLS rejects
 * anything else. Deactivation is reversible and is the preferred "remove"
 * action; hard delete exists only to correct a bad invite and lives in the
 * service-role server fn (delete-staff-fn.ts), which cascades the auth user
 * away so no DELETE on to_staff is ever needed.
 */
export async function setStaffActive(
  dbId: string,
  active: boolean
): Promise<void> {
  const { error } = await supabase
    .from("to_staff")
    .update({ is_active: active })
    .eq("id", dbId);
  if (error) throw error;
}

/** Promote/demote a staffer. Superadmin-only via 034. */
export async function setStaffRole(
  dbId: string,
  role: "staff" | "superadmin"
): Promise<void> {
  const { error } = await supabase
    .from("to_staff")
    .update({ role })
    .eq("id", dbId);
  if (error) throw error;
}

/* ------------------------------ AUDIT LOG ------------------------------ */

export interface LiveAuditEntry {
  date: string;
  t: string;
  who: string;
  action: string;
}

/**
 * Persist one audit entry. Fire-and-forget by contract: callers must `void`
 * the promise — a failed audit (network/RLS) warns to console and never
 * fails the primary action.
 */
export async function logAuditEvent(
  action: string,
  entity?: string
): Promise<void> {
  try {
    const {
      data: { session: s },
    } = await supabase.auth.getSession();
    if (!s?.user) return;
    const { error } = await supabase.from("audit_logs").insert({
      staff_id: s.user.id,
      staff_email: s.user.email || "unknown",
      action,
      entity: entity || null,
    });
    if (error) console.warn("[audit] insert failed:", error.message);
  } catch (e) {
    console.warn(
      "[audit] insert failed:",
      e instanceof Error ? e.message : e
    );
  }
}

async function fetchAuditLogs(): Promise<LiveAuditEntry[]> {
  const { data: rows, error } = await supabase
    .from("audit_logs")
    .select("action, staff_email, created_at")
    .order("created_at", { ascending: false })
    .limit(500);
  if (error) throw error;
  return (rows || []).map((r: any) => {
    const d = r.created_at ? new Date(r.created_at) : null;
    const valid = d && !Number.isNaN(d.getTime());
    return {
      date: valid ? d!.toISOString().slice(0, 10) : "—",
      t: valid
        ? d!.toTimeString().slice(0, 5)
        : "—",
      who: r.staff_email || "unknown",
      action: r.action,
    };
  });
}

export function useAuditLogsLive() {
  return useQuery({
    queryKey: ["live", "audit_logs"],
    queryFn: fetchAuditLogs,
    enabled: isSupabaseConfigured,
    staleTime: 30_000,
    retry: 1,
  });
}

/* ------------------------------ NOTIFICATIONS ------------------------------ */

/**
 * Staff-facing notification feed behind the header bell. Rows are produced by
 * the tourist-facing app in the shared Supabase project — the dashboard only
 * ever reads them and flips the read flag. There is no mock seed: an empty
 * table means an empty bell, which is the honest state.
 *
 * Schema (verified against the live project): id, title, body, type, is_read,
 * created_at, tourist_id. No recipient column, so `is_read` is global across
 * the office — one staffer marking a row read clears it for everyone, which
 * is the intended "someone handled this" semantics for a shared queue.
 */
export interface LiveNotificationRow {
  _dbId: string;
  title: string;
  body: string | null;
  type: string | null;
  isRead: boolean;
  createdAt: string;
  touristId: string | null;
}

async function fetchNotifications(): Promise<LiveNotificationRow[]> {
  const { data: rows, error } = await supabase
    .from("notifications")
    .select("id, title, body, type, is_read, created_at, tourist_id")
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw error;
  return (rows || []).map((n: any) => ({
    _dbId: n.id,
    title: n.title || "Notification",
    body: n.body ?? null,
    type: n.type ?? null,
    isRead: n.is_read !== false,
    createdAt: n.created_at || "",
    touristId: n.tourist_id ?? null,
  }));
}

export function useNotificationsLive() {
  return useQuery({
    queryKey: ["live", "notifications"],
    queryFn: fetchNotifications,
    enabled: isSupabaseConfigured,
    staleTime: 30_000,
    retry: 1,
  });
}

/**
 * Flips the read flag. Requires migration 039 — the UPDATE policy plus a
 * column-scoped `grant update (is_read)` that lets staff change read state
 * without being able to rewrite title/body/type.
 *
 * A broadcast fans out into one row per tourist, so the bell collapses those
 * rows into a single entry and clears the whole batch at once.
 */
export async function markNotificationsRead(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  const { error } = await supabase
    .from("notifications")
    .update({ is_read: true })
    .in("id", ids);
  if (error) throw error;
}

export async function markAllNotificationsRead(): Promise<void> {
  // Scope to unread only: rewriting every row would churn the realtime
  // publication and the audit trail for no benefit.
  const { error } = await supabase
    .from("notifications")
    .update({ is_read: true })
    .eq("is_read", false);
  if (error) throw error;
}

/* ------------------------------ ANNOUNCEMENTS ------------------------------ */

/**
 * The mobile app's announcement feed. The `announcements` table is owned by
 * the tourist (Sinsay) app; the dashboard writes it so staff can broadcast a
 * hero banner (image or blue gradient) to tourists.
 *
 * The table has no explicit status column — the dashboard's four states are
 * derived from `active` + the date window (see `statusOf`), matching how the
 * public read filter (active-only) treats them.
 */
export type AnnouncementStatus = "Published" | "Scheduled" | "Draft" | "Archived";

export interface LiveAnnouncementRow {
  _dbId: string;
  title: string;
  body: string | null;
  imageUrl: string | null;
  active: boolean;
  priority: number;
  startDate: string | null;
  endDate: string | null;
  eventStartDate: string | null;
  eventEndDate: string | null;
  createdAt: string;
}

function rowToAnnouncement(n: any): LiveAnnouncementRow {
  return {
    _dbId: n.id,
    title: n.title || "Untitled announcement",
    body: n.body ?? null,
    imageUrl: n.image_url ?? null,
    active: n.active !== false,
    priority: typeof n.priority === "number" ? n.priority : 0,
    startDate: n.start_date ?? null,
    endDate: n.end_date ?? null,
    eventStartDate: n.event_start_date ?? null,
    eventEndDate: n.event_end_date ?? null,
    createdAt: n.created_at || "",
  };
}

/**
 * Derives the dashboard status from the stored fields. Only `start_date` ever
 * schedules a row; an `active` row with no dates is simply live.
 */
export function statusOf(
  a: Pick<LiveAnnouncementRow, "active" | "startDate" | "endDate">
): AnnouncementStatus {
  const now = Date.now();
  if (!a.active) {
    const ended = a.endDate ? new Date(a.endDate).getTime() : NaN;
    return Number.isFinite(ended) && ended <= now ? "Archived" : "Draft";
  }
  if (a.startDate) {
    const starts = new Date(a.startDate).getTime();
    if (Number.isFinite(starts) && starts > now) return "Scheduled";
    const ends = a.endDate ? new Date(a.endDate).getTime() : NaN;
    if (Number.isFinite(ends) && ends <= now) return "Archived";
  }
  return "Published";
}

async function fetchAnnouncements(): Promise<LiveAnnouncementRow[]> {
  const { data, error } = await supabase
    .from("announcements")
    .select("*")
    .order("priority", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw error;
  return (data || []).map(rowToAnnouncement);
}

export function useAnnouncementsLive() {
  return useQuery({
    queryKey: ["live", "announcements"],
    queryFn: fetchAnnouncements,
    enabled: isSupabaseConfigured,
    staleTime: 30_000,
    retry: 1,
  });
}

export interface AnnouncementWrite {
  title: string;
  body: string | null;
  imageUrl: string | null;
  status: AnnouncementStatus;
  eventStartDate?: string | null;
  eventEndDate?: string | null;
}

/**
 * Maps the dashboard status onto the stored columns (date-window model):
 *   Draft     → active=false, no dates
 *   Scheduled → active=true, start_date in the future
 *   Published → active=true, live now (no end)
 *   Archived  → active=false, end_date in the past
 */
function statusToFields(status: AnnouncementStatus, startAt?: string | null) {
  const nowIso = new Date().toISOString();
  switch (status) {
    case "Draft":
      return { active: false, start_date: null, end_date: null };
    case "Scheduled":
      return {
        active: true,
        start_date: startAt ? new Date(startAt).toISOString() : nowIso,
        end_date: null,
      };
    case "Archived":
      return { active: false, start_date: null, end_date: nowIso };
    case "Published":
    default:
      return { active: true, start_date: null, end_date: null };
  }
}

export async function createAnnouncement(
  input: AnnouncementWrite & { startAt?: string | null }
): Promise<void> {
  const { error } = await supabase.from("announcements").insert({
    title: input.title,
    body: input.body,
    image_url: input.imageUrl,
    event_start_date: input.eventStartDate ?? null,
    event_end_date: input.eventEndDate ?? null,
    ...statusToFields(input.status, input.startAt),
  });
  if (error) throw error;
}

export async function updateAnnouncement(
  dbId: string,
  input: {
    title?: string;
    body?: string | null;
    imageUrl?: string | null;
    status?: AnnouncementStatus;
    startAt?: string | null;
    eventStartDate?: string | null;
    eventEndDate?: string | null;
  }
): Promise<void> {
  const patch: Record<string, unknown> = {};
  if (input.title !== undefined) patch.title = input.title;
  if (input.body !== undefined) patch.body = input.body;
  if (input.imageUrl !== undefined) patch.image_url = input.imageUrl;
  if (input.eventStartDate !== undefined)
    patch.event_start_date = input.eventStartDate;
  if (input.eventEndDate !== undefined)
    patch.event_end_date = input.eventEndDate;
  // Only touch active/start/end when a status transition is requested, so an
  // edit that changes just content can't silently reschedule a row.
  if (input.status) {
    Object.assign(patch, statusToFields(input.status, input.startAt));
  }
  const { error } = await supabase
    .from("announcements")
    .update(patch)
    .eq("id", dbId);
  if (error) throw error;
}

export async function deleteAnnouncement(dbId: string): Promise<void> {
  const { error } = await supabase.from("announcements").delete().eq("id", dbId);
  if (error) throw error;
}

/**
 * Uploads a hero photo to the public `announcement-photos` bucket (migration
 * 041) and returns the full public URL to store in `image_url` — the mobile
 * app renders it directly, so no signing is needed.
 */
export async function uploadAnnouncementPhoto(file: File): Promise<string> {
  const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
  const path = `announcements/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage
    .from("announcement-photos")
    .upload(path, file, { contentType: file.type || `image/${ext}` });
  if (error) throw error;
  const { data } = supabase.storage
    .from("announcement-photos")
    .getPublicUrl(path);
  return data.publicUrl;
}

/* ------------------------------ KPI HELPERS ------------------------------ */

const KPI_MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;

function monthIndexOf(dateStr: string | null | undefined): number {
  if (!dateStr || dateStr === "—") return -1;
  const d = new Date(
    dateStr.length <= 10 ? dateStr + "T00:00:00" : dateStr
  );
  if (Number.isNaN(d.getTime())) return -1;
  return d.getMonth();
}

export interface MonthBucket {
  m: string;
  count: number;
  total: number;
}

/**
 * Real 12-month buckets over live rows. Replaces the old `scale * 3`
 * multiplier that faked responsiveness on mock series. Rows with unknown
 * dates are skipped (they still render in tables via pass-through filters).
 */
export function bucketByMonth<T>(
  rows: T[],
  getDate: (r: T) => string,
  getValue?: (r: T) => number
): MonthBucket[] {
  const buckets: MonthBucket[] = KPI_MONTHS.map((m) => ({
    m,
    count: 0,
    total: 0,
  }));
  for (const r of rows) {
    const idx = monthIndexOf(getDate(r));
    if (idx < 0) continue;
    buckets[idx].count += 1;
    if (getValue) buckets[idx].total += getValue(r) || 0;
  }
  return buckets;
}

/** Rows whose date falls in the real current calendar month. */
export function thisMonth<T>(rows: T[], getDate: (r: T) => string): T[] {
  const cur = new Date().getMonth();
  return rows.filter((r) => monthIndexOf(getDate(r)) === cur);
}

export interface PeriodBucket {
  label: string;
  start: string;
  end: string;
  count: number;
  total: number;
}

const isoDay = (d: Date) => d.toISOString().slice(0, 10);
const shortDay = (d: Date) =>
  d.toLocaleString("en", { month: "short", day: "numeric" });

function sumInto<T>(
  rows: T[],
  getDate: (r: T) => string,
  getValue: ((r: T) => number) | undefined,
  fromISO: string,
  toISO: string
): { count: number; total: number } {
  let count = 0;
  let total = 0;
  for (const r of rows) {
    const d = getDate(r);
    if (!d || d === "—" || d < fromISO || d > toISO) continue;
    count += 1;
    if (getValue) total += getValue(r) || 0;
  }
  return { count, total };
}

/** Last N days (day-level buckets ending today) for daily reports. */
export function bucketByDay<T>(
  rows: T[],
  getDate: (r: T) => string,
  getValue?: (r: T) => number,
  days = 3
): PeriodBucket[] {
  const out: PeriodBucket[] = [];
  const now = new Date();
  for (let i = 0; i < days; i++) {
    const d = new Date(now.getTime() - i * 86400000);
    const iso = isoDay(d);
    const { count, total } = sumInto(rows, getDate, getValue, iso, iso);
    out.push({ label: shortDay(d), start: iso, end: iso, count, total });
  }
  return out;
}

/** Last N 7-day windows ending today for weekly reports. */
export function bucketByWeek<T>(
  rows: T[],
  getDate: (r: T) => string,
  getValue?: (r: T) => number,
  weeks = 3
): PeriodBucket[] {
  const out: PeriodBucket[] = [];
  const now = new Date();
  for (let w = 0; w < weeks; w++) {
    const end = new Date(now.getTime() - w * 7 * 86400000);
    const start = new Date(end.getTime() - 6 * 86400000);
    const sISO = isoDay(start);
    const eISO = isoDay(end);
    const { count, total } = sumInto(rows, getDate, getValue, sISO, eISO);
    out.push({
      label: `${shortDay(start)}–${shortDay(end)}`,
      start: sISO,
      end: eISO,
      count,
      total,
    });
  }
  return out;
}

/**
 * Realtime refresh for the live tables. Subscribes to postgres_changes on
 * operator_applications + payment_transactions + tourists + dive_manifests
 * (+ manifest_divers, which rolls up into the manifest list) +
 * dive_pass_inventory + to_staff + dive_sites + establishments + audit_logs
 * and invalidates the matching live query so counts, badges and rows
 * update without a manual refetch.
 *
 * No-op when Supabase isn't configured. Requires each table to be in the
 * `supabase_realtime` publication with staff SELECT (030) — otherwise the
 * channel connects but no events arrive, and the dashboard keeps working via
 * polling-by-invalidate (staleTime 30s + refetch after each write).
 */
export function useLiveRealtime() {
  const qc = useQueryClient();

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    const channel = supabase
      .channel("to-dashboard-live")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "operator_applications" },
        () => {
          qc.invalidateQueries({ queryKey: ["live", "operator_applications"] });
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "payment_transactions" },
        () => {
          qc.invalidateQueries({ queryKey: ["live", "payment_transactions"] });
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "tourists" },
        () => {
          qc.invalidateQueries({ queryKey: ["live", "tourists"] });
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "dive_manifests" },
        () => {
          qc.invalidateQueries({ queryKey: ["live", "dive_manifests"] });
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "manifest_divers" },
        () => {
          qc.invalidateQueries({ queryKey: ["live", "dive_manifests"] });
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "dive_pass_inventory" },
        () => {
          qc.invalidateQueries({ queryKey: ["live", "dive_pass_inventory"] });
        }
      )
      // Price edits made here are read by the tourist app, so keep every
      // dashboard tab honest about the current list. Requires pass_pricing in
      // the supabase_realtime publication (the dashboard still works without
      // it — this only drives cross-client push, not the refetch on mount).
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "pass_pricing" },
        () => {
          qc.invalidateQueries({ queryKey: ["live", "pass_pricing"] });
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "to_staff" },
        () => {
          qc.invalidateQueries({ queryKey: ["live", "to_staff"] });
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "dive_sites" },
        () => {
          qc.invalidateQueries({ queryKey: ["live", "dive_sites"] });
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "establishments" },
        () => {
          qc.invalidateQueries({ queryKey: ["live", "establishments"] });
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "audit_logs" },
        () => {
          qc.invalidateQueries({ queryKey: ["live", "audit_logs"] });
        }
      )
      // Keeps the header bell live without a reload. Requires the table in
      // the supabase_realtime publication (migration 039); without it this
      // subscription silently never fires.
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "notifications" },
        () => {
          qc.invalidateQueries({ queryKey: ["live", "notifications"] });
        }
      )
      // Keeps the announcements feed fresh for other staffers. Requires the
      // table in the supabase_realtime publication (migration 037).
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "announcements" },
        () => {
          qc.invalidateQueries({ queryKey: ["live", "announcements"] });
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [qc]);
}
