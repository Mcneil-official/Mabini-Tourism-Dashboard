import { useState, useEffect, useCallback } from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

let deferredPrompt: BeforeInstallPromptEvent | null = null;
const installListeners = new Set<(canInstall: boolean) => void>();

/**
 * Client-side Service Worker registration for PWA.
 */
export function registerServiceWorker() {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
    return;
  }

  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/sw.js", { scope: "/" })
      .then((reg) => {
        // Check for updates periodically
        reg.addEventListener("updatefound", () => {
          const installingWorker = reg.installing;
          if (installingWorker) {
            installingWorker.addEventListener("statechange", () => {
              if (
                installingWorker.state === "installed" &&
                navigator.serviceWorker.controller
              ) {
                console.info(
                  "[PWA] New version available — will activate on next reload.",
                );
              }
            });
          }
        });
      })
      .catch((err) => {
        console.warn("[PWA] ServiceWorker registration failed:", err);
      });
  });

  // Capture beforeinstallprompt globally
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferredPrompt = e as BeforeInstallPromptEvent;
    installListeners.forEach((listener) => listener(true));
  });

  window.addEventListener("appinstalled", () => {
    deferredPrompt = null;
    installListeners.forEach((listener) => listener(false));
    console.info("[PWA] Application successfully installed.");
  });
}

/**
 * Hook to manage PWA installation state and network connectivity.
 */
export function usePwa() {
  const [isInstallable, setIsInstallable] = useState(deferredPrompt !== null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== "undefined" ? navigator.onLine : true,
  );

  useEffect(() => {
    // Check if already in standalone display mode (PWA installed & running as standalone app)
    const checkStandalone = () => {
      const isStandalone =
        window.matchMedia("(display-mode: standalone)").matches ||
        (window.navigator as unknown as { standalone?: boolean }).standalone ===
          true ||
        document.referrer.includes("android-app://");
      setIsInstalled(Boolean(isStandalone));
    };

    checkStandalone();

    const handleInstallableChange = (canInstall: boolean) => {
      setIsInstallable(canInstall);
    };

    installListeners.add(handleInstallableChange);

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      installListeners.delete(handleInstallableChange);
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  const promptInstall = useCallback(async () => {
    if (!deferredPrompt) return;
    try {
      await deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      if (choice.outcome === "accepted") {
        setIsInstallable(false);
        deferredPrompt = null;
      }
    } catch (err) {
      console.warn("[PWA] Error displaying install prompt:", err);
    }
  }, []);

  return {
    isInstallable,
    isInstalled,
    isOnline,
    promptInstall,
  };
}
