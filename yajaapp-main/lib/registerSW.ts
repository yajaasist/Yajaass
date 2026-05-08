/**
 * Registers the YAJA Service Worker for PWA support.
 * Call this once from the client entrypoint.
 */
export function registerServiceWorker(): void {
  if (typeof window === "undefined") return;
  if (!("serviceWorker" in navigator)) return;

  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/sw.js", { scope: "/" })
      .then((reg) => {
        console.log("[SW] Registered:", reg.scope);

        // Force immediate update check on load to pick up new deployments.
        reg.update();

        // Check for updates every 60 seconds.
        setInterval(() => {
          reg.update();
        }, 60 * 1000);

        reg.addEventListener("updatefound", () => {
          const newWorker = reg.installing;
          if (!newWorker) return;

          newWorker.addEventListener("statechange", () => {
            if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
              console.log("[SW] New version available. Reloading...");
              // Auto-reload to apply new version.
              window.location.reload();
            }
          });
        });
      })
      .catch((err) => {
        console.warn("[SW] Registration failed:", err);
      });
  });
}
