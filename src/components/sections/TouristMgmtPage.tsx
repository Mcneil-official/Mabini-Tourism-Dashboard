import { DocumentViewer } from "@/components/DocumentViewer";
import { useState, useEffect, useMemo } from "react";
import {
  Users,
  User,
  Phone,
  Check,
  RotateCcw,
  Download,
  Search,
  Sparkles,
  Clock,
  Send,
  Edit3,
  Trash2,
  Eye,
  EyeOff,
  CheckCircle2,
  SlidersHorizontal,
  X,
  ChevronRight,
  ShieldAlert,
  AlertCircle,
  Ban,
  ShieldCheck,
  Shield,
  Loader2,
  CalendarIcon,
  FileDown,
  UserCheck,
  Waves,
  GraduationCap,
  Award,
  Compass,
  ExternalLink,
  FileText,
  MapPin,
  Building2,
  AlertTriangle,
  FileCheck2,
  Maximize2,
  ZoomIn,
  RefreshCw,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
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
  TableSkeletonRows,
  StatusBadge,
  DrilldownDialog,
} from "@/components/shared";
import { useFilters } from "@/hooks/useFilters";
import { usePermission } from "@/hooks/usePermission";
import { useGlobalDateRange } from "@/hooks/useGlobalDateRange";
import { pushAuditLog } from "@/lib/audit";
import { downloadCsv } from "@/lib/export-utils";
import { requireLiveSession, type StaffSession } from "@/lib/staff-auth";
import { displayNationality } from "@/lib/metrics";
import {
  useLiveMode,
  useTouristsLive,
  useInvalidateLive,
  useLiveList,
  setTouristStatus,
  renewTourist,
  verifyTouristProCredentials,
  issueTouristDivePass,
  type LiveTouristRow,
  dbErrorMessage,
  isPdfUrl,
} from "@/lib/queries";
import {
  tourists,
  ALL_NATIONALITIES,
  ALL_LEVELS,
  type MockTourist,
} from "@/lib/mock-data";

