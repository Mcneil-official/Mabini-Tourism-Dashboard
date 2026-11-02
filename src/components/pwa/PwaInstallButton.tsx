import { Download, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePwa } from "@/lib/pwa";

export function PwaInstallButton({
  variant = "outline",
  size = "sm",
  className = "",
}: {
  variant?: "outline" | "default" | "secondary" | "ghost";
  size?: "default" | "sm" | "lg" | "icon";
  className?: string;
}) {
  const { isInstallable, isInstalled, promptInstall } = usePwa();

  // If already installed or browser doesn't prompt, do not show button
  if (isInstalled || !isInstallable) {
    return null;
  }

  return (
    <Button
      variant={variant}
      size={size}
      onClick={promptInstall}
      title="Install Mabini Tourism Dashboard to your desktop or mobile home screen"
      className={`gap-1.5 font-medium border-primary/30 text-primary hover:bg-primary/10 transition-colors ${className}`}
    >
      <Download className="size-3.5 shrink-0" />
      <span className="hidden sm:inline">Install App</span>
    </Button>
  );
}

/**
 * Sidebar install tile with brief description
 */
export function PwaSidebarInstallCard({ className = "" }: { className?: string }) {
  const { isInstallable, isInstalled, promptInstall } = usePwa();

  if (isInstalled) {
    return null;
  }

  if (!isInstallable) {
    return null;
  }

  return (
    <div
      className={`rounded-xl border border-primary/20 bg-primary/5 p-3 text-left space-y-2 ${className}`}
    >
      <div className="flex items-center gap-2 text-xs font-semibold text-primary">
        <Download className="size-4" />
        <span>Install Desktop App</span>
      </div>
      <p className="text-[11px] text-muted-foreground leading-snug">
        Run Mabini Tourism in a dedicated window with instant launch and offline access.
      </p>
      <Button
        size="sm"
        onClick={promptInstall}
        className="w-full h-7 text-xs font-semibold bg-primary text-primary-foreground hover:bg-primary/90"
      >
        Install Now
      </Button>
    </div>
  );
}
