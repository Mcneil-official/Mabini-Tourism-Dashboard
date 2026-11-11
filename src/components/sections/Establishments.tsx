import { DocumentViewer } from "@/components/DocumentViewer";
import { useState, useMemo, useEffect } from "react";
import {
  Building2,
  MapPin,
  User,
  ShieldCheck,
  RefreshCw,
  Ban,
  Mail,
  Phone,
  Calendar,
  CreditCard,
  AlertTriangle,
  CheckCircle2,
  Download,
  FileText,
  FileCheck2,
  Maximize2,
  ZoomIn,
  ExternalLink,
  Check,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  SectionCard,
  StatusBadge,
  Field,
  Reveal,
  TableSkeletonRows,
} from "@/components/shared";
import { MABINI_BARANGAYS } from "@/lib/barangays";
import {
  MOCK_BUSINESS_PERMIT_URL,
  MOCK_PCSSD_URL,
  MOCK_DOT_URL,
} from "@/lib/mock-docs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useFilters, pushAuditLog, DataSourceBadge } from "@/routes/index";
import { requireLiveSession } from "@/lib/staff-auth";
import {
  useLiveMode,
  useLiveList,
  useEstablishmentsLive,
  setEstablishmentSuspended,
  useInvalidateLive,
  dbErrorMessage,
  isPdfUrl,
} from "@/lib/queries";
import { toast } from "sonner";
import { downloadCsv } from "@/lib/export-utils";

type Establishment = {
  _dbId?: string;
  id: string;
  name: string;
  owner: string;
  address: string;
  barangay: string;
  permitNumber: string;
  permitType: string;
  permitExpiry: string;
  contactEmail: string;
  contactPhone: string;
  status: "Active" | "Suspended" | "Expired";
  dateRegistered: string;
  totalManifestos: number;
  rating: number;
  ecoRating: number;
  certifications: string[];
  assignedDiveSites: string[];
  creditBalance: number;
  website: string;
  facebook: string;
  business_permit_url?: string | null;
  pcss_url?: string | null;
  dot_accreditation_url?: string | null;
};

