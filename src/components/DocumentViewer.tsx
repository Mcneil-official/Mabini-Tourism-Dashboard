import { useState, useEffect } from "react";
import {
  FileText,
  ExternalLink,
  Download,
  ZoomIn,
  Maximize2,
  AlertTriangle,
  FileCheck2,
  Loader2,
  AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { resolveDocumentUrl, isPdfUrl } from "@/lib/queries";

interface DocumentViewerProps {
  url: string | null | undefined;
  title: string;
  desc?: string;
  bucket?: "operator_uploads" | "tourist_uploads";
  onZoom?: (resolvedUrl: string) => void;
  className?: string;
  maxHeight?: string;
}

export function DocumentViewer({
  url,
  title,
  desc,
  bucket = "operator_uploads",
  onZoom,
  className = "",
  maxHeight = "460px",
}: DocumentViewerProps) {
  const [resolvedUrl, setResolvedUrl] = useState<string | null>(url ?? null);
  const [loading, setLoading] = useState(false);
  const [imgError, setImgError] = useState(false);

  useEffect(() => {
    let active = true;
    setImgError(false);
    if (!url) {
      setResolvedUrl(null);
      return;
    }

    // Data URLs or local paths don't need async signed resolution
    if (url.startsWith("data:") || url.startsWith("blob:") || url.startsWith("/")) {
      setResolvedUrl(url);
      return;
    }

    setLoading(true);
    void resolveDocumentUrl(url, bucket).then((res) => {
      if (active) {
        setResolvedUrl(res || url);
        setLoading(false);
      }
    });

    return () => {
      active = false;
    };
  }, [url, bucket]);

  if (!url) {
    return (
      <div className="rounded-xl border border-dashed border-amber-500/30 bg-amber-500/5 p-8 flex flex-col items-center justify-center text-center">
        <AlertTriangle className="size-8 text-amber-500 mb-2" />
        <h5 className="font-semibold text-foreground text-sm">
          No Document Uploaded
        </h5>
        <p className="text-xs text-muted-foreground max-w-md mt-1">
          No file or scan has been uploaded for {title}.
        </p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="rounded-xl border bg-slate-900/5 dark:bg-slate-950/60 p-12 flex flex-col items-center justify-center text-center">
        <Loader2 className="size-8 text-primary animate-spin mb-3" />
        <span className="text-xs font-medium text-foreground">
          Resolving secure document preview…
        </span>
        <span className="text-[11px] text-muted-foreground mt-1">
          Verifying storage credentials for {title}
        </span>
      </div>
    );
  }

  const activeUrl = resolvedUrl || url;
  const isPdf = isPdfUrl(activeUrl);

  // PDF Preview via iframe
  if (isPdf) {
    return (
      <div className={`space-y-2 ${className}`}>
        <div className="relative rounded-xl border bg-background overflow-hidden flex flex-col shadow-sm">
          <div className="bg-muted/70 px-3 py-2 flex items-center justify-between text-xs border-b">
            <span className="flex items-center gap-1.5 font-medium text-foreground">
              <FileText className="size-3.5 text-primary" />
              PDF Document — {title}
            </span>
            <div className="flex items-center gap-1.5">
              <Button size="sm" variant="outline" className="h-6 text-[11px] gap-1" asChild>
                <a href={activeUrl} target="_blank" rel="noreferrer" download>
                  <Download className="size-3" /> Download
                </a>
              </Button>
              <Button size="sm" variant="secondary" className="h-6 text-[11px] gap-1" asChild>
                <a href={activeUrl} target="_blank" rel="noreferrer">
                  <ExternalLink className="size-3" /> Open in New Tab
                </a>
              </Button>
            </div>
          </div>
          <iframe
            src={`${activeUrl}#toolbar=0&navpanes=0`}
            title={title}
            className="w-full border-0"
            style={{ height: maxHeight }}
          />
        </div>
      </div>
    );
  }

  // Image load error fallback
  if (imgError) {
    return (
      <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-8 flex flex-col items-center justify-center text-center">
        <AlertCircle className="size-8 text-destructive mb-2" />
        <h5 className="font-semibold text-foreground text-sm">
          Document Preview Unavailable
        </h5>
        <p className="text-xs text-muted-foreground max-w-md mt-1 mb-4">
          The document could not be previewed directly inline. It may require direct authentication, be a specialized file format, or have a private storage policy.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-2">
          <Button size="sm" variant="outline" className="h-8 gap-1.5 text-xs" asChild>
            <a href={activeUrl} target="_blank" rel="noreferrer" download>
              <Download className="size-3.5" />
              Download Document
            </a>
          </Button>
          <Button size="sm" className="h-8 gap-1.5 text-xs" asChild>
            <a href={activeUrl} target="_blank" rel="noreferrer">
              <ExternalLink className="size-3.5" />
              Open in New Tab
            </a>
          </Button>
        </div>
      </div>
    );
  }

  // Normal Image Display
  return (
    <div className={`relative group rounded-xl border bg-slate-900/5 dark:bg-slate-950/60 p-2 sm:p-3 flex flex-col items-center ${className}`}>
      <div
        className="w-full overflow-auto rounded-lg flex items-center justify-center bg-black/5 dark:bg-black/40 cursor-zoom-in"
        style={{ maxHeight }}
        onClick={() => onZoom?.(activeUrl)}
        title="Click photo to enlarge"
      >
        <img
          src={activeUrl}
          alt={title}
          onError={() => setImgError(true)}
          className="w-auto max-w-full object-contain rounded shadow-sm group-hover:scale-[1.01] transition-transform duration-150"
          style={{ maxHeight: `calc(${maxHeight} - 30px)` }}
        />
      </div>
      <div className="w-full mt-2 flex items-center justify-between text-[11px] text-muted-foreground px-1">
        <span className="flex items-center gap-1.5 font-medium text-foreground">
          <FileCheck2 className="size-3.5 text-success" />
          Uploaded photo submitted by {bucket === "tourist_uploads" ? "diver applicant" : "operator applicant"}
        </span>
        <span
          className="text-[11px] text-primary flex items-center gap-1 cursor-pointer hover:underline"
          onClick={() => onZoom?.(activeUrl)}
        >
          <ZoomIn className="size-3" />
          Click photo to zoom
        </span>
      </div>
    </div>
  );
}
