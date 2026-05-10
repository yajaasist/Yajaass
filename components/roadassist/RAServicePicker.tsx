import React, { useState, useMemo, useEffect, useCallback } from "react";
import { supabaseApi } from "@/lib/supabaseApi";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Car, Crown, Truck, Ambulance, Wrench, ShieldAlert, Zap, Bike, Bus,
  Flame, Star, Navigation, AlertTriangle, Settings, Phone, HardHat, Cog,
  MapPin, ChevronRight, ArrowLeft, CreditCard, Banknote,
  ArrowRightLeft, AlertCircle, Locate, Loader2, CheckCircle2, Wallet
} from "lucide-react";
import RAAddressSearch from "@/components/roadassist/RAAddressSearch";
import RALocationMapPicker from "@/components/roadassist/RALocationMapPicker";
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { nowCDMX } from "@/components/shared/dateUtils";
import { validateCoverageAvailability } from "@/components/shared/geozone";
import { getRoute } from "@/components/shared/mapsUtils";

const iconMap = {
  car: Car, crown: Crown, truck: Truck, ambulance: Ambulance, wrench: Wrench,
  shield: ShieldAlert, zap: Zap, bike: Bike, bus: Bus, flame: Flame, star: Star,
  navigation: Navigation, alert: AlertTriangle, settings: Settings, phone: Phone,
  hardhat: HardHat, cog: Cog,
};

const PAYMENT_METHODS = [
  { key: "cash", label: "Efectivo", icon: Banknote, color: "text-emerald-400" },
  { key: "card", label: "Tarjeta", icon: CreditCard, color: "text-blue-400" },
  { key: "transfer", label: "Transferencia", icon: ArrowRightLeft, color: "text-purple-400" },
  { key: "wallet", label: "Wallet", icon: Wallet, color: "text-violet-400" },
];

