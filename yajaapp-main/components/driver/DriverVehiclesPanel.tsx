import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Car, Plus, X, CheckCircle2, AlertTriangle, FileText, Bike } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabaseApi } from "@/lib/supabaseApi";
import { CAR_BRANDS, MOTO_BRANDS, VEHICLE_YEARS } from "@/components/shared/vehicleBrands";

const DEFAULT_VEHICLE_DOCS = [
  { key: "licencia", label: "Licencia de conducir", required: true },
  { key: "seguro", label: "Póliza de seguro", required: true },
  { key: "circulacion", label: "Tarjeta de circulación", required: false },
];

function daysUntilExpiry(dateStr) {
  if (!dateStr) return null;
  return Math.ceil((new Date(dateStr).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
}

function ExpiryBadge({ dateStr }) {
  const days = daysUntilExpiry(dateStr);
  if (days === null) return null;
  if (days < 0) return <span className="text-[10px] font-bold text-red-600 bg-red-50 px-1.5 py-0.5 rounded-full">Vencido</span>;
  if (days <= 30) return <span className="text-[10px] font-bold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded-full">Vence en {days}d</span>;
  return <span className="text-[10px] font-semibold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded-full">Vigente</span>;
}

function VehicleForm({ vehicle, docs, onSave, onCancel }) {
  const [form, setForm] = useState(vehicle || { id: Date.now().toString(), vehicle_type: "car", brand: "", model: "", year: "", color: "", plates: "", is_active: true });
  const [uploading, setUploading] = useState({});
  const [useCustomBrand, setUseCustomBrand] = useState(false);
  const [customBrand, setCustomBrand] = useState("");
  const brands = form.vehicle_type === "moto" ? MOTO_BRANDS : CAR_BRANDS;

  const upd = (f, v) => setForm(p => ({ ...p, [f]: v }));

  const uploadDoc = async (docKey, file) => {
    setUploading(p => ({ ...p, [docKey]: true }));
    const { file_url } = await supabaseApi.uploads.uploadFile({ file });
    upd(`doc_${docKey}_url`, file_url);
    setUploading(p => ({ ...p, [docKey]: false }));
  };

  return (
    <div className="space-y-4">
      {/* Vehicle type selector */}
      <div>
        <label className="text-xs font-medium text-slate-600">Tipo de vehículo *</label>
        <div className="grid grid-cols-2 gap-2 mt-1">
          {[{ value: "car", label: "🚗 Carro", icon: Car }, { value: "moto", label: "🏍️ Moto", icon: Bike }].map(t => (
            <button key={t.value} type="button"
              onClick={() => { upd("vehicle_type", t.value); upd("brand", ""); }}
              className={`py-2.5 rounded-xl border-2 text-sm font-semibold transition-all ${form.vehicle_type === t.value ? "border-blue-500 bg-blue-50 text-blue-700" : "border-slate-200 text-slate-500 hover:border-slate-300"}`}>
              {t.label}
            </button>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-medium text-slate-600">Marca *</label>
          {useCustomBrand ? (
            <div className="flex gap-1 mt-1">
              <Input value={customBrand} onChange={e => setCustomBrand(e.target.value.toUpperCase())} placeholder="Ej: ITALIKA" className="h-10 text-sm" />
              <button type="button" onClick={() => { setUseCustomBrand(false); setCustomBrand(""); }} className="text-xs text-slate-400 hover:text-red-400 px-1">✕</button>
            </div>
          ) : (
            <div>
              <Select value={form.brand} onValueChange={v => upd("brand", v)}>
                <SelectTrigger className="mt-1 h-10 text-sm"><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                <SelectContent>{brands.map(b => <SelectItem key={b} value={b}>{b}</SelectItem>)}</SelectContent>
              </Select>
              <button type="button" onClick={() => setUseCustomBrand(true)} className="text-[10px] text-blue-500 hover:underline mt-0.5">+ Otra marca</button>
            </div>
          )}
        </div>
        <div>
          <label className="text-xs font-medium text-slate-600">Modelo *</label>
          <Input value={form.model} onChange={e => upd("model", e.target.value.toUpperCase())} placeholder="COROLLA" className="mt-1 h-10 text-sm" />
        </div>
        <div>
          <label className="text-xs font-medium text-slate-600">Año</label>
          <Select value={form.year} onValueChange={v => upd("year", v)}>
            <SelectTrigger className="mt-1 h-10 text-sm"><SelectValue placeholder="Año" /></SelectTrigger>
            <SelectContent>{VEHICLE_YEARS.map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div>
          <label className="text-xs font-medium text-slate-600">Color</label>
          <Input value={form.color} onChange={e => upd("color", e.target.value.toUpperCase())} placeholder="BLANCO" className="mt-1 h-10 text-sm" />
        </div>
        <div className="col-span-2">
          <label className="text-xs font-medium text-slate-600">Placa *</label>
          <Input value={form.plates} onChange={e => upd("plates", e.target.value.toUpperCase())} placeholder="ABC-123" className="mt-1 h-10 text-sm font-mono" />
        </div>
      </div>

      {docs.length > 0 && (
        <div className="space-y-3">
          <p className="text-xs font-semibold text-slate-700 uppercase tracking-wide">Documentos del vehículo</p>
          {docs.map(doc => {
            const urlKey = `doc_${doc.key}_url`;
            const expiryKey = `doc_${doc.key}_expiry`;
            const hasDoc = !!form[urlKey];
            const isUploading = uploading[doc.key];
            return (
              <div key={doc.key} className="border border-slate-200 rounded-2xl p-3 space-y-2">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-blue-100 flex items-center justify-center">
                    <FileText className="w-3.5 h-3.5 text-blue-600" />
                  </div>
                  <div className="flex-1">
                    <p className="text-xs font-semibold text-slate-800">{doc.label}{doc.required && <span className="text-red-500 ml-0.5">*</span>}</p>
                    {form[expiryKey] && <ExpiryBadge dateStr={form[expiryKey]} />}
                  </div>
                  {hasDoc && <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />}
                </div>
                <div className={`grid gap-2 ${doc.require_expiry !== false ? "grid-cols-2" : "grid-cols-1"}`}>
                  <label className="cursor-pointer">
                    <input type="file" accept="image/*,application/pdf" className="hidden"
                      onChange={e => { const f = e.target.files?.[0]; if (f) uploadDoc(doc.key, f); }} />
                    <div className={`text-center py-2 rounded-xl border text-xs font-medium transition-colors ${hasDoc ? "bg-emerald-50 border-emerald-200 text-emerald-700" : "bg-slate-50 border-slate-200 text-slate-500 hover:border-blue-300 hover:text-blue-600"}`}>
                      {isUploading ? "Subiendo..." : hasDoc ? "✓ Subido" : "📎 Subir archivo"}
                    </div>
                  </label>
                  {doc.require_expiry !== false && (
                    <div>
                      <Input
                        type="date"
                        value={form[expiryKey] || ""}
                        onChange={e => upd(expiryKey, e.target.value)}
                        className="h-9 text-xs"
                        title="Fecha de vencimiento"
                      />
                    </div>
                  )}
                </div>
                {hasDoc && doc.require_expiry !== false && !form[expiryKey] && (
                  <p className="text-[10px] text-amber-600 bg-amber-50 rounded-lg px-2 py-1">⚠ Agrega la fecha de vencimiento</p>
                )}
              </div>
            );
          })}
        </div>
      )}

      <div className="flex gap-2 pt-2">
        <Button variant="outline" onClick={onCancel} className="flex-1 rounded-xl min-h-[44px] select-none text-sm">Cancelar</Button>
        <Button
          onClick={() => onSave({ ...form, brand: useCustomBrand ? customBrand : form.brand })}
          disabled={(!form.brand && !customBrand) || !form.plates}
          className="flex-1 bg-blue-600 hover:bg-blue-700 rounded-xl min-h-[44px] select-none text-sm"
        >
          Guardar vehículo
        </Button>
      </div>
    </div>
  );
}

function VehicleCard({ vehicle, docs, onEdit, onSetActive }) {
  const hasExpiredDocs = docs.some(d => {
    const days = daysUntilExpiry(vehicle[`doc_${d.key}_expiry`]);
    return days !== null && days < 0;
  });
  const hasSoonDocs = !hasExpiredDocs && docs.some(d => {
    const days = daysUntilExpiry(vehicle[`doc_${d.key}_expiry`]);
    return days !== null && days <= 30;
  });

  return (
    <div className={`rounded-2xl border p-4 ${vehicle.is_active ? "border-blue-200 bg-blue-50/40" : "border-slate-200 bg-white"}`}>
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="flex items-center gap-2.5">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${vehicle.is_active ? "bg-blue-100" : "bg-slate-100"}`}>
            {vehicle.vehicle_type === "moto"
              ? <Bike className={`w-5 h-5 ${vehicle.is_active ? "text-blue-600" : "text-slate-400"}`} />
              : <Car className={`w-5 h-5 ${vehicle.is_active ? "text-blue-600" : "text-slate-400"}`} />
            }
          </div>
          <div>
            <p className="font-bold text-slate-900 text-sm">{vehicle.brand} {vehicle.model}</p>
            <p className="text-xs text-slate-500">{vehicle.year} · {vehicle.color}</p>
            <p className="text-xs font-mono font-bold text-slate-700 mt-0.5">{vehicle.plates}</p>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1.5">
          {vehicle.is_active && (
            <span className="text-[10px] font-bold text-blue-700 bg-blue-100 px-2 py-0.5 rounded-full">Activo</span>
          )}
          {hasExpiredDocs && (
            <span className="text-[10px] font-bold text-red-600 bg-red-50 px-2 py-0.5 rounded-full flex items-center gap-1">
              <AlertTriangle className="w-2.5 h-2.5" /> Docs vencidos
            </span>
          )}
          {hasSoonDocs && !hasExpiredDocs && (
            <span className="text-[10px] font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full flex items-center gap-1">
              <AlertTriangle className="w-2.5 h-2.5" /> Por vencer
            </span>
          )}
        </div>
      </div>

      {docs.length > 0 && (
        <div className="flex gap-1.5 mb-3 flex-wrap">
          {docs.map(doc => {
            const hasDoc = !!vehicle[`doc_${doc.key}_url`];
            const expiry = vehicle[`doc_${doc.key}_expiry`];
            const days = daysUntilExpiry(expiry);
            const isExpired = days !== null && days < 0;
            const isSoon = days !== null && days >= 0 && days <= 30;
            return (
              <div key={doc.key} className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-medium ${isExpired ? "bg-red-50 text-red-600" : isSoon ? "bg-amber-50 text-amber-600" : hasDoc ? "bg-emerald-50 text-emerald-600" : "bg-slate-100 text-slate-400"}`}>
                {hasDoc ? "✓" : "—"} {doc.label.split(" ")[0]}
              </div>
            );
          })}
        </div>
      )}

      <div className="flex gap-2">
        {hasExpiredDocs && (
          <Button variant="outline" size="sm" onClick={onEdit} className="flex-1 rounded-xl min-h-[36px] text-xs select-none border-amber-200 text-amber-700 hover:bg-amber-50">
            ⚠️ Actualizar docs
          </Button>
        )}
        {!vehicle.is_active && (
          <Button size="sm" onClick={() => onSetActive(vehicle.id)} className="flex-1 rounded-xl min-h-[36px] text-xs bg-blue-600 hover:bg-blue-700 select-none">
            Usar este vehículo
          </Button>
        )}
      </div>
    </div>
  );
}

