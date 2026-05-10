export async function ensureLocationPermission(): Promise<boolean> {
  if (typeof window === "undefined") return true;
  if (!('permissions' in navigator)) return true;

  const status = await navigator.permissions.query({ name: "geolocation" as PermissionName });

  if (status.state === "granted") return true;

  if (status.state === "prompt") {
    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        () => resolve(true),
        () => resolve(false),
        { enableHighAccuracy: true }
      );
    });
  }

  if (status.state === "denied") {
    alert("La ubicación está bloqueada. Actívala en los permisos de la app/navegador.");
    return false;
  }

  return false;
}