function calcDistance(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Leaflet icon fix
try {
  delete (L.Icon.Default.prototype as any)._getIconUrl;
  L.Icon.Default.mergeOptions({
    iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
    iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
    shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  });
} catch (_) {}

const _pickupIcon = new L.DivIcon({
  html: `<div style="width:32px;height:32px;background:#22C55E;border:3px solid white;border-radius:50%;box-shadow:0 4px 14px rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;"><svg xmlns='http://www.w3.org/2000/svg' width='14' height='14' fill='white' viewBox='0 0 24 24'><path d='M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z'/></svg></div>`,
  iconSize: [32, 32], iconAnchor: [16, 16], className: "",
});

const _dropoffIcon = new L.DivIcon({
  html: `<div style="width:32px;height:32px;background:#EF4444;border:3px solid white;border-radius:50%;box-shadow:0 4px 14px rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;"><svg xmlns='http://www.w3.org/2000/svg' width='14' height='14' fill='white' viewBox='0 0 24 24'><path d='M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z'/></svg></div>`,
  iconSize: [32, 32], iconAnchor: [16, 16], className: "",
});

function DragMarker({ lat, lon, onMove }) {
  const mRef = React.useRef(null);
  return (
    <Marker draggable position={[lat, lon]} icon={_pickupIcon} ref={mRef}
      eventHandlers={{ dragend() { const ll = mRef.current?.getLatLng(); if (ll) onMove(ll.lat, ll.lng); } }} />
  );
}

function MapCenterPreserveZoom({ pickupLat, pickupLon, dropoffLat, dropoffLon }) {
  const map = useMap();
  const prevRef = React.useRef(null);
  React.useEffect(() => {
    if (!pickupLat || !pickupLon) return;
    const hasDropoff = !!(dropoffLat && dropoffLon);
    const key = hasDropoff
      ? `${pickupLat.toFixed(4)},${pickupLon.toFixed(4)}|${dropoffLat?.toFixed(4)},${dropoffLon?.toFixed(4)}`
      : `${pickupLat.toFixed(4)},${pickupLon.toFixed(4)}`;
    if (prevRef.current === key) return;
    prevRef.current = key;

    const center: [number, number] = hasDropoff
      ? [(pickupLat + (dropoffLat as number)) / 2, (pickupLon + (dropoffLon as number)) / 2]
      : [pickupLat, pickupLon];

    map.setView(center, map.getZoom(), { animate: true });
  }, [pickupLat, pickupLon, dropoffLat, dropoffLon, map]);
  return null;
}

export default function RAServicePicker({ user, onRequestCreated, onRefreshUser }) {
  const queryClient = useQueryClient();
  const [step, setStep] = useState("category");
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [selectedService, setSelectedService] = useState(null);
  const [pickupAddress, setPickupAddress] = useState("");
  const [pickupLat, setPickupLat] = useState(null);
  const [pickupLon, setPickupLon] = useState(null);
  const [dropoffAddress, setDropoffAddress] = useState("");
  const [dropoffLat, setDropoffLat] = useState(null);
  const [dropoffLon, setDropoffLon] = useState(null);
  const [distanceKm, setDistanceKm] = useState(null);
  const [durationMin, setDurationMin] = useState(null);
  const [routeLoading, setRouteLoading] = useState(false);
  const [routePolyline, setRoutePolyline] = useState(null);
  const [notes, setNotes] = useState("");
  const [customFieldAnswers, setCustomFieldAnswers] = useState({});
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [paymentSelected, setPaymentSelected] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [gpsLoading, setGpsLoading] = useState(false);
  const [couponCode, setCouponCode] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState(null);
  const [couponError, setCouponError] = useState("");
  const [selectedExtras, setSelectedExtras] = useState([]);
  const [mapPicker, setMapPicker] = useState(null);
  // Wallet partial payment
  const [useWalletPartial, setUseWalletPartial] = useState(false);
  const [walletAmountToUse, setWalletAmountToUse] = useState("");
  const [complementaryMethod, setComplementaryMethod] = useState("");
  // Wallet recharge reference
  const [showWalletRecharge, setShowWalletRecharge] = useState(false);
  const [walletRechargeAmount, setWalletRechargeAmount] = useState("");
  const [walletRefGenerated, setWalletRefGenerated] = useState(null);
  const [generatingRef, setGeneratingRef] = useState(false);
  // Card gateway charge state
  const [cardCharged, setCardCharged] = useState(false);
  const [chargingCard, setChargingCard] = useState(false);
  const [cardChargeStatus, setCardChargeStatus] = useState(null); // null | 'success' | 'failed'

  const { data: serviceTypes = [] } = useQuery({
    queryKey: ["serviceTypes"],
    queryFn: () => supabaseApi.serviceTypes.list(),
  });

  const { data: appSettingsList = [] } = useQuery({
    queryKey: ["appSettings"],
    queryFn: () => supabaseApi.settings.list(),
  });
  const { data: geoZones = [] } = useQuery({
    queryKey: ["geoZones"],
    queryFn: () => supabaseApi.geoZones.list(),
  });
  const { data: redZones = [] } = useQuery({
    queryKey: ["redZones"],
    queryFn: () => supabaseApi.redZones.list(),
  });
  const { data: cities = [] } = useQuery({
    queryKey: ["cities"],
    queryFn: () => supabaseApi.cities.list(),
  });
  const appSettings = appSettingsList[0];
  // Filter payment methods: active + allowed for this service type
  const activePMs = useMemo(() => {
    const configured = appSettings?.payment_methods?.filter(m => {
      if (!m.is_active) return false;
      // If method has allowed_service_type_ids restriction, check if current service qualifies
      if (m.allowed_service_type_ids?.length && selectedService?.id) {
        return m.allowed_service_type_ids.includes(selectedService.id);
      }
      return true;
    });
    return configured?.length ? configured : null;
  }, [appSettings, selectedService?.id]);

  // When available payment methods change, reset selection to force user to pick
  useEffect(() => {
    setPaymentSelected(false);
    // Pre-select first method if only one available
    if (activePMs?.length === 1) {
      setPaymentMethod(activePMs[0].key);
      setPaymentSelected(true);
    } else if (!activePMs) {
      // No configured methods, use default "cash"
      setPaymentMethod("cash");
      setPaymentSelected(true);
    } else {
      // Multiple options: require explicit selection
      setPaymentMethod("");
      setPaymentSelected(false);
    }
  }, [activePMs?.length]);

  // Recent addresses from localStorage — keyed by user so each account has its own history
  const raAddressKey = user?.id ? `ra_recent_addresses_${user.id}` : "ra_recent_addresses";
  const recentAddresses = useMemo(() => {
    try { return JSON.parse(localStorage.getItem(raAddressKey) || "[]"); } catch { return []; }
  }, [step, raAddressKey]);

  const saveRecentAddress = useCallback((address, lat, lon) => {
    if (!address || !lat || !lon) return;
    const key = user?.id ? `ra_recent_addresses_${user.id}` : "ra_recent_addresses";
    const existing = (() => { try { return JSON.parse(localStorage.getItem(key) || "[]"); } catch { return []; } })();
    const filtered = existing.filter(a => a.address !== address);
    const updated = [{ address, lat, lon }, ...filtered].slice(0, 5);
    localStorage.setItem(key, JSON.stringify(updated));
  }, [user?.id]);

  const destinationRequired = !!appSettings?.destination_required;
  // Is selected service a "vial" category?
  const isVial = useMemo(() => /vial/i.test(selectedCategory || ""), [selectedCategory]);
  const isTransporteFlow = /transporte/i.test(selectedCategory || "");
  const isGruaFlow = /grua|grúa/i.test(selectedCategory || "");
  const pickupCoverage = useMemo(() => {
    if (pickupLat == null || pickupLon == null) return null;
    return validateCoverageAvailability(pickupLat, pickupLon, {
      zones: geoZones,
      redZones,
      cities,
    });
  }, [pickupLat, pickupLon, geoZones, redZones, cities]);

  // Fetch route when both coords available (only if destination required)
  const fetchRoute = async (pLat, pLon, dLat, dLon) => {
    if (!pLat || !pLon || !dLat || !dLon) return;
    setDistanceKm(null);
    setDurationMin(null);
    setRoutePolyline(null);
    setRouteLoading(true);
    const trafficFactor = appSettings?.city_traffic_factor ?? 1.0;
    const provider = appSettings?.maps_provider || "osrm";
    const apiKey = appSettings?.google_maps_api_key;
    try {
      const route = await getRoute(pLat, pLon, dLat, dLon, provider, apiKey);
      if (route) {
        const distKm = parseFloat(route.distKm.toFixed(1));
        const adjustedMins = Math.round(route.durationMin * trafficFactor);
        setDistanceKm(distKm);
        setDurationMin(adjustedMins);
        if (route.polyline?.length) {
          setRoutePolyline(route.polyline);
        }
      } else {
        // Fallback: distancia en línea recta
        const d = calcDistance(pLat, pLon, dLat, dLon);
        setDistanceKm(parseFloat(d.toFixed(1)));
        setDurationMin(Math.round((d / 30) * 60 * trafficFactor));
      }
    } catch (_) {
      // Fallback: distancia en línea recta si OSRM falla
      const d = calcDistance(pLat, pLon, dLat, dLon);
      setDistanceKm(parseFloat(d.toFixed(1)));
      setDurationMin(Math.round((d / 30) * 60 * trafficFactor));
    } finally {
      setRouteLoading(false);
    }
  };

  const { data: drivers = [] } = useQuery({
    queryKey: ["drivers_available"],
    queryFn: async () => {
      const all = await supabaseApi.drivers.list();
      return all.filter(d => d.status === "available" && d.approval_status === "approved");
    },
    staleTime: 30 * 1000, // 30s - drivers change status frequently but not every 15s
    gcTime: 10 * 60 * 1000,
    // Real-time updates via postgres_changes subscription in parent component
  });

  const activeServices = useMemo(() => serviceTypes.filter(s => s.is_active), [serviceTypes]);
  const categories = useMemo(() => {
    const map = {};
    activeServices.forEach(s => {
      const cat = s.category?.trim() || "Servicios";
      if (!map[cat]) map[cat] = [];
      map[cat].push(s);
    });
    return map;
  }, [activeServices]);
  const categoryList = Object.keys(categories);

  // GPS auto-location
  const getMyLocation = () => {
    if (!navigator.geolocation) { setError("Tu dispositivo no soporta geolocalización"); return; }
    setGpsLoading(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude;
        const lon = pos.coords.longitude;
        setPickupLat(lat);
        setPickupLon(lon);
        // Reverse geocode
        const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}`, { headers: { "Accept-Language": "es" } });
        const data = await res.json();
        setPickupAddress(data.display_name || `${lat.toFixed(5)}, ${lon.toFixed(5)}`);
        setGpsLoading(false);
      },
      () => { setError("No se pudo obtener tu ubicación. Escríbela manualmente."); setGpsLoading(false); },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  // Auto-GPS when entering transport map
  React.useEffect(() => {
    if (step === "transport_map" && !pickupLat) getMyLocation();
  }, [step]);

  const extrasTotal = useMemo(() => selectedExtras.reduce((sum, e) => sum + (e.price || 0), 0), [selectedExtras]);

  // ── Transfer payment reference generation ────────────────────────────────
  const [transferRefGenerated, setTransferRefGenerated] = useState(null);
  const walletRef = walletRefGenerated?.ref;
  const transferRef = transferRefGenerated?.ref;
  const [generatingTransferRef, setGeneratingTransferRef] = useState(false);

  const handleGenerateTransferRef = async (amount) => {
    setGeneratingTransferRef(true);
    const ref = "REF-" + Date.now().toString(36).toUpperCase() + "-" + Math.random().toString(36).slice(2, 6).toUpperCase();
    // Save pending ref on user record
    await supabaseApi.passengers.update(user.id, {
      wallet_pending_ref: ref,
      wallet_pending_amount: amount,
      wallet_pending_ref_created: nowCDMX(),
    });
    setTransferRefGenerated({ ref, amount });
    setGeneratingTransferRef(false);
  };

  if (user.pending_balance > 0) {
    return (
      <div className="h-full overflow-y-auto px-4 py-6 flex flex-col items-center justify-center gap-4 text-center">
        <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center">
          <AlertCircle className="w-8 h-8 text-red-400" />
        </div>
        <div>
          <h3 className="text-white font-bold text-lg mb-1">Saldo pendiente</h3>
          <p className="text-white/60 text-sm">Tienes un saldo pendiente de <span className="text-red-400 font-bold">${user.pending_balance?.toFixed(2)}</span> por una cancelación anterior.</p>
          <p className="text-white/40 text-xs mt-2">Liquida el saldo con tu operador para poder solicitar servicios.</p>
        </div>
        <button onClick={onRefreshUser} className="text-blue-400 text-sm underline">Actualizar estado</button>
      </div>
    );
  }

  const applyCoupon = () => {
    setCouponError("");
    const promos = appSettings?.promotions || [];
    const found = promos.find(p => p.is_active && p.code?.toUpperCase() === couponCode.trim().toUpperCase());
    if (!found) { setCouponError("Cupón inválido o inactivo"); return; }
    setAppliedCoupon(found);
  };

  const estimatePrice = (service, distKm = null, mins = null, coupon = null, extras = 0) => {
    if (!service) return 0;
    const useKm = distKm ?? 0;
    const useMins = mins ?? 0;
    const base = (service.base_price || 0) + (service.price_per_km || 0) * useKm + (service.price_per_minute || 0) * useMins;
    const calc = base * (service.surge_multiplier || 1);
    const price = Math.max(calc, service.minimum_fare || 0) + extras;
    if (coupon?.discount_pct) return price * (1 - coupon.discount_pct / 100);
    return price;
  };

  const minServicePrice = (service) => {
    if (!service) return 0;
    return Math.max(service.minimum_fare || 0, service.base_price || 0);
  };

  const findNearestDriver = () => {
    if (!pickupLat || !pickupLon || !selectedService) return null;
    const eligible = drivers.filter(d => d.service_type_ids?.includes(selectedService.id) && d.latitude && d.longitude);
    if (!eligible.length) return null;
    let nearest = null, minDist = Infinity;
    eligible.forEach(d => {
      const dist = calcDistance(pickupLat, pickupLon, d.latitude, d.longitude);
      if (dist < minDist) { minDist = dist; nearest = d; }
    });
    return nearest;
  };

  // Check if card method (contains "tarjeta" in label)
  const isCardMethod = (key) => {
    const method = (appSettings?.payment_methods || []).find(m => m.key === key);
    return method?.label?.toLowerCase().includes("tarjeta") || key === "card";
  };

  // Check if pending payment is allowed for selected method
  const isPendingAllowed = (key) => {
    const pending = appSettings?.pending_payment_methods || [];
    return pending.includes(key);
  };

  const walletBalance = user?.wallet_balance || 0;
  const walletAmountNum = +walletAmountToUse || 0;
  const fareProtectionEnabled = !!appSettings?.fare_protection_enabled;
  const fareProtectionLabel = appSettings?.fare_protection_label || "Tarifa protegida";

  // When wallet is selected as main method, check if it covers the full amount
  const walletIsInsufficient = (estimated) => paymentMethod === "wallet" && walletBalance < estimated;

  const handleChargeCard = async (amount) => {
    setChargingCard(true);
    setCardChargeStatus(null);
    // Simulate gateway charge via LLM (in real integration, call actual gateway API)
    // Here we set a pending status and tell admin to confirm
    // For now, mark as pending and set payment_status to "pending_card_charge"
    setCardChargeStatus("pending");
    setChargingCard(false);
    setCardCharged(true);
    return true;
  };

  const handleGenerateWalletRef = async () => {
    if (!walletRechargeAmount || +walletRechargeAmount <= 0) return;
    setGeneratingRef(true);
    const ref = "REF-" + Date.now().toString(36).toUpperCase() + "-" + Math.random().toString(36).slice(2,6).toUpperCase();
    // Store ref on user record
    await supabaseApi.passengers.update(user.id, {
      wallet_pending_ref: ref,
      wallet_pending_amount: +walletRechargeAmount,
      wallet_pending_ref_created: nowCDMX(),
    });
    setWalletRefGenerated({ ref, amount: +walletRechargeAmount });
    setGeneratingRef(false);
  };

  const handleSubmit = async () => {
    if (!pickupLat || !pickupLon) {
      setError("Ingresa la dirección de recogida");
      return;
    }
    const coverage = validateCoverageAvailability(pickupLat, pickupLon, {
      zones: geoZones,
      redZones,
      cities,
    });
    if (!coverage.isCovered) {
      if (coverage.reason === "red_zone") {
        setError("No disponible por zona roja. Ciudad no disponible, pronto estaremos aquí.");
      } else {
        setError(coverage.message || "Ciudad no disponible, pronto estaremos aquí.");
      }
      return;
    }
    setSubmitting(true);
    setError("");
    const estimated = estimatePrice(selectedService, distanceKm, durationMin, appliedCoupon, extrasTotal);

    const globalAuctionEnabled = !!appSettings?.auction_mode_enabled;
    const assignmentMode = globalAuctionEnabled ? "auction" : "auto";

    // Determine if this payment requires pending flow
    const isPending = isPendingAllowed(paymentMethod);
    // If card method, payment_status is pending_card_charge (admin confirms card)
    const isCard = isCardMethod(paymentMethod);
    // Check if this method requires payment before service (transfer, etc.)
    const pmConfig = (appSettings?.payment_methods || []).find(m => m.key === paymentMethod);
    const requiresBeforeService = !!pmConfig?.require_before_service || !!pmConfig?.generates_reference;

    // Deduct wallet partial if applicable
    let walletDeducted = 0;
    if (paymentMethod === "wallet") {
      // Deduct whatever is available
      const deduct = Math.min(walletBalance, estimated);
      if (deduct > 0) {
        const newBal = +(walletBalance - deduct).toFixed(2);
        await supabaseApi.passengers.update(user.id, { wallet_balance: newBal });
        walletDeducted = deduct;
      }
    } else if (useWalletPartial && walletAmountNum > 0 && walletBalance >= walletAmountNum) {
      const newBal = +(walletBalance - walletAmountNum).toFixed(2);
      await supabaseApi.passengers.update(user.id, { wallet_balance: newBal });
      walletDeducted = walletAmountNum;
    }

    const rideData = {
      passenger_name: user.full_name,
      passenger_phone: user.phone,
      passenger_user_id: user.id,
      passenger_rating: user.rating || null,
      passenger_photo_url: user.photo_url || null,
      pickup_address: pickupAddress,
      pickup_lat: pickupLat,
      pickup_lon: pickupLon,
      dropoff_address: !isVial ? dropoffAddress : undefined,
      dropoff_lat: !isVial ? dropoffLat : undefined,
      dropoff_lon: !isVial ? dropoffLon : undefined,
      distance_km: distanceKm || undefined,
      duration_minutes: durationMin || undefined,
      service_type_id: selectedService.id,
      service_type_name: selectedService.name,
      estimated_price: estimated,
      payment_method: paymentMethod === "wallet" && walletIsInsufficient(estimated) ? complementaryMethod : paymentMethod,
      notes,
      selected_extras: selectedExtras.length > 0 ? selectedExtras.map(e => ({ name: e.name, price: e.price })) : undefined,
      custom_field_answers: selectedService?.custom_fields?.length > 0
        ? selectedService.custom_fields.map(f => ({
            key: f.key,
            label: f.label,
            answer: customFieldAnswers[f.key] || ""
          })).filter(f => f.answer)
        : undefined,
      wallet_amount_used: walletDeducted > 0 ? walletDeducted : undefined,
      // Status: siempre crear como "pending" y dejar que useRideAutoAssign maneje la subasta/asignación
      // igual que el panel de administración — el hook detecta el evento create y procesa según assignment_mode
      status: (isPending || requiresBeforeService) ? "pending" : "pending",
      payment_status: (isPending || requiresBeforeService) ? "awaiting_payment" : (isCard ? "pending_card_charge" : undefined),
      assignment_mode: assignmentMode,
      // If awaiting payment, flag so auto-assign hook does NOT dispatch until confirmed
      awaiting_payment_confirmation: isPending || requiresBeforeService,
      // Store transfer reference if generated
      transfer_reference: (paymentMethod === "transfer" || pmConfig?.generates_reference) && transferRefGenerated ? transferRefGenerated.ref : undefined,
    };
    await supabaseApi.rideRequests.create({ ...rideData, requested_at: nowCDMX() });
    setSubmitting(false);
    onRequestCreated();
  };

  // ── MAP PICKER OVERLAY (must be before step checks) ─────────────────────────
  if (mapPicker) {
    const isPickup = mapPicker.field === "pickup";
    return (
      <RALocationMapPicker
        initialLat={isPickup ? pickupLat : dropoffLat}
        initialLon={isPickup ? pickupLon : dropoffLon}
        initialAddress={isPickup ? pickupAddress : dropoffAddress}
        label={isPickup ? "Punto de recogida" : "Destino"}
        onConfirm={(addr, lat, lon) => {
          if (isPickup) {
            setPickupAddress(addr); setPickupLat(lat); setPickupLon(lon);
            saveRecentAddress(addr, lat, lon);
            if (!isVial && dropoffLat && dropoffLon) fetchRoute(lat, lon, dropoffLat, dropoffLon);
          } else {
            setDropoffAddress(addr); setDropoffLat(lat); setDropoffLon(lon);
            saveRecentAddress(addr, lat, lon);
            if (pickupLat && pickupLon) fetchRoute(pickupLat, pickupLon, lat, lon);
          }
          setMapPicker(null);
        }}
        onClose={() => setMapPicker(null)}
      />
    );
  }

  // ── TRANSPORT MAP ────────────────────────────────────────────────────────────
  if (step === "transport_map") {
    const subs = categories[selectedCategory] || [];
    const destReady = !!(dropoffLat && dropoffLon);
    // Para servicios viales: no se necesita destino, solo origen
    const canContinue = isVial ? !!(pickupLat && pickupLon && selectedService) : !!(selectedService && destReady && distanceKm);
    return (
      <div className="fixed inset-0 flex flex-col bg-slate-900 z-10">
        {/* Map */}
        <div className="relative flex-1 min-h-0">
          <MapContainer center={[19.4326, -99.1332]} zoom={13} style={{ width: "100%", height: "100%" }} zoomControl={false}>
            <TileLayer url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png" />
            {pickupLat && pickupLon && (
              <MapCenterPreserveZoom
                pickupLat={pickupLat}
                pickupLon={pickupLon}
                dropoffLat={dropoffLat}
                dropoffLon={dropoffLon}
              />
            )}
            {routePolyline && <Polyline positions={routePolyline} color="#3B82F6" weight={4} opacity={0.85} />}
            {dropoffLat && dropoffLon && <Marker position={[dropoffLat, dropoffLon]} icon={_dropoffIcon}><Popup>Destino</Popup></Marker>}
            {pickupLat && pickupLon && (
              <DragMarker lat={pickupLat} lon={pickupLon} onMove={async (lat, lon) => {
                setPickupLat(lat); setPickupLon(lon);
                try {
                  const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}`, { headers: { "Accept-Language": "es" } });
                  const d = await res.json();
                  setPickupAddress(d.display_name || `${lat.toFixed(5)}, ${lon.toFixed(5)}`);
                } catch (_) {}
                if (!isVial && destReady) fetchRoute(lat, lon, dropoffLat, dropoffLon);
              }} />
            )}
          </MapContainer>
          {/* GPS loading overlay */}
          {!pickupLat && (
            <div className="absolute inset-0 flex items-center justify-center bg-slate-900/60 pointer-events-none" style={{ zIndex: 400 }}>
              <div className="bg-slate-800/90 rounded-2xl px-4 py-3 flex items-center gap-3">
                <Loader2 className="w-5 h-5 text-blue-400 animate-spin" />
                <p className="text-white/70 text-sm">Obteniendo tu ubicación...</p>
              </div>
            </div>
          )}

          {/* Top overlay — ORIGEN arriba, DESTINO solo si no es vial */}
          <div className="absolute top-0 left-0 right-0 z-[500] p-3 space-y-2" style={{ paddingTop: "max(76px, calc(env(safe-area-inset-top) + 68px))" }}>
            {/* Fila con botón atrás */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => { setStep("category"); setDropoffAddress(""); setDropoffLat(null); setDropoffLon(null); setSelectedService(null); setError(""); }}
                className="w-10 h-10 flex-shrink-0 bg-slate-900/95 backdrop-blur-md rounded-full flex items-center justify-center shadow-2xl border border-white/10">
                <ArrowLeft className="w-5 h-5 text-white" />
              </button>
              {/* ORIGEN */}
              <div className="flex-1 min-w-0 bg-slate-900/95 backdrop-blur-md rounded-2xl shadow-2xl border border-white/10">
                <div className="flex items-center gap-2 px-3 py-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 flex-shrink-0" />
                  <input
                    value={pickupAddress}
                    onChange={e => setPickupAddress(e.target.value)}
                    onBlur={async (e) => {
                      const addr = e.target.value.trim();
                      if (!addr) return;
                      try {
                        const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(addr)}&limit=1`, { headers: { "Accept-Language": "es" } });
                        const data = await res.json();
                        if (data[0]) { setPickupLat(parseFloat(data[0].lat)); setPickupLon(parseFloat(data[0].lon)); }
                      } catch (_) {}
                    }}
                    onKeyDown={e => e.key === "Enter" && (e.currentTarget as HTMLInputElement).blur()}
                    placeholder="Obteniendo ubicación..."
                    className="text-white text-xs flex-1 min-w-0 bg-transparent outline-none placeholder:text-white/40"
                  />
                  <button onClick={getMyLocation} disabled={gpsLoading} className="text-blue-400 text-xs flex-shrink-0 px-1">
                    {gpsLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : "📍"}
                  </button>
                  <span className="text-white/20 text-xs">|</span>
                  <button onClick={() => setMapPicker({ field: "pickup" })} className="text-blue-400 text-xs flex-shrink-0 whitespace-nowrap">Mover</button>
                </div>
              </div>
            </div>
            {/* DESTINO — solo si NO es vial */}
            {!isVial && (
              <div className="ml-12 bg-slate-900/95 backdrop-blur-md rounded-2xl shadow-2xl border border-white/10">
                <RAAddressSearch
                  value={dropoffAddress}
                  placeholder="¿A dónde vamos? (destino)"
                  recentAddresses={recentAddresses}
                  onChange={(addr, lat, lon) => {
                    setDropoffAddress(addr); setDropoffLat(lat); setDropoffLon(lon);
                    if (lat && lon) saveRecentAddress(addr, lat, lon);
                    if (pickupLat && pickupLon && lat && lon) fetchRoute(pickupLat, pickupLon, lat, lon);
                  }}
                />
              </div>
            )}
          </div>
        </div>

        {/* Bottom sheet */}
        <div className="flex-shrink-0 bg-slate-950 rounded-t-3xl border-t border-white/15 px-4 pt-4 shadow-2xl" style={{ paddingBottom: "max(24px, env(safe-area-inset-bottom))" }}>
          {/* Leyenda de ruta — solo para servicios con destino */}
          {!isVial && (
            destReady && distanceKm ? (
              <div className="mb-3 bg-blue-500/15 border border-blue-500/30 rounded-2xl px-3 py-2.5 flex items-start gap-2">
                <Navigation className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5" />
                <p className="text-blue-200 text-xs leading-snug">
                  <span className="font-bold">{distanceKm} km · ~{durationMin} min</span> · {fareProtectionEnabled
                    ? `${fareProtectionLabel}: pagarás exactamente el estimado mostrado.`
                    : "Las tarifas son aproximadas, el costo final se cobra al concluir el servicio"}
                </p>
              </div>
            ) : (
              <p className="text-white/60 text-xs text-center mb-3">Ingresa tu destino para ver tarifas estimadas</p>
            )
          )}

          {routeLoading && (
            <p className="text-blue-400/70 text-xs text-center mb-2 flex items-center justify-center gap-1">
              <Loader2 className="w-3 h-3 animate-spin" /> Calculando ruta...
            </p>
          )}

          {/* Horizontal carousel */}
          <div className="flex gap-2 overflow-x-auto pb-2 -mx-4 px-4" style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}>
            {subs.map(s => {
              const Icon = iconMap[s.icon] || Car;
              const color = s.color || "#3B82F6";
              const price = estimatePrice(s, distanceKm, durationMin);
              const isSel = selectedService?.id === s.id;
              const displayMin = minServicePrice(s);
              return (
                <button key={s.id}
                  onClick={() => {
                    setSelectedService(s);
                    setError("");
                    if (!isVial && !destReady) setError("Ingresa tu destino para continuar");
                  }}
                  className={`flex-shrink-0 flex flex-col items-start gap-2 p-3 rounded-2xl border transition-all w-48 text-left ${
                    isSel ? "border-blue-500 bg-blue-500/15" : "border-white/10 bg-white/5 active:bg-white/15"
                  }`}>
                  <div className="flex items-center gap-2 w-full">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center overflow-hidden" style={{ backgroundColor: color + "25", color }}>
                      {s.icon_url
                        ? <img src={s.icon_url} alt={s.name} className="w-full h-full object-cover" />
                        : <Icon className="w-5 h-5" />}
                    </div>
                    <div className="min-w-0">
                      <p className="text-white font-semibold text-sm leading-tight">{s.name}</p>
                      {s.description && <p className="text-white/40 text-[11px] line-clamp-2">{s.description}</p>}
                    </div>
                  </div>
                  <div className="w-full flex items-center justify-between gap-2">
                    {!isVial && destReady ? (
                      <p className="text-emerald-400 text-[11px] font-bold">~${price.toFixed(0)}</p>
                    ) : (
                      <p className="text-white/40 text-[10px]">Desde ${displayMin.toFixed(0)}</p>
                    )}
                    {isSel && <span className="text-blue-300 text-[10px] font-semibold">Seleccionado</span>}
                  </div>
                </button>
              );
            })}
          </div>
          {error && <p className="text-red-400 text-xs text-center mt-1 mb-1">{error}</p>}
          {!error && pickupCoverage && !pickupCoverage.isCovered && (
            <p className="text-amber-300 text-xs text-center mt-1 mb-1">Ciudad no disponible, pronto estaremos aquí.</p>
          )}
          {/* Reintentar ruta — solo si tiene destino */}
          {!isVial && selectedService && destReady && !distanceKm && !routeLoading && (
            <button
              onClick={() => fetchRoute(pickupLat, pickupLon, dropoffLat, dropoffLon)}
              className="w-full bg-amber-500 hover:bg-amber-400 text-white font-bold text-sm py-3.5 rounded-2xl mt-2 transition-all">
              ↺ Reintentar calcular ruta
            </button>
          )}
          {canContinue && !routeLoading && (
            <button
              onClick={() => { setError(""); setStep("payment"); }}
              className="w-full bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white font-bold text-sm py-3.5 rounded-2xl mt-2 transition-all">
              Continuar para solicitar →
            </button>
          )}
          {routeLoading && (
            <div className="w-full flex items-center justify-center gap-2 py-3.5 mt-2 rounded-2xl bg-white/5 border border-white/10">
              <Loader2 className="w-4 h-4 animate-spin text-blue-400" />
              <span className="text-white/60 text-sm">Calculando ruta...</span>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── GRUA PICKER ──────────────────────────────────────────────────────────────
  if (step === "grua_picker") {
    const subs = categories[selectedCategory] || [];
    return (
      <div className="flex flex-col h-full overflow-hidden px-4 pt-3 pb-2">
        <div className="flex items-center gap-3 mb-2 flex-shrink-0">
          <button onClick={() => { setStep("category"); setSelectedCategory(null); }}
            className="w-8 h-8 rounded-xl bg-white/10 flex items-center justify-center text-white/60 flex-shrink-0">
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <p className="text-white/40 text-xs">Asistencia vial</p>
            <h2 className="text-white font-bold text-base leading-tight">{selectedCategory}</h2>
          </div>
        </div>
        <p className="text-white/50 text-xs mb-2 flex-shrink-0">Elige el servicio que mejor se adapte a tu situación:</p>
        <div className="flex-1 space-y-2 overflow-y-auto">
          {subs.map(s => {
            const Icon = iconMap[s.icon] || Truck;
            const color = s.color || "#F59E0B";
            const displayMin = minServicePrice(s);
            return (
              <button key={s.id}
                onClick={() => { setSelectedService(s); setStep("details"); }}
                className="w-full text-left p-3 rounded-2xl border border-white/10 bg-white/5 active:bg-white/15 transition-all">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 overflow-hidden" style={{ backgroundColor: color + "25", color }}>
                    {s.icon_url
                      ? <img src={s.icon_url} alt={s.name} className="w-full h-full object-cover" />
                      : <Icon className="w-6 h-6" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-white font-bold text-sm">{s.name}</p>
                    <span className="text-xs bg-white/10 text-white/60 px-2 py-0.5 rounded-full inline-block mt-0.5">Desde ${displayMin.toFixed(0)}</span>
                    {s.description && <p className="text-white/40 text-xs mt-0.5 line-clamp-2">{s.description}</p>}
                  </div>
                  <ChevronRight className="w-4 h-4 text-white/30 flex-shrink-0" />
                </div>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  // ── CATEGORY ────────────────────────────────────────────────────────────────
  if (step === "category") {
    return (
      <div className="flex flex-col h-full overflow-hidden px-4 pt-3 pb-2">
        <div className="mb-3 flex-shrink-0">
          <h2 className="text-white font-bold text-lg">¿Qué necesitas?</h2>
          <p className="text-white/40 text-xs mt-0.5">Elige el tipo de servicio</p>
        </div>
        {categoryList.length === 0 && (
          <div className="flex-1 flex flex-col items-center justify-center text-white/30">
            <Wrench className="w-10 h-10 mb-3 opacity-30" />
            <p className="text-sm">No hay servicios disponibles</p>
          </div>
        )}
        <div className="flex-1 grid grid-cols-2 gap-2.5 content-start overflow-hidden">
          {categoryList.map(cat => {
            const subs = categories[cat];
            const Icon = iconMap[subs[0]?.icon] || Wrench;
            const color = subs[0]?.color || "#3B82F6";
            return (
              <button key={cat} onClick={() => {
                setSelectedCategory(cat);
                // Todos los tipos de servicio abren el flujo con mapa (igual que transporte)
                setStep("transport_map");
              }}
                className="flex flex-col items-center gap-2 p-3 rounded-2xl border border-white/10 bg-white/5 active:bg-white/15 transition-all text-center">
                <div className="w-11 h-11 rounded-2xl flex items-center justify-center" style={{ backgroundColor: color + "25", color }}>
                  <Icon className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-white font-bold text-sm">{cat}</p>
                  <p className="text-white/40 text-xs">{subs.length} servicio{subs.length !== 1 ? "s" : ""}</p>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  // ── SERVICE ─────────────────────────────────────────────────────────────────
  if (step === "service") {
    const subs = categories[selectedCategory] || [];
    return (
      <div className="flex flex-col h-full overflow-hidden px-4 pt-3 pb-2">
        <div className="flex items-center gap-3 mb-3 flex-shrink-0">
          <button onClick={() => { setStep("category"); setSelectedCategory(null); }}
            className="w-8 h-8 rounded-xl bg-white/10 flex items-center justify-center text-white/60 flex-shrink-0">
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <p className="text-white/40 text-xs">Categoría</p>
            <h2 className="text-white font-bold text-base leading-tight">{selectedCategory}</h2>
          </div>
        </div>
        <div className="flex-1 space-y-2 overflow-y-auto">
          {subs.map(s => {
            const Icon = iconMap[s.icon] || Car;
            const displayMin = minServicePrice(s);
            return (
              <button key={s.id} onClick={() => { setSelectedService(s); setStep("details"); }}
                className="w-full flex items-center gap-3 p-3 rounded-2xl border border-white/10 bg-white/5 active:bg-white/15 transition-all text-left">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 overflow-hidden" style={{ backgroundColor: (s.color || "#3B82F6") + "25", color: s.color || "#3B82F6" }}>
                  {s.icon_url
                    ? <img src={s.icon_url} alt={s.name} className="w-full h-full object-cover" />
                    : <Icon className="w-5 h-5" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-white font-bold text-sm">{s.name}</p>
                  {s.description && <p className="text-white/40 text-xs mt-0.5 line-clamp-1">{s.description}</p>}
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-xs bg-white/10 text-white/60 px-2 py-0.5 rounded-full">Desde ${displayMin.toFixed(0)}</span>
                    <span className="text-xs text-white/40">${s.price_per_km}/km</span>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-white/30 flex-shrink-0" />
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  // ── DETAILS ──────────────────────────────────────────────────────────────────
  if (step === "details") {
    const Icon = iconMap[selectedService?.icon] || Car;
    const color = selectedService?.color || "#3B82F6";
    return (
      <div className="flex flex-col h-full overflow-hidden px-4 pt-3 pb-2">
        <div className="flex items-center gap-3 mb-3 flex-shrink-0">
          <button onClick={() => setStep(isGruaFlow ? "grua_picker" : "service")} className="w-8 h-8 rounded-xl bg-white/10 flex items-center justify-center text-white/60 flex-shrink-0">
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ backgroundColor: color + "25", color }}>
              <Icon className="w-4 h-4" />
            </div>
            <div>
              <p className="text-white/40 text-xs">{selectedCategory}</p>
              <p className="text-white font-bold text-sm">{selectedService?.name}</p>
              {selectedService?.description && (
                <p className="text-white/50 text-xs mt-1 line-clamp-2">{selectedService.description}</p>
              )}
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto space-y-3 pb-2">
          <div>
            <label className="text-white/50 text-xs font-medium block mb-1.5">📍 Dirección de recogida *</label>
            <RAAddressSearch
              value={pickupAddress}
              placeholder="Dirección de recogida"
              recentAddresses={recentAddresses}
              onChange={(addr, lat, lon) => {
                setPickupAddress(addr); setPickupLat(lat); setPickupLon(lon);
                if (lat && lon) saveRecentAddress(addr, lat, lon);
                if (!isVial && dropoffLat && dropoffLon && lat && lon) fetchRoute(lat, lon, dropoffLat, dropoffLon);
              }}
            />
            <div className="flex gap-2 mt-2">
              <button
                onClick={getMyLocation}
                disabled={gpsLoading}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border border-blue-500/30 bg-blue-500/10 text-blue-400 text-sm active:bg-blue-500/20 transition-all"
              >
                {gpsLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Locate className="w-4 h-4" />}
                {gpsLoading ? "Obteniendo..." : "Mi ubicación"}
              </button>
              {pickupLat && pickupLon && (
                <button
                  onClick={() => setMapPicker({ field: "pickup" })}
                  className="flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-400 text-sm active:bg-emerald-500/20 transition-all"
                >
                  <MapPin className="w-4 h-4" /> Ajustar en mapa
                </button>
              )}
            </div>
            {pickupLat && pickupLon && (
              <p className="text-emerald-400/70 text-xs mt-1.5 flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" /> Ubicación confirmada
              </p>
            )}
          </div>

          {/* Destination — only for non-vial services */}
          {!isVial && (
            <div>
              <label className="text-white/50 text-xs font-medium block mb-1.5">🏁 Destino {destinationRequired ? <span className="text-red-400">*</span> : "(opcional)"}</label>
              <RAAddressSearch
                value={dropoffAddress}
                placeholder="Dirección destino"
                recentAddresses={recentAddresses}
                onChange={(addr, lat, lon) => {
                  setDropoffAddress(addr); setDropoffLat(lat); setDropoffLon(lon);
                  if (lat && lon) saveRecentAddress(addr, lat, lon);
                  if (pickupLat && pickupLon && lat && lon) fetchRoute(pickupLat, pickupLon, lat, lon);
                }}
              />
              {dropoffLat && dropoffLon && (
                <button
                  onClick={() => setMapPicker({ field: "dropoff" })}
                  className="mt-2 flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-400 text-sm active:bg-emerald-500/20 transition-all"
                >
                  <MapPin className="w-3.5 h-3.5" /> Ajustar destino en mapa
                </button>
              )}
              {routeLoading && (
                <p className="text-blue-400/70 text-xs mt-1.5 flex items-center gap-1">
                  <Loader2 className="w-3 h-3 animate-spin" /> Calculando ruta...
                </p>
              )}
              {distanceKm && durationMin && (
                <p className="text-emerald-400/70 text-xs mt-1.5 flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" /> {distanceKm} km · aprox. {durationMin} min
                </p>
              )}
            </div>
          )}

          {/* Extras del servicio */}
          {(selectedService?.service_extras || []).filter(e => e.is_active !== false).length > 0 && (
            <div className="bg-white/5 border border-amber-400/20 rounded-2xl p-3 space-y-2">
              <p className="text-amber-300 text-xs font-semibold uppercase tracking-wide">⭐ Extras opcionales</p>
              {(selectedService.service_extras || []).filter(e => e.is_active !== false).map((extra, idx) => {
                const isSelected = selectedExtras.some(e => e.name === extra.name);
                return (
                  <button key={idx} onClick={() => {
                    setSelectedExtras(prev =>
                      isSelected ? prev.filter(e => e.name !== extra.name) : [...prev, extra]
                    );
                  }}
                    className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl border transition-all ${
                      isSelected ? "border-amber-500/50 bg-amber-500/10" : "border-white/10 bg-white/5"
                    }`}>
                    <span className={`text-sm font-medium ${isSelected ? "text-white" : "text-white/70"}`}>{extra.name}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-amber-400 text-sm font-bold">+${extra.price?.toFixed(0) || 0}</span>
                      {isSelected && <span className="text-amber-400 text-xs">✓</span>}
                    </div>
                  </button>
                );
              })}
              {selectedExtras.length > 0 && (
                <p className="text-amber-300/70 text-xs text-right">Extras: +${extrasTotal.toFixed(0)}</p>
              )}
            </div>
          )}

          {/* Campos personalizados del servicio */}
          {(selectedService?.custom_fields || []).length > 0 && (
            <div className="bg-white/5 border border-violet-400/30 rounded-2xl p-3 space-y-2">
              <p className="text-violet-300 text-xs font-semibold uppercase tracking-wide">📋 Información del servicio</p>
              {selectedService.custom_fields.map(field => (
                <div key={field.key}>
                  <label className="text-white/50 text-xs font-medium block mb-1.5">
                    {field.label}{field.required && <span className="text-red-400 ml-0.5">*</span>}
                  </label>
                  {field.type === "select" ? (
                    <select
                      className="w-full bg-white/10 border border-white/20 text-white rounded-xl px-3 py-2.5 text-sm"
                      value={customFieldAnswers[field.key] || ""}
                      onChange={e => setCustomFieldAnswers(prev => ({ ...prev, [field.key]: e.target.value }))}
                    >
                      <option value="">Seleccionar...</option>
                      {(field.options || []).map((opt, j) => (
                        <option key={j} value={opt} className="bg-slate-800">{opt}</option>
                      ))}
                    </select>
                  ) : (
                    <Input
                      type={field.type === "number" ? "number" : "text"}
                      value={customFieldAnswers[field.key] || ""}
                      onChange={e => setCustomFieldAnswers(prev => ({ ...prev, [field.key]: e.target.value }))}
                      placeholder={field.placeholder || `Ingresa ${field.label}`}
                      className="bg-white/10 border-white/20 text-white placeholder:text-white/30 rounded-xl"
                    />
                  )}
                </div>
              ))}
            </div>
          )}

          <div>
            <label className="text-white/50 text-xs font-medium block mb-1.5">📝 Notas (opcional)</label>
            <Input value={notes} onChange={e => setNotes(e.target.value)}
              placeholder="Ingresa tu nota"
              className="bg-white/10 border-white/20 text-white placeholder:text-white/30 rounded-xl" />
          </div>

          {error && <p className="text-red-400 text-xs bg-red-400/10 rounded-xl p-3 text-center">{error}</p>}
          {!error && pickupCoverage && !pickupCoverage.isCovered && (
            <p className="text-amber-300 text-xs bg-amber-400/10 rounded-xl p-3 text-center">Ciudad no disponible, pronto estaremos aquí.</p>
          )}

          <Button onClick={() => {
            if (!pickupAddress) { setError("Ingresa la dirección de recogida"); return; }
            if (!isVial && destinationRequired && !dropoffAddress) { setError("La dirección de destino es obligatoria"); return; }
            // Validate required custom fields
            const missing = (selectedService?.custom_fields || []).find(f => f.required && !customFieldAnswers[f.key]);
            if (missing) { setError(`El campo "${missing.label}" es obligatorio`); return; }
            setError(""); setStep("payment");
          }} className="w-full bg-blue-600 hover:bg-blue-500 rounded-2xl h-11 font-bold">
            Continuar →
          </Button>
        </div>
      </div>
    );
  }

  // ── PAYMENT ──────────────────────────────────────────────────────────────────
  if (step === "payment") {
    const estimated = estimatePrice(selectedService, distanceKm, durationMin, null, extrasTotal);
    // Use platform payment methods if configured, otherwise fallback
    const paymentOptions = activePMs
      ? activePMs.map(m => {
          const match = PAYMENT_METHODS.find(pm => pm.key === m.key);
          return match ? { ...match, label: m.label || match.label, require_before_service: m.require_before_service } : null;
        }).filter(Boolean)
      : PAYMENT_METHODS;
    const selectedMethodCfg = paymentOptions.find(m => m.key === paymentMethod);
    const requireBeforeService = !!selectedMethodCfg?.require_before_service;
    return (
      <div className="flex flex-col h-full overflow-hidden px-4 pt-3 pb-2">
        <div className="flex items-center gap-3 mb-3 flex-shrink-0">
          <button onClick={() => setStep("transport_map")} className="w-8 h-8 rounded-xl bg-white/10 flex items-center justify-center text-white/60 flex-shrink-0">
            <ArrowLeft className="w-4 h-4" />
          </button>
          <h2 className="text-white font-bold text-base">Método de pago</h2>
        </div>

        <div className="flex-1 overflow-y-auto space-y-2.5 pb-2">
          <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
            <p className="text-white/40 text-xs mb-1">Tarifa estimada</p>
            <p className="text-white font-black text-3xl">${estimated.toFixed(0)} <span className="text-white/30 text-sm font-normal">MXN</span></p>
            {selectedService?.description && (
              <p className="text-white/40 text-xs mt-2 line-clamp-2">{selectedService.description}</p>
            )}
            {fareProtectionEnabled && (
              <p className="text-emerald-300 text-xs mt-1 font-semibold">✅ {fareProtectionLabel}</p>
            )}
            {distanceKm ? (
              <p className="text-white/30 text-xs mt-1">{distanceKm} km · {durationMin} min</p>
            ) : (
              <p className="text-white/30 text-xs mt-1">Tarifa mínima del servicio</p>
            )}
          </div>

          <div className="bg-white/5 border border-white/10 rounded-2xl p-3 space-y-2">
            <div className="flex items-start gap-2">
              <MapPin className="w-3.5 h-3.5 text-blue-400 flex-shrink-0 mt-0.5" />
              <p className="text-white/70 text-xs line-clamp-2">{pickupAddress}</p>
            </div>
            {!isVial && dropoffAddress && (
              <div className="flex items-start gap-2">
                <MapPin className="w-3.5 h-3.5 text-red-400 flex-shrink-0 mt-0.5" />
                <p className="text-white/70 text-xs line-clamp-2">{dropoffAddress}</p>
              </div>
            )}
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: selectedService?.color || "#3B82F6" }} />
              <p className="text-white/60 text-xs">{selectedCategory} · {selectedService?.name}</p>
            </div>
          </div>

          {/* Métodos de pago disponibles */}
          <div className="space-y-2">
            <p className="text-white/40 text-xs">Selecciona un método de pago</p>
            <div className="flex flex-col gap-2">
              {paymentOptions.map(opt => (
                <button key={opt.key} onClick={() => setPaymentMethod(opt.key)}
                  className={`w-full text-left p-3 rounded-2xl border transition-all ${paymentMethod === opt.key ? 'border-blue-500 bg-blue-500/10' : 'border-white/10 bg-white/5'}`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ backgroundColor: opt.color || '#111827', color: '#fff' }}>
                        {opt.icon ? <opt.icon className="w-4 h-4" /> : <CreditCard className="w-4 h-4" />}
                      </div>
                      <div>
                        <p className="text-white font-semibold text-sm">{opt.label}</p>
                        {opt.description && <p className="text-white/40 text-xs">{opt.description}</p>}
                      </div>
                    </div>
                    {opt.require_before_service && <span className="text-amber-400 text-xs">Pago previo</span>}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Cupones y resumen */}
          <div className="space-y-2">
            <div className="flex gap-2">
              <Input value={couponCode} onChange={e => setCouponCode(e.target.value)} placeholder="Código promocional" className="flex-1 bg-white/5 text-white/70" />
              <button onClick={async () => {
                if (!couponCode) return setError('Ingresa un código');
                try {
                  // TODO: Implement via Supabase Edge Function
                  // const { data: res } = await supabase.functions.invoke("apply-coupon", { body: { code: couponCode } });
                  console.warn("Coupon feature requires Edge Function implementation");
                  setError('Cupones aún no disponibles');
                } catch (err) { setError('Cupón inválido'); }
              }} className="px-3 rounded-2xl bg-emerald-500 text-white">Aplicar</button>
            </div>

            <div className="bg-white/5 border border-white/10 rounded-2xl p-3 flex items-center justify-between">
              <div>
                <p className="text-white/40 text-xs">Total estimado</p>
                <p className="text-white font-bold text-lg">${(estimated - (appliedCoupon?.discount || 0)).toFixed(0)} MXN</p>
              </div>
              <div className="text-right text-white/60 text-xs">Extras: +${extrasTotal.toFixed(0)}</div>
            </div>
          </div>

          {/* Opciones de pago específicas */}
          <div className="space-y-2">
            {paymentMethod === 'wallet' && (
              <div className="bg-white/5 border border-white/10 rounded-2xl p-3">
                <p className="text-white/70 text-sm">Saldo: ${walletBalance.toFixed(2)}</p>
                <div className="flex gap-2 mt-3">
                  <button onClick={async () => { await handleGenerateWalletRef(); }} className="flex-1 rounded-2xl bg-blue-600 text-white py-2">Pagar con wallet</button>
                  <button onClick={() => setPaymentMethod('card')} className="rounded-2xl px-3 bg-white/5 text-white">Usar tarjeta</button>
                </div>
              </div>
            )}

            {paymentMethod === 'transfer' && (
              <div className="bg-white/5 border border-white/10 rounded-2xl p-3">
                <p className="text-white/70 text-sm">Transferencia bancaria</p>
                {!transferRef && <button onClick={() => handleGenerateTransferRef(estimated)} className="mt-3 w-full rounded-2xl bg-emerald-500 text-white py-2">Generar referencia</button>}
                {transferRef && (
                  <div className="mt-3">
                    <p className="text-white text-sm">Ref: <span className="font-mono text-amber-300">{transferRef}</span></p>
                    <p className="text-white/50 text-xs mt-1">Envía la transferencia y el servicio se confirmará cuando recibamos el pago.</p>
                  </div>
                )}
              </div>
            )}

            {paymentMethod === 'card' && (
              <div className="bg-white/5 border border-white/10 rounded-2xl p-3">
                <p className="text-white/70 text-sm">Pagar con tarjeta</p>
                <div className="mt-3 flex gap-2">
                  <button onClick={() => handleChargeCard(estimated)} className="flex-1 rounded-2xl bg-blue-600 text-white py-2">Cobrar tarjeta</button>
                </div>
                {cardChargeStatus === 'charging' && <p className="text-white/60 text-xs mt-2">Procesando pago...</p>}
                {cardChargeStatus === 'failed' && <p className="text-red-400 text-xs mt-2">Pago fallido</p>}
              </div>
            )}
          </div>

          {/* Error global */}
          {error && <p className="text-red-400 text-xs text-center">{error}</p>}
          {!error && pickupCoverage && !pickupCoverage.isCovered && (
            <p className="text-amber-300 text-xs text-center">Ciudad no disponible, pronto estaremos aquí.</p>
          )}

          <div className="pt-3">
            <Button onClick={async () => {
              if (pickupCoverage && !pickupCoverage.isCovered) {
                setError("Ciudad no disponible, pronto estaremos aquí.");
                return;
              }
              if (requireBeforeService) {
                // Si el método requiere pago previo, intentar cobrar ahora
                if (paymentMethod === 'card') {
                  await handleChargeCard(estimated);
                } else if (paymentMethod === 'wallet') {
                  if (!walletRef) await handleGenerateWalletRef();
                } else if (paymentMethod === 'transfer') {
                  if (!transferRef) await handleGenerateTransferRef(estimated);
                }
              }
              await handleSubmit();
            }}
            disabled={submitting || (pickupCoverage ? !pickupCoverage.isCovered : false)}
            className="w-full bg-emerald-500 hover:bg-emerald-400 rounded-2xl h-12 font-bold">
              Solicitar servicio
            </Button>
            <p className="text-white/40 text-xs text-center mt-2">Al solicitar confirmas que aceptas los términos y condiciones.</p>
          </div>
        </div>
      </div>
    );
  }

  return null;
}


