import { Capacitor } from "@capacitor/core";
import { supabaseApi } from "@/lib/supabaseApi";
import { nowCDMX } from "@/components/shared/dateUtils";

export type AppPermissionState = "granted" | "denied" | "prompt" | "unsupported" | "checking";

export type LiveLocationWatchHandle = {
  native: boolean;
  id: string | number;
};

function normalizePermission(state?: string | null): AppPermissionState {
  if (!state) return "prompt";
  if (state === "granted") return "granted";
  if (state === "denied") return "denied";
  if (state === "prompt" || state === "prompt-with-rationale") return "prompt";
  return "prompt";
}

export function isNativePlatform() {
  return Capacitor.isNativePlatform();
}

export async function getLocationPermissionState(): Promise<AppPermissionState> {
  if (typeof window === "undefined") return "checking";

  if (isNativePlatform()) {
    try {
      const { Geolocation } = await import("@capacitor/geolocation");
      const permissions = await Geolocation.checkPermissions();
      return normalizePermission(permissions.location || permissions.coarseLocation);
    } catch {
      return "prompt";
    }
  }

  if (!navigator.geolocation) return "denied";

  // En PWA: verificar localStorage primero para evitar problemas de navigator.permissions
  if (typeof window !== "undefined" && !isNativePlatform()) {
    const stored = localStorage.getItem("location_perm_granted");
    if (stored === "true") {
      return "granted";
    }
  }

  if (!navigator.permissions) return "prompt";

  try {
    const result = await navigator.permissions.query({ name: "geolocation" });
    return normalizePermission(result.state);
  } catch {
    return "prompt";
  }
}

export async function requestLocationPermissionAccess(): Promise<AppPermissionState> {
  if (typeof window === "undefined") return "checking";

  if (isNativePlatform()) {
    try {
      const { Geolocation } = await import("@capacitor/geolocation");
      const permissions = await Geolocation.requestPermissions();
      const state = normalizePermission(permissions.location || permissions.coarseLocation);
      if (state === "granted") {
        localStorage.setItem("location_perm_granted", "true");
      }
      return state;
    } catch {
      return "denied";
    }
  }

  if (!navigator.geolocation) return "denied";

  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      () => {
        localStorage.setItem("location_perm_granted", "true");
        resolve("granted");
      },
      (error) => resolve(error.code === 1 ? "denied" : "prompt"),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  });
}

export async function getMediaPermissionState(kind: "camera" | "microphone"): Promise<AppPermissionState> {
  if (typeof window === "undefined") return "checking";
  if (!navigator.permissions) return "prompt";

  try {
    const result = await navigator.permissions.query({ name: kind as PermissionName });
    return normalizePermission(result.state);
  } catch {
    return "prompt";
  }
}

export async function requestMediaPermissionAccess(): Promise<{ camera: AppPermissionState; microphone: AppPermissionState }> {
  if (typeof window === "undefined") return { camera: "checking", microphone: "checking" };
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    return { camera: "unsupported", microphone: "unsupported" } as any;
  }

  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
    stream.getTracks().forEach((track) => track.stop());
    return { camera: "granted", microphone: "granted" };
  } catch (error: any) {
    const isDenied = error && (error.name === "NotAllowedError" || error.name === "PermissionDeniedError");
    const state = isDenied ? "denied" : "prompt";
    return { camera: state, microphone: state };
  }
}

export async function requestNotificationPermissionAccess(): Promise<AppPermissionState> {
  if (typeof window === "undefined") return "checking";

  if (!("Notification" in window)) return "unsupported";
  const permission = await Notification.requestPermission();
  return normalizePermission(permission);
}

export async function getNotificationPermissionState(): Promise<AppPermissionState> {
  if (typeof window === "undefined") return "checking";

  if (isNativePlatform()) {
    try {
      const { PushNotifications } = await import("@capacitor/push-notifications");
      const permissions = await PushNotifications.checkPermissions();
      return normalizePermission(permissions.receive);
    } catch {
      return "prompt";
    }
  }

  if (!("Notification" in window)) return "unsupported";
  return normalizePermission(Notification.permission);
}

let registeredDriverId: string | null = null;
let registeredPassengerId: string | null = null;
let lastNativePushToken: string | null = null;
let nativePushListenersReady = false;

async function persistNativePushTokenForRole(role: "driver" | "passenger") {
  if (!lastNativePushToken) return;

  try {
    const payload = {
      push_subscription: {
        platform: "android-native",
        provider: "fcm",
        token: lastNativePushToken,
        registered_at: nowCDMX(),
      },
    };

    if (role === "driver") {
      if (!registeredDriverId) return;
      await supabaseApi.drivers.update(registeredDriverId, payload);
      return;
    }

    if (!registeredPassengerId) return;
    await supabaseApi.passengers.update(registeredPassengerId, payload);
  } catch (error) {
    console.warn(`[NativePush] Could not save FCM token (${role})`, error);
  }
}