const ESTABLISHMENT_DATA: Establishment[] = [
  {
    id: "EST-001",
    name: "Deep Blue Charters",
    owner: "Rafael Magtibay",
    address: "14 Coastal Road, Barangay San Teodoro",
    barangay: "San Teodoro",
    permitNumber: "MMDR-2024-0812",
    permitType: "Dive Operator",
    permitExpiry: "2027-03-15",
    contactEmail: "rafael@deepbluecharters.ph",
    contactPhone: "+63 917 854 2301",
    status: "Active",
    dateRegistered: "2022-06-10",
    totalManifestos: 312,
    rating: 4.8,
    ecoRating: 92,
    certifications: [
      "PADI 5-Star",
      "Green Fins",
      "Sustainable Tourism Certified",
    ],
    assignedDiveSites: ["Blue Hole", "Shark Point", "Turtle Bay"],
    creditBalance: 2850,
    website: "https://deepbluecharters.ph",
    facebook: "https://facebook.com/deepbluecharters",
    business_permit_url: MOCK_BUSINESS_PERMIT_URL,
    pcss_url: MOCK_PCSSD_URL,
    dot_accreditation_url: MOCK_DOT_URL,
  },
  {
    id: "EST-002",
    name: "Reef Riders Co.",
    owner: "Carmina Villanueva",
    address: "7 Dive Center Lane, Barangay Solo",
    barangay: "Solo",
    permitNumber: "MMDR-2024-0933",
    permitType: "Dive Shop",
    permitExpiry: "2027-08-20",
    contactEmail: "info@reefriders.co",
    contactPhone: "+63 918 223 4567",
    status: "Active",
    dateRegistered: "2021-09-14",
    totalManifestos: 247,
    rating: 4.6,
    ecoRating: 88,
    certifications: ["SSI", "Green Fins"],
    assignedDiveSites: ["Coral Gardens", "Manta Reef"],
    creditBalance: 1920,
    website: "https://reefriders.co",
    facebook: "https://facebook.com/reefridersco",
    business_permit_url: MOCK_BUSINESS_PERMIT_URL,
    pcss_url: MOCK_PCSSD_URL,
    dot_accreditation_url: null,
  },
  {
    id: "EST-003",
    name: "Coral Coast Divers",
    owner: "Jun Bautista",
    address: "32 Marine Parade, Barangay Batas",
    barangay: "Batas",
    permitNumber: "MMDR-2023-0471",
    permitType: "Dive Operator",
    permitExpiry: "2026-01-30",
    contactEmail: "jun@coralcoastdivers.ph",
    contactPhone: "+63 920 112 7890",
    status: "Expired",
    dateRegistered: "2020-03-22",
    totalManifestos: 189,
    rating: 4.3,
    ecoRating: 76,
    certifications: ["PADI", "CMAS"],
    assignedDiveSites: ["Shark Point", "Loyzaga Wreck"],
    creditBalance: 580,
    website: "https://coralcoastdivers.ph",
    facebook: "https://facebook.com/coralcoastdivers",
  },
  {
    id: "EST-004",
    name: "Manta Expeditions",
    owner: "Sofia Reyes",
    address: "5 Waterfront Plaza, Barangay San Joaquin",
    barangay: "San Joaquin",
    permitNumber: "MMDR-2024-1102",
    permitType: "Dive Operator",
    permitExpiry: "2027-11-05",
    contactEmail: "sofia@mantaexpeditions.ph",
    contactPhone: "+63 917 665 0043",
    status: "Active",
    dateRegistered: "2023-01-18",
    totalManifestos: 156,
    rating: 4.9,
    ecoRating: 95,
    certifications: ["PADI 5-Star", "Green Fins", "Ocean Guardian"],
    assignedDiveSites: ["Manta Reef", "Blue Hole", "Sombrero Island Wall"],
    creditBalance: 2240,
    website: "https://mantaexpeditions.ph",
    facebook: "https://facebook.com/mantaexpeditions",
    business_permit_url: MOCK_BUSINESS_PERMIT_URL,
    pcss_url: MOCK_PCSSD_URL,
    dot_accreditation_url: MOCK_DOT_URL,
  },
  {
    id: "EST-005",
    name: "Turtle Bay Dive Shop",
    owner: "Antonio Cruz",
    address: "9 Tamarind Street, Barangay San Teodoro",
    barangay: "San Teodoro",
    permitNumber: "MMDR-2024-0287",
    permitType: "Dive Shop",
    permitExpiry: "2026-06-10",
    contactEmail: "tony@turtlebaydive.ph",
    contactPhone: "+63 918 443 2210",
    status: "Expired",
    dateRegistered: "2019-11-05",
    totalManifestos: 421,
    rating: 4.5,
    ecoRating: 85,
    certifications: ["SSI", "PADI", "Green Fins"],
    assignedDiveSites: ["Turtle Bay", "Sepoc Point"],
    creditBalance: 1450,
    website: "https://turtlebaydive.ph",
    facebook: "https://facebook.com/turtlebaydiveshop",
  },
  {
    id: "EST-006",
    name: "Bluefin Divers",
    owner: "Derek Lim",
    address: "20 Marina Drive, Barangay Solo",
    barangay: "Solo",
    permitNumber: "MMDR-2025-0018",
    permitType: "Dive Operator",
    permitExpiry: "2027-01-22",
    contactEmail: "derek@bluefindivers.ph",
    contactPhone: "+63 920 887 6654",
    status: "Active",
    dateRegistered: "2023-05-30",
    totalManifestos: 98,
    rating: 4.4,
    ecoRating: 80,
    certifications: ["PADI", "TDI"],
    assignedDiveSites: ["Maricaban Wreck", "Sombrero Island Wall"],
    creditBalance: 1120,
    website: "https://bluefindivers.ph",
    facebook: "https://facebook.com/bluefindivers",
  },
  {
    id: "EST-007",
    name: "Aqua Ventures PH",
    owner: "Mia Santos",
    address: "2 Coral Bay Road, Barangay Batas",
    barangay: "Batas",
    permitNumber: "MMDR-2024-0756",
    permitType: "Dive Shop",
    permitExpiry: "2026-09-18",
    contactEmail: "mia@aquaventures.ph",
    contactPhone: "+63 917 334 9988",
    status: "Active",
    dateRegistered: "2022-12-01",
    totalManifestos: 174,
    rating: 4.7,
    ecoRating: 90,
    certifications: ["SSI", "Green Fins", "Sustainable Tourism Certified"],
    assignedDiveSites: ["Coral Gardens", "Blue Hole", "Sepoc Point"],
    creditBalance: 1780,
    website: "https://aquaventures.ph",
    facebook: "https://facebook.com/aquaventuresph",
  },
  {
    id: "EST-008",
    name: "Apnea Island Charters",
    owner: "Gabriel Ong",
    address: "11 Harbour Street, Barangay San Joaquin",
    barangay: "San Joaquin",
    permitNumber: "MMDR-2024-0611",
    permitType: "Dive Operator",
    permitExpiry: "2027-04-28",
    contactEmail: "gab@apneaisland.ph",
    contactPhone: "+63 918 776 5543",
    status: "Active",
    dateRegistered: "2021-07-19",
    totalManifestos: 203,
    rating: 4.2,
    ecoRating: 72,
    certifications: ["PADI", "SDI"],
    assignedDiveSites: ["Loyzaga Wreck", "Twin Rocks"],
    creditBalance: 890,
    website: "https://apneaisland.ph",
    facebook: "https://facebook.com/apneaislandcharters",
  },
  {
    id: "EST-009",
    name: "Whale Shark Divers Inc.",
    owner: "Elena Pascual",
    address: "46 Mangrove Avenue, Barangay San Teodoro",
    barangay: "San Teodoro",
    permitNumber: "MMDR-2023-0199",
    permitType: "Dive Operator",
    permitExpiry: "2025-12-01",
    contactEmail: "elena@whalesharkdivers.ph",
    contactPhone: "+63 920 554 3321",
    status: "Suspended",
    dateRegistered: "2020-08-11",
    totalManifestos: 142,
    rating: 3.9,
    ecoRating: 65,
    certifications: ["PADI"],
    assignedDiveSites: ["Turtle Bay", "Coral Gardens"],
    creditBalance: 500,
    website: "https://whalesharkdivers.ph",
    facebook: "https://facebook.com/whalesharkdivers",
  },
  {
    id: "EST-010",
    name: "Pacific Reef Outfitters",
    owner: "Luis Navarro",
    address: "18 Baywalk Lane, Barangay Solo",
    barangay: "Solo",
    permitNumber: "MMDR-2024-1055",
    permitType: "Dive Shop",
    permitExpiry: "2028-02-14",
    contactEmail: "luis@pacificreef.ph",
    contactPhone: "+63 917 998 1234",
    status: "Active",
    dateRegistered: "2024-02-14",
    totalManifestos: 45,
    rating: 4.1,
    ecoRating: 78,
    certifications: ["SSI", "Green Fins"],
    assignedDiveSites: ["Sepoc Point", "Blue Hole"],
    creditBalance: 1340,
    website: "https://pacificreef.ph",
    facebook: "https://facebook.com/pacificreefoutfitters",
  },
  {
    id: "EST-011",
    name: "Tidepool Dive Center",
    owner: "Renata Gomez",
    address: "33 Reef Crest Road, Barangay Batas",
    barangay: "Batas",
    permitNumber: "MMDR-2024-0340",
    permitType: "Dive Operator",
    permitExpiry: "2026-11-25",
    contactEmail: "renata@tidepooldive.ph",
    contactPhone: "+63 918 112 8877",
    status: "Active",
    dateRegistered: "2022-04-09",
    totalManifestos: 231,
    rating: 4.6,
    ecoRating: 87,
    certifications: ["PADI", "Green Fins", "Ocean Guardian"],
    assignedDiveSites: ["Shark Point", "Manta Reef", "Twin Rocks"],
    creditBalance: 1650,
    website: "https://tidepooldive.ph",
    facebook: "https://facebook.com/tidepooldivecenter",
  },
  {
    id: "EST-012",
    name: "Nemo Dive Adventures",
    owner: "Patrick Dela Cruz",
    address: "8 Lagoon Court, Barangay San Joaquin",
    barangay: "San Joaquin",
    permitNumber: "MMDR-2025-0067",
    permitType: "Dive Shop",
    permitExpiry: "2025-09-30",
    contactEmail: "patrick@nemodive.ph",
    contactPhone: "+63 920 221 4455",
    status: "Suspended",
    dateRegistered: "2023-10-01",
    totalManifestos: 38,
    rating: 3.7,
    ecoRating: 61,
    certifications: ["SSI"],
    assignedDiveSites: ["Maricaban Wreck"],
    creditBalance: 720,
    website: "",
    facebook: "https://facebook.com/nemodiveadventures",
  },
];