export default function DriverVehiclesPanel({ driver, onDriverUpdate, vehicleDocs }) {
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);

  const allDocs = vehicleDocs?.length > 0 ? vehicleDocs : DEFAULT_VEHICLE_DOCS;
  const vehicles = driver?.vehicles || [];

  // Filter docs based on vehicle type
  const getDocsForVehicle = (vehicle) => {
    const vtype = vehicle?.vehicle_type || "car";
    return allDocs.filter(d => !d.applies_to || d.applies_to === "both" || d.applies_to === vtype);
  };

  const alerts = [];
  vehicles.forEach(v => {
    getDocsForVehicle(v).forEach(doc => {
      const days = daysUntilExpiry(v[`doc_${doc.key}_expiry`]);
      if (days !== null && days <= 30) {
        alerts.push({ vehicle: `${v.brand} ${v.model} (${v.plates})`, doc: doc.label, days });
      }
    });
  });

  const syncFields = (vehicleObj) => ({
    vehicle_brand: vehicleObj.brand,
    vehicle_model: vehicleObj.model,
    vehicle_year: vehicleObj.year,
    vehicle_color: vehicleObj.color,
    license_plate: vehicleObj.plates,
  });

  const saveVehicle = async (vehicleData) => {
    setSaving(true);
    try {
      const existing = vehicles.filter(v => v.id !== vehicleData.id);
      const updated = [...existing, vehicleData];
      const activeVehicle = updated.find(v => v.is_active);
      const extraFields = activeVehicle ? syncFields(activeVehicle) : {};
    await supabaseApi.drivers.update(driver.id, { vehicles: updated, ...extraFields });
      onDriverUpdate({ ...driver, vehicles: updated, ...extraFields });
      setEditing(null);
    } catch (err) {
      console.error("Error saving vehicle:", err);
    }
    setSaving(false);
  };

  const setActiveVehicle = async (vehicleId) => {
    try {
      const updated = vehicles.map(v => ({ ...v, is_active: v.id === vehicleId }));
      const activeVehicle = updated.find(v => v.is_active);
      const extraFields = activeVehicle ? syncFields(activeVehicle) : {};
      await supabaseApi.drivers.update(driver.id, { vehicles: updated, ...extraFields });
      onDriverUpdate({ ...driver, vehicles: updated, ...extraFields });
    } catch (err) {
      console.error("Error setting active vehicle:", err);
    }
  };

  return (
    <div className="space-y-4">
      {alerts.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-3 space-y-1.5">
          <div className="flex items-center gap-2 text-amber-700 font-semibold text-sm">
            <AlertTriangle className="w-4 h-4" /> Alertas de vencimiento
          </div>
          {alerts.map((a, i) => (
            <p key={i} className="text-xs text-amber-600">
              {a.days < 0
                ? `❌ ${a.vehicle} — ${a.doc}: Vencido`
                : `⚠️ ${a.vehicle} — ${a.doc}: Vence en ${a.days} días`}
            </p>
          ))}
        </div>
      )}

      {editing === null && (
        <button
          onClick={() => setEditing("new")}
          className="w-full flex items-center justify-center gap-2 border-2 border-dashed border-blue-200 rounded-2xl py-4 text-blue-600 text-sm font-semibold hover:bg-blue-50 transition-colors select-none"
        >
          <Plus className="w-4 h-4" /> Agregar vehículo
        </button>
      )}

      <AnimatePresence>
        {editing !== null && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="bg-white border border-slate-200 rounded-2xl p-4"
          >
            <div className="flex items-center justify-between mb-4">
              <p className="font-semibold text-slate-800 text-sm">
                {editing === "new" ? "Nuevo vehículo" : "Editar vehículo"}
              </p>
              <button onClick={() => setEditing(null)} className="p-1 rounded-lg hover:bg-slate-100">
                <X className="w-4 h-4 text-slate-400" />
              </button>
            </div>
            <VehicleForm
              vehicle={editing === "new" ? null : editing}
              docs={getDocsForVehicle(editing === "new" ? null : editing)}
              onSave={saveVehicle}
              onCancel={() => setEditing(null)}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {vehicles.length === 0 && editing === null && (
        <div className="text-center py-8">
          <Car className="w-10 h-10 text-slate-200 mx-auto mb-2" />
          <p className="text-sm text-slate-400">No tienes vehículos registrados</p>
          <p className="text-xs text-slate-300 mt-1">Agrega al menos un vehículo para conectarte</p>
        </div>
      )}

      <div className="space-y-3">
        {vehicles.map(v => (
          <VehicleCard
            key={v.id}
            vehicle={v}
            docs={getDocsForVehicle(v)}
            onEdit={() => setEditing(v)}
            onSetActive={setActiveVehicle}
          />
        ))}
      </div>
    </div>
  );
}
