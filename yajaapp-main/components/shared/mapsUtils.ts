type RoutePoint = [number, number];

interface RouteResult {
  distKm: number;
  durationMin: number;
  polyline?: RoutePoint[];
  durationInTraffic?: boolean;
}

interface GoogleRouteLeg {
  distance?: { value: number };
  duration?: { value: number };
  duration_in_traffic?: { value: number };
}

interface GoogleDirectionsResult {
  routes?: Array<{
    legs?: GoogleRouteLeg[];
    overview_polyline?: { points?: string };
  }>;
}

interface GoogleMapsWindow extends Window {
  google?: {
    maps?: {
      DirectionsService: new () => {
        route: (
          request: any,
          callback: (result: GoogleDirectionsResult | null, status: string) => void,
        ) => void;
      };
      TravelMode: {
        DRIVING: string;
      };
    };
  };
}

let googleMapsLoading: Promise<boolean> | null = null;

function supportsAbortTimeout() {
  return typeof AbortSignal !== "undefined" && typeof AbortSignal.timeout === "function";
}

function createTimeoutSignal(timeoutMs: number) {
  if (supportsAbortTimeout()) {
    return AbortSignal.timeout(timeoutMs);
  }

  const controller = new AbortController();
  setTimeout(() => controller.abort(), timeoutMs);
  return controller.signal;
}

async function loadGoogleMapsSDK(apiKey: string) {
  const mapsWindow = window as GoogleMapsWindow;

  if (mapsWindow.google?.maps?.DirectionsService) return true;
  if (googleMapsLoading) return googleMapsLoading;

  googleMapsLoading = new Promise((resolve) => {
    const existing = document.querySelector('script[src*="maps.googleapis.com"]');

    if (existing) {
      const check = setInterval(() => {
        if (mapsWindow.google?.maps?.DirectionsService) {
          clearInterval(check);
          resolve(true);
        }
      }, 100);

      setTimeout(() => {
        clearInterval(check);
        resolve(false);
      }, 10000);
      return;
    }

    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}`;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve(true);
    script.onerror = () => {
      googleMapsLoading = null;
      resolve(false);
    };
    document.head.appendChild(script);
  });

  return googleMapsLoading;
}

export async function getOSRMRoute(lat1?: number | null, lon1?: number | null, lat2?: number | null, lon2?: number | null): Promise<RouteResult | null> {
  if (!lat1 || !lon1 || !lat2 || !lon2) return null;

  try {
    const url = `https://router.project-osrm.org/route/v1/driving/${lon1},${lat1};${lon2},${lat2}?overview=full&geometries=geojson`;
    const res = await fetch(url, { signal: createTimeoutSignal(8000) });
    const data = await res.json();

    if (data.routes?.[0]) {
      const route = data.routes[0];
      const polyline = (route.geometry?.coordinates || []).map(([lon, lat]: [number, number]) => [lat, lon] as RoutePoint);

      return {
        distKm: route.distance / 1000,
        durationMin: Math.ceil(route.duration / 60),
        polyline,
      };
    }
  } catch {
  }

  return null;
}

export async function getGoogleMapsRoute(
  lat1?: number | null,
  lon1?: number | null,
  lat2?: number | null,
  lon2?: number | null,
  apiKey?: string | null,
): Promise<RouteResult | null> {
  if (!lat1 || !lon1 || !lat2 || !lon2 || !apiKey || typeof window === "undefined") return null;

  try {
    const loaded = await loadGoogleMapsSDK(apiKey);
    const mapsWindow = window as GoogleMapsWindow;
    if (!loaded || !mapsWindow.google?.maps?.DirectionsService) return null;

    return await new Promise<RouteResult | null>((resolve) => {
      const service = new mapsWindow.google!.maps!.DirectionsService();
      service.route(
        {
          origin: { lat: lat1, lng: lon1 },
          destination: { lat: lat2, lng: lon2 },
          travelMode: mapsWindow.google!.maps!.TravelMode.DRIVING,
          drivingOptions: {
            departureTime: new Date(),
            trafficModel: "bestguess",
          },
        },
        (result, status) => {
          const leg = result?.routes?.[0]?.legs?.[0];
          if (status === "OK" && leg?.distance?.value && (leg.duration_in_traffic?.value || leg.duration?.value)) {
            const durationSeconds = leg.duration_in_traffic?.value || leg.duration?.value || 0;
            const encoded = result?.routes?.[0]?.overview_polyline?.points || "";
            const polyline = decodePolyline(encoded);

            resolve({
              distKm: leg.distance.value / 1000,
              durationMin: Math.ceil(durationSeconds / 60),
              durationInTraffic: !!leg.duration_in_traffic,
              polyline,
            });
            return;
          }

          resolve(null);
        },
      );
    });
  } catch {
    return null;
  }
}

function decodePolyline(encoded: string): RoutePoint[] {
  const points: RoutePoint[] = [];
  let index = 0;
  let lat = 0;
  let lng = 0;

  while (index < encoded.length) {
    let shift = 0;
    let result = 0;
    let byte = 0;

    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);

    lat += result & 1 ? ~(result >> 1) : result >> 1;

    shift = 0;
    result = 0;

    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);

    lng += result & 1 ? ~(result >> 1) : result >> 1;
    points.push([lat / 1e5, lng / 1e5]);
  }

  return points;
}

export async function getRoute(
  fromLat?: number | null,
  fromLon?: number | null,
  toLat?: number | null,
  toLon?: number | null,
  provider = "osrm",
  apiKey?: string | null,
): Promise<RouteResult | null> {
  if (provider === "google_maps" || provider === "google") {
    if (apiKey) {
      const googleResult = await getGoogleMapsRoute(fromLat, fromLon, toLat, toLon, apiKey);
      if (googleResult) return googleResult;
    }
    return getOSRMRoute(fromLat, fromLon, toLat, toLon);
  }

  return getOSRMRoute(fromLat, fromLon, toLat, toLon);
}

export function getHaverDist(lat1?: number | null, lon1?: number | null, lat2?: number | null, lon2?: number | null) {
  if (!lat1 || !lon1 || !lat2 || !lon2) return null;

  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;

  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}