const TODAY = new Date("2026-08-17");
function daysUntil(dateStr: string) {
  return Math.ceil(
    (new Date(dateStr).getTime() - TODAY.getTime()) / (1000 * 60 * 60 * 24),
  );
}
function ExpiryBadge({ dateStr }: { dateStr: string }) {
  const days = daysUntil(dateStr);
  if (days <= 0)
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-destructive/10 text-destructive border border-destructive/20 px-2 py-0.5 text-[10px] font-medium">
        <AlertTriangle className="size-3" />
        Expired
      </span>
    );
  if (days <= 30)
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-warning/15 text-warning-foreground border border-warning/30 px-2 py-0.5 text-[10px] font-medium">
        <AlertTriangle className="size-3" />
        Expiring in {days}d
      </span>
    );
  return null;
}
function PermitIndicator({ dateStr }: { dateStr: string }) {
  const days = daysUntil(dateStr);
  if (days <= 0)
    return (
      <span className="inline-flex items-center gap-1 text-destructive text-xs font-medium">
        <AlertTriangle className="size-3.5" />
        Expired
      </span>
    );
  if (days <= 30)
    return (
      <span className="inline-flex items-center gap-1 text-destructive text-xs font-medium">
        <AlertTriangle className="size-3.5" />
        {days}d remaining
      </span>
    );
  if (days <= 90)
    return (
      <span className="inline-flex items-center gap-1 text-warning text-xs font-medium">
        <AlertTriangle className="size-3.5" />
        {days}d remaining
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1 text-success text-xs font-medium">
      <CheckCircle2 className="size-3.5" />
      {days}d remaining
    </span>
  );
}
// Canonical 34-barangay list (src/lib/barangays.ts) shared with the
// dive-site form, so filters and data entry always offer the full set.
const BARANGAYS = MABINI_BARANGAYS;