async function ensureNativePushListeners() {
  if (nativePushListenersReady || !isNativePlatform()) return;

  const { PushNotifications } = await import("@capacitor/push-notifications");

  await PushNotifications.removeAllListeners().catch(() => {});

  await PushNotifications.addListener("registration", async (token) => {
    lastNativePushToken = token.value;
    // Persist for whichever role has an active session in this device.
    await Promise.allSettled([
      persistNativePushTokenForRole("driver"),
      persistNativePushTokenForRole("passenger"),
    ]);
  });

  await PushNotifications.addListener("pushNotificationActionPerformed", (action) => {
    const url = String(action.notification.data?.url || "/driver-app");
    if (typeof window !== "undefined") {
      window.location.href = url;
    }
  });

  nativePushListenersReady = true;
}

export async function initNativeDriverPush(driverId?: string): Promise<AppPermissionState> {
  if (!isNativePlatform()) return "unsupported";
  if (driverId) registeredDriverId = driverId;

  try {
    const { PushNotifications } = await import("@capacitor/push-notifications");
    await ensureNativePushListeners();

    let permissions = await PushNotifications.checkPermissions();
    if (permissions.receive !== "granted") {
      permissions = await PushNotifications.requestPermissions();
    }
    if (permissions.receive !== "granted") {
      return normalizePermission(permissions.receive);
    }

    await PushNotifications.register();
    await persistNativePushTokenForRole("driver");
    return "granted";
  } catch (error) {
    console.warn("[NativePush] Init failed", error);
    return "denied";
  }
}

export async function initNativePassengerPush(passengerId?: string): Promise<AppPermissionState> {
  if (!isNativePlatform()) return "unsupported";
  if (passengerId) registeredPassengerId = passengerId;

  try {
    const { PushNotifications } = await import("@capacitor/push-notifications");
    await ensureNativePushListeners();

    let permissions = await PushNotifications.checkPermissions();
    if (permissions.receive !== "granted") {
      permissions = await PushNotifications.requestPermissions();
    }
    if (permissions.receive !== "granted") {
      return normalizePermission(permissions.receive);
    }

    await PushNotifications.register();
    await persistNativePushTokenForRole("passenger");
    return "granted";
  } catch (error) {
    console.warn("[NativePush] Passenger init failed", error);
    return "denied";
  }
}

export async function showNativeDriverNotification({
  title,
  body,
  url = "/driver-app",
}: {
  title: string;
  body?: string;
  url?: string;
}) {
  if (!isNativePlatform()) return false;

  try {
    const { LocalNotifications } = await import("@capacitor/local-notifications");
    let permissions = await LocalNotifications.checkPermissions();
    if (permissions.display !== "granted") {
      permissions = await LocalNotifications.requestPermissions();
    }
    if (permissions.display !== "granted") return false;

    await LocalNotifications.schedule({
      notifications: [
        {
          id: Math.floor(Date.now() % 2147483000),
          title,
          body: body || "",
          extra: { url },
          schedule: { at: new Date(Date.now() + 200) },
        },
      ],
    });

    return true;
  } catch (error) {
    console.warn("[NativePush] Local notification failed", error);
    return false;
  }
}

export async function getCurrentLiveLocation() {
  if (isNativePlatform()) {
    const { Geolocation } = await import("@capacitor/geolocation");
    return Geolocation.getCurrentPosition({ enableHighAccuracy: true, timeout: 10000, maximumAge: 0 });
  }

  return new Promise<GeolocationPosition>((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("Geolocalización no soportada"));
      return;
    }
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 0,
    });
  });
}

export async function watchLiveLocation(
  onSuccess: (position: { coords: { latitude: number; longitude: number } }) => void,
  onError?: (error: { message?: string }) => void,
): Promise<LiveLocationWatchHandle | null> {
  if (isNativePlatform()) {
    const { Geolocation } = await import("@capacitor/geolocation");
    const id = await Geolocation.watchPosition(
      { 
        enableHighAccuracy: true, 
        timeout: 10000, 
        maximumAge: 0,
        distanceFilter: 2
      },
      (position, error) => {
        if (position?.coords) onSuccess(position as any);
        if (error) onError?.(error as any);
      }
    );
    return { native: true, id };
  }

  if (!navigator.geolocation) return null;

  const id = navigator.geolocation.watchPosition(
    (position) => onSuccess(position),
    (error) => onError?.(error),
    { 
      enableHighAccuracy: true, 
      timeout: 10000, 
      maximumAge: 0,
      distanceFilter: 2
    }
  );

  return { native: false, id };
}

export async function clearLiveLocationWatch(watch: LiveLocationWatchHandle | null) {
  if (!watch) return;

  if (watch.native) {
    const { Geolocation } = await import("@capacitor/geolocation");
    await Geolocation.clearWatch({ id: String(watch.id) }).catch(() => {});
    return;
  }

  navigator.geolocation?.clearWatch(watch.id as number);
}

export async function openNativeAppSettings() {
  if (!isNativePlatform()) return false;
  try {
    const { App } = await import("@capacitor/app");
    const openSettings = (App as any).openSettings;
    if (typeof openSettings === "function") {
      await openSettings();
      return true;
    }
  } catch {}
  return false;
}