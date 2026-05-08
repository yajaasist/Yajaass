import React, { useState, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { supabaseApi } from "@/lib/supabaseApi";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import AddressSearch from "./AddressSearch";
import MapPreview from "./MapPreview";
import AdminMapPicker from "./AdminMapPicker";
import { detectZone, calcZonePrice, detectRedZone, validateCoverageAvailability, calcPriceForNormalService, calcPriceForCorporateService } from "@/components/shared/geozone";
import { Gavel, Car, AlertTriangle, Camera, Calendar, Phone } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { nowCDMX, futureCDMX, todayCDMX, systemLocalToISO } from "@/components/shared/dateUtils";

export default function CreateRideDialog({ open, onOpenChange, serviceTypes, paymentMethods, onRideCreated }) {
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [pickupCoords, setPickupCoords] = useState(null);
  const [dropoffCoords, setDropoffCoords] = useState(null);
  const [routeLoading, setRouteLoading] = useState(false);
  const [routePoints, setRoutePoints] = useState(null);
  const [mapPickerField, setMapPickerField] = useState(null); // "pickup" | "dropoff"
  const [detectedZone, setDetectedZone] = useState(null);
  const [detectedRedZone, setDetectedRedZone] = useState(null);
  const [coverageValidation, setCoverageValidation] = useState<any>(null);
  const [form, setForm] = useState({
    passenger_name: "", passenger_phone: "", pickup_address: "", dropoff_address: "",
    service_type_name: "", service_type_id: "", estimated_price: "", distance_km: "", duration_minutes: "",
    payment_method: "", notes: "", company_id: "", ride_type: "normal", assignment_mode: "auto",
    require_proof_photo: false,
    require_admin_approval: false,
    is_scheduled: false,
    scheduled_date: "",
    scheduled_time: "",
    extra_company_cost: "",
    show_phone_to_driver: true,
    // Corporate: company_price = what company pays, driver sees only driver_estimated_price
    company_price: "",
    driver_estimated_price: "",
    gasoline_liters: "",
  });

  const { data: zones = [] } = useQuery({
    queryKey: ["geoZones"],
    queryFn: () => supabaseApi.geoZones.list(),
    enabled: open,
  });

  const { data: redZones = [] } = useQuery({
    queryKey: ["redZones"],
    queryFn: () => supabaseApi.redZones.list(),
    enabled: open,
  });

  const { data: companies = [] } = useQuery({
    queryKey: ["companies"],
    queryFn: async () => (await supabaseApi.companies.list()).filter(c => c.is_active === true),
    enabled: open,
  });

  const { data: cities = [] } = useQuery({
    queryKey: ["cities"],
    queryFn: () => supabaseApi.cities.list(),
    enabled: open,
  });

  const [folioAnswers, setFolioAnswers] = useState({});
  const [customFieldAnswers, setCustomFieldAnswers] = useState({});

  // Wallet user state
  const [walletUser, setWalletUser] = useState(null);
  const [walletBalance, setWalletBalance] = useState(0);
  const [insufficientWalletBalance, setInsufficientWalletBalance] = useState(false);

  const { data: settingsList = [] } = useQuery({
    queryKey: ["appSettings"],
    queryFn: () => supabaseApi.settings.list(),
    enabled: open,
  });
  const settings = settingsList[0];

  // Auto-fill passenger data from phone number
  const handlePhoneBlur = async (phone) => {
    if (!phone || phone.length < 8) return;
    const found = (await supabaseApi.roadAssistUsers.list()).filter(p => p.phone === phone.trim());
    if (found.length > 0) {
      const p = found[0];
      setForm(prev => ({ ...prev, passenger_name: p.full_name || prev.passenger_name }));

      // Set wallet user data
      setWalletUser(p);
      setWalletBalance(p.wallet_balance || 0);
    } else {
      // Reset wallet data if user not found
      setWalletUser(null);
      setWalletBalance(0);
    }
  };

  const [selectedCategory, setSelectedCategory] = useState("");
  const update = (field, value) => setForm(prev => ({ ...prev, [field]: value }));

  // Build category list from active serviceTypes
  const categoryList = useMemo(() => {
    const cats = new Set();
    (serviceTypes || []).filter(s => s.is_active).forEach(s => cats.add(s.category?.trim() || "Servicios"));
    return (Array.from(cats) as string[]).sort();
  }, [serviceTypes]);

  // Filter services by selected category
  const filteredServices = useMemo(() => {
    if (!selectedCategory) return [];
    return (serviceTypes || []).filter(s => s.is_active && (s.category?.trim() || "Servicios") === selectedCategory);
  }, [serviceTypes, selectedCategory]);

  const selectedServiceType = (serviceTypes || []).find(s => s.name === form.service_type_name);
  const destinationRequired = !!settings?.destination_required;
  const isVial = /vial/i.test(form.service_type_name?.trim() || "");
  const isGrua = /grua/i.test(form.service_type_name?.trim() || "");
  const [questionnaireAnswers, setQuestionnaireAnswers] = useState({});

  const selectedCompany = form.company_id ? companies.find(c => c.id === form.company_id) : null;

  // Calculate corporate zone price if company has geocercas billing type
  const calcCorporateZonePrice = (company, zone) => {
    if (!company || !zone) return null;
    if (company.billing_type !== "geocercas") return null;
    const zoneEntry = (company.zone_prices || []).find(zp => zp.zone_id === zone.id);
    if (!zoneEntry) return null;
    // Try service-specific price first, then zone general price
    const svcEntry = (zoneEntry.service_prices || []).find(sp => sp.service_type_name === form.service_type_name || sp.service_type_id);
    return svcEntry?.price ?? zoneEntry.price ?? null;
  };

  // Given a company price, compute driver pay using service type's corporate_driver_pct
  const calcDriverPayFromCompanyPrice = (companyPrice, serviceTypeName) => {
    const svc = (serviceTypes || []).find(s => s.name === serviceTypeName);
    const pct = svc?.corporate_driver_pct ?? 80;
    return parseFloat((companyPrice * pct / 100).toFixed(2));
  };

  // Fetch route from OSRM when both coords are available
  const fetchRoute = async (pickup, dropoff) => {
    if (!pickup || !dropoff) return;
    setRouteLoading(true);
    const pLon = pickup.lon || pickup.lng;
    const dLon = dropoff.lon || dropoff.lng;
    const url = `https://router.project-osrm.org/route/v1/driving/${pLon},${pickup.lat};${dLon},${dropoff.lat}?overview=full&geometries=geojson`;
    const res = await fetch(url);
    const data = await res.json();
    if (data.routes?.[0]) {
      const km = (data.routes[0].distance / 1000).toFixed(1);
      const mins = Math.round(data.routes[0].duration / 60);
      // Extract polyline points from GeoJSON
      const coords = data.routes[0].geometry?.coordinates;
      if (coords) setRoutePoints(coords.map(([lng, lat]) => [lat, lng]));
      setForm(prev => {
        const zone = detectZone(pickup.lat, pickup.lng || pickup.lon, zones);
        setDetectedZone(zone || null);
        let price = prev.estimated_price;
        const company = prev.company_id ? companies.find(c => c.id === prev.company_id) : null;
        const svc = (serviceTypes || []).find(s => s.name === prev.service_type_name);

        if (zone) {
          if (company) {
            // Corporate service: use zone tariff priorities + company tariff
            let companyTariff = null;
            if (company.billing_type === "geocercas") {
              const zoneEntry = (company.zone_prices || []).find(zp => zp.zone_id === zone.id);
              const svcEntry = zoneEntry ? (zoneEntry.service_prices || []).find(sp => sp.service_type_name === prev.service_type_name || sp.service_type_id === svc?.id) : null;
              companyTariff = svcEntry?.price ?? zoneEntry?.price ?? null;
            }
            price = (calcPriceForCorporateService(zone, companyTariff, parseFloat(km)) || 0).toFixed(0);
          } else {
            // Normal service: use zone tariff priorities
            price = (calcPriceForNormalService(zone, svc, parseFloat(km)) || 0).toFixed(0);
          }
        } else if (svc) {
          // No zone: use service general tariff
          const calc = svc.base_price + svc.price_per_km * parseFloat(km) + (svc.price_per_minute || 0) * mins;
          price = Math.max(calc, svc.minimum_fare || 0).toFixed(0);
        }

        // If corporate: compute driver pay from company price
        if (company && price) {
          const driverPay = calcDriverPayFromCompanyPrice(parseFloat(price), prev.service_type_name);
          return { ...prev, distance_km: km, duration_minutes: String(mins), company_price: price, driver_estimated_price: driverPay.toFixed(0), estimated_price: price };
        }
        return { ...prev, distance_km: km, duration_minutes: String(mins), estimated_price: price };
      });
    }
    setRouteLoading(false);
  };

  const handlePickupChange = (addr, coords) => {
    update("pickup_address", addr);
    if (!coords) {
      // User typed but didn't select — clear coords
      setPickupCoords(null);
      setCoverageValidation(null);
      setDetectedZone(null);
      setDetectedRedZone(null);
      return;
    }
    if (coords) {
      setPickupCoords(coords);
      const lat = coords.lat; const lng = coords.lng || coords.lon;
      const coverage = validateCoverageAvailability(lat, lng, { zones, redZones, cities });
      const zone = coverage.zone || detectZone(lat, lng, zones);
      setDetectedZone(zone || null);
      setDetectedRedZone(coverage.redZone || detectRedZone(lat, lng, redZones) || null);
      setCoverageValidation(coverage);
      if (dropoffCoords) fetchRoute(coords, dropoffCoords);
      // If single zone (no destination yet), try to apply corp pricing
      if (zone && form.company_id) {
        const company = companies.find(c => c.id === form.company_id);
        const svc = (serviceTypes || []).find(s => s.name === form.service_type_name);
        if (company) {
          // Calculate price with new priority logic
          let companyTariff = null;
          if (company.billing_type === "geocercas") {
            const zoneEntry = (company.zone_prices || []).find(zp => zp.zone_id === zone.id);
            const svcEntry = zoneEntry ? (zoneEntry.service_prices || []).find(sp => sp.service_type_name === form.service_type_name || sp.service_type_id === svc?.id) : null;
            companyTariff = svcEntry?.price ?? zoneEntry?.price ?? null;
          }
          const corpPrice = calcPriceForCorporateService(zone, companyTariff, 0);
          if (corpPrice !== null) update("estimated_price", corpPrice.toFixed(0));
        }
      }
    }
  };

  const activeMethods = paymentMethods?.filter(m => m.is_active) || [
    { key: "cash", label: "Efectivo" },
    { key: "card", label: "Tarjeta" },
    { key: "transfer", label: "Transferencia" },
  ];

  const calcPrice = (serviceTypeName, km) => {
    const svc = (serviceTypes || []).find(s => s.name === serviceTypeName);
    if (!svc) return "";
    if (!km) {
      // No destination: return minimum fare
      return svc.minimum_fare ? svc.minimum_fare.toFixed(0) : (svc.base_price || "").toFixed?.(0) || String(svc.base_price || "");
    }
    const price = svc.base_price + (svc.price_per_km * parseFloat(km));
    return Math.max(price, svc.minimum_fare || 0).toFixed(0);
  };

  const handleServiceChange = (v) => {
    const price = calcPrice(v, form.distance_km);
    const svc = (serviceTypes || []).find(s => s.name === v);
    setForm(prev => ({ ...prev, service_type_name: v, service_type_id: svc?.id || "", estimated_price: price || prev.estimated_price }));
  };

  const handleDistanceChange = (v) => {
    const price = calcPrice(form.service_type_name, v);
    setForm(prev => ({ ...prev, distance_km: v, estimated_price: price || prev.estimated_price }));
  };

  const handleCompanyChange = (v) => {
    const companyId = v === "__none__" ? "" : v;
    setForm(prev => {
      const updates = { ...prev, company_id: companyId };
      if (companyId && detectedZone) {
        const company = companies.find(c => c.id === companyId);
        const svc = (serviceTypes || []).find(s => s.name === prev.service_type_name);
        if (company) {
          // Calculate price with new priority logic
          let companyTariff = null;
          if (company.billing_type === "geocercas") {
            const zoneEntry = (company.zone_prices || []).find(zp => zp.zone_id === detectedZone.id);
            const svcEntry = zoneEntry ? (zoneEntry.service_prices || []).find(sp => sp.service_type_name === prev.service_type_name || sp.service_type_id === svc?.id) : null;
            companyTariff = svcEntry?.price ?? zoneEntry?.price ?? null;
          }
          const corpPrice = calcPriceForCorporateService(detectedZone, companyTariff, parseFloat(prev.distance_km || "0"));
          if (corpPrice !== null) {
            const driverPay = calcDriverPayFromCompanyPrice(corpPrice, prev.service_type_name);
            updates.company_price = corpPrice.toFixed(0);
            updates.driver_estimated_price = driverPay.toFixed(0);
            updates.estimated_price = corpPrice.toFixed(0);
          }
        }
      }
      if (!companyId) {
        updates.company_price = "";
        updates.driver_estimated_price = "";
      }
      return updates;
    });
  };

  // Generate unique service ID
  const generateServiceId = () => {
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = Math.random().toString(36).substring(2, 5).toUpperCase();
    return `SVC-${timestamp}-${random}`;
  };

  // Check if notes contain "gasolina"
  const isGasolineService = /gasolina/i.test(form.service_type_name || "") || /gasolina/i.test(form.notes || "");

  const handleCreate = async () => {
    const pickupLat = pickupCoords?.lat;
    const pickupLng = pickupCoords?.lon || pickupCoords?.lng;
    const coverage = validateCoverageAvailability(pickupLat, pickupLng, { zones, redZones, cities });
    if (!coverage.isCovered) {
      if (coverage.reason === "red_zone" && coverage.redZone?.name) {
        alert(`No se puede crear el servicio: ZONA ROJA - ${coverage.redZone.name}`);
      } else {
        alert(coverage.message || "Ciudad no disponible, pronto estaremos aquí.");
      }
      return;
    }
    if (detectedRedZone) {
      alert(`No se puede crear el servicio: ZONA ROJA - ${detectedRedZone.name}`);
      return;
    }

    // ── VALIDACIÓN DE PAGO: Verificar si el método requiere confirmación previa ──
    const selectedPaymentMethod = paymentMethods?.find(m => m.key === form.payment_method);
    if (selectedPaymentMethod?.require_before_service) {
      // Para métodos que requieren pago previo, verificar que el pago esté confirmado
      // Nota: Esta es una validación básica. En producción, se debería verificar
      // contra una tabla de pagos o integración con pasarela de pago
      alert(`El método de pago "${selectedPaymentMethod.label}" requiere confirmación de pago antes de crear el servicio. Por favor, confirme el pago primero.`);
      return;
    }

    // ── VALIDACIÓN DE WALLET: Verificar saldo suficiente ──
    if (form.payment_method === "wallet") {
      if (!walletUser) {
        alert("Para usar wallet como método de pago, debe ingresar un teléfono válido de un usuario registrado.");
        return;
      }

      const servicePrice = parseFloat(form.estimated_price) || 0;
      if (walletBalance < servicePrice) {
        setInsufficientWalletBalance(true);
        alert(`Saldo insuficiente en wallet. Saldo actual: $${walletBalance}. Precio del servicio: $${servicePrice}. Por favor, elija otro método de pago.`);
        return;
      }

      // Reset insufficient balance flag if validation passes
      setInsufficientWalletBalance(false);
    } else {
      // Reset wallet validation flags for other payment methods
      setInsufficientWalletBalance(false);
    }

    setSaving(true);
    try {
    const isAuction = form.assignment_mode === "auction";
    const auctionExpiresAt = isAuction
      ? futureCDMX((settings?.auction_timeout_seconds || 30) * 1000)
      : undefined;

    // Corporate vs normal pricing
    const isCorporate = !!form.company_id;
    const basePrice = form.estimated_price ? parseFloat(form.estimated_price) : 0;
    const extraCost = form.extra_company_cost ? parseFloat(form.extra_company_cost) : 0;
    const totalPrice = basePrice + extraCost;

    // For corporate: company_price = what company pays, driver_estimated_price = what driver receives
    const companyPrice = isCorporate ? (form.company_price ? parseFloat(form.company_price) + extraCost : totalPrice) : undefined;
    const driverEstimated = isCorporate
      ? (form.driver_estimated_price ? parseFloat(form.driver_estimated_price) : calcDriverPayFromCompanyPrice(basePrice, form.service_type_name))
      : undefined;

    const data = {
      ...form,
      service_id: generateServiceId(),
      requested_at: nowCDMX(),
      // estimated_price: for normal = total; for corporate = driver's amount (driver-visible)
      estimated_price: isCorporate ? (driverEstimated || undefined) : (totalPrice > 0 ? totalPrice : undefined),
      driver_estimated_price: driverEstimated > 0 ? driverEstimated : undefined,
      company_price: companyPrice > 0 ? companyPrice : undefined,
      extra_company_cost: extraCost > 0 ? extraCost : undefined,
      distance_km: form.distance_km ? parseFloat(form.distance_km) : undefined,
      duration_minutes: form.duration_minutes ? parseFloat(form.duration_minutes) : undefined,
      status: form.is_scheduled ? "scheduled" : isAuction ? "auction" : "pending",
      assignment_mode: form.assignment_mode,
      auction_expires_at: auctionExpiresAt,
      geo_zone_id: detectedZone?.id || undefined,
      geo_zone_name: detectedZone?.name || undefined,
      company_name: selectedCompany?.razon_social || undefined,
      ride_type: form.company_id ? "corporativo" : "normal",
      proof_photo_required: form.require_proof_photo,
      require_admin_approval: form.require_admin_approval || false,
      show_phone_to_driver: form.show_phone_to_driver,
      // ── Coordenadas de recogida y destino (necesarias para ETA y auto-asignación) ──
      pickup_lat: pickupCoords?.lat || undefined,
      pickup_lon: pickupCoords?.lon || pickupCoords?.lng || undefined,
      dropoff_lat: dropoffCoords?.lat || undefined,
      dropoff_lon: dropoffCoords?.lon || dropoffCoords?.lng || undefined,
      scheduled_time: form.is_scheduled && form.scheduled_date && form.scheduled_time
        ? systemLocalToISO(`${form.scheduled_date}T${form.scheduled_time}`)
        : undefined,
      questionnaire_answers: isGrua && Object.keys(questionnaireAnswers).length > 0
        ? Object.entries(questionnaireAnswers).map(([i, v]) => ({
            question: selectedServiceType?.questionnaire?.[i]?.question || "",
            answer: v
          }))
        : undefined,
      custom_field_answers: selectedServiceType?.custom_fields?.length > 0
        ? selectedServiceType.custom_fields.map(f => ({
            key: f.key,
            label: f.label,
            answer: customFieldAnswers[f.key] || ""
          })).filter(f => f.answer)
        : undefined,
      folio_data: selectedCompany && (selectedCompany.folio_fields || []).length > 0 ? folioAnswers : undefined,
      is_gasoline: isGasolineService,
      gasoline_liters: isGasolineService ? (form.gasoline_liters || undefined) : undefined,
      is_red_zone_blocked: !!detectedRedZone,
    };
    const createdRide = await supabaseApi.rideRequests.create(data);
    queryClient.invalidateQueries({ queryKey: ["rides"] });
    onRideCreated?.(createdRide || data);
    onOpenChange(false);
    setForm({ passenger_name: "", passenger_phone: "", pickup_address: "", dropoff_address: "", service_type_name: "", service_type_id: "", estimated_price: "", distance_km: "", duration_minutes: "", payment_method: "", notes: "", company_id: "", ride_type: "normal", assignment_mode: "auto", require_proof_photo: false, require_admin_approval: false, is_scheduled: false, scheduled_date: "", scheduled_time: "", extra_company_cost: "", show_phone_to_driver: true, company_price: "", driver_estimated_price: "", gasoline_liters: "" });
    setSelectedCategory("");
    setQuestionnaireAnswers({});
    setCustomFieldAnswers({});
    setFolioAnswers({});
    setPickupCoords(null);
    setDropoffCoords(null);
    setDetectedZone(null);
    // Reset wallet states
    setWalletUser(null);
    setWalletBalance(0);
    setInsufficientWalletBalance(false);
    } catch (error) {
      console.error('Error creating ride:', error);
      alert('Error al crear el servicio. Por favor, inténtelo de nuevo.');
    } finally {
      setSaving(false);
    }
  };

  const getPriceLabel = () => {
    if (!form.estimated_price) return null;
    if (selectedCompany && detectedZone) {
      let companyTariff = null;
      const svc = (serviceTypes || []).find(s => s.name === form.service_type_name);
      if (selectedCompany.billing_type === "geocercas") {
        const zoneEntry = (selectedCompany.zone_prices || []).find(zp => zp.zone_id === detectedZone.id);
        const svcEntry = zoneEntry ? (zoneEntry.service_prices || []).find(sp => sp.service_type_name === form.service_type_name || sp.service_type_id === svc?.id) : null;
        companyTariff = svcEntry?.price ?? zoneEntry?.price ?? null;
      }
      const corpPrice = calcPriceForCorporateService(detectedZone, companyTariff, parseFloat(form.distance_km || "0"));
      if (corpPrice !== null) return `💼 Precio corporativo (zona ${detectedZone.name}): $${corpPrice}`;
      return `💰 Zona ${detectedZone.name} (tarifa general)`;
    }
    if (detectedZone) return `💰 Zona: ${detectedZone.name}`;
    if (form.service_type_name && form.distance_km) return `💰 Por km — ${form.distance_km} km · ${form.duration_minutes} min`;
    return null;
  };

  return (
    <>
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[46.2rem] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nuevo viaje</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">

          {/* PASO 1: Categoría */}
          <div>
            <Label>Categoría *</Label>
            <Select value={selectedCategory} onValueChange={(v) => {
              setSelectedCategory(v);
              // Reset service if it doesn't belong to new category
              setForm(prev => ({ ...prev, service_type_name: "", estimated_price: "" }));
            }}>
              <SelectTrigger className={!selectedCategory ? "border-red-300" : ""}>
                <SelectValue placeholder="Seleccionar categoría" />
              </SelectTrigger>
              <SelectContent>
                {categoryList.map(cat => (
                  <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* PASO 2: Tipo de servicio (subcategoría) */}
          <div>
            <Label>Tipo de servicio *</Label>
            <Select
              value={form.service_type_name}
              onValueChange={handleServiceChange}
              disabled={!selectedCategory}
            >
              <SelectTrigger className={selectedCategory && !form.service_type_name ? "border-red-300" : ""}>
                <SelectValue placeholder={selectedCategory ? "Seleccionar tipo de servicio" : "Primero elige una categoría"} />
              </SelectTrigger>
              <SelectContent>
                {filteredServices.map(s => (
                  <SelectItem key={s.id} value={s.name}>{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Cuestionario para grúa */}
          {isGrua && selectedServiceType?.questionnaire?.length > 0 && (
            <div className="bg-amber-50 border border-amber-300 rounded-xl p-4 space-y-3">
              <p className="text-sm font-semibold text-amber-800 flex items-center gap-2">
                🔧 Cuestionario de servicio
              </p>
              {selectedServiceType.questionnaire.map((q, i) => (
                <div key={i}>
                  <Label className="text-amber-800">{q.question}{q.required && " *"}</Label>
                  <Select
                    value={questionnaireAnswers[i] || ""}
                    onValueChange={v => setQuestionnaireAnswers(prev => ({ ...prev, [i]: v }))}
                  >
                    <SelectTrigger className="mt-1 border-amber-300 bg-white">
                      <SelectValue placeholder="Seleccionar respuesta" />
                    </SelectTrigger>
                    <SelectContent>
                      {(q.options || []).map((opt, j) => (
                        <SelectItem key={j} value={opt}>{opt}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>
          )}

          {/* Campos personalizados del tipo de servicio */}
          {selectedServiceType?.custom_fields?.length > 0 && (
            <div className="bg-violet-50 border border-violet-200 rounded-xl p-4 space-y-3">
              <p className="text-sm font-semibold text-violet-800 flex items-center gap-2">
                📋 Información del servicio
              </p>
              {selectedServiceType.custom_fields.map(field => (
                <div key={field.key}>
                  <Label className="text-violet-800">{field.label}{field.required && " *"}</Label>
                  {field.type === "select" ? (
                    <Select
                      value={customFieldAnswers[field.key] || ""}
                      onValueChange={v => setCustomFieldAnswers(prev => ({ ...prev, [field.key]: v }))}
                    >
                      <SelectTrigger className="mt-1 border-violet-300 bg-white">
                        <SelectValue placeholder="Seleccionar..." />
                      </SelectTrigger>
                      <SelectContent>
                        {(field.options || []).map((opt, j) => (
                          <SelectItem key={j} value={opt}>{opt}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Input
                      type={field.type === "number" ? "number" : "text"}
                      value={customFieldAnswers[field.key] || ""}
                      onChange={e => setCustomFieldAnswers(prev => ({ ...prev, [field.key]: e.target.value }))}
                      placeholder={field.placeholder || `Ingresa ${field.label}`}
                      className="mt-1 border-violet-300"
                    />
                  )}
                </div>
              ))}
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Nombre del pasajero *</Label>
              <Input value={form.passenger_name} onChange={e => update("passenger_name", e.target.value)} placeholder="Nombre completo" />
            </div>
            <div>
              <Label>Teléfono</Label>
              <Input
                value={form.passenger_phone}
                onChange={e => update("passenger_phone", e.target.value)}
                onBlur={e => handlePhoneBlur(e.target.value)}
                placeholder="+52 55 ..."
              />
            </div>
          </div>

          {/* Assignment mode */}
          <div>
            <Label>Modo de asignación</Label>
            <div className="flex gap-2 mt-1">
              <button
                onClick={() => update("assignment_mode", "auto")}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border text-sm font-medium transition-all ${form.assignment_mode === "auto" ? "bg-slate-900 text-white border-slate-900" : "bg-white text-slate-600 border-slate-200 hover:border-slate-400"}`}
              >
                <Car className="w-4 h-4" /> Automático
              </button>
              <button
                onClick={() => update("assignment_mode", "auction")}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border text-sm font-medium transition-all ${form.assignment_mode === "auction" ? "bg-amber-600 text-white border-amber-600" : "bg-white text-slate-600 border-slate-200 hover:border-slate-400"}`}
              >
                <Gavel className="w-4 h-4" /> Subasta
              </button>
              <button
                onClick={() => update("assignment_mode", "manual")}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border text-sm font-medium transition-all ${form.assignment_mode === "manual" ? "bg-blue-600 text-white border-blue-600" : "bg-white text-slate-600 border-slate-200 hover:border-slate-400"}`}
              >
                Manual
              </button>
            </div>
            {form.assignment_mode === "auction" && (
              <p className="text-xs text-amber-600 bg-amber-50 rounded-lg px-3 py-2 mt-1.5">
                Se notificará a los {settings?.auction_max_drivers || 5} conductores más cercanos en un radio de {settings?.auction_primary_radius_km || 5} km. El primero en aceptar toma el viaje.
              </p>
            )}
          </div>

          <div>
            <Label>Dirección de recogida *</Label>
            <AddressSearch
              value={form.pickup_address}
              onChange={handlePickupChange}
              placeholder="¿Dónde recogemos?"
              label="Dirección de recogida"
            />
            {detectedRedZone && (
              <div className="mt-1.5 flex items-center gap-2 bg-red-50 border border-red-300 rounded-xl px-3 py-2">
                <AlertTriangle className="w-4 h-4 text-red-600 flex-shrink-0" />
                <span className="text-xs text-red-700 font-semibold">⚠️ ZONA ROJA: {detectedRedZone.name}</span>
                {detectedRedZone.reason && <span className="text-xs text-red-600">— {detectedRedZone.reason}</span>}
              </div>
            )}
            {!detectedRedZone && pickupCoords && coverageValidation && !coverageValidation.isCovered && (
              <div className="mt-1.5 flex items-center gap-2 bg-amber-50 border border-amber-300 rounded-xl px-3 py-2">
                <AlertTriangle className="w-4 h-4 text-amber-700 flex-shrink-0" />
                <span className="text-xs text-amber-800 font-semibold">Ciudad no disponible, pronto estaremos aquí.</span>
              </div>
            )}
            {detectedZone && !detectedRedZone && (
              <div className="mt-1.5 flex items-center gap-2">
                <span className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-2 py-0.5 flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: detectedZone.color || "#10B981" }} />
                  Zona: <strong>{detectedZone.name}</strong> ({detectedZone.tipo_tarifa === "fija" ? `$${detectedZone.tarifa_fija} fija` : `$${detectedZone.tarifa_base}+$${detectedZone.tarifa_por_km}/km`})
                </span>
              </div>
            )}
          </div>
          {!isVial && (
            <div>
              <Label>Dirección de destino {destinationRequired ? <span className="text-red-500 font-medium">*</span> : <span className="text-slate-400 font-normal">(opcional)</span>}</Label>
              <AddressSearch
                value={form.dropoff_address}
                onChange={(addr, coords) => {
                  update("dropoff_address", addr);
                  if (!coords) {
                    setDropoffCoords(null);
                    return;
                  }
                  setDropoffCoords(coords);
                  if (pickupCoords) fetchRoute(pickupCoords, coords);
                }}
                placeholder={destinationRequired ? "¿A dónde va? (obligatorio)" : "¿A dónde va? (opcional)"}
                label="Dirección de destino"
              />
            </div>
          )}
          {routeLoading && (
            <p className="text-xs text-blue-500 flex items-center gap-1">⟳ Calculando ruta y tarifa{detectedZone ? ` (zona: ${detectedZone.name})` : ""}...</p>
          )}

          {getPriceLabel() && (
            <div className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-700">
              {getPriceLabel()}
            </div>
          )}

          <MapPreview
            pickup={pickupCoords}
            dropoff={dropoffCoords}
            routePoints={routePoints}
            height={220}
            onAdjustPickup={pickupCoords ? () => setMapPickerField("pickup") : null}
            onAdjustDropoff={dropoffCoords ? () => setMapPickerField("dropoff") : null}
          />

          <div>
            <Label>Método de pago *</Label>
            <Select value={form.payment_method} onValueChange={v => update("payment_method", v)}>
              <SelectTrigger className={!form.payment_method ? "border-red-300" : ""}><SelectValue placeholder="Seleccionar" /></SelectTrigger>
              <SelectContent>
                {activeMethods.map(m => (
                  <SelectItem key={m.key} value={m.key}>{m.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {/* Wallet balance display */}
            {form.payment_method === "wallet" && walletUser && (
              <div className={`mt-2 p-3 rounded-lg border-2 ${
                insufficientWalletBalance
                  ? "bg-red-50 border-red-300 text-red-700"
                  : walletBalance >= (parseFloat(form.estimated_price) || 0)
                    ? "bg-green-50 border-green-300 text-green-700"
                    : "bg-amber-50 border-amber-300 text-amber-700"
              }`}>
                <div className="flex items-center gap-2">
                  <span className="font-semibold">💰 Saldo disponible:</span>
                  <span className="font-bold">${walletBalance}</span>
                </div>
                {form.estimated_price && (
                  <div className="text-sm mt-1">
                    Precio del servicio: ${form.estimated_price}
                    {walletBalance < parseFloat(form.estimated_price) && (
                      <div className="font-semibold mt-1">⚠️ Saldo insuficiente - elija otro método de pago</div>
                    )}
                  </div>
                )}
              </div>
            )}
            {/* Insufficient balance warning */}
            {insufficientWalletBalance && (
              <div className="mt-2 p-3 bg-red-50 border border-red-300 rounded-lg text-red-700">
                <div className="font-semibold">❌ Saldo insuficiente en wallet</div>
                <div className="text-sm mt-1">
                  El usuario no tiene suficiente saldo para cubrir el costo del servicio.
                  Por favor, seleccione un método de pago alternativo.
                </div>
              </div>
            )}
          </div>
          {/* Gasoline special field */}
          {isGasolineService && (
            <div className="bg-amber-50 border border-amber-300 rounded-xl p-3">
              <Label className="text-amber-800 font-semibold">⛽ Litros de gasolina</Label>
              <div className="flex gap-2 mt-2">
                {[5, 10].map(liters => (
                  <button
                    key={liters}
                    type="button"
                    onClick={() => update("gasoline_liters", liters)}
                    className={`flex-1 py-2.5 rounded-xl text-sm font-bold border-2 transition-all ${Number(form.gasoline_liters) === liters ? "bg-amber-600 border-amber-600 text-white" : "bg-white border-amber-200 text-amber-700"}`}
                  >
                    {liters} litros
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Pricing: corporate = 2 separate fields, normal = 1 field */}
          {selectedCompany ? (
            <div className="space-y-3 bg-blue-50 border border-blue-200 rounded-xl p-4">
              <p className="text-xs font-semibold text-blue-800">💼 Costos corporativos</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-blue-800">Costo empresa <span className="text-red-500">*</span></Label>
                  <p className="text-[10px] text-slate-400 mb-1">Lo que se factura a la empresa</p>
                  <Input
                    type="number"
                    value={form.company_price}
                    onChange={e => {
                      const cp = e.target.value;
                      const dp = cp ? calcDriverPayFromCompanyPrice(parseFloat(cp), form.service_type_name) : "";
                      setForm(prev => ({ ...prev, company_price: cp, driver_estimated_price: dp ? dp.toFixed(0) : "", estimated_price: cp }));
                    }}
                    placeholder="$0"
                    className="border-blue-300"
                  />
                </div>
                <div>
                  <Label className="text-emerald-700">Pago al conductor</Label>
                  <p className="text-[10px] text-slate-400 mb-1">Solo el conductor ve este monto</p>
                  <Input
                    type="number"
                    value={form.driver_estimated_price}
                    onChange={e => update("driver_estimated_price", e.target.value)}
                    placeholder="$0"
                    className="border-emerald-300"
                  />
                  {form.company_price && form.driver_estimated_price && (
                    <p className="text-[10px] text-slate-500 mt-1">
                      {((parseFloat(form.driver_estimated_price) / parseFloat(form.company_price)) * 100).toFixed(0)}% del costo empresa
                    </p>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Distancia (km)</Label>
                  <Input type="number" value={form.distance_km} onChange={e => handleDistanceChange(e.target.value)} placeholder="0" />
                </div>
                <div>
                  <Label>Duración (min)</Label>
                  <Input type="number" value={form.duration_minutes} onChange={e => update("duration_minutes", e.target.value)} placeholder="0" />
                </div>
              </div>
              <div>
                <Label>Costo extra empresa <span className="text-slate-400 font-normal">(opcional)</span></Label>
                <Input type="number" value={form.extra_company_cost} onChange={e => update("extra_company_cost", e.target.value)} placeholder="$0" className="mt-1" />
              </div>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label>Precio estimado</Label>
                  <Input type="number" value={form.estimated_price} onChange={e => update("estimated_price", e.target.value)} placeholder="$0" />
                </div>
                <div>
                  <Label>Distancia (km)</Label>
                  <Input type="number" value={form.distance_km} onChange={e => handleDistanceChange(e.target.value)} placeholder="0" />
                </div>
                <div>
                  <Label>Duración (min)</Label>
                  <Input type="number" value={form.duration_minutes} onChange={e => update("duration_minutes", e.target.value)} placeholder="0" />
                </div>
              </div>
              <div>
                <Label>Costo extra para empresa <span className="text-slate-400 font-normal">(opcional)</span></Label>
                <Input type="number" value={form.extra_company_cost} onChange={e => update("extra_company_cost", e.target.value)} placeholder="$0" className="mt-1" />
                {form.extra_company_cost && parseFloat(form.extra_company_cost) > 0 && (
                  <p className="text-xs text-blue-600 mt-1">
                    Total con extra: ${(parseFloat(String(form.estimated_price || "0")) + parseFloat(form.extra_company_cost)).toFixed(0)}
                  </p>
                )}
              </div>
            </>
          )}

          {/* Show phone to driver switch */}
          <div className={`flex items-center justify-between p-3 rounded-xl border transition-all ${form.show_phone_to_driver ? "bg-blue-50 border-blue-200" : "bg-slate-50 border-slate-200"}`}>
            <div className="flex items-center gap-2.5">
              <Phone className={`w-4 h-4 ${form.show_phone_to_driver ? "text-blue-600" : "text-slate-400"}`} />
              <div>
                <p className={`text-sm font-medium ${form.show_phone_to_driver ? "text-blue-700" : "text-slate-600"}`}>
                  Mostrar teléfono al conductor
                </p>
              </div>
            </div>
            <Switch
              checked={form.show_phone_to_driver}
              onCheckedChange={v => update("show_phone_to_driver", v)}
            />
          </div>

          {/* Corporate */}
          <div>
            <Label>Empresa (corporativo)</Label>
            <Select value={form.company_id || "__none__"} onValueChange={handleCompanyChange}>
              <SelectTrigger className="mt-1"><SelectValue placeholder="Normal (sin empresa)" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">Normal (sin empresa)</SelectItem>
                {companies.map(c => <SelectItem key={c.id} value={c.id}>{c.razon_social}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {selectedCompany && (selectedCompany.folio_fields || []).length > 0 && (
            <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4 space-y-3">
              <p className="text-xs font-semibold text-indigo-800">📋 Campos de folio requeridos</p>
              {(selectedCompany.folio_fields || []).map((field, idx) => (
                <div key={idx}>
                  <Label className="text-indigo-800">{field.label}{field.required && <span className="text-red-500 ml-0.5">*</span>}</Label>
                  <Input
                    value={folioAnswers[field.key] || ""}
                    onChange={e => setFolioAnswers(prev => ({ ...prev, [field.key]: e.target.value }))}
                    placeholder={`Ingresa ${field.label}`}
                    className="mt-1 border-indigo-300"
                  />
                </div>
              ))}
            </div>
          )}

          {selectedCompany && (
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 space-y-2">
              <div className="flex items-center justify-between">
                <Badge className="bg-blue-100 text-blue-700 border-blue-200">Viaje corporativo</Badge>
                <span className="text-xs text-blue-600 font-medium">
                  Cobro: {selectedCompany.billing_type === "geocercas" ? "Por geocercas" : "General"}
                </span>
              </div>
              {selectedCompany.billing_type === "geocercas" && detectedZone && (
                <div className="text-xs text-blue-700">
                  {(() => {
                    const svc = (serviceTypes || []).find(s => s.name === form.service_type_name);
                    const zoneEntry = (selectedCompany.zone_prices || []).find(zp => zp.zone_id === detectedZone.id);
                    const svcEntry = zoneEntry ? (zoneEntry.service_prices || []).find(sp => sp.service_type_name === form.service_type_name || sp.service_type_id === svc?.id) : null;
                    const companyTariff = svcEntry?.price ?? zoneEntry?.price ?? null;
                    const cp = calcPriceForCorporateService(detectedZone, companyTariff, parseFloat(form.distance_km || "0"));
                    return cp !== null
                      ? `✓ Tarifa corporativa en ${detectedZone.name}: $${cp}`
                      : `⚠️ Sin tarifa corporativa para zona ${detectedZone.name} — se usa tarifa general`;
                  })()}
                </div>
              )}
              {selectedCompany.billing_type === "geocercas" && !detectedZone && (
                <p className="text-xs text-amber-600">Ingresa la dirección de origen para detectar la zona y aplicar tarifa corporativa.</p>
              )}
            </div>
          )}

          {/* Requiere aprobación para iniciar */}
          <div className={`flex items-center justify-between p-3 rounded-xl border transition-all ${form.require_admin_approval ? "bg-blue-50 border-blue-300" : "bg-slate-50 border-slate-200"}`}>
            <div className="flex items-center gap-2.5">
              <Car className={`w-4 h-4 ${form.require_admin_approval ? "text-blue-600" : "text-slate-400"}`} />
              <div>
                <p className={`text-sm font-medium ${form.require_admin_approval ? "text-blue-700" : "text-slate-600"}`}>
                  Requiere aprobación para iniciar viaje
                </p>
                {form.require_admin_approval && (
                  <p className="text-xs text-blue-500 mt-0.5">El conductor debe esperar aprobación del panel antes de iniciar</p>
                )}
              </div>
            </div>
            <Switch
              checked={form.require_admin_approval}
              onCheckedChange={v => update("require_admin_approval", v)}
            />
          </div>

          {/* Foto obligatoria */}
          <div className={`flex items-center justify-between p-3 rounded-xl border transition-all ${form.require_proof_photo ? "bg-orange-50 border-orange-300" : "bg-slate-50 border-slate-200"}`}>
            <div className="flex items-center gap-2.5">
              <Camera className={`w-4 h-4 ${form.require_proof_photo ? "text-orange-600" : "text-slate-400"}`} />
              <div>
                <p className={`text-sm font-medium ${form.require_proof_photo ? "text-orange-700" : "text-slate-600"}`}>
                  Foto de comprobante obligatoria
                </p>
                {form.require_proof_photo && (
                  <p className="text-xs text-orange-500 mt-0.5">El conductor debe subir foto antes de finalizar el viaje</p>
                )}
              </div>
            </div>
            <Switch
              checked={form.require_proof_photo}
              onCheckedChange={v => update("require_proof_photo", v)}
            />
          </div>

          {/* CITA / Viaje programado */}
          <div>
            <button
              type="button"
              onClick={() => update("is_scheduled", !form.is_scheduled)}
              className={`w-full flex items-center gap-3 py-3 px-4 rounded-xl border-2 font-semibold text-sm transition-all ${form.is_scheduled ? "bg-blue-600 border-blue-600 text-white shadow-sm" : "bg-white border-slate-200 text-slate-500 hover:border-blue-300 hover:text-blue-600"}`}
            >
              <Calendar className="w-4 h-4 flex-shrink-0" />
              CITA — Viaje programado
              {form.is_scheduled && form.scheduled_date && form.scheduled_time && (
                <span className="ml-auto text-xs font-normal opacity-80">
                  {form.scheduled_date} {form.scheduled_time}
                </span>
              )}
            </button>
            {form.is_scheduled && (
              <div className="mt-2 grid grid-cols-2 gap-3 p-3 bg-blue-50 border border-blue-200 rounded-xl">
                <div>
                  <Label className="text-blue-800">Fecha *</Label>
                  <Input
                    type="date"
                    value={form.scheduled_date}
                    min={todayCDMX()}
                    onChange={e => update("scheduled_date", e.target.value)}
                    className={`mt-1 ${!form.scheduled_date ? "border-red-300" : "border-blue-300"}`}
                  />
                </div>
                <div>
                  <Label className="text-blue-800">Hora *</Label>
                  <Input
                    type="time"
                    value={form.scheduled_time}
                    onChange={e => update("scheduled_time", e.target.value)}
                    className={`mt-1 ${!form.scheduled_time ? "border-red-300" : "border-blue-300"}`}
                  />
                </div>
                {form.service_type_name && selectedServiceType?.advance_assignment_minutes && (
                  <div className="col-span-2 text-xs text-blue-700 bg-blue-100 rounded-lg px-3 py-2">
                    ⏰ El conductor se asignará <strong>{selectedServiceType.advance_assignment_minutes} minutos antes</strong> de la cita ({form.scheduled_time || "--:--"})
                  </div>
                )}
              </div>
            )}
          </div>

          <div>
            <Label>Notas</Label>
            <Textarea value={form.notes} onChange={e => update("notes", e.target.value)} placeholder="Instrucciones especiales..." rows={2} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleCreate} disabled={
            !form.passenger_name || !form.pickup_address || !form.service_type_name || !form.payment_method ||
            !pickupCoords ||
            (pickupCoords && coverageValidation && !coverageValidation.isCovered) ||
            (form.is_scheduled && (!form.scheduled_date || !form.scheduled_time)) ||
            ((destinationRequired || (form.dropoff_address && !dropoffCoords)) && !isVial && !dropoffCoords) ||
            (selectedCompany && (selectedCompany.folio_fields || []).some(f => f.required && !folioAnswers[f.key])) ||
            (selectedServiceType?.custom_fields || []).some(f => f.required && !customFieldAnswers[f.key]) ||
            saving
          }>
            {saving ? "Creando..." : "Crear viaje"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    <AdminMapPicker
      open={!!mapPickerField}
      onOpenChange={(v) => !v && setMapPickerField(null)}
      lat={mapPickerField === "pickup" ? pickupCoords?.lat : dropoffCoords?.lat}
      lon={mapPickerField === "pickup" ? (pickupCoords?.lon || pickupCoords?.lng) : (dropoffCoords?.lon || dropoffCoords?.lng)}
      label={mapPickerField === "pickup" ? "Origen" : "Destino"}
      isDropoff={mapPickerField === "dropoff"}
      onConfirm={(address, lat, lon) => {
        const coords = { lat, lon };
        if (mapPickerField === "pickup") {
          update("pickup_address", address);
          setPickupCoords(coords);
          const coverage = validateCoverageAvailability(lat, lon, { zones, redZones, cities });
          const zone = coverage.zone || detectZone(lat, lon, zones);
          setDetectedZone(zone || null);
          setDetectedRedZone(coverage.redZone || detectRedZone(lat, lon, redZones) || null);
          setCoverageValidation(coverage);
          if (dropoffCoords) fetchRoute(coords, dropoffCoords);
        } else {
          update("dropoff_address", address);
          setDropoffCoords(coords);
          if (pickupCoords) fetchRoute(pickupCoords, coords);
        }
        setMapPickerField(null);
      }}
    />
    </>
  );
}