// Live rows carry the DB subset; the view fills display-only mock fields
// (permit data, certifications, ratings) with neutral placeholders. Those
// sections stay visibly empty until permit management exists — never faked.
const toEstablishmentView = (e: any): Establishment => ({
  id: e.id,
  name: e.name,
  owner: e.owner ?? "Unknown owner",
  address: e.address ?? e.location ?? "—",
  barangay: e.barangay ?? "—",
  permitNumber: e.permitNumber ?? "—",
  permitType: e.permitType ?? "—",
  permitExpiry: e.permitExpiry ?? "—",
  contactEmail: e.contactEmail ?? "—",
  contactPhone: e.contactPhone ?? "—",
  status: e.status,
  dateRegistered: e.dateRegistered ?? "—",
  totalManifestos: e.totalManifestos ?? 0,
  rating: e.rating ?? 0,
  ecoRating: e.ecoRating ?? 0,
  certifications: e.certifications ?? [],
  assignedDiveSites: e.assignedDiveSites ?? [],
  creditBalance: e.creditBalance ?? 0,
  website: e.website ?? "",
  facebook: e.facebook ?? "",
  business_permit_url: e.business_permit_url ?? null,
  pcss_url: e.pcss_url ?? null,
  dot_accreditation_url: e.dot_accreditation_url ?? null,
  _dbId: e._dbId,
});

