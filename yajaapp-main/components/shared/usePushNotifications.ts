import { supabaseApi } from "@/lib/supabaseApi";
import {
  initNativeDriverPush,
  initNativePassengerPush,
  isNativePlatform,
  showNativeDriverNotification,
} from "@/lib/nativeMobile";

const VAPID_PUBLIC_KEY =
  "BJAiNTakC4wPq6j1Lv0xAPTvkybNTCga9BcPYSMzzrhjILPv88w8pQMyZTW7D1Qa25de5oLjcnlrRkboGFyq15w";

type PushPermissionResult = "granted" | "denied" | "default" | "unsupported";

interface NotificationPayload {
  title: string;
  body?: string;
  rideId?: string;
  tag?: string;
  url?: string;
}

interface ServiceWorkerMessage {
  type: string;
  [key: string]: any;
}

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(base64);
  return Uint8Array.from([...raw].map((char) => char.charCodeAt(0)));
}

let serviceWorkerRegistration: ServiceWorkerRegistration | null = null;

async function getActiveServiceWorker() {
  if (typeof window === "undefined") return null;
  const reg = serviceWorkerRegistration || (await registerDriverSW());
  if (!reg) return null;
  const readyReg = await navigator.serviceWorker.ready.catch(() => reg);
  return readyReg?.active || reg.active || null;
}

export async function registerDriverSW() {
  if (isNativePlatform()) return null;
  if (serviceWorkerRegistration) return serviceWorkerRegistration;
  if (typeof window === "undefined") return null;
  if (!("serviceWorker" in navigator)) return null;

  try {
    serviceWorkerRegistration = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
    return serviceWorkerRegistration;
  } catch (err: any) {
    console.warn("[Push] SW registration failed:", err?.message || err);
    return null;
  }
}

async function getOrCreateSubscription(swReg: ServiceWorkerRegistration) {
  try {
    let subscription = await swReg.pushManager.getSubscription();
    if (!subscription) {
      subscription = await swReg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      });
    }
    return subscription;
  } catch (err: any) {
    console.warn("[Push] Could not get subscription:", err?.message || err);
    return null;
  }
}

export async function initDriverPush(driverId?: string): Promise<PushPermissionResult> {
  if (isNativePlatform()) {
    return initNativeDriverPush(driverId) as Promise<PushPermissionResult>;
  }
  if (typeof window === "undefined") return "unsupported";
  if (!("Notification" in window)) return "unsupported";

  let permission: NotificationPermission = Notification.permission;
  if (permission === "default") {
    try {
      permission = await Promise.race([
        Notification.requestPermission(),
        new Promise<never>((_, reject) => setTimeout(() => reject(new Error("timeout")), 15000)),
      ]);
    } catch {
      return "default";
    }
  }

  if (permission === "granted") {
    if (!("serviceWorker" in navigator)) return permission;
    try {
      const swReg = await Promise.race([
        registerDriverSW(),
        new Promise<null>((resolve) => setTimeout(() => resolve(null), 5000)),
      ]);

      if (swReg && driverId) {
        const sub = await Promise.race([
          getOrCreateSubscription(swReg),
          new Promise<null>((resolve) => setTimeout(() => resolve(null), 5000)),
        ]);

        if (sub) {
          try {
            await supabaseApi.drivers.update(driverId, {
              push_subscription: sub.toJSON(),
            });
          } catch (err: any) {
            console.warn("[Push] Could not save driver subscription:", err?.message || err);
          }
        }
      }
    } catch (err: any) {
      console.warn("[Push] SW init failed (non-fatal):", err?.message || err);
    }
  }

  return permission;
}

