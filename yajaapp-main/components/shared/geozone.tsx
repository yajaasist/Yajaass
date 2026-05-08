/**
 * Point-in-polygon (Ray Casting) algorithm
 * coordinates: [[lat, lng], ...]
 * point: { lat, lng }
 */
export function pointInPolygon(point, coordinates) {
  if (!coordinates || coordinates.length < 3) return false;
  const { lat, lng } = point;
  let inside = false;
  const n = coordinates.length;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const [xi, yi] = coordinates[i];
    const [xj, yj] = coordinates[j];
    const intersect = ((yi > lng) !== (yj > lng)) &&
      (lat < (xj - xi) * (lng - yi) / (yj - yi) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}

/**
 * Given pickup coords and a list of zones, returns the best matching zone
 * (highest priority active zone that contains the point)
 */
export function detectZone(lat, lng, zones) {
  if (!lat || !lng || !zones?.length) return null;
  const matching = zones
    .filter(z => z.is_active && pointInPolygon({ lat, lng }, z.coordinates))
    .sort((a, b) => (b.prioridad || 0) - (a.prioridad || 0));
  return matching[0] || null;
}

/**
 * Check if a point is inside any active red zone
 */
export function detectRedZone(lat, lng, redZones) {
  if (!lat || !lng || !redZones?.length) return null;
  return redZones.find(z => z.is_active && pointInPolygon({ lat, lng }, z.coordinates)) || null;
}

/**
 * Calculate price based on zone tariff
 */
export function calcZonePrice(zone, distanceKm) {
  if (!zone) return null;
  if (zone.tipo_tarifa === "fija" && zone.tarifa_fija) return zone.tarifa_fija;
  const base = zone.tarifa_base || 0;
  const perKm = zone.tarifa_por_km || 0;
  return base + perKm * (distanceKm || 0);
}

/**
 * Calculate price for NORMAL (non-corporate) services considering zone tariff priority
 * 
 * Priority logic:
 * - If zone has service_tariff_priority = "zone": always use zone tariff
 * - If zone has service_tariff_priority = "service": use service general tariff
 * 
 * @param zone - The detected zone
 * @param serviceType - The service configuration with base_price, price_per_km, minimum_fare
 * @param distanceKm - Distance in kilometers
 * @returns Calculated price or null if inputs invalid
 */
export function calcPriceForNormalService(zone, serviceType, distanceKm) {
  if (!zone || !serviceType) return null;
  
  const priority = zone.service_tariff_priority || "zone";
  
  if (priority === "zone") {
    // Use zone tariff
    return calcZonePrice(zone, distanceKm);
  } else {
    // Use service general tariff
    const base = serviceType.base_price || 0;
    const perKm = serviceType.price_per_km || 0;
    const perMin = serviceType.price_per_minute || 0;
    const minimumFare = serviceType.minimum_fare || 0;
    
    // Calculate price (without time for now, as we may not have duration)
    const price = base + perKm * (distanceKm || 0);
    return Math.max(price, minimumFare);
  }
}

/**
 * Calculate price for CORPORATE (company) services considering zone tariff priority
 * 
 * Priority logic:
 * - If zone has company_tariff_priority = "zone": use zone tariff
 * - If zone has company_tariff_priority = "company": use company configured tariff
 * 
 * @param zone - The detected zone
 * @param companyTariff - The company's negotiated tariff (e.g., from company.zone_prices)
 * @param distanceKm - Distance in kilometers
 * @returns Calculated price or null if inputs invalid
 */
export function calcPriceForCorporateService(zone, companyTariff, distanceKm) {
  if (!zone) return null;
  
  const priority = zone.company_tariff_priority || "zone";
  
  if (priority === "zone") {
    // Use zone tariff
    return calcZonePrice(zone, distanceKm);
  } else if (priority === "company" && companyTariff) {
    // Use company tariff
    return companyTariff;
  } else {
    // Fallback to zone if no company tariff available
    return calcZonePrice(zone, distanceKm);
  }
}

function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function pointInCityCircle(lat, lng, city) {
  const cLat = Number(city?.center_lat);
  const cLng = Number(city?.center_lon);
  const radiusKm = Number(city?.geofence_radius_km);
  if (!Number.isFinite(cLat) || !Number.isFinite(cLng) || !Number.isFinite(radiusKm) || radiusKm <= 0) {
    return false;
  }
  return haversineKm(lat, lng, cLat, cLng) <= radiusKm;
}

/**
 * Validates if a pickup point is serviceable according to:
 * 1) Active red zones (always block)
 * 2) Active tariff zones (must be inside one)
 * 3) Active city coverage (must belong to at least one active city, by geofence or zone city_id)
 */
export function validateCoverageAvailability(lat, lng, options: any = {}) {
  const { zones = [], redZones = [], cities = [] } = options;
  const unavailableMessage = "Ciudad no disponible, pronto estaremos aquí.";

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return {
      isCovered: false,
      reason: "invalid_coordinates",
      message: unavailableMessage,
      zone: null,
      redZone: null,
      city: null,
    };
  }

  const redZone = detectRedZone(lat, lng, redZones);
  if (redZone) {
    return {
      isCovered: false,
      reason: "red_zone",
      message: unavailableMessage,
      zone: null,
      redZone,
      city: null,
    };
  }

  const activeCities = (cities || []).filter((c) => c?.is_active);
  const cityByCircle = activeCities.find((c) => pointInCityCircle(lat, lng, c)) || null;

  const activeZones = (zones || []).filter(
    (z) => z?.is_active && pointInPolygon({ lat, lng }, z.coordinates)
  );
  const zone = activeZones.sort((a, b) => (b.prioridad || 0) - (a.prioridad || 0))[0] || null;

  const cityByZone = zone?.city_id
    ? activeCities.find((c) => c.id === zone.city_id) || null
    : null;

  // Covered if it belongs to any active tariff polygon OR falls inside an active city radius.
  if (!zone && !cityByCircle) {
    return {
      isCovered: false,
      reason: activeCities.length > 0 ? "outside_city" : "outside_zone",
      message: unavailableMessage,
      zone: null,
      redZone: null,
      city: null,
    };
  }

  if (!activeCities.length) {
    return {
      isCovered: true,
      reason: null,
      message: "",
      zone,
      redZone: null,
      city: null,
    };
  }

  if (cityByZone) {
    return {
      isCovered: true,
      reason: null,
      message: "",
      zone,
      redZone: null,
      city: cityByZone,
    };
  }

  if (cityByCircle) {
    return {
      isCovered: true,
      reason: null,
      message: "",
      zone,
      redZone: null,
      city: cityByCircle,
    };
  }

  return {
    isCovered: !!zone,
    reason: zone ? null : "outside_city",
    message: zone ? "" : unavailableMessage,
    zone,
    redZone: null,
    city: null,
  };
}