export function Establishments() {
  const { setFilters } = useFilters();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [barangayFilter, setBarangayFilter] = useState("All");
  const [detail, setDetail] = useState<Establishment | null>(null);
  const [selectedDocIdx, setSelectedDocIdx] = useState(0);
  const [zoomedDocPhoto, setZoomedDocPhoto] = useState<string | null>(null);

  const estDocs = detail
    ? [
        {
          id: "permit",
          title: "Business Permit",
          shortTitle: "Business Permit",
          type: "LGU Permit",
          desc: "Municipal business permit issued by the Local Government of Mabini.",
          url: detail.business_permit_url,
          icon: FileText,
        },
        {
          id: "pcssd",
          title: "PCSSD Accreditation",
          shortTitle: "PCSSD Accreditation",
          type: "Scuba Diving Safety",
          desc: "Philippine Commission on Sports Scuba Diving standard accredited certification.",
          url: detail.pcss_url,
          icon: ShieldCheck,
        },
        {
          id: "dot",
          title: "DOT Accreditation",
          shortTitle: "DOT Accreditation",
          type: "Tourism Standard",
          desc: "Department of Tourism primary tourism enterprise accreditation.",
          url: detail.dot_accreditation_url,
          icon: Building2,
        },
      ]
    : [];
  const selectedDoc = estDocs[selectedDocIdx] || estDocs[0];
  const uploadedDocCount = estDocs.filter((d) => Boolean(d.url)).length;
  const [suspendTarget, setSuspendTarget] = useState<Establishment | null>(
    null,
  );
  const [suspendReason, setSuspendReason] = useState("");
  const [mockData, setMockData] = useState(ESTABLISHMENT_DATA);
  // Live mode (Supabase configured): registry comes from establishments
  // (+ manifest/credit rollups); mocks are the offline fallback.
  const isLive = useLiveMode();
  const liveEstablishments = useEstablishmentsLive();
  const invalidateEst = useInvalidateLive();
  const establishmentsSource = useLiveList(
    isLive,
    liveEstablishments,
    mockData,
  );
  const establishmentRows = establishmentsSource.rows;
  const data = useMemo(
    () => establishmentRows.map(toEstablishmentView),
    [establishmentRows]
  );
  const [opBusy, setOpBusy] = useState<Record<string, boolean>>({});
  useEffect(() => {
    if (liveEstablishments.isError) {
      toast.error("Could not load live establishments", {
        description: "Showing demo data. Check the Supabase connection.",
      });
    }
  }, [liveEstablishments.isError]);

  const filtered = useMemo(() => {
    return data.filter((e) => {
      if (statusFilter !== "All" && e.status !== statusFilter) return false;
      if (barangayFilter !== "All" && e.barangay !== barangayFilter)
        return false;
      if (
        search &&
        !e.name.toLowerCase().includes(search.toLowerCase()) &&
        !e.owner.toLowerCase().includes(search.toLowerCase())
      )
        return false;
      return true;
    });
  }, [data, search, statusFilter, barangayFilter]);

  const stats = useMemo(
    () => ({
      total: data.length,
      active: data.filter((e) => e.status === "Active").length,
      suspended: data.filter((e) => e.status === "Suspended").length,
      expired: data.filter((e) => e.status === "Expired").length,
    }),
    [data],
  );

  // Filter always offers the full canonical set (empty results render the
  // no-data message), keeping it consistent with the dive-site form.
  const barangayOptions = BARANGAYS;

  async function handleSuspend() {
    if (!suspendTarget) return;
    if (suspendReason.trim().length < 5) {
      toast.error("Reason must be at least 5 characters.");
      return;
    }
    // Live mode: persist via accredited=false (035). The reason has no
    // column — it goes to the audit log only, stated not stored.
    const dbId = (suspendTarget as any)._dbId as string | undefined;
    if (isLive && dbId) {
      if (!(await requireLiveSession())) return;
      setOpBusy((b) => ({ ...b, [suspendTarget.id]: true }));
      try {
        await setEstablishmentSuspended(dbId, true, suspendTarget.name);
        invalidateEst();
        pushAuditLog(
          `Suspended establishment ${suspendTarget.name} — ${suspendReason.trim()}`
        );
        toast.success(`${suspendTarget.name} has been suspended.`);
        setSuspendTarget(null);
        setSuspendReason("");
      } catch (e) {
        toast.error("Could not suspend establishment", {
          description: dbErrorMessage(e),
        });
      } finally {
        setOpBusy((b) => ({ ...b, [suspendTarget.id]: false }));
      }
      return;
    }
    setMockData((prev) =>
      prev.map((e) =>
        e.id === suspendTarget.id ? { ...e, status: "Suspended" as const } : e,
      ),
    );
    pushAuditLog(
      `Suspended establishment ${suspendTarget.name} — ${suspendReason.trim()}`
    );
    toast.success(`${suspendTarget.name} has been suspended.`);
    setSuspendTarget(null);
    setSuspendReason("");
  }

  async function handleReactivate(est: Establishment) {
    const dbId = (est as any)._dbId as string | undefined;
    if (isLive && dbId) {
      if (!(await requireLiveSession())) return;
      setOpBusy((b) => ({ ...b, [est.id]: true }));
      try {
        await setEstablishmentSuspended(dbId, false, est.name);
        invalidateEst();
        pushAuditLog(`Reactivated establishment ${est.name}`);
        toast.success(`${est.name} has been reactivated.`);
      } catch (e) {
        toast.error("Could not reactivate establishment", {
          description: dbErrorMessage(e),
        });
      } finally {
        setOpBusy((b) => ({ ...b, [est.id]: false }));
      }
      return;
    }
    setMockData((prev) =>
      prev.map((e) =>
        e.id === est.id ? { ...e, status: "Active" as const } : e,
      ),
    );
    pushAuditLog(`Reactivated establishment ${est.name}`);
    toast.success(`${est.name} has been reactivated.`);
  }

  function handleRequestRenewal(est: Establishment) {
    toast.success(`Renewal request submitted for ${est.name}.`);
  }

  const handleExportCsv = () => {
    if (filtered.length === 0) return;
    const filename = `mabini-establishments-${new Date().toISOString().slice(0, 10)}.csv`;
    const headers = [
      "Establishment ID",
      "Business Name",
      "Owner",
      "Barangay",
      "Permit Number",
      "Permit Expiry",
      "Contact Email",
      "Contact Phone",
      "Total Manifestos",
      "Status",
    ];
    const rows = filtered.map((e) => [
      e.id,
      e.name,
      e.owner,
      e.barangay,
      e.permitNumber,
      e.permitExpiry,
      e.contactEmail,
      e.contactPhone,
      e.totalManifestos,
      e.status,
    ]);
    downloadCsv(filename, headers, rows);
    pushAuditLog(
      `Exported filtered establishments (${filtered.length} records) to CSV`,
    );
    toast.success("Establishment registry exported", {
      description: `Downloaded ${filtered.length} establishments as CSV.`,
    });
  };

  return (
    <div className="space-y-6">
      <Reveal>
        <div className="flex items-center gap-2 mb-3">
          <DataSourceBadge
            live={isLive}
            isError={liveEstablishments.isError}
            isLoading={establishmentsSource.isLoading}
          />
        </div>
        <SectionCard
          title="Registered Establishments"
          action={
            <div className="flex items-center gap-2">
              <Input
                placeholder="Search name or owner…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-[200px] h-8 text-sm"
              />
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[130px] h-8 text-sm">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="All">All Status</SelectItem>
                  <SelectItem value="Active">Active</SelectItem>
                  <SelectItem value="Suspended">Suspended</SelectItem>
                  <SelectItem value="Expired">Expired</SelectItem>
                </SelectContent>
              </Select>
              <Select value={barangayFilter} onValueChange={setBarangayFilter}>
                <SelectTrigger className="w-[150px] h-8 text-sm">
                  <SelectValue placeholder="Barangay" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="All">All Barangays</SelectItem>
                  {barangayOptions.map((b) => (
                    <SelectItem key={b} value={b}>
                      {b}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                variant="outline"
                size="sm"
                onClick={handleExportCsv}
                disabled={establishmentsSource.isLoading || filtered.length === 0}
                className="h-8 gap-1.5 text-xs shrink-0"
              >
                <Download className="size-3.5" />
                Export CSV ({filtered.length})
              </Button>
            </div>
          }
        >
          {establishmentsSource.isLoading ? (
            <div className="overflow-x-auto">
              <Table>
                <TableBody>
                  <TableSkeletonRows rows={6} cols={8} />
                </TableBody>
              </Table>
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground text-sm">
              No establishments match your filters.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Establishment</TableHead>
                    <TableHead>Owner</TableHead>
                    <TableHead>Barangay</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Permit Expiry</TableHead>
                    <TableHead className="text-center">Manifestos</TableHead>
                    <TableHead className="text-right">Credits</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((est) => (
                    <TableRow
                      key={est.id}
                      className="cursor-pointer hover:bg-muted/50 transition-colors"
                      onClick={() => setDetail(est)}
                    >
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="size-8 rounded-lg bg-primary-soft text-primary flex items-center justify-center shrink-0">
                            <Building2 className="size-4" />
                          </div>
                          <div>
                            <div className="font-medium text-sm">
                              {est.name}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {est.id}
                            </div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1 text-sm">
                          <User className="size-3 text-muted-foreground" />
                          {est.owner}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1 text-sm">
                          <MapPin className="size-3 text-muted-foreground" />
                          {est.barangay}
                        </div>
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={est.status} />
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          <span className="text-sm">{est.permitExpiry}</span>
                          <ExpiryBadge dateStr={est.permitExpiry} />
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <span className="flex items-center justify-center gap-1 text-sm">
                          <Calendar className="size-3 text-muted-foreground" />
                          {est.totalManifestos}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <span className="flex items-center justify-end gap-1 text-sm">
                          <CreditCard className="size-3 text-primary" />
                          {(est as any)._dbId ? "₱" : "$"}
                          {est.creditBalance.toLocaleString()}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        {est.status === "Active" && (
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={!!opBusy[est.id]}
                            className="h-7 text-xs text-destructive hover:text-destructive hover:bg-destructive/10"
                            onClick={(ev) => {
                              ev.stopPropagation();
                              setSuspendTarget(est);
                            }}
                          >
                            <Ban className="size-3 mr-1" />
                            Suspend
                          </Button>
                        )}
                        {est.status === "Suspended" && (
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={!!opBusy[est.id]}
                            className="h-7 text-xs text-success hover:text-success hover:bg-success/10"
                            onClick={(ev) => {
                              ev.stopPropagation();
                              handleReactivate(est);
                            }}
                          >
                            <RefreshCw className="size-3 mr-1" />
                            Reactivate
                          </Button>
                        )}
                        {est.status === "Expired" && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 text-xs text-primary hover:bg-primary/10"
                            onClick={(ev) => {
                              ev.stopPropagation();
                              handleRequestRenewal(est);
                            }}
                          >
                            <RefreshCw className="size-3 mr-1" />
                            Renew
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </SectionCard>
      </Reveal>

      {/* Detail Dialog */}
      <Dialog open={!!detail} onOpenChange={() => { setDetail(null); setSelectedDocIdx(0); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display">{detail?.name}</DialogTitle>
          </DialogHeader>
          {detail && (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <StatusBadge status={detail.status} />
                <Badge variant="secondary">{detail.permitType}</Badge>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Establishment ID" value={detail.id} />
                <Field label="Owner" value={detail.owner} />
                <Field label="Address" value={detail.address} />
                <Field label="Barangay" value={detail.barangay} />
                <Field label="Permit Number" value={detail.permitNumber} />
                <Field label="Permit Type" value={detail.permitType} />
                <div className="rounded-lg bg-secondary/60 px-3 py-2">
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    Permit Expiry
                  </div>
                  <div className="font-medium mt-0.5 flex items-center gap-2">
                    {detail.permitExpiry}
                    <PermitIndicator dateStr={detail.permitExpiry} />
                  </div>
                </div>
                <Field label="Date Registered" value={detail.dateRegistered} />
                <Field label="Email" value={detail.contactEmail} />
                <Field label="Phone" value={detail.contactPhone} />
                <Field
                  label="Total Manifestos"
                  value={String(detail.totalManifestos)}
                />
                <Field
                  label="Credit Balance"
                  value={`${(detail as any)._dbId ? "₱" : "$"}${detail.creditBalance.toLocaleString()}`}
                />
                <Field
                  label="Website"
                  value={
                    detail.website ? (
                      <a
                        href={detail.website}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary underline decoration-dotted underline-offset-2 hover:decoration-solid"
                      >
                        {detail.website}
                      </a>
                    ) : (
                      "—"
                    )
                  }
                />
                <Field
                  label="Facebook"
                  value={
                    detail.facebook ? (
                      <a
                        href={detail.facebook}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary underline decoration-dotted underline-offset-2 hover:decoration-solid"
                      >
                        {detail.facebook}
                      </a>
                    ) : (
                      "—"
                    )
                  }
                />
              </div>
              {/* Verified Accreditations & Uploaded Photos */}
              <div className="space-y-3 pt-2 border-t border-border/60">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="size-4 text-primary" />
                    <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Accreditation & Permit Photos
                    </span>
                  </div>
                  <Badge
                    variant={uploadedDocCount > 0 ? "secondary" : "outline"}
                    className="text-[11px]"
                  >
                    {uploadedDocCount} of {estDocs.length} on file
                  </Badge>
                </div>

                {/* Document Selector Pills */}
                <div className="grid grid-cols-3 gap-2">
                  {estDocs.map((doc, idx) => {
                    const isSelected = idx === selectedDocIdx;
                    const hasFile = Boolean(doc.url);
                    const Icon = doc.icon;
                    return (
                      <button
                        key={doc.id}
                        type="button"
                        onClick={() => setSelectedDocIdx(idx)}
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
                          {hasFile ? (
                            <CheckCircle2 className="size-3.5 text-success shrink-0" />
                          ) : (
                            <AlertTriangle className="size-3.5 text-amber-500 shrink-0" />
                          )}
                        </div>
                        <span className="text-[10px] text-muted-foreground block truncate">
                          {hasFile ? "Photo Available" : "No Document"}
                        </span>
                      </button>
                    );
                  })}
                </div>

                {/* Selected Photo Preview Box */}
                {selectedDoc && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="text-xs font-bold text-foreground flex items-center gap-1.5">
                          <selectedDoc.icon className="size-3.5 text-primary" />
                          {selectedDoc.title}
                        </h4>
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                          {selectedDoc.desc}
                        </p>
                      </div>

                      {selectedDoc.url ? (
                        <div className="flex items-center gap-1.5">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-7 text-xs gap-1 border-primary/30 text-primary hover:bg-primary/10"
                            onClick={() => setZoomedDocPhoto(selectedDoc.url!)}
                          >
                            <Maximize2 className="size-3" />
                            Enlarge Photo
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-7 text-xs gap-1"
                            asChild
                          >
                            <a href={selectedDoc.url} target="_blank" rel="noreferrer">
                              <ExternalLink className="size-3" />
                              Open Original
                            </a>
                          </Button>
                        </div>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-600 dark:text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                          <AlertTriangle className="size-3" />
                          No Photo
                        </span>
                      )}
                    </div>

                    <DocumentViewer
                      url={selectedDoc.url}
                      title={selectedDoc.title}
                      desc={selectedDoc.desc}
                      bucket="operator_uploads"
                      maxHeight="380px"
                      onZoom={(resolved: string) => setZoomedDocPhoto(resolved)}
                    />
                  </div>
                )}
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">
                  Assigned Dive Sites
                </div>
                {detail.assignedDiveSites.length === 0 ? (
                  <span className="text-xs text-muted-foreground">
                    None recorded
                  </span>
                ) : (
                <div className="flex flex-wrap gap-1.5">
                  {detail.assignedDiveSites.map((site) => (
                    <Badge
                      key={site}
                      variant="secondary"
                      className="text-xs cursor-pointer hover:bg-primary/10 transition-colors"
                      onClick={() => {
                        setDetail(null);
                        setFilters({
                          section: "dive-ops",
                          tab: "sites",
                          q: site,
                        });
                      }}
                    >
                      <MapPin className="size-3 mr-1" />
                      {site}
                    </Badge>
                  ))}
                </div>
                )}
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">
                  Certifications
                </div>
                {detail.certifications.length === 0 ? (
                  <span className="text-xs text-muted-foreground">
                    None recorded
                  </span>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {detail.certifications.map((cert) => (
                      <Badge
                        key={cert}
                        variant="secondary"
                        className="text-xs"
                      >
                        <ShieldCheck className="size-3 mr-1" />
                        {cert}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex justify-end gap-2 pt-2 border-t border-border/60">
                {detail.status === "Active" && (
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => {
                      setDetail(null);
                      setSuspendTarget(detail);
                    }}
                  >
                    <Ban className="size-3 mr-1" />
                    Suspend
                  </Button>
                )}
                {detail.status === "Suspended" && (
                  <Button
                    variant="default"
                    size="sm"
                    onClick={() => {
                      handleReactivate(detail);
                      setDetail(null);
                    }}
                  >
                    <RefreshCw className="size-3 mr-1" />
                    Reactivate
                  </Button>
                )}
                {detail.status === "Expired" && (
                  <Button
                    variant="default"
                    size="sm"
                    onClick={() => {
                      handleRequestRenewal(detail);
                      setDetail(null);
                    }}
                  >
                    <RefreshCw className="size-3 mr-1" />
                    Request Renewal
                  </Button>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Suspend Reason Dialog */}
      <Dialog
        open={!!suspendTarget}
        onOpenChange={() => {
          setSuspendTarget(null);
          setSuspendReason("");
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display">
              Suspend {suspendTarget?.name}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Provide a reason for suspending this establishment. Minimum 5
              characters.
            </p>
            <Textarea
              placeholder="Enter suspension reason…"
              value={suspendReason}
              onChange={(e) => setSuspendReason(e.target.value)}
              className="min-h-[80px]"
            />
            {suspendReason.length > 0 && suspendReason.length < 5 && (
              <p className="text-xs text-destructive">
                {5 - suspendReason.length} more characters required.
              </p>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setSuspendTarget(null);
                setSuspendReason("");
              }}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              size="sm"
              disabled={!!(suspendTarget && opBusy[suspendTarget.id])}
              onClick={handleSuspend}
            >
              Confirm Suspend
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Document Photo Zoom Lightbox */}
      <Dialog
        open={!!zoomedDocPhoto}
        onOpenChange={(o) => !o && setZoomedDocPhoto(null)}
      >
        <DialogContent className="max-w-4xl p-2 bg-background/95 backdrop-blur-md">
          <DialogHeader className="px-3 pt-2">
            <DialogTitle className="text-sm font-semibold flex items-center gap-2">
              <FileText className="size-4 text-primary" />
              {detail?.name} — {selectedDoc?.title || "Accreditation Photo"}
            </DialogTitle>
          </DialogHeader>
          <div className="max-h-[80vh] overflow-auto p-2 flex items-center justify-center bg-black/5 dark:bg-black/50 rounded-lg">
            {zoomedDocPhoto &&
              (isPdfUrl(zoomedDocPhoto) ? (
                <iframe
                  src={`${zoomedDocPhoto}#toolbar=1`}
                  title={selectedDoc?.title || "Accreditation Document"}
                  className="w-full h-[75vh] rounded border-0"
                />
              ) : (
                <img
                  src={zoomedDocPhoto}
                  alt="Accreditation Document Photo"
                  className="max-h-[75vh] w-auto max-w-full object-contain rounded"
                />
              ))}
          </div>
          <div className="flex justify-end px-3 pb-2 pt-1">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setZoomedDocPhoto(null)}
            >
              Close Zoom
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