export async function initPassengerPush(userId?: string): Promise<PushPermissionResult> {
  if (isNativePlatform()) {
    return initNativePassengerPush(userId) as Promise<PushPermissionResult>;
  }
  if (typeof window === "undefined") return "unsupported";
  if (!("Notification" in window)) return "unsupported";

  let permission: NotificationPermission = Notification.permission;
  if (permission === "default") {
    try {
      permission = await Promise.race([
        Notification.requestPermission(),
        new Promise<never>((_, reject) => setTimeout(() => reject(new Error("timeout")), 15000)),
      ]);
    } catch {
      return "default";
    }
  }

  if (permission === "granted") {
    if (!("serviceWorker" in navigator)) return permission;
    try {
      // Ensure service worker is active and ready before subscribing to push
      const swReg = await registerDriverSW();
      if (!swReg) return permission;
      
      // Wait for the service worker to actually be active
      const readyReg = await navigator.serviceWorker.ready.catch(() => swReg);
      if (!readyReg?.active && !swReg?.active) {
        console.warn("[Push] Service worker not yet active");
        return permission;
      }

      if (userId) {
        const sub = await Promise.race([
          getOrCreateSubscription(swReg),
          new Promise<null>((resolve) => setTimeout(() => resolve(null), 8000)),
        ]);

        if (sub) {
          try {
            await supabaseApi.passengers.update(userId, {
              push_subscription: sub.toJSON(),
            });
          } catch (err: any) {
            console.warn("[Push] Could not save passenger subscription:", err?.message || err);
          }
        }
      }
    } catch (err: any) {
      console.warn("[Push] Passenger SW init failed (non-fatal):", err?.message || err);
    }
  }

  return permission;
}

export async function showDriverNotification({ title, body, rideId, tag, url }: NotificationPayload) {
  if (isNativePlatform()) {
    await showNativeDriverNotification({ title, body, url: url || "/driver-app" });
    return;
  }
  if (typeof window === "undefined") return;
  if (!("Notification" in window)) return;
  if (Notification.permission !== "granted") return;

  const swReg = serviceWorkerRegistration || (await registerDriverSW());
  const payload: ServiceWorkerMessage = {
    type: "SHOW_NOTIFICATION",
    title,
    body,
    tag: tag || (rideId ? `ride-${rideId}` : `notif-${Date.now()}`),
    ride: { id: rideId },
    url: url || "/driver-app",
  };

  if (swReg?.active) {
    swReg.active.postMessage(payload);
    return;
  }

  try {
    new Notification(title, {
      body,
      icon: "/favicon.ico",
      tag: payload.tag,
      requireInteraction: true,
    });
  } catch {
  }
}

export async function showPassengerNotification({ title, body, rideId, tag }: NotificationPayload) {
  if (isNativePlatform()) {
    await showNativeDriverNotification({ title, body, url: "/road-assist-app" });
    return;
  }
  if (typeof window === "undefined") return;
  if (!("Notification" in window)) return;
  if (Notification.permission !== "granted") return;

  const swReg = serviceWorkerRegistration || (await registerDriverSW());
  const payload: ServiceWorkerMessage = {
    type: "SHOW_NOTIFICATION",
    title,
    body,
    tag: tag || (rideId ? `ride-${rideId}` : `notif-${Date.now()}`),
    ride: { id: rideId },
    url: "/road-assist-app",
  };

  if (swReg?.active) {
    swReg.active.postMessage(payload);
    return;
  }

  try {
    new Notification(title, {
      body,
      icon: "/favicon.ico",
      tag: payload.tag,
      requireInteraction: true,
    });
  } catch {
  }
}

export async function dismissDriverNotification(tag: string) {
  if (serviceWorkerRegistration?.active) {
    serviceWorkerRegistration.active.postMessage({ type: "DISMISS", tag });
  }
}

export async function startSWRideTimer(
  rideId: string,
  timeoutMs: number,
  passengerName?: string,
  pickupAddress?: string,
) {
  if (isNativePlatform()) return;
  const sw = await getActiveServiceWorker();
  if (!sw) return;

  sw.postMessage({
    type: "START_RIDE_TIMER",
    rideId,
    timeoutMs,
    passengerName,
    pickupAddress,
  });
}

export async function cancelSWRideTimer(rideId: string) {
  if (isNativePlatform()) return;
  const sw = await getActiveServiceWorker();
  if (!sw) return;
  sw.postMessage({ type: "CANCEL_RIDE_TIMER", rideId });
}

export async function sendDriverHeartbeat(timeoutMs: number) {
  if (isNativePlatform()) return;
  const sw = await getActiveServiceWorker();
  if (!sw) return;
  sw.postMessage({ type: "DRIVER_HEARTBEAT", timeoutMs });
}

export async function stopDriverHeartbeat() {
  if (isNativePlatform()) return;
  const sw = await getActiveServiceWorker();
  if (!sw) return;
  sw.postMessage({ type: "STOP_HEARTBEAT" });
}