export function TouristMgmtPage({ session }: { session?: StaffSession | null }) {
  const { search, setFilters, resetFilters } = useFilters();
  const { inRange } = useGlobalDateRange();
  const { canAct, deny } = usePermission();
  const [mockTourists, setMockTourists] = useState(tourists);
  // Live mode (Supabase configured): the registry comes from tourists;
  // mocks are the offline fallback. Register stays mock-only (creating
  // auth.users rows needs a server function — impossible client-side).
  const isLive = useLiveMode();
  const liveTourists = useTouristsLive();
  const invalidateTourists = useInvalidateLive();
  const isLiveData = isLive && !!liveTourists.data;
  const touristsSource = useLiveList(isLive, liveTourists, mockTourists);
  const touristList = touristsSource.rows;
  // Hide the signed-in staffer's own tourists row: Sinsay auto-creates a
  // tourists profile for every auth user, including staff logins. Server-side
  // exclusion can't do better (to_staff RLS is own-row-only), so filter the
  // session UID client-side. Mock rows carry no _dbId — demo mode untouched.
  const visibleTourists = useMemo(
    () =>
      session?.userId
        ? touristList.filter((t) => (t as any)._dbId !== session.userId)
        : touristList,
    [touristList, session?.userId],
  );
  useEffect(() => {
    if (liveTourists.isError) {
      toast.error("Could not load live tourists", {
        description: "Showing demo data. Check the Supabase connection.",
      });
    }
  }, [liveTourists.isError]);
  const [viewing, setViewing] = useState<any>(null);
  const [rowBusy, setRowBusy] = useState<"suspend" | "renew" | null>(null);
  const [touristDrilldown, setTouristDrilldown] = useState<any>(null);

  // Dive Instructors / Dive Masters View & Filter state (unified role)
  const activeTab = search.tab === "pros" ? "pros" : "all";
  const [proDocFilter, setProDocFilter] = useState<string>("All");
  const [proStatus, setProStatus] = useState<string>("All");
  const [proSearch, setProSearch] = useState<string>("");
  const [viewingPro, setViewingPro] = useState<(LiveTouristRow | MockTourist) | null>(null);
  const [zoomedProPhoto, setZoomedProPhoto] = useState<string | null>(null);
  const [selectedProDocIdx, setSelectedProDocIdx] = useState<number>(0);
  const [verifyingPro, setVerifyingPro] = useState<boolean>(false);
  const [issuingPass, setIssuingPass] = useState<boolean>(false);
  const [confirmPassAction, setConfirmPassAction] = useState<{
    type: "issue-pro" | "renew-pro" | "renew-tourist";
    passType?: "annual" | "one-day";
    tourist: LiveTouristRow | MockTourist;
  } | null>(null);

  const promptIssueDivePass = (
    t: LiveTouristRow | MockTourist,
    passType: "annual" | "one-day" = "annual"
  ) => {
    const isAnnual = passType === "annual";
    const isRenewal = (t as any).dive_pass_type === "annual" && isAnnual;
    setConfirmPassAction({
      type: isRenewal ? "renew-pro" : "issue-pro",
      passType,
      tourist: t,
    });
  };

  const promptRenewTourist = () => {
    if (!viewing) return;
    setConfirmPassAction({
      type: "renew-tourist",
      tourist: viewing,
    });
  };

  const executeConfirmedPassAction = async () => {
    if (!confirmPassAction) return;
    const action = confirmPassAction;
    try {
      if (action.type === "renew-tourist") {
        await renewViewing();
      } else if (action.passType) {
        await handleIssueDivePass(action.tourist, action.passType);
      }
      setConfirmPassAction(null);
    } catch {
      setConfirmPassAction(null);
    }
  };


  // Auto-focus the tab that has an uploaded file when opening a pro dossier
  useEffect(() => {
    if (viewingPro) {
      const hasPcssd = Boolean((viewingPro as any).pcssd_url || (viewingPro as any).pcssd_certificate_url);
      const hasPto = Boolean((viewingPro as any).permit_to_operate_url || (viewingPro as any).pto_url);
      if (!hasPcssd && hasPto) {
        setSelectedProDocIdx(1);
      } else {
        setSelectedProDocIdx(0);
      }
    }
  }, [viewingPro]);

  // Unified list of Dive Instructors & Dive Masters matching checklist
  const proTourists = useMemo(() => {
    return visibleTourists.filter((t) => {
      const lvl = String(t.level || (t as any).diver_type || "").toLowerCase();
      const isDiveMasterOrInstructor =
        lvl.includes("master") || lvl.includes("instructor");
      const hasGuidingAccreditations = Boolean(
        (t as any).pcssd_number ||
          (t as any).pcssd_certificate_url ||
          (t as any).pto_number ||
          (t as any).pto_url ||
          (t as any).license_number ||
          (t as any).credentials_url,
      );
      return isDiveMasterOrInstructor || hasGuidingAccreditations;
    });
  }, [visibleTourists]);

  // Filtered pros list
  const filteredPros = useMemo(() => {
    return proTourists.filter((t) => {
      if (proDocFilter === "Complete") {
        const hasPcssd = Boolean(
          (t as any).pcssd_number && (t as any).pcssd_certificate_url,
        );
        const hasPto = Boolean((t as any).pto_number && (t as any).pto_url);
        if (!hasPcssd || !hasPto) return false;
      } else if (proDocFilter === "Missing Docs") {
        const hasPcssd = Boolean(
          (t as any).pcssd_number && (t as any).pcssd_certificate_url,
        );
        const hasPto = Boolean((t as any).pto_number && (t as any).pto_url);
        if (hasPcssd && hasPto) return false;
      }

      if (proStatus === "Verified" && !t.pro_verified) return false;
      if (proStatus === "Pending" && t.pro_verified) return false;
      if (proStatus === "Suspended" && t.status !== "Suspended") return false;

      if (proSearch) {
        const q = proSearch.toLowerCase();
        const matchName = t.name.toLowerCase().includes(q);
        const matchId = t.id.toLowerCase().includes(q);
        const matchPcssd = String((t as any).pcssd_number || "").toLowerCase().includes(q);
        const matchPto = String((t as any).pto_number || "").toLowerCase().includes(q);
        const matchOp = String((t as any).affiliated_operator || "").toLowerCase().includes(q);
        if (!matchName && !matchId && !matchPcssd && !matchPto && !matchOp) return false;
      }

      return true;
    });
  }, [proTourists, proDocFilter, proStatus, proSearch]);

  const {
    page: pPage,
    setPage: pSetPage,
    totalPages: pTotalPages,
    paged: pPaged,
  } = usePagination(filteredPros, 10);

  // High-level statistics
  const totalDivers = visibleTourists.length;
  const proCount = proTourists.length;
  const verifiedProCount = proTourists.filter((t) => Boolean(t.pro_verified)).length;
  const pendingProCount = proCount - verifiedProCount;

  const isProEligible = (p: LiveTouristRow | MockTourist) => {
    if (p.pro_verified) return true;
    const hasPcssd = Boolean(
      ((p as any).pcssd_accreditation_no || (p as any).pcssd_number) && ((p as any).pcssd_url || (p as any).pcssd_certificate_url),
    );
    const hasPto = Boolean(((p as any).permit_to_operate_no || (p as any).pto_number) && ((p as any).permit_to_operate_url || (p as any).pto_url));
    return hasPcssd && hasPto;
  };

  const toggleVerifyPro = async (t: LiveTouristRow | MockTourist) => {
    const nextVerified = !t.pro_verified;
    if (nextVerified && !isProEligible(t)) {
      toast.error("Cannot verify credentials", {
        description: "Both PCSSD Accreditation and Municipal Permit to Operate documents are required.",
      });
      return;
    }
    if (!canAct) return deny();
    if (isLive && !(await requireLiveSession())) return;
    const dbId = (t as any)._dbId as string | undefined;
    setVerifyingPro(true);
    try {
      if (isLive && dbId) {
        await verifyTouristProCredentials(dbId, nextVerified);
        invalidateTourists();
      } else {
        const today = new Date().toISOString().slice(0, 10);
        setMockTourists((prev) =>
          prev.map((item) =>
            item.id === t.id
              ? { ...item, pro_verified: nextVerified, dateAccredited: nextVerified ? today : null }
              : item
          )
        );
      }
      if (viewingPro && viewingPro.id === t.id) {
        const today = new Date().toISOString().slice(0, 10);
        setViewingPro({
          ...viewingPro,
          pro_verified: nextVerified,
          dateAccredited: nextVerified ? today : null,
        } as any);
      }
      pushAuditLog(
        nextVerified
          ? `Verified credentials for dive professional ${t.name} (${t.id})`
          : `Revoked credential verification for ${t.name} (${t.id})`
      );
      toast.success(
        nextVerified
          ? "Professional credentials verified"
          : "Verification status reset",
        {
          description: `${t.name} (${t.id}) • ${t.level}`,
        }
      );
    } catch (err) {
      toast.error("Could not update verification", {
        description: dbErrorMessage(err),
      });
    } finally {
      setVerifyingPro(false);
    }
  };

  const handleIssueDivePass = async (
    t: LiveTouristRow | MockTourist,
    passType: "annual" | "one-day" = "annual"
  ) => {
    if (!canAct) return deny();
    if (isLive && !(await requireLiveSession())) return;
    const dbId = (t as any)._dbId as string | undefined;
    setIssuingPass(true);
    try {
      const today = new Date().toISOString().slice(0, 10);
      const next = new Date();
      if (passType === "annual") {
        next.setFullYear(next.getFullYear() + 1);
      } else {
        next.setDate(next.getDate() + 1);
      }
      const renewalDate = next.toISOString().slice(0, 10);

      if (isLive && dbId) {
        await issueTouristDivePass(dbId, passType);
        invalidateTourists();
      } else {
        setMockTourists((prev) =>
          prev.map((item) =>
            item.id === t.id
              ? {
                  ...item,
                  dive_pass_type: passType,
                  dateAccredited: today,
                  expires: renewalDate,
                  status: "Active",
                }
              : item
          )
        );
      }

      if (viewingPro && viewingPro.id === t.id) {
        setViewingPro({
          ...viewingPro,
          dive_pass_type: passType,
          dateAccredited: today,
          expires: renewalDate,
          status: "Active",
        } as any);
      }

      const passLabel = passType === "annual" ? "Annual Dive Pass (1 Year)" : "One-Day Dive Pass";
      pushAuditLog(
        `Issued ${passLabel} to ${t.name} (${t.id}) — valid until ${renewalDate}`
      );
      toast.success(`${passLabel} Issued`, {
        description: `${t.name} accredited & valid until ${renewalDate}.`,
      });
    } catch (e) {
      toast.error("Could not issue dive pass", {
        description: dbErrorMessage(e),
      });
    } finally {
      setIssuingPass(false);
    }
  };

  const touristDiveHistory: Record<
    string,
    {
      date: string;
      site: string;
      depth: string;
      divemaster: string;
      operator: string;
    }[]
  > = {
    "TR-10241": [
      {
        date: "2026-07-20",
        site: "Blue Hole",
        depth: "32 m",
        divemaster: "Kai Reyes",
        operator: "Deep Blue Divers",
      },
      {
        date: "2026-07-22",
        site: "Coral Gardens",
        depth: "18 m",
        divemaster: "Kai Reyes",
        operator: "Deep Blue Divers",
      },
      {
        date: "2026-07-25",
        site: "Manta Reef",
        depth: "28 m",
        divemaster: "Lena Cruz",
        operator: "AquaVenture",
      },
      {
        date: "2026-08-01",
        site: "Turtle Bay",
        depth: "12 m",
        divemaster: "Kai Reyes",
        operator: "Deep Blue Divers",
      },
      {
        date: "2026-08-05",
        site: "Shark Point",
        depth: "30 m",
        divemaster: "Lena Cruz",
        operator: "AquaVenture",
      },
      {
        date: "2026-08-10",
        site: "Loyzaga Wreck",
        depth: "35 m",
        divemaster: "Marco Silva",
        operator: "Island Dive Co",
      },
      {
        date: "2026-08-14",
        site: "Blue Hole",
        depth: "38 m",
        divemaster: "Kai Reyes",
        operator: "Deep Blue Divers",
      },
    ],
    "TR-10242": [
      {
        date: "2026-06-30",
        site: "Shark Point",
        depth: "33 m",
        divemaster: "Marco Silva",
        operator: "Island Dive Co",
      },
      {
        date: "2026-07-05",
        site: "Manta Reef",
        depth: "27 m",
        divemaster: "Lena Cruz",
        operator: "AquaVenture",
      },
      {
        date: "2026-07-12",
        site: "Blue Hole",
        depth: "40 m",
        divemaster: "Kai Reyes",
        operator: "Deep Blue Divers",
      },
      {
        date: "2026-07-18",
        site: "Loyzaga Wreck",
        depth: "36 m",
        divemaster: "Marco Silva",
        operator: "Island Dive Co",
      },
      {
        date: "2026-07-24",
        site: "Coral Gardens",
        depth: "20 m",
        divemaster: "Lena Cruz",
        operator: "AquaVenture",
      },
      {
        date: "2026-08-02",
        site: "Shark Point",
        depth: "34 m",
        divemaster: "Kai Reyes",
        operator: "Deep Blue Divers",
      },
      {
        date: "2026-08-08",
        site: "Manta Reef",
        depth: "29 m",
        divemaster: "Marco Silva",
        operator: "Island Dive Co",
      },
      {
        date: "2026-08-12",
        site: "Blue Hole",
        depth: "39 m",
        divemaster: "Lena Cruz",
        operator: "AquaVenture",
      },
    ],
    "TR-10243": [
      {
        date: "2026-06-18",
        site: "Coral Gardens",
        depth: "15 m",
        divemaster: "Kai Reyes",
        operator: "Deep Blue Divers",
      },
      {
        date: "2026-06-20",
        site: "Turtle Bay",
        depth: "10 m",
        divemaster: "Lena Cruz",
        operator: "AquaVenture",
      },
      {
        date: "2026-06-22",
        site: "Coral Gardens",
        depth: "18 m",
        divemaster: "Kai Reyes",
        operator: "Deep Blue Divers",
      },
    ],
    "TR-10244": [
      {
        date: "2026-07-08",
        site: "Shark Point",
        depth: "30 m",
        divemaster: "Marco Silva",
        operator: "Island Dive Co",
      },
      {
        date: "2026-07-14",
        site: "Manta Reef",
        depth: "26 m",
        divemaster: "Lena Cruz",
        operator: "AquaVenture",
      },
      {
        date: "2026-07-20",
        site: "Blue Hole",
        depth: "37 m",
        divemaster: "Kai Reyes",
        operator: "Deep Blue Divers",
      },
      {
        date: "2026-07-28",
        site: "Loyzaga Wreck",
        depth: "34 m",
        divemaster: "Marco Silva",
        operator: "Island Dive Co",
      },
      {
        date: "2026-08-04",
        site: "Turtle Bay",
        depth: "14 m",
        divemaster: "Lena Cruz",
        operator: "AquaVenture",
      },
      {
        date: "2026-08-11",
        site: "Shark Point",
        depth: "32 m",
        divemaster: "Kai Reyes",
        operator: "Deep Blue Divers",
      },
    ],
    "TR-10245": [
      {
        date: "2026-06-25",
        site: "Coral Gardens",
        depth: "16 m",
        divemaster: "Lena Cruz",
        operator: "AquaVenture",
      },
      {
        date: "2026-07-02",
        site: "Turtle Bay",
        depth: "12 m",
        divemaster: "Kai Reyes",
        operator: "Deep Blue Divers",
      },
      {
        date: "2026-07-10",
        site: "Manta Reef",
        depth: "24 m",
        divemaster: "Marco Silva",
        operator: "Island Dive Co",
      },
      {
        date: "2026-07-18",
        site: "Coral Gardens",
        depth: "19 m",
        divemaster: "Lena Cruz",
        operator: "AquaVenture",
      },
    ],
    "TR-10246": [
      {
        date: "2026-07-20",
        site: "Blue Hole",
        depth: "40 m",
        divemaster: "Kai Reyes",
        operator: "Deep Blue Divers",
      },
      {
        date: "2026-07-25",
        site: "Shark Point",
        depth: "35 m",
        divemaster: "Marco Silva",
        operator: "Island Dive Co",
      },
      {
        date: "2026-07-30",
        site: "Manta Reef",
        depth: "30 m",
        divemaster: "Lena Cruz",
        operator: "AquaVenture",
      },
      {
        date: "2026-08-03",
        site: "Loyzaga Wreck",
        depth: "38 m",
        divemaster: "Kai Reyes",
        operator: "Deep Blue Divers",
      },
      {
        date: "2026-08-08",
        site: "Coral Gardens",
        depth: "22 m",
        divemaster: "Marco Silva",
        operator: "Island Dive Co",
      },
      {
        date: "2026-08-13",
        site: "Blue Hole",
        depth: "40 m",
        divemaster: "Lena Cruz",
        operator: "AquaVenture",
      },
    ],
    "TR-10247": [
      {
        date: "2026-06-10",
        site: "Turtle Bay",
        depth: "14 m",
        divemaster: "Lena Cruz",
        operator: "AquaVenture",
      },
      {
        date: "2026-06-18",
        site: "Coral Gardens",
        depth: "20 m",
        divemaster: "Kai Reyes",
        operator: "Deep Blue Divers",
      },
      {
        date: "2026-06-26",
        site: "Manta Reef",
        depth: "28 m",
        divemaster: "Marco Silva",
        operator: "Island Dive Co",
      },
      {
        date: "2026-07-04",
        site: "Blue Hole",
        depth: "36 m",
        divemaster: "Kai Reyes",
        operator: "Deep Blue Divers",
      },
      {
        date: "2026-07-15",
        site: "Shark Point",
        depth: "31 m",
        divemaster: "Lena Cruz",
        operator: "AquaVenture",
      },
      {
        date: "2026-08-01",
        site: "Turtle Bay",
        depth: "12 m",
        divemaster: "Marco Silva",
        operator: "Island Dive Co",
      },
    ],
    "TR-10248": [
      {
        date: "2026-07-26",
        site: "Coral Gardens",
        depth: "12 m",
        divemaster: "Kai Reyes",
        operator: "Deep Blue Divers",
      },
      {
        date: "2026-07-30",
        site: "Turtle Bay",
        depth: "10 m",
        divemaster: "Lena Cruz",
        operator: "AquaVenture",
      },
      {
        date: "2026-08-04",
        site: "Coral Gardens",
        depth: "16 m",
        divemaster: "Kai Reyes",
        operator: "Deep Blue Divers",
      },
      {
        date: "2026-08-10",
        site: "Turtle Bay",
        depth: "14 m",
        divemaster: "Marco Silva",
        operator: "Island Dive Co",
      },
    ],
    "TR-10249": [
      {
        date: "2026-06-14",
        site: "Manta Reef",
        depth: "28 m",
        divemaster: "Marco Silva",
        operator: "Island Dive Co",
      },
      {
        date: "2026-06-18",
        site: "Blue Hole",
        depth: "34 m",
        divemaster: "Kai Reyes",
        operator: "Deep Blue Divers",
      },
      {
        date: "2026-06-22",
        site: "Shark Point",
        depth: "30 m",
        divemaster: "Lena Cruz",
        operator: "AquaVenture",
      },
      {
        date: "2026-06-28",
        site: "Loyzaga Wreck",
        depth: "32 m",
        divemaster: "Marco Silva",
        operator: "Island Dive Co",
      },
    ],
    "TR-10250": [
      {
        date: "2026-07-12",
        site: "Blue Hole",
        depth: "30 m",
        divemaster: "Kai Reyes",
        operator: "Deep Blue Divers",
      },
      {
        date: "2026-07-18",
        site: "Coral Gardens",
        depth: "22 m",
        divemaster: "Lena Cruz",
        operator: "AquaVenture",
      },
      {
        date: "2026-07-25",
        site: "Turtle Bay",
        depth: "14 m",
        divemaster: "Kai Reyes",
        operator: "Deep Blue Divers",
      },
      {
        date: "2026-08-02",
        site: "Manta Reef",
        depth: "26 m",
        divemaster: "Marco Silva",
        operator: "Island Dive Co",
      },
      {
        date: "2026-08-09",
        site: "Shark Point",
        depth: "32 m",
        divemaster: "Lena Cruz",
        operator: "AquaVenture",
      },
    ],
    "TR-10251": [
      {
        date: "2026-06-28",
        site: "Blue Hole",
        depth: "40 m",
        divemaster: "Kai Reyes",
        operator: "Deep Blue Divers",
      },
      {
        date: "2026-07-04",
        site: "Shark Point",
        depth: "35 m",
        divemaster: "Marco Silva",
        operator: "Island Dive Co",
      },
      {
        date: "2026-07-10",
        site: "Loyzaga Wreck",
        depth: "38 m",
        divemaster: "Lena Cruz",
        operator: "AquaVenture",
      },
      {
        date: "2026-07-18",
        site: "Manta Reef",
        depth: "30 m",
        divemaster: "Kai Reyes",
        operator: "Deep Blue Divers",
      },
      {
        date: "2026-07-26",
        site: "Coral Gardens",
        depth: "20 m",
        divemaster: "Marco Silva",
        operator: "Island Dive Co",
      },
      {
        date: "2026-08-03",
        site: "Blue Hole",
        depth: "39 m",
        divemaster: "Lena Cruz",
        operator: "AquaVenture",
      },
      {
        date: "2026-08-10",
        site: "Shark Point",
        depth: "33 m",
        divemaster: "Kai Reyes",
        operator: "Deep Blue Divers",
      },
      {
        date: "2026-08-15",
        site: "Loyzaga Wreck",
        depth: "36 m",
        divemaster: "Marco Silva",
        operator: "Island Dive Co",
      },
    ],
    "TR-10252": [
      {
        date: "2026-07-05",
        site: "Coral Gardens",
        depth: "14 m",
        divemaster: "Lena Cruz",
        operator: "AquaVenture",
      },
      {
        date: "2026-07-12",
        site: "Turtle Bay",
        depth: "10 m",
        divemaster: "Kai Reyes",
        operator: "Deep Blue Divers",
      },
    ],
    "TR-10253": [
      {
        date: "2026-07-04",
        site: "Shark Point",
        depth: "34 m",
        divemaster: "Kai Reyes",
        operator: "Deep Blue Divers",
      },
      {
        date: "2026-07-12",
        site: "Manta Reef",
        depth: "28 m",
        divemaster: "Lena Cruz",
        operator: "AquaVenture",
      },
      {
        date: "2026-07-20",
        site: "Blue Hole",
        depth: "38 m",
        divemaster: "Marco Silva",
        operator: "Island Dive Co",
      },
      {
        date: "2026-07-28",
        site: "Loyzaga Wreck",
        depth: "35 m",
        divemaster: "Kai Reyes",
        operator: "Deep Blue Divers",
      },
      {
        date: "2026-08-05",
        site: "Coral Gardens",
        depth: "20 m",
        divemaster: "Lena Cruz",
        operator: "AquaVenture",
      },
    ],
    "TR-10254": [
      {
        date: "2026-07-18",
        site: "Blue Hole",
        depth: "30 m",
        divemaster: "Kai Reyes",
        operator: "Deep Blue Divers",
      },
      {
        date: "2026-07-24",
        site: "Coral Gardens",
        depth: "18 m",
        divemaster: "Lena Cruz",
        operator: "AquaVenture",
      },
      {
        date: "2026-08-01",
        site: "Turtle Bay",
        depth: "12 m",
        divemaster: "Marco Silva",
        operator: "Island Dive Co",
      },
      {
        date: "2026-08-08",
        site: "Manta Reef",
        depth: "26 m",
        divemaster: "Kai Reyes",
        operator: "Deep Blue Divers",
      },
    ],
    "TR-10255": [
      {
        date: "2026-06-22",
        site: "Coral Gardens",
        depth: "12 m",
        divemaster: "Lena Cruz",
        operator: "AquaVenture",
      },
      {
        date: "2026-06-28",
        site: "Turtle Bay",
        depth: "8 m",
        divemaster: "Kai Reyes",
        operator: "Deep Blue Divers",
      },
      {
        date: "2026-07-06",
        site: "Coral Gardens",
        depth: "16 m",
        divemaster: "Lena Cruz",
        operator: "AquaVenture",
      },
      {
        date: "2026-07-15",
        site: "Turtle Bay",
        depth: "12 m",
        divemaster: "Marco Silva",
        operator: "Island Dive Co",
      },
      {
        date: "2026-08-02",
        site: "Coral Gardens",
        depth: "18 m",
        divemaster: "Kai Reyes",
        operator: "Deep Blue Divers",
      },
    ],
    "TR-10256": [
      {
        date: "2026-07-24",
        site: "Manta Reef",
        depth: "28 m",
        divemaster: "Marco Silva",
        operator: "Island Dive Co",
      },
      {
        date: "2026-07-30",
        site: "Shark Point",
        depth: "32 m",
        divemaster: "Lena Cruz",
        operator: "AquaVenture",
      },
      {
        date: "2026-08-06",
        site: "Blue Hole",
        depth: "36 m",
        divemaster: "Kai Reyes",
        operator: "Deep Blue Divers",
      },
      {
        date: "2026-08-12",
        site: "Loyzaga Wreck",
        depth: "34 m",
        divemaster: "Marco Silva",
        operator: "Island Dive Co",
      },
    ],
    "TR-10257": [
      {
        date: "2026-06-26",
        site: "Blue Hole",
        depth: "35 m",
        divemaster: "Kai Reyes",
        operator: "Deep Blue Divers",
      },
      {
        date: "2026-07-03",
        site: "Coral Gardens",
        depth: "20 m",
        divemaster: "Lena Cruz",
        operator: "AquaVenture",
      },
      {
        date: "2026-07-10",
        site: "Manta Reef",
        depth: "28 m",
        divemaster: "Marco Silva",
        operator: "Island Dive Co",
      },
      {
        date: "2026-07-18",
        site: "Shark Point",
        depth: "30 m",
        divemaster: "Kai Reyes",
        operator: "Deep Blue Divers",
      },
      {
        date: "2026-07-28",
        site: "Loyzaga Wreck",
        depth: "33 m",
        divemaster: "Lena Cruz",
        operator: "AquaVenture",
      },
      {
        date: "2026-08-06",
        site: "Blue Hole",
        depth: "38 m",
        divemaster: "Marco Silva",
        operator: "Island Dive Co",
      },
      {
        date: "2026-08-14",
        site: "Turtle Bay",
        depth: "14 m",
        divemaster: "Kai Reyes",
        operator: "Deep Blue Divers",
      },
    ],
    "TR-10258": [
      {
        date: "2026-07-08",
        site: "Blue Hole",
        depth: "40 m",
        divemaster: "Kai Reyes",
        operator: "Deep Blue Divers",
      },
      {
        date: "2026-07-14",
        site: "Shark Point",
        depth: "35 m",
        divemaster: "Marco Silva",
        operator: "Island Dive Co",
      },
      {
        date: "2026-07-22",
        site: "Loyzaga Wreck",
        depth: "38 m",
        divemaster: "Lena Cruz",
        operator: "AquaVenture",
      },
      {
        date: "2026-07-30",
        site: "Manta Reef",
        depth: "30 m",
        divemaster: "Kai Reyes",
        operator: "Deep Blue Divers",
      },
      {
        date: "2026-08-07",
        site: "Coral Gardens",
        depth: "22 m",
        divemaster: "Marco Silva",
        operator: "Island Dive Co",
      },
      {
        date: "2026-08-14",
        site: "Blue Hole",
        depth: "40 m",
        divemaster: "Lena Cruz",
        operator: "AquaVenture",
      },
    ],
    "TR-10259": [
      {
        date: "2026-06-14",
        site: "Coral Gardens",
        depth: "10 m",
        divemaster: "Lena Cruz",
        operator: "AquaVenture",
      },
      {
        date: "2026-06-20",
        site: "Turtle Bay",
        depth: "8 m",
        divemaster: "Kai Reyes",
        operator: "Deep Blue Divers",
      },
      {
        date: "2026-06-28",
        site: "Coral Gardens",
        depth: "14 m",
        divemaster: "Marco Silva",
        operator: "Island Dive Co",
      },
    ],
    "TR-10260": [
      {
        date: "2026-07-16",
        site: "Shark Point",
        depth: "32 m",
        divemaster: "Kai Reyes",
        operator: "Deep Blue Divers",
      },
      {
        date: "2026-07-22",
        site: "Blue Hole",
        depth: "36 m",
        divemaster: "Lena Cruz",
        operator: "AquaVenture",
      },
      {
        date: "2026-07-28",
        site: "Manta Reef",
        depth: "28 m",
        divemaster: "Marco Silva",
        operator: "Island Dive Co",
      },
      {
        date: "2026-08-04",
        site: "Coral Gardens",
        depth: "20 m",
        divemaster: "Kai Reyes",
        operator: "Deep Blue Divers",
      },
      {
        date: "2026-08-11",
        site: "Turtle Bay",
        depth: "14 m",
        divemaster: "Lena Cruz",
        operator: "AquaVenture",
      },
    ],
  };

  const filtered = useMemo(() => {
    return visibleTourists.filter((t) => {
      if (search.status !== "All" && t.status !== search.status) return false;
      if (
        search.nationality !== "All" &&
        String(t.nationality ?? "").toLowerCase() !==
          search.nationality.toLowerCase()
      )
        return false;
      if (search.level !== "All" && t.level !== search.level) return false;
      // Unknown dates stay visible under every range filter.
      if (!inRange(t.registered)) return false;
      if (search.q) {
        const q = search.q.toLowerCase();
        if (
          !t.name.toLowerCase().includes(q) &&
          !t.id.toLowerCase().includes(q)
        )
          return false;
      }
      return true;
    });
  }, [
    visibleTourists,
    search.q,
    search.status,
    search.nationality,
    search.level,
    inRange,
  ]);

  // Filter options follow the visible rows: live distinct values when live,
  // mock constants otherwise (certification_level values are data-driven).
  // Derived from visibleTourists so the hidden staff row can't pollute them.
  const nationalityOptions = useMemo(
    () =>
      isLiveData
        ? [
            ...new Set(
              visibleTourists
                .map((t) => t.nationality)
                .filter((n): n is string => !!n),
            ),
          ].sort()
        : ALL_NATIONALITIES,
    [isLiveData, visibleTourists],
  );
  const levelOptions = useMemo(
    () =>
      isLiveData
        ? [
            ...new Set(
              visibleTourists
                .map((t) => t.level)
                .filter((l): l is string => !!l),
            ),
          ].sort()
        : ALL_LEVELS,
    [isLiveData, visibleTourists],
  );

  const {
    page: tPage,
    setPage: tSetPage,
    totalPages: tTotalPages,
    paged: tPaged,
  } = usePagination(filtered, 10);

  const activeFilters: { key: string; label: string }[] = [];
  if (search.status !== "All")
    activeFilters.push({ key: "status", label: `Status: ${search.status}` });
  if (search.nationality !== "All")
    activeFilters.push({
      key: "nationality",
      label: `Nationality: ${displayNationality(search.nationality)}`,
    });
  if (search.level !== "All")
    activeFilters.push({ key: "level", label: `Level: ${search.level}` });
  if (search.q)
    activeFilters.push({ key: "q", label: `Search: "${search.q}"` });

  const handleRemoveFilter = (key: string) => {
    if (key === "q") setFilters({ q: "" });
    else if (key === "status") setFilters({ status: "All" });
    else if (key === "nationality") setFilters({ nationality: "All" });
    else if (key === "level") setFilters({ level: "All" });
  };

  const suspendViewing = async () => {
    if (!viewing) return;
    if (!canAct) return deny();
    if (isLive && !(await requireLiveSession())) return;
    if (!!session?.userId && (viewing as any)._dbId === session.userId) {
      toast.error("Action not allowed", {
        description: "This is your own staff account.",
      });
      return;
    }
    const dbId = (viewing as any)._dbId as string | undefined;
    const toSuspended = viewing.status !== "Suspended";
    const nextStatus = toSuspended ? "Suspended" : "Active";
    // Live mode: persist to tourists (031 status + staff UPDATE).
    if (isLive && dbId) {
      setRowBusy("suspend");
      try {
        await setTouristStatus(dbId, toSuspended ? "suspended" : "active");
        invalidateTourists();
        setViewing({ ...viewing, status: nextStatus });
        pushAuditLog(
          `${toSuspended ? "Suspended" : "Reactivated"} tourist ${viewing.id}`,
        );
        toast.success(
          toSuspended ? "Tourist suspended" : "Tourist reactivated",
          { description: `${viewing.name} (${viewing.id})` },
        );
      } catch (e) {
        toast.error("Could not update tourist", {
          description: dbErrorMessage(e),
        });
      } finally {
        setRowBusy(null);
      }
      return;
    }
    setMockTourists((prev) =>
      prev.map((t) => (t.id === viewing.id ? { ...t, status: nextStatus } : t)),
    );
    setViewing({ ...viewing, status: nextStatus });
    pushAuditLog(
      `${toSuspended ? "Suspended" : "Reactivated"} tourist ${viewing.id}`,
    );
    toast.success(toSuspended ? "Tourist suspended" : "Tourist reactivated", {
      description: `${viewing.name} (${viewing.id})`,
    });
  };

  const renewViewing = async () => {
    if (!viewing) return;
    if (!canAct) return deny();
    if (isLive && !(await requireLiveSession())) return;
    if (!!session?.userId && (viewing as any)._dbId === session.userId) {
      toast.error("Action not allowed", {
        description: "This is your own staff account.",
      });
      return;
    }
    const dbId = (viewing as any)._dbId as string | undefined;
    // Live mode: extend renewal_date by one year from today.
    if (isLive && dbId) {
      setRowBusy("renew");
      try {
        const renewalDate = await renewTourist(dbId);
        invalidateTourists();
        setViewing({ ...viewing, expires: renewalDate, status: "Active" });
        pushAuditLog(
          `Renewed tourist ${viewing.id} — extends to ${renewalDate}`,
        );
        toast.success("Tourist ID renewed", {
          description: `${viewing.name} (${viewing.id}) — valid to ${renewalDate}`,
        });
      } catch (e) {
        toast.error("Could not renew tourist", {
          description: dbErrorMessage(e),
        });
      } finally {
        setRowBusy(null);
      }
      return;
    }
    const next = new Date();
    next.setFullYear(next.getFullYear() + 1);
    const renewalDate = next.toISOString().slice(0, 10);
    setMockTourists((prev) =>
      prev.map((t) =>
        t.id === viewing.id
          ? { ...t, expires: renewalDate, status: "Active" }
          : t,
      ),
    );
    setViewing({ ...viewing, expires: renewalDate, status: "Active" });
    pushAuditLog(`Renewed tourist ${viewing.id} — extends to ${renewalDate}`);
    toast.success("Tourist ID renewed", {
      description: `${viewing.name} (${viewing.id}) — valid to ${renewalDate}`,
    });
  };

  const handleExportCsv = () => {
    if (filtered.length === 0) return;
    const filename = `mabini-tourist-registry-${new Date().toISOString().slice(0, 10)}.csv`;
    const headers = [
      "Tourist ID",
      "Full Name",
      "Nationality",
      "Dive Certification Level",
      "Date Registered",
      "Expiry Date",
      "Status",
    ];
    const rows = filtered.map((t) => [
      t.id,
      t.name,
      t.nationality ?? "N/A",
      t.level ?? "N/A",
      t.registered ?? "N/A",
      t.expires ?? "N/A",
      t.status,
    ]);
    downloadCsv(filename, headers, rows);
    pushAuditLog(
      `Exported filtered tourist registry (${filtered.length} records) to CSV`,
    );
    toast.success("Tourist registry exported", {
      description: `Downloaded ${filtered.length} records as CSV.`,
    });
  };

  return (
    <div className="space-y-5">
      {/* Top Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <button
          type="button"
          onClick={() => {
            setFilters({ tab: "all", level: "All" });
          }}
          className="text-left w-full h-full transition-transform active:scale-[0.99]"
        >
          <StatCard
            icon={Users}
            label="Total Divers Registered"
            value={touristsSource.isLoading ? "—" : String(totalDivers)}
            delta="+14 this month"
            up={true}
          />
        </button>
        <button
          type="button"
          onClick={() => {
            setFilters({ tab: "pros" });
            setProStatus("All");
          }}
          className="text-left w-full h-full transition-transform active:scale-[0.99]"
        >
          <StatCard
            icon={Award}
            label="Dive Instructors / Masters"
            value={touristsSource.isLoading ? "—" : String(proCount)}
            delta="Certified dive leaders"
            up={true}
          />
        </button>
        <button
          type="button"
          onClick={() => {
            setFilters({ tab: "pros" });
            setProStatus("Verified");
          }}
          className="text-left w-full h-full transition-transform active:scale-[0.99]"
        >
          <StatCard
            icon={ShieldCheck}
            label="Verified Credentials"
            value={touristsSource.isLoading ? "—" : String(verifiedProCount)}
            delta="TO clearance active"
            up={true}
          />
        </button>
        <button
          type="button"
          onClick={() => {
            setFilters({ tab: "pros" });
            setProStatus("Pending");
          }}
          className="text-left w-full h-full transition-transform active:scale-[0.99]"
        >
          <StatCard
            icon={Clock}
            label="Pending Verification"
            value={touristsSource.isLoading ? "—" : String(pendingProCount)}
            delta={pendingProCount > 0 ? "Requires TO check" : "All cleared"}
            up={pendingProCount === 0}
          />
        </button>
      </div>

      {/* Tabs Layout */}
      <Tabs
        value={activeTab}
        onValueChange={(val) => setFilters({ tab: val })}
        className="space-y-4"
      >
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <TabsList className="grid w-full sm:w-auto grid-cols-2 max-w-md">
            <TabsTrigger value="all" className="gap-2 text-xs">
              <Users className="size-3.5" />
              All Divers & Tourists
              <Badge variant="secondary" className="ml-1 px-1.5 py-0 text-[10px]">
                {visibleTourists.length}
              </Badge>
            </TabsTrigger>
            <TabsTrigger value="pros" className="gap-2 text-xs">
              <Award className="size-3.5" />
              Dive Instructors / Masters
              <Badge
                variant="secondary"
                className="ml-1 px-1.5 py-0 text-[10px] bg-primary/10 text-primary font-semibold"
              >
                {proTourists.length}
              </Badge>
            </TabsTrigger>
          </TabsList>
        </div>

        {/* Tab 1: All Divers & Tourists */}
        <TabsContent value="all" className="space-y-4 mt-0">
          {/* Search & Filters */}
          <div className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <DataSourceBadge
            live={isLive}
            isError={liveTourists.isError}
            isLoading={touristsSource.isLoading}
          />
        </div>
        <div className="flex flex-col md:flex-row gap-3 md:items-center">
          <div className="relative flex-1 max-w-md">
            <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search by name or ID…"
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
              {["All", "Active", "Expired", "Suspended"].map((s) => (
                <SelectItem key={s} value={s}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={search.nationality}
            onValueChange={(v) => setFilters({ nationality: v })}
          >
            <SelectTrigger className="w-44">
              <SelectValue placeholder="Nationality" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="All">All nationalities</SelectItem>
              {nationalityOptions.map((n) => (
                <SelectItem key={n} value={n}>
                  {n}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={search.level}
            onValueChange={(v) => setFilters({ level: v })}
          >
            <SelectTrigger className="w-44">
              <SelectValue placeholder="Dive Level" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="All">All levels</SelectItem>
              {levelOptions.map((l) => (
                <SelectItem key={l} value={l}>
                  {l}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
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

      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <div>
          {touristsSource.isLoading
            ? "Loading tourists…"
            : `${filtered.length} of ${visibleTourists.length} tourist${
                visibleTourists.length !== 1 ? "s" : ""
              }`}
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleExportCsv}
          disabled={touristsSource.isLoading || filtered.length === 0}
          className="h-8 gap-1.5 text-xs"
        >
          <Download className="size-3.5" />
          Export CSV ({filtered.length})
        </Button>
      </div>

      <Card className="shadow-elegant overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-secondary/50">
              <TableHead>Tourist ID</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Nationality</TableHead>
              <TableHead>Dive Level</TableHead>
              <TableHead>Registered</TableHead>
              <TableHead>Expires</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {touristsSource.isLoading ? (
              <TableSkeletonRows rows={6} cols={7} />
            ) : filtered.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={7}
                  className="text-center py-8 text-muted-foreground"
                >
                  No tourists match the current filters.
                </TableCell>
              </TableRow>
            ) : (
              tPaged.map((t) => (
                <TableRow
                  key={t.id}
                  className="cursor-pointer hover:bg-muted/50 transition-colors"
                  onClick={() => setTouristDrilldown(t)}
                >
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    {t.id}
                  </TableCell>
                  <TableCell className="font-medium">{t.name}</TableCell>
                  <TableCell>{t.nationality ?? "—"}</TableCell>
                  <TableCell>{t.level ?? "—"}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {t.registered}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {t.expires}
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={t.status} />
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={(e) => {
                        e.stopPropagation();
                        setViewing(t);
                      }}
                    >
                      <Eye className="size-4 mr-1" /> View
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
        <Pagination
          page={tPage}
          totalPages={tTotalPages}
          onPageChange={tSetPage}
          className="mt-4"
        />
      </Card>
        </TabsContent>

        {/* Tab 2: Dive Professionals (Instructors & Divemasters) */}
        <TabsContent value="pros" className="space-y-4 mt-0">
          {/* Search & Filter Bar for Dive Professionals */}
          <div className="flex flex-col gap-3">
            <div className="flex flex-col md:flex-row gap-3 md:items-center">
              <div className="relative flex-1 max-w-md">
                <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search pro name, ID, PCSSD / PTO number, or dive shop…"
                  value={proSearch}
                  onChange={(e) => setProSearch(e.target.value)}
                  className="pl-9"
                />
              </div>

              {/* Credentials completeness filter */}
              <Select value={proDocFilter} onValueChange={setProDocFilter}>
                <SelectTrigger className="w-44">
                  <SelectValue placeholder="Guiding Credentials" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="All">All Guiding Credentials</SelectItem>
                  <SelectItem value="Complete">Complete Documents</SelectItem>
                  <SelectItem value="Missing Docs">Missing Documents</SelectItem>
                </SelectContent>
              </Select>

              {/* Verification status filter */}
              <Select value={proStatus} onValueChange={setProStatus}>
                <SelectTrigger className="w-44">
                  <SelectValue placeholder="TO Clearance" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="All">All Clearances</SelectItem>
                  <SelectItem value="Verified">Verified & Active</SelectItem>
                  <SelectItem value="Pending">Pending TO Review</SelectItem>
                  <SelectItem value="Suspended">Suspended</SelectItem>
                </SelectContent>
              </Select>

              {(proSearch || proDocFilter !== "All" || proStatus !== "All") && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setProSearch("");
                    setProDocFilter("All");
                    setProStatus("All");
                  }}
                  className="text-muted-foreground"
                >
                  <X className="size-3.5 mr-1" /> Reset
                </Button>
              )}
            </div>
          </div>

          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <div>
              {touristsSource.isLoading
                ? "Loading professionals…"
                : `Showing ${filteredPros.length} of ${proTourists.length} dive instructor / master${
                    proTourists.length !== 1 ? "s" : ""
                  }`}
            </div>
          </div>

          <Card className="shadow-elegant overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-secondary/50">
                  <TableHead>Pro ID</TableHead>
                  <TableHead>Professional Name</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Accreditation Numbers</TableHead>
                  <TableHead>Affiliated Dive Center</TableHead>
                  <TableHead>Guiding Credentials</TableHead>
                  <TableHead>Municipal Dive Pass</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {touristsSource.isLoading ? (
                  <TableSkeletonRows rows={6} cols={8} />
                ) : filteredPros.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={8}
                      className="text-center py-8 text-muted-foreground"
                    >
                      No dive instructors or dive masters match the selected filters.
                    </TableCell>
                  </TableRow>
                ) : (
                  pPaged.map((pro) => {
                    const isInstructor = String(pro.level || "")
                      .toLowerCase()
                      .includes("instructor");
                    return (
                      <TableRow
                        key={pro.id}
                        className="cursor-pointer hover:bg-muted/50 transition-colors"
                        onClick={() => setViewingPro(pro)}
                      >
                        <TableCell className="font-mono text-xs text-muted-foreground">
                          {pro.id}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-foreground">
                              {pro.name}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              ({pro.nationality ?? "—"})
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-primary/10 text-primary border border-primary/25">
                            <Award className="size-3" />
                            Dive Instructor / Master
                          </span>
                        </TableCell>
                        <TableCell>
                          <div className="text-xs space-y-0.5">
                            <div className="flex items-center gap-1 font-mono text-[11px]">
                              <span className="text-muted-foreground font-semibold">PCSSD:</span>
                              <span className="text-foreground">{((pro as any).pcssd_accreditation_no || (pro as any).pcssd_number) || "—"}</span>
                            </div>
                            <div className="flex items-center gap-1 font-mono text-[11px]">
                              <span className="text-muted-foreground font-semibold">PTO:</span>
                              <span className="text-foreground">{((pro as any).permit_to_operate_no || (pro as any).pto_number) || "—"}</span>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <Building2 className="size-3 shrink-0" />
                            {(pro as any).affiliated_operator || "Freelance / Unaffiliated"}
                          </span>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span
                              className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium border ${
                                Boolean(((pro as any).pcssd_url || (pro as any).pcssd_certificate_url))
                                  ? "bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/40 dark:text-sky-300 dark:border-sky-800"
                                  : "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800"
                              }`}
                              title={Boolean(((pro as any).pcssd_url || (pro as any).pcssd_certificate_url)) ? "PCSSD Certificate attached" : "Missing PCSSD Certificate"}
                            >
                              <ShieldCheck className="size-2.5" />
                              PCSSD
                              {Boolean(((pro as any).pcssd_url || (pro as any).pcssd_certificate_url)) ? (
                                <Check className="size-2.5" />
                              ) : (
                                <span className="text-[9px] font-bold">!</span>
                              )}
                            </span>

                            <span
                              className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium border ${
                                Boolean(((pro as any).permit_to_operate_url || (pro as any).pto_url))
                                  ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800"
                                  : "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800"
                              }`}
                              title={Boolean(((pro as any).permit_to_operate_url || (pro as any).pto_url)) ? "Municipal Permit attached" : "Missing Municipal Permit"}
                            >
                              <FileText className="size-2.5" />
                              PTO
                              {Boolean(((pro as any).permit_to_operate_url || (pro as any).pto_url)) ? (
                                <Check className="size-2.5" />
                              ) : (
                                <span className="text-[9px] font-bold">!</span>
                              )}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          {(pro as any).dive_pass_type === "annual" ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/30">
                              <Award className="size-3" />
                              Annual Pass
                              <span className="text-[10px] text-muted-foreground font-normal ml-0.5">({pro.expires || "1 Yr"})</span>
                            </span>
                          ) : (pro as any).dive_pass_type === "one-day" ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-sky-700 dark:text-sky-300 bg-sky-500/10 px-2 py-0.5 rounded border border-sky-500/30">
                              <Waves className="size-3" />
                              One-Day Pass
                            </span>
                          ) : pro.pro_verified ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-600 dark:text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/30">
                              <Clock className="size-3" />
                              Verified (No Pass)
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground bg-muted/50 px-2 py-0.5 rounded border border-border">
                              <Clock className="size-3" />
                              Pending Review
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-right space-x-1.5">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 text-xs gap-1 hover:bg-primary/10 hover:text-primary"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedProDocIdx(0);
                              setViewingPro(pro);
                            }}
                          >
                            <Eye className="size-3.5" /> Credentials
                          </Button>
                          <Button
                            size="sm"
                            variant={pro.pro_verified ? "outline" : "default"}
                            disabled={verifyingPro || (!pro.pro_verified && !isProEligible(pro))}
                            title={
                              !pro.pro_verified && !isProEligible(pro)
                                ? "Both PCSSD Accreditation and Municipal Permit to Operate documents are required to verify"
                                : undefined
                            }
                            className={`h-8 text-xs font-medium ${
                              pro.pro_verified
                                ? "border-border text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                                : isProEligible(pro)
                                  ? "bg-success text-success-foreground hover:opacity-90"
                                  : "bg-muted text-muted-foreground cursor-not-allowed opacity-50"
                            }`}
                            onClick={(e) => {
                              e.stopPropagation();
                              void toggleVerifyPro(pro);
                            }}
                          >
                            {pro.pro_verified ? (
                              "Revoke"
                            ) : (
                              <>
                                <Check className="size-3.5 mr-1" /> Verify
                              </>
                            )}
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
            <Pagination
              page={pPage}
              totalPages={pTotalPages}
              onPageChange={pSetPage}
              className="mt-4"
            />
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={!!viewing} onOpenChange={(o) => !o && setViewing(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Tourist Profile</DialogTitle>
          </DialogHeader>
          {viewing && (
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <Avatar className="size-14">
                  <AvatarFallback className="bg-primary text-primary-foreground">
                    {viewing.name
                      .split(" ")
                      .map((n: string) => n[0])
                      .join("")}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <div className="font-display text-lg font-semibold">
                    {viewing.name}
                  </div>
                  <div className="text-xs text-muted-foreground font-mono">
                    {viewing.id}
                  </div>
                </div>
                <StatusBadge status={viewing.status} />
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <Field label="Nationality" value={viewing.nationality ?? "—"} />
                <Field label="Type of Dive" value={(viewing as any).type_of_dive || "Certified"} />
                <Field label="Dive Level" value={(viewing as any).diver_type || viewing.level || "—"} />
                <Field label="Registered" value={viewing.registered} />
                <Field label="ID Expires" value={viewing.expires} />
                <Field
                  label="Emergency Contact"
                  value={
                    (viewing as any).emergency_contact_name ? (
                      <div>
                        <div className="font-semibold text-foreground">
                          {(viewing as any).emergency_contact_name}
                        </div>
                        {(viewing as any).emergency_contact_phone && (
                          <a
                            href={`tel:${(viewing as any).emergency_contact_phone}`}
                            className="text-xs text-primary hover:underline font-mono"
                          >
                            {(viewing as any).emergency_contact_phone}
                          </a>
                        )}
                      </div>
                    ) : (
                      "—"
                    )
                  }
                />
              </div>
              <div className="flex gap-2 pt-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  disabled={
                    rowBusy !== null ||
                    (!!session?.userId &&
                      (viewing as any)._dbId === session.userId)
                  }
                  title={
                    !!session?.userId &&
                    (viewing as any)._dbId === session.userId
                      ? "This is your own staff account — status writes don't apply"
                      : undefined
                  }
                  onClick={suspendViewing}
                >
                  {rowBusy === "suspend" ? (
                    <Loader2 className="size-4 mr-1 animate-spin" />
                  ) : null}
                  {viewing.status === "Suspended" ? "Reactivate" : "Suspend"}
                </Button>
                <Button
                  className="flex-1 gradient-primary text-primary-foreground"
                  disabled={
                    rowBusy !== null ||
                    (!!session?.userId &&
                      (viewing as any)._dbId === session.userId)
                  }
                  title={
                    !!session?.userId &&
                    (viewing as any)._dbId === session.userId
                      ? "This is your own staff account — renewal doesn't apply"
                      : undefined
                  }
                  onClick={renewViewing}
                >
                  {rowBusy === "renew" ? (
                    <Loader2 className="size-4 mr-1 animate-spin" />
                  ) : null}
                  Renew ID
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>


      {/* Dive Professional Credential Dossier Modal */}
      <Dialog open={!!viewingPro} onOpenChange={(o) => !o && setViewingPro(null)}>
        <DialogContent className="max-w-3xl max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center justify-between gap-3 pr-6">
              <DialogTitle className="text-xl font-bold flex items-center gap-2">
                <Award className="size-5 text-primary" />
                {viewingPro?.name}
              </DialogTitle>
              <StatusBadge status={viewingPro?.status || "Active"} />
            </div>
            <DialogDescription className="text-xs text-muted-foreground flex items-center gap-3 mt-1">
              <span>Eco-Dive ID: <strong className="font-mono text-foreground">{viewingPro?.id}</strong></span>
              <span>•</span>
              <span>Nationality: <strong className="text-foreground">{viewingPro?.nationality || "—"}</strong></span>
            </DialogDescription>
          </DialogHeader>

          {viewingPro && (() => {
            const hasPcssd = Boolean(
              (viewingPro as any).pcssd_number &&
                (viewingPro as any).pcssd_certificate_url,
            );
            const hasPto = Boolean(
              (viewingPro as any).pto_number && (viewingPro as any).pto_url,
            );

            const proDocs = [
              {
                id: "pcssd",
                title: "PCSSD Accreditation",
                shortTitle: "PCSSD Accreditation",
                type: "Mandatory Safety Accreditation",
                numberLabel: "PCSSD Accreditation Number",
                number: (viewingPro as any).pcssd_accreditation_no || (viewingPro as any).pcssd_number,
                url: (viewingPro as any).pcssd_url || (viewingPro as any).pcssd_certificate_url || null,
                desc: "Philippine Commission on Sports Scuba Diving standard accredited certification.",
                icon: ShieldCheck,
                mandatory: true,
              },
              {
                id: "pto",
                title: "Municipal Permit to Operate",
                shortTitle: "Permit to Operate (PTO)",
                type: "LGU Guiding Clearance",
                numberLabel: "Permit to Operate Number",
                number: (viewingPro as any).permit_to_operate_no || (viewingPro as any).pto_number,
                url: (viewingPro as any).permit_to_operate_url || (viewingPro as any).pto_url || null,
                desc: "Mabini Municipal Permit to Operate for Scuba Diving Guiding & Instruction.",
                icon: FileText,
                mandatory: true,
              },
            ];

            const activeDoc = proDocs[selectedProDocIdx] || proDocs[0];
            const uploadedCount = proDocs.filter(d => Boolean(d.url)).length;

            return (
              <div className="space-y-4 py-2">
                {/* Step 1: Personal Info & Emergency Contact Card */}
                <div className="rounded-lg border bg-secondary/30 p-3.5 space-y-2.5 text-xs">
                  <div className="flex items-center justify-between border-b border-border/60 pb-2">
                    <div className="flex items-center gap-2">
                      <User className="size-3.5 text-primary" />
                      <span className="font-semibold text-foreground uppercase tracking-wider text-[11px]">
                        Diver Profile & Emergency Details
                      </span>
                    </div>
                    <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                      <CheckCircle2 className="size-3" /> Privacy Consent Acknowledged
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div>
                      <span className="text-muted-foreground block text-[11px]">Full Name</span>
                      <span className="font-semibold text-foreground mt-0.5 block truncate">
                        {viewingPro.name}
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground block text-[11px]">Nationality</span>
                      <span className="font-medium text-foreground mt-0.5 block truncate">
                        {viewingPro.nationality || "—"}
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground block text-[11px]">Emergency Contact</span>
                      <span className="font-semibold text-foreground mt-0.5 block truncate">
                        {(viewingPro as any).emergency_contact_name || "—"}
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground block text-[11px]">Emergency Phone (+63)</span>
                      {(viewingPro as any).emergency_contact_phone || (viewingPro as any).emergency_contact_number ? (
                        <a
                          href={`tel:${(viewingPro as any).emergency_contact_phone}`}
                          className="font-mono text-primary hover:underline mt-0.5 flex items-center gap-1 font-semibold truncate"
                        >
                          <Phone className="size-3 shrink-0" />
                          {(viewingPro as any).emergency_contact_phone || (viewingPro as any).emergency_contact_number}
                        </a>
                      ) : (
                        <span className="text-muted-foreground mt-0.5 block">—</span>
                      )}
                    </div>
                  </div>

                  {/* Step 2: Dive Credentials Classification */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 border-t border-border/50">
                    <div>
                      <span className="text-muted-foreground block text-[11px]">Type of Dive</span>
                      <span className="font-semibold text-foreground mt-0.5 block">
                        {(viewingPro as any).type_of_dive || "Certified"}
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground block text-[11px]">Type of Diver</span>
                      <span className="font-semibold text-foreground mt-0.5 block">
                        {(viewingPro as any).diver_type || viewingPro.level || "Dive Master / Instructor"}
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground block text-[11px]">Accredited Since</span>
                      {(viewingPro as any).dateAccredited ? (
                        <span className="font-medium text-foreground mt-0.5 flex items-center gap-1">
                          <CheckCircle2 className="size-3 text-emerald-600 dark:text-emerald-400 shrink-0" />
                          {(viewingPro as any).dateAccredited}
                        </span>
                      ) : viewingPro.pro_verified ? (
                        <span className="text-sky-600 dark:text-sky-400 font-medium text-xs mt-0.5 flex items-center gap-1">
                          <Clock className="size-3 shrink-0" />
                          Verified (Pass unissued)
                        </span>
                      ) : (
                        <span className="text-amber-600 dark:text-amber-400 font-medium text-xs mt-0.5 flex items-center gap-1">
                          <Clock className="size-3 shrink-0" />
                          Not yet accredited
                        </span>
                      )}
                    </div>
                    <div>
                      <span className="text-muted-foreground block text-[11px]">Municipal Dive Pass</span>
                      {(viewingPro as any).dive_pass_type ? (
                        <span className="font-semibold text-foreground mt-0.5 flex items-center gap-1">
                          <Badge variant="outline" className="border-emerald-500/40 text-emerald-700 dark:text-emerald-300 bg-emerald-500/10 text-[10px] py-0 px-1.5 font-semibold">
                            {(viewingPro as any).dive_pass_type === "annual" ? "Annual Pass" : "One-Day Pass"}
                          </Badge>
                          <span className="text-[10px] text-muted-foreground font-normal">
                            (Exp: {viewingPro.expires || "—"})
                          </span>
                        </span>
                      ) : (
                        <span className="text-amber-600 dark:text-amber-400 font-medium text-xs mt-0.5 block">
                          No pass issued
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Step 3: Mandatory Guiding Accreditations Selector */}
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                      <ShieldCheck className="size-3.5 text-primary" />
                      Guiding Accreditations (PCSSD &amp; Permit to Operate)
                    </span>
                    <Badge variant={uploadedCount >= 2 ? "secondary" : "outline"} className="text-[11px]">
                      {uploadedCount} of {proDocs.length} files attached
                    </Badge>
                  </div>

                  <div className="grid grid-cols-2 gap-2.5">
                    {proDocs.map((doc, idx) => {
                      const isSelected = idx === selectedProDocIdx;
                      const hasDocFile = Boolean(doc.url);
                      const hasDocNum = Boolean(doc.number && doc.number !== "Pending Submission");
                      const Icon = doc.icon;
                      return (
                        <button
                          key={doc.id}
                          type="button"
                          onClick={() => setSelectedProDocIdx(idx)}
                          className={`p-2.5 rounded-lg border text-left transition-all ${
                            isSelected
                              ? "border-primary bg-primary/10 shadow-sm ring-1 ring-primary/40"
                              : "border-border/70 hover:bg-muted/50 bg-card"
                          }`}
                        >
                          <div className="flex items-center justify-between gap-1 mb-1">
                            <span className="text-xs font-semibold text-foreground flex items-center gap-1.5 truncate">
                              <Icon className="size-3.5 shrink-0 text-primary" />
                              {doc.shortTitle}
                            </span>
                            {hasDocFile && hasDocNum ? (
                              <CheckCircle2 className="size-3.5 text-success shrink-0" />
                            ) : (
                              <AlertTriangle className="size-3.5 text-amber-500 shrink-0" />
                            )}
                          </div>
                          <div className="flex items-center justify-between text-[10px] gap-1">
                            <span className="text-muted-foreground truncate font-mono">
                              {doc.number ? `No: ${doc.number}` : "Missing Number"}
                            </span>
                            {hasDocFile ? (
                              <span className="inline-flex items-center gap-0.5 text-[9px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded shrink-0">
                                <FileCheck2 className="size-2.5" /> File Attached
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-0.5 text-[9px] font-semibold text-amber-600 dark:text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded shrink-0">
                                <AlertTriangle className="size-2.5" /> Missing File
                              </span>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Document Inspection & Photo Display Card */}
                {activeDoc && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="text-xs font-bold text-foreground flex items-center gap-1.5">
                          <activeDoc.icon className="size-3.5 text-primary" />
                          {activeDoc.title}
                        </h4>
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                          {activeDoc.desc}
                        </p>
                      </div>

                      {activeDoc.number ? (
                        <Badge variant="outline" className="font-mono text-xs">
                          {activeDoc.number}
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-[11px] border-amber-500/40 text-amber-600 dark:text-amber-400 bg-amber-500/10">
                          Missing Document Number
                        </Badge>
                      )}
                    </div>

                    <DocumentViewer
                      url={activeDoc.url}
                      title={`${viewingPro.name} — ${activeDoc.title}`}
                      desc={activeDoc.desc}
                      bucket="tourist_uploads"
                      maxHeight="320px"
                      onZoom={(resolved: string) => setZoomedProPhoto(resolved)}
                    />
                  </div>
                )}

                {/* Verification Requirements Status Callout */}
                <div className="rounded-lg bg-secondary/40 border border-border/80 p-3 text-xs text-muted-foreground">
                  <span className="font-semibold text-foreground block mb-0.5">
                    Mabini Guiding Accreditation Standards:
                  </span>
                  Dive Masters and Instructors leading dives in Mabini waters must hold an accredited PCSSD Certification and a valid Municipal Permit to Operate (PTO) under Municipal Marine Conservation regulations.
                </div>
              </div>
            );
          })()}
          <DialogFooter className="flex items-center justify-between sm:justify-between border-t pt-3">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setViewingPro(null)}
            >
              Close
            </Button>

            {viewingPro && (
              <div className="flex flex-col sm:flex-row items-end sm:items-center gap-2">
                {!viewingPro.pro_verified && !isProEligible(viewingPro) && (
                  <p className="text-[11px] text-amber-600 dark:text-amber-400 flex items-center gap-1 mr-1">
                    <AlertTriangle className="size-3.5 shrink-0" />
                    {!Boolean((viewingPro as any).pcssd_number && (viewingPro as any).pcssd_certificate_url) && !Boolean((viewingPro as any).pto_number && (viewingPro as any).pto_url)
                      ? "PCSSD Accreditation and Municipal Permit to Operate (PTO) are both required to verify."
                      : !Boolean((viewingPro as any).pcssd_number && (viewingPro as any).pcssd_certificate_url)
                        ? "PCSSD Accreditation number & certificate are required to verify."
                        : "Municipal Permit to Operate (PTO) number & document are required to verify."}
                  </p>
                )}
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const p = viewingPro;
                      setViewingPro(null);
                      setTouristDrilldown(p);
                    }}
                    className="text-xs gap-1"
                  >
                    <Waves className="size-3.5" />
                    View Dive History
                  </Button>

                  {/* Step 1: Verify Pro Credentials */}
                  <Button
                    type="button"
                    size="sm"
                    disabled={verifyingPro || (!viewingPro.pro_verified && !isProEligible(viewingPro))}
                    variant={viewingPro.pro_verified ? "outline" : "default"}
                    className={`text-xs font-semibold gap-1.5 ${
                      viewingPro.pro_verified
                        ? "border-destructive/30 text-destructive hover:bg-destructive/10"
                        : isProEligible(viewingPro)
                          ? "bg-primary text-primary-foreground hover:opacity-90"
                          : "bg-muted text-muted-foreground cursor-not-allowed opacity-60"
                    }`}
                    onClick={() => void toggleVerifyPro(viewingPro)}
                    title={
                      !viewingPro.pro_verified && !isProEligible(viewingPro)
                        ? "Both PCSSD Accreditation and Municipal Permit to Operate documents are required to verify."
                        : undefined
                    }
                  >
                    {verifyingPro ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : viewingPro.pro_verified ? (
                      "Revoke Verification"
                    ) : (
                      <>
                        <Check className="size-3.5" /> Verify Pro Credentials
                      </>
                    )}
                  </Button>

                  {/* Step 2: Issue Dive Pass (Separate Action) */}
                  {viewingPro.pro_verified && (
                    <div className="flex items-center gap-1.5">
                      <Button
                        type="button"
                        size="sm"
                        disabled={issuingPass}
                        className="bg-success text-success-foreground hover:opacity-90 text-xs font-semibold gap-1.5 shadow-sm"
                        onClick={() => promptIssueDivePass(viewingPro, "annual")}
                        title="Issue or renew 1-Year Municipal Annual Dive Pass"
                      >
                        {issuingPass ? (
                          <Loader2 className="size-3.5 animate-spin" />
                        ) : (
                          <Award className="size-3.5" />
                        )}
                        {(viewingPro as any).dive_pass_type === "annual" ? "Renew Annual Pass" : "Issue Annual Pass"}
                      </Button>

                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={issuingPass}
                        className="text-xs font-medium gap-1 text-foreground hover:bg-muted"
                        onClick={() => promptIssueDivePass(viewingPro, "one-day")}
                        title="Issue One-Day Municipal Dive Pass"
                      >
                        <Waves className="size-3" />
                        One-Day Pass
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Guiding Accreditation Photo Zoom Lightbox */}
      <Dialog
        open={!!zoomedProPhoto}
        onOpenChange={(o) => !o && setZoomedProPhoto(null)}
      >
        <DialogContent className="max-w-3xl p-2 bg-background/95 backdrop-blur-md">
          <DialogHeader className="px-3 pt-2">
            <DialogTitle className="text-sm font-semibold flex items-center gap-2">
              <Award className="size-4 text-primary" />
              {viewingPro?.name} — Guiding Accreditation Document Photo
            </DialogTitle>
          </DialogHeader>
          <div className="max-h-[80vh] overflow-auto p-2 flex items-center justify-center bg-black/5 dark:bg-black/50 rounded-lg">
            {zoomedProPhoto &&
              (isPdfUrl(zoomedProPhoto) ? (
                <iframe
                  src={`${zoomedProPhoto}#toolbar=1`}
                  title="Guiding Accreditation Document"
                  className="w-full h-[75vh] rounded border-0"
                />
              ) : (
                <img
                  src={zoomedProPhoto}
                  alt="Guiding Accreditation Document Photo"
                  className="max-h-[75vh] w-auto max-w-full object-contain rounded"
                />
              ))}
          </div>
          <div className="flex justify-end px-3 pb-2 pt-1">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setZoomedProPhoto(null)}
            >
              Close Zoom
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Confirmation Modal for Issuing or Renewing a Dive Pass / ID */}
      <Dialog
        open={!!confirmPassAction}
        onOpenChange={(o) => {
          if (!o && !issuingPass && rowBusy !== "renew") {
            setConfirmPassAction(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-sm p-6 rounded-3xl border bg-card text-card-foreground shadow-2xl z-[70]">
          {confirmPassAction && (() => {
            const isBusy = issuingPass || rowBusy === "renew";
            const { type, passType, tourist } = confirmPassAction;
            const isProAnnual = passType === "annual";
            const isProOneDay = passType === "one-day";
            const isRenewPro = type === "renew-pro";
            const isRenewTourist = type === "renew-tourist";

            let title = "Confirm Dive Pass";
            let confirmLabel = "Confirm";
            let confirmBtnClass = "bg-primary hover:bg-primary/90 text-primary-foreground";

            if (isRenewPro) {
              title = "Renew Annual Pass";
              confirmLabel = "Renew Annual Pass";
              confirmBtnClass = "bg-emerald-600 hover:bg-emerald-700 text-white";
            } else if (isProAnnual) {
              title = "Issue Annual Pass";
              confirmLabel = "Issue Annual Pass";
              confirmBtnClass = "bg-emerald-600 hover:bg-emerald-700 text-white";
            } else if (isProOneDay) {
              title = "Issue One-Day Pass";
              confirmLabel = "Issue One-Day Pass";
              confirmBtnClass = "bg-sky-600 hover:bg-sky-700 text-white";
            } else if (isRenewTourist) {
              title = "Renew Eco-Dive ID";
              confirmLabel = "Renew ID";
              confirmBtnClass = "gradient-primary text-primary-foreground";
            }

            return (
              <div className="flex flex-col items-center text-center pt-2">
                {/* Circular Icon Badge */}
                <div
                  className={`size-16 rounded-full flex items-center justify-center mb-4 transition-transform ${
                    isProAnnual
                      ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400 ring-8 ring-emerald-500/10"
                      : isProOneDay
                      ? "bg-sky-50 text-sky-600 dark:bg-sky-950/60 dark:text-sky-400 ring-8 ring-sky-500/10"
                      : "bg-primary/10 text-primary ring-8 ring-primary/5"
                  }`}
                >
                  {isProAnnual ? (
                    <Award className="size-8" />
                  ) : isProOneDay ? (
                    <Waves className="size-8" />
                  ) : (
                    <RefreshCw className="size-8" />
                  )}
                </div>

                <DialogTitle className="text-xl font-bold text-foreground mb-2">
                  {title}
                </DialogTitle>

                <DialogDescription className="text-sm text-muted-foreground leading-relaxed max-w-xs mb-6">
                  {type === "renew-tourist" ? (
                    <>
                      Are you sure you want to renew the Eco-Dive ID for{" "}
                      <strong className="text-foreground font-semibold">
                        {tourist.name}
                      </strong>{" "}
                      for another 1 year?
                    </>
                  ) : isRenewPro ? (
                    <>
                      Are you sure you want to renew the Municipal Annual Dive Pass for{" "}
                      <strong className="text-foreground font-semibold">
                        {tourist.name}
                      </strong>{" "}
                      for another 1 year?
                    </>
                  ) : isProAnnual ? (
                    <>
                      Are you sure you want to issue an Annual Dive Pass (valid for 1 year) to{" "}
                      <strong className="text-foreground font-semibold">
                        {tourist.name}
                      </strong>
                      ?
                    </>
                  ) : (
                    <>
                      Are you sure you want to issue a One-Day Municipal Dive Pass to{" "}
                      <strong className="text-foreground font-semibold">
                        {tourist.name}
                      </strong>
                      ?
                    </>
                  )}
                </DialogDescription>

                {/* Action Buttons */}
                <div className="flex items-center gap-3 w-full">
                  <Button
                    type="button"
                    variant="outline"
                    disabled={isBusy}
                    className="flex-1 h-11 rounded-xl text-sm font-semibold border-border/80 hover:bg-muted"
                    onClick={() => setConfirmPassAction(null)}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="button"
                    disabled={isBusy}
                    className={`flex-1 h-11 rounded-xl text-sm font-semibold shadow-sm ${confirmBtnClass}`}
                    onClick={() => void executeConfirmedPassAction()}
                  >
                    {isBusy ? (
                      <Loader2 className="size-4 animate-spin mr-1.5" />
                    ) : null}
                    {confirmLabel}
                  </Button>
                </div>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>

      <DrilldownDialog
        open={!!touristDrilldown}
        onOpenChange={(o) => !o && setTouristDrilldown(null)}
        title={`${touristDrilldown?.name ?? ""} — Dive History`}
        subtitle={`${touristDrilldown?.nationality ?? "—"} · ${touristDrilldown?.level ?? "—"}`}
        stats={
          touristDrilldown
            ? [
                {
                  label: "Total Dives",
                  value: touristDiveHistory[touristDrilldown.id]?.length ?? 0,
                  icon: Waves,
                },
                {
                  label: "Tourist ID",
                  value: touristDrilldown.id,
                  icon: Users,
                },
                {
                  label: "Status",
                  value: touristDrilldown.status,
                  icon: ShieldCheck,
                },
              ]
            : undefined
        }
      >
        {touristDrilldown && (
          <Card className="shadow-elegant overflow-hidden mt-2">
            <Table>
              <TableHeader>
                <TableRow className="bg-secondary/50">
                  <TableHead>Date</TableHead>
                  <TableHead>Site</TableHead>
                  <TableHead>Depth</TableHead>
                  <TableHead>Divemaster</TableHead>
                  <TableHead>Operator</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(touristDiveHistory[touristDrilldown.id] ?? []).length ===
                0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={5}
                      className="text-center py-6 text-muted-foreground"
                    >
                      No dive history recorded for this tourist.
                    </TableCell>
                  </TableRow>
                ) : (
                  (touristDiveHistory[touristDrilldown.id] ?? []).map(
                    (dive, i) => (
                      <TableRow key={i}>
                        <TableCell className="font-mono text-xs">
                          {dive.date}
                        </TableCell>
                        <TableCell className="font-medium">
                          {dive.site}
                        </TableCell>
                        <TableCell>{dive.depth}</TableCell>
                        <TableCell className="text-muted-foreground">
                          {dive.divemaster}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {dive.operator}
                        </TableCell>
                      </TableRow>
                    ),
                  )
                )}
              </TableBody>
            </Table>
          </Card>
        )}
      </DrilldownDialog>
    </div>
  );
}


