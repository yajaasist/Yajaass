"use client";

import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { supabaseApi } from "@/lib/supabaseApi";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Trash2, DollarSign, AlertCircle, Save, Calendar, Lock } from "lucide-react";
import AddressSearch from "@/components/admin/AddressSearch";
import { systemLocalToISO } from "@/components/shared/dateUtils";

interface RideFormData {
  passenger_name: string;
  passenger_phone: string;
  pickup_address: string;
  dropoff_address: string;
  pickup_lat: number | null;
  pickup_lon: number | null;
  dropoff_lat: number | null;
  dropoff_lon: number | null;
  notes: string;
  payment_method: string;
  estimated_price: string | number;
  company_price: string | number;
  driver_earnings_base: string | number;
  distance_km: string | number;
  duration_minutes: string | number;
  service_type_name: string;
  service_type_id: string;
  driver_id: string;
  driver_name: string;
  city_id: string;
  city_name: string;
  require_proof_photo: boolean;
  require_admin_approval: boolean;
  show_phone_to_driver: boolean;
  is_scheduled: boolean;
  scheduled_date: string;
  scheduled_time: string;
  commission_rate: string | number;
  paid_by: string;
}

const CHARGE_TYPES = [
  { value: "peaje", label: "🛣️ Peaje" },
  { value: "espera", label: "⏱️ Tiempo de espera" },
  { value: "propina", label: "💰 Propina" },
  { value: "otro", label: "📝 Otro" },
];

const PAYMENT_METHODS = [
  { value: "cash", label: "Efectivo" },
  { value: "card", label: "Tarjeta" },
  { value: "transfer", label: "Transferencia" },
];

