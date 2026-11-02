import { WifiOff, RefreshCw } from "lucide-react";
import { usePwa } from "@/lib/pwa";

export function OfflineAlertBanner() {
  const { isOnline } = usePwa();

  if (isOnline) {
    return null;
  }

  return (
    <div className="sticky top-0 z-50 w-full bg-amber-500/15 border-b border-amber-500/30 px-4 py-2 text-xs text-amber-700 dark:text-amber-400 backdrop-blur-md transition-all animate-fade-in flex items-center justify-between gap-3">
      <div className="flex items-center gap-2 min-w-0">
        <div className="size-5 rounded-full bg-amber-500/20 flex items-center justify-center shrink-0">
          <WifiOff className="size-3 text-amber-600 dark:text-amber-400" />
        </div>
        <p className="truncate">
          <strong className="font-semibold">Offline Mode:</strong> Viewing cached dashboard data. Real-time Supabase sync will resume once reconnected.
        </p>
      </div>
      <button
        onClick={() => window.location.reload()}
        className="shrink-0 inline-flex items-center gap-1 font-semibold underline underline-offset-2 hover:opacity-80 transition-opacity cursor-pointer"
      >
        <RefreshCw className="size-3" />
        <span>Check connection</span>
      </button>
    </div>
  );
}
