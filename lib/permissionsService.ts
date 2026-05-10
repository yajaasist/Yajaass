import { isNativePlatform, openNativeAppSettings, getLocationPermissionState as getNativeLocationPermissionState, requestLocationPermissionAccess as requestNativeLocationPermissionAccess, getNotificationPermissionState as getNativeNotificationPermissionState, requestNotificationPermissionAccess as requestNativeNotificationPermissionAccess } from "@/lib/nativeMobile";

export type AppPermissionState = "granted" | "denied" | "prompt" | "unsupported" | "checking";

function normalizePermission(state?: string | null): AppPermissionState {
  if (!state) return "prompt";
  if (state === "granted") return "granted";
  if (state === "denied") return "denied";
  if (state === "prompt" || state === "default" || state === "prompt-with-rationale") return "prompt";
  return "prompt";
}

export async function getLocationPermissionState(): Promise<AppPermissionState> {
  if (typeof window === "undefined") return "checking";
  if (isNativePlatform()) {
    return getNativeLocationPermissionState();
  }

  if (!navigator.geolocation) return "denied";
  if (!navigator.permissions) return "prompt";

  try {
    const result = await navigator.permissions.query({ name: "geolocation" as PermissionName });
    return normalizePermission(result.state);
  } catch {
    return "prompt";
  }
}

export async function requestLocationPermission(): Promise<boolean> {
  if (typeof window === "undefined") return false;
  if (isNativePlatform()) {
    const state = await requestNativeLocationPermissionAccess();
    return state === "granted";
  }

  if (!navigator.geolocation) return false;

  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      () => resolve(true),
      () => resolve(false),
      { enableHighAccuracy: true, timeout: 15000 }
    );
  });
}

export async function ensureLocationPermission(): Promise<boolean> {
  const state = await getLocationPermissionState();
  if (state === "granted") return true;
  if (state === "prompt") {
    return requestLocationPermission();
  }
  if (state === "denied") {
    return false;
  }
  return false;
}

export async function getNotificationPermissionState(): Promise<AppPermissionState> {
  if (typeof window === "undefined") return "checking";
  if (isNativePlatform()) {
    return getNativeNotificationPermissionState();
  }

  if (!("Notification" in window)) return "unsupported";
  if (navigator.permissions) {
    try {
      const result = await navigator.permissions.query({ name: "notifications" as PermissionName });
      return normalizePermission(result.state);
    } catch {
      return normalizePermission(Notification.permission);
    }
  }

  return normalizePermission(Notification.permission);
}

export async function requestNotificationPermission(): Promise<boolean> {
  if (typeof window === "undefined") return false;
  if (isNativePlatform()) {
    const state = await requestNativeNotificationPermissionAccess();
    return state === "granted";
  }

  if (!("Notification" in window)) return false;
  const permission = await Notification.requestPermission();
  return normalizePermission(permission) === "granted";
}

export async function ensureNotificationPermission(): Promise<boolean> {
  const state = await getNotificationPermissionState();
  if (state === "granted") return true;
  if (state === "prompt") {
    return requestNotificationPermission();
  }
  if (state === "denied") {
    return false;
  }
  return false;
}

export async function openAppSettings(): Promise<boolean> {
  if (typeof window === "undefined") return false;
  const opened = await openNativeAppSettings();
  if (opened) return true;

  // Browser fallback: instruct the user
  return false;
}