export default function EditRideDialog({ ride, open, onOpenChange, onSaved }) {
  const [form, setForm] = useState<RideFormData>({
    passenger_name: "",
    passenger_phone: "",
    pickup_address: "",
    dropoff_address: "",
    pickup_lat: null,
    pickup_lon: null,
    dropoff_lat: null,
    dropoff_lon: null,
    notes: "",
    payment_method: "cash",
    estimated_price: "",
    company_price: "",
    driver_earnings_base: "",
    distance_km: "",
    duration_minutes: "",
    service_type_name: "",
    service_type_id: "",
    driver_id: "",
    driver_name: "",
    city_id: "",
    city_name: "",
    require_proof_photo: false,
    require_admin_approval: false,
    show_phone_to_driver: true,
    is_scheduled: false,
    scheduled_date: "",
    scheduled_time: "",
    commission_rate: 20,
    paid_by: "company",
  });
  const [extraCharges, setExtraCharges] = useState([]);
  const [saving, setSaving] = useState(false);
  const [newCharge, setNewCharge] = useState({ concept: "", amount: "", type: "peaje", paid_to_driver: false });

  const { data: serviceTypes = [] } = useQuery({
    queryKey: ["serviceTypes"],
    queryFn: () => supabaseApi.serviceTypes.list(),
    enabled: open,
  });

  const { data: drivers = [] } = useQuery({
    queryKey: ["drivers"],
    queryFn: () => supabaseApi.drivers.list(),
    enabled: open,
  });

  const { data: cities = [] } = useQuery({
    queryKey: ["cities"],
    queryFn: () => supabaseApi.cities.list(),
    enabled: open,
  });

  const { data: settingsList = [] } = useQuery({
    queryKey: ["appSettings"],
    queryFn: () => supabaseApi.settings.list(),
    enabled: open,
  });
  const settings = settingsList[0];

  useEffect(() => {
    if (!ride) return;

    let scheduled_date = "";
    let scheduled_time_val = "";
    if (ride.scheduled_time) {
      const d = new Date(ride.scheduled_time);
      const pad = n => String(n).padStart(2, "0");
      scheduled_date = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
      scheduled_time_val = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
    }

    setForm({
      passenger_name: ride.passenger_name || "",
      passenger_phone: ride.passenger_phone || "",
      pickup_address: ride.pickup_address || "",
      dropoff_address: ride.dropoff_address || "",
      pickup_lat: ride.pickup_lat || null,
      pickup_lon: ride.pickup_lon || null,
      dropoff_lat: ride.dropoff_lat || null,
      dropoff_lon: ride.dropoff_lon || null,
      notes: ride.notes || "",
      payment_method: ride.payment_method || "cash",
      // Precio estimado: fijo, no se modifica
      estimated_price: ride.estimated_price ?? "",
      company_price: ride.company_price ?? "",
      // Ganancia base del conductor ya calculada previamente
      driver_earnings_base: ride.driver_earnings ?? "",
      distance_km: ride.distance_km ?? "",
      duration_minutes: ride.duration_minutes ?? "",
      service_type_name: ride.service_type_name || "",
      service_type_id: ride.service_type_id || "",
      driver_id: ride.driver_id || "",
      driver_name: ride.driver_name || "",
      city_id: ride.city_id || "",
      city_name: ride.city_name || "",
      require_proof_photo: ride.proof_photo_required || false,
      require_admin_approval: ride.require_admin_approval || false,
      show_phone_to_driver: ride.show_phone_to_driver !== false,
      is_scheduled: !!ride.scheduled_time,
      scheduled_date,
      scheduled_time: scheduled_time_val,
      commission_rate: ride.commission_rate ?? settings?.platform_commission_pct ?? 20,
      paid_by: ride.paid_by || "company",
    } as RideFormData);
    setExtraCharges(Array.isArray(ride.extra_charges) ? ride.extra_charges : []);
  }, [ride, settings]);

  const set = (key, val) => setForm(f => ({ ...f, [key]: val }));

  // ── Lógica financiera ─────────────────────────────────────────────────────
  // Precio estimado = fijo (lo que se le cobra a empresa/cliente, no cambia)
  const estimatedPrice = Number(form.estimated_price) || 0;

  // Extras: suma total de todos los extras agregados
  const totalExtras = extraCharges.reduce((s, c) => s + (Number(c.amount) || 0), 0);

  // Extras marcados "para el conductor" → van directo al conductor sin descontar comisión
  const extrasParaConductor = extraCharges.filter(c => c.paid_to_driver).reduce((s, c) => s + (Number(c.amount) || 0), 0);

  // Extras que sí llevan comisión
  const extrasConComision = extraCharges.filter(c => !c.paid_to_driver).reduce((s, c) => s + (Number(c.amount) || 0), 0);

  // Precio final = precio estimado + TODOS los extras
  const precioFinal = estimatedPrice + totalExtras;

  // Tasa de comisión
  const commissionRate = Number(form.commission_rate) || settings?.platform_commission_pct || 20;

  // Base comisionable = precio estimado + extras que llevan comisión
  const baseComisionable = estimatedPrice + extrasConComision;

  // Comisión = sobre la base comisionable
  const comision = parseFloat((baseComisionable * commissionRate / 100).toFixed(2));

  // Ganancia conductor = (base comisionable - comisión) + extras para conductor
  const gananciaConductor = parseFloat((baseComisionable - comision + extrasParaConductor).toFixed(2));

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handleServiceChange = (v) => {
    const svc = serviceTypes.find(s => s.id === v);
    if (svc) {
      setForm(f => ({ ...f, service_type_id: svc.id, service_type_name: svc.name }));
    }
  };

  const handleDriverChange = (v) => {
    if (v === "__none__") {
      setForm(f => ({ ...f, driver_id: "", driver_name: "" }));
    } else {
      const d = drivers.find(dr => dr.id === v);
      if (d) setForm(f => ({ ...f, driver_id: d.id, driver_name: d.full_name }));
    }
  };

  const handleCityChange = (v) => {
    const c = cities.find(ci => ci.id === v);
    if (c) setForm(f => ({ ...f, city_id: c.id, city_name: c.name }));
  };

  const addCharge = () => {
    if (!newCharge.concept.trim() || !newCharge.amount || parseFloat(newCharge.amount) <= 0) {
      toast.error("Ingresa concepto y monto válido");
      return;
    }
    setExtraCharges(prev => [...prev, { ...newCharge, id: Date.now().toString(), amount: parseFloat(newCharge.amount) }]);
    setNewCharge({ concept: "", amount: "", type: "peaje", paid_to_driver: false });
  };

  const removeCharge = (id) => setExtraCharges(prev => prev.filter(c => c.id !== id));

  const updateCharge = (id, field, value) => {
    setExtraCharges(prev => prev.map(c => c.id === id ? { ...c, [field]: value } : c));
  };

  const handleSave = async () => {
    setSaving(true);
    const updates: Record<string, any> = {
      passenger_name: form.passenger_name,
      passenger_phone: form.passenger_phone,
      pickup_address: form.pickup_address,
      dropoff_address: form.dropoff_address,
      ...(form.pickup_lat ? { pickup_lat: form.pickup_lat, pickup_lon: form.pickup_lon } : {}),
      ...(form.dropoff_lat ? { dropoff_lat: form.dropoff_lat, dropoff_lon: form.dropoff_lon } : {}),
      notes: form.notes,
      payment_method: form.payment_method,
      service_type_name: form.service_type_name,
      service_type_id: form.service_type_id,
      driver_id: form.driver_id || undefined,
      driver_name: form.driver_name || undefined,
      city_id: form.city_id || undefined,
      city_name: form.city_name || undefined,
      proof_photo_required: form.require_proof_photo,
      require_admin_approval: form.require_admin_approval,
      show_phone_to_driver: form.show_phone_to_driver,
      extra_charges: extraCharges,
      commission_rate: commissionRate,
      paid_by: form.paid_by || "company",
      scheduled_time: form.is_scheduled && form.scheduled_date && form.scheduled_time
        ? systemLocalToISO(`${form.scheduled_date}T${form.scheduled_time}`)
        : (ride.scheduled_time || undefined),
      // El precio estimado NO se modifica — se conserva el original
      estimated_price: estimatedPrice,
      // Precio final = estimado + todos los extras
      final_price: precioFinal,
      // Ganancia conductor calculada
      driver_earnings: gananciaConductor,
      // Comisión plataforma
      platform_commission: comision,
      // Marcar que el admin editó para evitar reasignación automática
      _admin_edit: true,
    };

    if (form.company_price !== "") updates.company_price = Number(form.company_price) || 0;
    if (form.distance_km !== "") updates.distance_km = Number(form.distance_km) || 0;
    if (form.duration_minutes !== "") updates.duration_minutes = Number(form.duration_minutes) || 0;

    await supabaseApi.rideRequests.update(ride.id, updates);
    toast.success("Viaje actualizado correctamente");
    setSaving(false);
    onSaved && onSaved({ ...ride, ...updates });
    onOpenChange(false);
  };

  if (!ride) return null;

  const activeServiceTypes = serviceTypes.filter(s => s.is_active);
  const approvedDrivers = drivers.filter(d => d.approval_status === "approved");
  const isCompany = !!ride.company_name;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[46.2rem] max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            ✏️ Editar Viaje
            <Badge variant="outline" className="text-xs ml-auto">#{ride.service_id || ride.id?.slice(-8).toUpperCase()}</Badge>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {/* Datos del pasajero */}
          <section className="bg-slate-50 rounded-xl p-4 space-y-3">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Datos del pasajero</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Nombre pasajero</Label>
                <Input value={form.passenger_name || ""} onChange={e => set("passenger_name", e.target.value)} className="h-8 text-sm" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Teléfono</Label>
                <Input value={form.passenger_phone || ""} onChange={e => set("passenger_phone", e.target.value)} className="h-8 text-sm" />
              </div>
            </div>
            <div className={`flex items-center justify-between p-2.5 rounded-lg border text-xs transition-all ${form.show_phone_to_driver ? "bg-blue-50 border-blue-200" : "bg-white border-slate-200"}`}>
              <span className={form.show_phone_to_driver ? "text-blue-700 font-medium" : "text-slate-500"}>Mostrar teléfono al conductor</span>
              <Switch checked={form.show_phone_to_driver} onCheckedChange={v => set("show_phone_to_driver", v)} />
            </div>
          </section>

          {/* Servicio y asignación */}
          <section className="bg-slate-50 rounded-xl p-4 space-y-3">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Tipo de servicio</p>
            <div className="space-y-1">
              <Label className="text-xs">Tipo de servicio</Label>
              <Select
                value={form.service_type_id || activeServiceTypes.find(s => s.name === form.service_type_name)?.id || ""}
                onValueChange={handleServiceChange}
              >
                <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Seleccionar servicio" /></SelectTrigger>
                <SelectContent>
                  {activeServiceTypes.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {form.driver_name && (
              <p className="text-xs text-slate-400 flex items-center gap-1.5">
                🚗 Conductor asignado: <span className="font-medium text-slate-600">{form.driver_name}</span>
              </p>
            )}
          </section>

          {/* Ruta */}
          <section className="bg-slate-50 rounded-lg p-2 space-y-1">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Ruta</p>
            <div className="space-y-1">
              <Label className="text-xs text-xs">Dirección de origen</Label>
              <AddressSearch
                label="Origen"
                value={form.pickup_address || ""}
                onChange={(address, coords) => setForm(f => ({
                  ...f,
                  pickup_address: address,
                  ...(coords ? { pickup_lat: coords.lat, pickup_lon: coords.lon } : {}),
                }))}
                placeholder="Buscar origen..."
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-xs">Dirección de destino</Label>
              <AddressSearch
                label="Destino"
                value={form.dropoff_address || ""}
                onChange={(address, coords) => setForm(f => ({
                  ...f,
                  dropoff_address: address,
                  ...(coords ? { dropoff_lat: coords.lat, dropoff_lon: coords.lon } : {}),
                }))}
                placeholder="Buscar destino..."
              />
            </div>
            <div className="grid grid-cols-2 gap-1">
              <div className="space-y-1">
                <Label className="text-xs text-xs">Distancia (km)</Label>
                <Input type="number" value={form.distance_km} onChange={e => set("distance_km", e.target.value)} className="h-7 text-xs" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-xs">Duración (min)</Label>
                <Input type="number" value={form.duration_minutes} onChange={e => set("duration_minutes", e.target.value)} className="h-7 text-xs" />
              </div>
            </div>
          </section>

          {/* Cita programada */}
          {(ride.status === "scheduled" || form.is_scheduled) && (
            <section className="bg-blue-50 border border-blue-200 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-blue-700 uppercase tracking-wider flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5" /> Cita programada
                </p>
                <Switch checked={form.is_scheduled} onCheckedChange={v => set("is_scheduled", v)} />
              </div>
              {form.is_scheduled && (
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs text-blue-800">Fecha *</Label>
                    <Input type="date" value={form.scheduled_date} onChange={e => set("scheduled_date", e.target.value)} className="h-8 text-sm border-blue-300" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-blue-800">Hora *</Label>
                    <Input type="time" value={form.scheduled_time} onChange={e => set("scheduled_time", e.target.value)} className="h-8 text-sm border-blue-300" />
                  </div>
                </div>
              )}
            </section>
          )}

          {/* ── FINANCIERO ─────────────────────────────────────────────────── */}
          <section className="bg-slate-50 rounded-xl p-4 space-y-4">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Financiero</p>

            {/* Precio estimado: solo lectura */}
            <div className="bg-white border border-slate-200 rounded-xl p-3">
              <div className="flex items-center gap-2 mb-1">
                <Lock className="w-3.5 h-3.5 text-slate-400" />
                <Label className="text-xs font-semibold text-slate-600">Precio estimado del servicio (fijo)</Label>
              </div>
              <p className="text-xs text-slate-400 mb-2">
                Calculado por tarifa mínima, cobro por km y/o zona. No se modifica al editar.
              </p>
              <div className="flex items-center gap-3">
                <span className="text-xl font-bold text-slate-800">${estimatedPrice.toFixed(2)}</span>
                <span className="text-xs text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">Base del servicio</span>
              </div>
            </div>

            {/* Empresa: costo independiente */}
            {isCompany && (
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 space-y-2">
                <Label className="text-xs font-semibold text-blue-700">💼 Costo empresa (facturación — editable independiente)</Label>
                <p className="text-xs text-blue-500">Este costo aparece en el ticket de empresa. No afecta el ticket del conductor.</p>
                <Input
                  type="number"
                  value={form.company_price}
                  onChange={e => set("company_price", e.target.value)}
                  className="h-8 text-sm border-blue-300 bg-white"
                  placeholder="Costo para facturar a la empresa"
                />
                {/* Quién paga */}
                <div className="pt-1">
                  <Label className="text-xs text-blue-600">¿Quién paga este servicio?</Label>
                  <div className="flex gap-2 mt-1">
                    <button
                      type="button"
                      onClick={() => set("paid_by", "company")}
                      className={`flex-1 py-1.5 rounded-lg border text-xs font-medium transition-all ${form.paid_by === "company" ? "bg-blue-600 text-white border-blue-600" : "border-blue-200 text-blue-600"}`}
                    >
                      🏢 La empresa
                    </button>
                    <button
                      type="button"
                      onClick={() => set("paid_by", "passenger")}
                      className={`flex-1 py-1.5 rounded-lg border text-xs font-medium transition-all ${form.paid_by === "passenger" ? "bg-orange-500 text-white border-orange-500" : "border-orange-200 text-orange-600"}`}
                    >
                      👤 El pasajero
                    </button>
                  </div>
                  {form.paid_by === "passenger" && (
                    <p className="text-xs text-orange-600 mt-1 bg-orange-50 rounded-lg p-1.5">
                      ⚠️ Pagado por el pasajero — no se añade al costo de la empresa para facturación.
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Comisión */}
            <div className="space-y-1">
              <Label className="text-xs">Comisión plataforma (%)</Label>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min={0}
                  max={100}
                  value={form.commission_rate || commissionRate}
                  onChange={e => set("commission_rate", parseFloat(e.target.value) || 0)}
                  className="h-8 text-sm w-24"
                />
                <span className="text-xs text-slate-400">%</span>
                <span className="text-xs text-slate-400">(Base para cálculo del conductor)</span>
              </div>
            </div>

            {/* Método de pago */}
            <div className="space-y-1">
              <Label className="text-xs">Método de pago</Label>
              <Select value={form.payment_method} onValueChange={v => set("payment_method", v)}>
                <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PAYMENT_METHODS.map(p => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </section>

          {/* ── EXTRAS ─────────────────────────────────────────────────────── */}
          <section className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-3">
            <p className="text-xs font-semibold text-amber-700 uppercase tracking-wider flex items-center gap-1.5">
              <DollarSign className="w-3.5 h-3.5" /> Extras / Gastos adicionales
            </p>
            <p className="text-xs text-amber-600">
              Todos los extras se suman al precio estimado. Si es "Para el conductor", va directo sin descontar comisión.
            </p>

            {extraCharges.length > 0 && (
              <div className="space-y-2">
                {extraCharges.map(charge => (
                  <div key={charge.id} className="bg-white rounded-lg border border-amber-100 p-2.5 grid grid-cols-12 gap-2 items-center">
                    <div className="col-span-4">
                      <Input value={charge.concept} onChange={e => updateCharge(charge.id, "concept", e.target.value)} className="h-7 text-xs" placeholder="Concepto" />
                    </div>
                    <div className="col-span-3">
                      <Select value={charge.type} onValueChange={v => updateCharge(charge.id, "type", v)}>
                        <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {CHARGE_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="col-span-2">
                      <Input type="number" value={charge.amount} onChange={e => updateCharge(charge.id, "amount", parseFloat(e.target.value) || 0)} className="h-7 text-xs" placeholder="$" />
                    </div>
                    <div className="col-span-2 flex items-center gap-1">
                      <input
                        type="checkbox"
                        id={`ptd-${charge.id}`}
                        checked={charge.paid_to_driver}
                        onChange={e => updateCharge(charge.id, "paid_to_driver", e.target.checked)}
                        className="w-3.5 h-3.5 accent-amber-500"
                      />
                      <label htmlFor={`ptd-${charge.id}`} className="text-[10px] text-amber-700 leading-tight">Al conductor</label>
                    </div>
                    <div className="col-span-1 flex justify-end">
                      <button onClick={() => removeCharge(charge.id)} className="text-red-400 hover:text-red-600 transition-colors">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Nuevo extra */}
            <div className="bg-white rounded-lg border border-amber-100 p-2.5 grid grid-cols-12 gap-2 items-end">
              <div className="col-span-4 space-y-1">
                <Label className="text-[10px] text-slate-500">Concepto</Label>
                <Input value={newCharge.concept} onChange={e => setNewCharge(p => ({ ...p, concept: e.target.value }))} className="h-7 text-xs" placeholder="Ej: Peaje autopista" />
              </div>
              <div className="col-span-3 space-y-1">
                <Label className="text-[10px] text-slate-500">Tipo</Label>
                <Select value={newCharge.type} onValueChange={v => setNewCharge(p => ({ ...p, type: v }))}>
                  <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CHARGE_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-2 space-y-1">
                <Label className="text-[10px] text-slate-500">Monto $</Label>
                <Input type="number" value={newCharge.amount} onChange={e => setNewCharge(p => ({ ...p, amount: e.target.value }))} className="h-7 text-xs" placeholder="0" />
              </div>
              <div className="col-span-2 flex items-center gap-1 pb-0.5">
                <input type="checkbox" id="new-ptd" checked={newCharge.paid_to_driver} onChange={e => setNewCharge(p => ({ ...p, paid_to_driver: e.target.checked }))} className="w-3.5 h-3.5 accent-amber-500" />
                <label htmlFor="new-ptd" className="text-[10px] text-amber-700 leading-tight">Al conductor</label>
              </div>
              <div className="col-span-1 flex justify-end pb-0.5">
                <Button size="sm" className="h-7 w-7 p-0 bg-amber-500 hover:bg-amber-600 rounded-lg" onClick={addCharge}>
                  <Plus className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>

            {/* ── Resumen financiero ── */}
            <div className="bg-white border border-amber-200 rounded-xl p-3 space-y-2">
              <p className="text-xs font-bold text-slate-700 mb-2">Resumen financiero</p>

              <div className="flex justify-between text-xs text-slate-600">
                <span>Precio estimado (base fijo):</span>
                <span className="font-semibold">${estimatedPrice.toFixed(2)}</span>
              </div>

              {totalExtras > 0 && (
                <>
                  <div className="flex justify-between text-xs text-amber-700">
                    <span>+ Extras (concepto "Extras"):</span>
                    <span className="font-semibold">+${totalExtras.toFixed(2)}</span>
                  </div>
                  {extrasParaConductor > 0 && (
                    <div className="flex justify-between text-xs text-blue-600 pl-3">
                      <span>↳ Para el conductor (sin comisión):</span>
                      <span>+${extrasParaConductor.toFixed(2)}</span>
                    </div>
                  )}
                  {extrasConComision > 0 && (
                    <div className="flex justify-between text-xs text-slate-500 pl-3">
                      <span>↳ Con comisión:</span>
                      <span>+${extrasConComision.toFixed(2)}</span>
                    </div>
                  )}
                </>
              )}

              <div className="border-t border-amber-200 pt-2 flex justify-between text-xs font-bold text-emerald-700">
                <span>Precio final:</span>
                <span>${precioFinal.toFixed(2)}</span>
              </div>

              <div className="bg-slate-50 rounded-lg p-2 space-y-1.5 mt-1">
                <div className="flex justify-between text-xs text-violet-700">
                  <span>Comisión plataforma ({commissionRate}% sobre ${baseComisionable.toFixed(2)}):</span>
                  <span>-${comision.toFixed(2)}</span>
                </div>
                {extrasParaConductor > 0 && (
                  <div className="flex justify-between text-xs text-blue-600">
                    <span>+ Extras para conductor (sin comisión):</span>
                    <span>+${extrasParaConductor.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between text-xs font-bold text-blue-700 border-t border-slate-200 pt-1">
                  <span>Ganancia del conductor:</span>
                  <span>${gananciaConductor.toFixed(2)}</span>
                </div>
              </div>

              <div className="flex items-center gap-1 text-[10px] text-amber-600 pt-0.5">
                <AlertCircle className="w-3 h-3" />
                Los importes se actualizarán al guardar. El precio estimado nunca cambia.
              </div>
            </div>
          </section>

          {/* Opciones */}
          <section className="space-y-2">
            <div className={`flex items-center justify-between p-2.5 rounded-xl border text-xs transition-all ${form.require_admin_approval ? "bg-blue-50 border-blue-200" : "bg-slate-50 border-slate-200"}`}>
              <span className={form.require_admin_approval ? "text-blue-700 font-medium" : "text-slate-500"}>Requiere aprobación admin para iniciar</span>
              <Switch checked={form.require_admin_approval} onCheckedChange={v => set("require_admin_approval", v)} />
            </div>
            <div className={`flex items-center justify-between p-2.5 rounded-xl border text-xs transition-all ${form.require_proof_photo ? "bg-orange-50 border-orange-200" : "bg-slate-50 border-slate-200"}`}>
              <span className={form.require_proof_photo ? "text-orange-700 font-medium" : "text-slate-500"}>Foto de comprobante obligatoria</span>
              <Switch checked={form.require_proof_photo} onCheckedChange={v => set("require_proof_photo", v)} />
            </div>
          </section>

          {/* Notas */}
          <section className="space-y-1">
            <Label className="text-xs text-slate-500">Notas del servicio</Label>
            <Textarea value={form.notes || ""} onChange={e => set("notes", e.target.value)} className="text-sm resize-none" rows={2} />
          </section>
        </div>

        <div className="flex gap-2 pt-2 border-t">
          <Button variant="outline" className="flex-1 rounded-xl" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button className="flex-1 rounded-xl bg-slate-900 hover:bg-slate-800" onClick={handleSave} disabled={saving}>
            <Save className="w-4 h-4 mr-1.5" /> {saving ? "Guardando..." : "Guardar cambios"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
