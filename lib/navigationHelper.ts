/**
 * navigationHelper.ts
 * 
 * Utilities to open external navigation apps (Google Maps, Waze, Apple Maps)
 * with pickup/dropoff locations for drivers
 */

export interface NavigationTarget {
  lat: number;
  lng: number;
  name?: string;
  label?: string;
}

export interface NavigationOptions {
  pickup?: NavigationTarget;
  dropoff?: NavigationTarget;
  usePreferred?: 'maps' | 'waze' | 'apple-maps' | 'browser';
}

/**
 * Detect if the app is running on iOS
 */
function isIOS(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent);
}

/**
 * Detect if the app is running on Android
 */
function isAndroid(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /Android/.test(navigator.userAgent);
}

/**
 * Open Google Maps with a specific location
 * Returns true if the app was opened, false if we had to fall back to web
 */
export function openGoogleMaps(
  target: NavigationTarget,
  options?: { waypoint?: NavigationTarget }
): boolean {
  const { lat, lng, name = 'Destino' } = target;
  
  // Try mobile app first
  if (isAndroid() || isIOS()) {
    const q = encodeURIComponent(name);
    const url = `https://www.google.com/maps/search/?api=1&query=${lat},${lng}&query_place_id=${q}`;
    window.location.href = url;
    return true;
  }
  
  // Fallback to web
  const webUrl = `https://www.google.com/maps/search/${lat},${lng}/?api=1`;
  window.location.href = webUrl;
  return false;
}

/**
 * Open Waze with a specific location
 * Returns true if the app was opened, false if fallback to web
 */
export function openWaze(
  target: NavigationTarget,
  options?: { waypoint?: NavigationTarget }
): boolean {
  const { lat, lng, name = 'Destino' } = target;
  
  // Waze URL scheme for both mobile and web
  // Format: waze://?ll=40.758896,-73.985130&navigate=yes
  const wazeUrl = `waze://?ll=${lat},${lng}&navigate=yes&zoom=15`;
  
  // Try to open the Waze app
  if (isAndroid() || isIOS()) {
    window.location.href = wazeUrl;
    // If it doesn't open the app, it will open web after a timeout
    return true;
  }
  
  // Fallback to Waze web
  const webUrl = `https://waze.com/ul?ll=${lat},${lng}&navigate=yes&zoom=15`;
  window.location.href = webUrl;
  return false;
}

/**
 * Open Apple Maps (iOS only)
 */
export function openAppleMaps(target: NavigationTarget): boolean {
  if (!isIOS()) {
    console.warn('Apple Maps is only available on iOS');
    return false;
  }
  
  const { lat, lng, name = 'Destino' } = target;
  const mapsUrl = `maps://maps.apple.com/?daddr=${lat},${lng}&dirflg=d&t=m`;
  window.location.href = mapsUrl;
  return true;
}

/**
 * Open the best available navigation app based on platform and availability
 * Priority: 
 *   - iOS: Apple Maps > Google Maps > Waze
 *   - Android: Google Maps > Waze
 *   - Web: Google Maps
 */
export function openBestNavigationApp(
  target: NavigationTarget,
  preferred?: 'maps' | 'waze' | 'apple-maps'
): void {
  if (!target) return;
  
  // If user has a preference, try that first
  if (preferred === 'apple-maps' && isIOS()) {
    if (openAppleMaps(target)) return;
  }
  
  if (preferred === 'waze') {
    if (openWaze(target)) return;
  }
  
  if (preferred === 'maps') {
    if (openGoogleMaps(target)) return;
  }
  
  // Default fallback: platform-specific order
  if (isIOS()) {
    if (openAppleMaps(target)) return;
    if (openGoogleMaps(target)) return;
    if (openWaze(target)) return;
  } else if (isAndroid()) {
    if (openGoogleMaps(target)) return;
    if (openWaze(target)) return;
  } else {
    // Web browser
    if (openGoogleMaps(target)) return;
  }
}

/**
 * Get a string ID/code for a location to preserve it in analytics
 */
export function getLocationCode(target: NavigationTarget): string {
  if (!target) return 'unknown';
  return `${target.lat.toFixed(4)}_${target.lng.toFixed(4)}`;
}

/**
 * Create a shareable text representation of navigation targets
 */
export function createNavigationSummary(
  pickup?: NavigationTarget,
  dropoff?: NavigationTarget
): string {
  const parts = [];
  if (pickup) parts.push(`Recogida: ${pickup.label || pickup.name || `${pickup.lat}, ${pickup.lng}`}`);
  if (dropoff) parts.push(`Destino: ${dropoff.label || dropoff.name || `${dropoff.lat}, ${dropoff.lng}`}`);
  return parts.join('\n');
}

/**
 * Calculate approximate distance between two points (haversine, in km)
 */
export function calcDistance(p1: NavigationTarget, p2: NavigationTarget): number {
  const R = 6371; // Earth's radius in km
  const lat1 = (p1.lat * Math.PI) / 180;
  const lat2 = (p2.lat * Math.PI) / 180;
  const deltaLat = ((p2.lat - p1.lat) * Math.PI) / 180;
  const deltaLng = ((p2.lng - p1.lng) * Math.PI) / 180;
  
  const a =
    Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLng / 2) * Math.sin(deltaLng / 2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}
