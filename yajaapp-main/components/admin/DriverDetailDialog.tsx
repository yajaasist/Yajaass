"use client";

import React, { useState } from "react";
import { CAR_BRANDS, MOTO_BRANDS, VEHICLE_YEARS } from "@/components/shared/vehicleBrands";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabaseApi } from "@/lib/supabaseApi";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Star, Car, CheckCircle, Clock, Upload, X, TimerOff, ThumbsUp, ThumbsDown } from "lucide-react";
import DriverSmsNotifier from "@/components/admin/DriverSmsNotifier";
import { toast } from "sonner";

function AdminAddVehicleForm({ onAdd, vehicleDocs, editingVehicle, onCancel }) {
  const isEdit = !!editingVehicle;
  const [form, setForm] = useState(editingVehicle || { vehicle_type: "car", brand: "", model: "", year: "", color: "", plates: "", is_active: false });
  const [customBrand, setCustomBrand] = useState("");
  const [useCustomBrand, setUseCustomBrand] = useState(false);
  const [uploading, setUploading] = useState({});

  // Pre-load existing URLs and expiries from the vehicle being edited
  const initDocFiles = () => {
    if (!editingVehicle || !vehicleDocs) return {};
    const files = {};
    vehicleDocs.forEach(doc => {
      if (editingVehicle[`doc_${doc.key}_url`]) files[doc.key] = editingVehicle[`doc_${doc.key}_url`];
    });
    return files;
  };
  const initDocExpiries = () => {
    if (!editingVehicle || !vehicleDocs) return {};
    const exp = {};
    vehicleDocs.forEach(doc => {
      if (editingVehicle[`doc_${doc.key}_expiry`]) exp[doc.key] = editingVehicle[`doc_${doc.key}_expiry`];
    });
    return exp;
  };
  const [docFiles, setDocFiles] = useState(initDocFiles);
  const [docExpiries, setDocExpiries] = useState(initDocExpiries);

  const upd = (f, v) => setForm(p => ({ ...p, [f]: v }));
  const brands = form.vehicle_type === "moto" ? MOTO_BRANDS : CAR_BRANDS;

  const uploadDoc = async (docKey, file) => {
    setUploading(p => ({ ...p, [docKey]: true }));
    const { file_url } = await supabaseApi.uploads.uploadFile({ file });
    setDocFiles(p => ({ ...p, [docKey]: file_url }));
    setUploading(p => ({ ...p, [docKey]: false }));
  };

  const handleAdd = () => {
    const finalBrand = useCustomBrand ? customBrand.toUpperCase() : form.brand;
    const vehicle = {
      id: editingVehicle?.id || Date.now().toString(),
      ...form,
      brand: finalBrand,
      is_active: editingVehicle?.is_active ?? false,
      // Preserve approval state
      approved_docs: editingVehicle?.approved_docs || [],
      rejected_docs: editingVehicle?.rejected_docs || [],
      admin_disabled: editingVehicle?.admin_disabled ?? false,
    };
    vehicleDocs.forEach(doc => {
      // Always write the URL (from new upload or pre-loaded existing)
      if (docFiles[doc.key]) vehicle[`doc_${doc.key}_url`] = docFiles[doc.key];
      if (docExpiries[doc.key]) vehicle[`doc_${doc.key}_expiry`] = docExpiries[doc.key];
    });
    onAdd(vehicle);
    setForm({ vehicle_type: "car", brand: "", model: "", year: "", color: "", plates: "", is_active: false });
    setDocFiles({});
    setDocExpiries({});
    setCustomBrand("");
    setUseCustomBrand(false);
    if (onCancel) onCancel();
  };

  return (
    <div className="border-2 border-blue-200 bg-blue-50/30 rounded-xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <p className="font-semibold text-slate-800 text-sm">{isEdit ? "Editar vehículo" : "Nuevo vehículo"}</p>
        {onCancel && <button onClick={onCancel} className="p-1 rounded-lg hover:bg-slate-100"><X className="w-4 h-4 text-slate-400" /></button>}
      </div>
      {/* Vehicle type selector */}
      <div>
        <Label className="text-xs">Tipo de vehículo *</Label>
        <div className="grid grid-cols-2 gap-2 mt-1">
          {[{ value: "car", label: "🚗 Carro" }, { value: "moto", label: "🏍️ Moto" }].map(t => (
            <button key={t.value} type="button"
              onClick={() => { upd("vehicle_type", t.value); upd("brand", ""); setUseCustomBrand(false); }}
              className={`py-2 rounded-xl border-2 text-sm font-semibold transition-all ${form.vehicle_type === t.value ? "border-blue-500 bg-blue-50 text-blue-700" : "border-slate-200 text-slate-500 hover:border-slate-300"}`}>
              {t.label}
            </button>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-xs">Marca *</Label>
          {useCustomBrand ? (
            <div className="flex gap-1 mt-1">
              <Input value={customBrand} onChange={e => setCustomBrand(e.target.value)} placeholder="Ej: ITALIKA" className="h-9 text-sm" />
              <button onClick={() => { setUseCustomBrand(false); setCustomBrand(""); }} className="text-xs text-slate-400 hover:text-red-400 px-1">✕</button>
            </div>
          ) : (
            <div>
              <Select value={form.brand} onValueChange={v => upd("brand", v)}>
                <SelectTrigger className="mt-1 h-9 text-sm"><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                <SelectContent>
                  {brands.map(b => <SelectItem key={b} value={b}>{b}</SelectItem>)}
                </SelectContent>
              </Select>
              <button onClick={() => setUseCustomBrand(true)} className="text-[10px] text-blue-500 hover:underline mt-0.5">+ Otra marca</button>
            </div>
          )}
        </div>
        <div>
          <Label className="text-xs">Modelo *</Label>
          <Input value={form.model} onChange={e => upd("model", e.target.value.toUpperCase())} placeholder="COROLLA" className="mt-1 h-9 text-sm" />
        </div>
        <div>
          <Label className="text-xs">Año</Label>
          <Select value={form.year} onValueChange={v => upd("year", v)}>
            <SelectTrigger className="mt-1 h-9 text-sm"><SelectValue placeholder="Año" /></SelectTrigger>
            <SelectContent>{VEHICLE_YEARS.map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs">Color</Label>
          <Input value={form.color} onChange={e => upd("color", e.target.value.toUpperCase())} placeholder="BLANCO" className="mt-1 h-9 text-sm" />
        </div>
        <div className="col-span-2">
          <Label className="text-xs">Placa *</Label>
          <Input value={form.plates} onChange={e => upd("plates", e.target.value.toUpperCase())} placeholder="ABC-123" className="mt-1 h-9 text-sm font-mono" />
        </div>
      </div>

      {vehicleDocs.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Documentos del vehículo</p>
          <div className="grid grid-cols-3 gap-2">
            {vehicleDocs.map(doc => (
              <div key={doc.key} className="border border-slate-200 rounded-lg p-2 space-y-1 bg-white">
                <p className="text-[10px] font-semibold text-slate-700 truncate">{doc.label}</p>
                <label className="cursor-pointer block">
                  <input type="file" accept="image/*,.pdf" className="hidden"
                    onChange={e => { const f = e.target.files?.[0]; if (f) uploadDoc(doc.key, f); }} />
                  <div className={`text-center py-0.5 rounded-lg border text-[10px] font-medium ${docFiles[doc.key] ? "bg-emerald-50 border-emerald-200 text-emerald-700" : "bg-slate-50 border-slate-200 text-slate-500 hover:border-blue-300"}`}>
                      {uploading[doc.key] ? "..." : docFiles[doc.key] ? "✓ Cargado" : <><Upload className="w-2.5 h-2.5 inline mr-0.5" />Subir</>}
                    </div>
                  </label>
                  {docFiles[doc.key] && (
                    <a href={docFiles[doc.key]} target="_blank" rel="noreferrer"
                      className="block text-center text-[10px] text-blue-500 hover:underline">Ver doc</a>
                  )}
                <input type="date" value={docExpiries[doc.key] || ""}
                  onChange={e => setDocExpiries(p => ({ ...p, [doc.key]: e.target.value }))}
                  className="w-full border border-slate-200 rounded-md px-1.5 py-1 text-[10px] focus:outline-none focus:ring-1 focus:ring-blue-300" />
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex gap-2 pt-1">
        <Button variant="outline" size="sm" onClick={onCancel || (() => {})} className="flex-1 rounded-xl text-sm">Cancelar</Button>
        <Button size="sm" onClick={handleAdd} disabled={(!form.brand && !customBrand) || !form.plates || !form.model}
          className="flex-1 bg-blue-600 hover:bg-blue-700 rounded-xl text-sm">
          {isEdit ? "Guardar cambios" : "Agregar vehículo"}
        </Button>
      </div>
    </div>
  );
}

export default function DriverDetailDialog({ driver, open, onOpenChange, cities = [], serviceTypes = [], rides = [] }) {
  const [editDriver, setEditDriver] = useState(driver || {});
  const [saving, setSaving] = useState(false);
  const [uploadingDoc, setUploadingDoc] = useState(null);
  const [docApproved, setDocApproved] = useState({});
  const [docRejected, setDocRejected] = useState({});
  const [docExpiries, setDocExpiries] = useState({});
  const [editingVehicleId, setEditingVehicleId] = useState(null);
  const queryClient = useQueryClient();

  // Fetch current settings to get dynamic docs list
  const { data: settingsList = [] } = useQuery({
    queryKey: ["appSettings"],
    queryFn: () => supabaseApi.settings.list(),
  });
  const settings = settingsList[0];
  const configuredDocs = settings?.driver_required_docs || [];
  const configuredVehicleDocs = settings?.driver_vehicle_docs || [];

  // Only re-init when dialog opens with a new driver (open + driver.id change)
  const prevDriverId = React.useRef(null);
  React.useEffect(() => { 
    if (!driver || !open) return;
    if (prevDriverId.current === driver.id) return; // already initialized for this driver
    prevDriverId.current = driver.id;
    setEditDriver(driver);
    const approvedInit = {};
    (driver.approved_docs || []).forEach(key => { approvedInit[key] = true; });
    setDocApproved(approvedInit);
    const rejectedInit = {};
    (driver.rejected_docs || []).forEach(key => { rejectedInit[key] = true; });
    setDocRejected(rejectedInit);
    // Init doc expiries from doc_expiries field or empty
    setDocExpiries(driver.doc_expiries || {});
  }, [driver?.id, open]);

  // Reset ref when dialog closes so next open re-initializes
  React.useEffect(() => {
    if (!open) prevDriverId.current = null;
  }, [open]);

  const update = (field, value) => setEditDriver(prev => ({ ...prev, [field]: value }));

  const driverRides = rides.filter(r => r.driver_id === driver?.id && r.status === "completed");
  const totalEarnings = driverRides.reduce((sum, r) => sum + (r.driver_earnings || 0), 0);

  const handleSave = async () => {
    setSaving(true);
    const syncedNames = (editDriver.service_type_ids || []).map(id => {
      const found = serviceTypes.find(s => s.id === id);
      return found ? found.name : null;
    }).filter(Boolean);
    const { _isNewDriver, ...editDriverClean } = editDriver as any;
    const dataToSave = {
      ...editDriverClean,
      service_type_names: syncedNames,
      approved_docs: Object.keys(docApproved).filter(k => docApproved[k]),
      rejected_docs: Object.keys(docRejected).filter(k => docRejected[k]),
      doc_expiries: docExpiries,
    };
    if (driver._isNewDriver) {
      const created = await supabaseApi.drivers.create(dataToSave);
      queryClient.setQueryData<any[]>(["drivers"], (old = []) => [created, ...old]);
      toast.success("Conductor creado");
    } else {
      await supabaseApi.drivers.update(driver.id, dataToSave);
      queryClient.setQueryData<any[]>(["drivers"], (old = []) =>
        old.map(d => d.id === driver.id ? { ...d, ...dataToSave } : d)
      );
      toast.success("Conductor actualizado");
    }
    setSaving(false);
    onOpenChange(false);
  };

  const handleDocUpload = async (docKey, file) => {
    setUploadingDoc(docKey);
    const { file_url } = await supabaseApi.uploads.uploadFile({ file });
    // Update local state FIRST so subsequent saves include this URL
    setEditDriver(prev => {
      const newUrls = { ...(prev.doc_urls || {}), [docKey]: file_url };
      const updated = { ...prev, doc_urls: newUrls };
      // Persist immediately (fire and forget, handleSave will also save it)
      supabaseApi.drivers.update(driver.id, { doc_urls: newUrls });
      queryClient.setQueryData<any[]>(["drivers"], (old = []) =>
        old.map(d => d.id === driver.id ? { ...d, doc_urls: newUrls } : d)
      );
      return updated;
    });
    setUploadingDoc(null);
    toast.success("Documento cargado");
  };

  const saveDocStatus = async (newApproved, newRejected) => {
    const approvedList = Object.keys(newApproved).filter(k => newApproved[k]);
    const rejectedList = Object.keys(newRejected).filter(k => newRejected[k]);
    await supabaseApi.drivers.update(driver.id, {
      approved_docs: approvedList,
      rejected_docs: rejectedList,
    });
    // Update cache directly so the re-render doesn't reset local state
    queryClient.setQueryData<any[]>(["drivers"], (old = []) =>
      old.map(d => d.id === driver.id ? { ...d, approved_docs: approvedList, rejected_docs: rejectedList } : d)
    );
  };

  const approveDoc = async (docKey) => {
    const newApproved = { ...docApproved, [docKey]: true };
    const newRejected = { ...docRejected, [docKey]: false };
    setDocApproved(newApproved);
    setDocRejected(newRejected);
    await saveDocStatus(newApproved, newRejected);
    toast.success("Documento aprobado");
  };

  const rejectDoc = async (docKey) => {
    const newRejected = { ...docRejected, [docKey]: true };
    const newApproved = { ...docApproved, [docKey]: false };
    setDocRejected(newRejected);
    setDocApproved(newApproved);
    await saveDocStatus(newApproved, newRejected);
    toast.error("Documento rechazado");
  };

  const undoDocDecision = async (docKey) => {
    const newApproved = { ...docApproved, [docKey]: false };
    const newRejected = { ...docRejected, [docKey]: false };
    setDocApproved(newApproved);
    setDocRejected(newRejected);
    await saveDocStatus(newApproved, newRejected);
  };

  const toggleServiceType = (svcId, svcName) => {
    const ids = editDriver.service_type_ids || [];
    const names = editDriver.service_type_names || [];
    if (ids.includes(svcId)) {
      update("service_type_ids", ids.filter(i => i !== svcId));
      update("service_type_names", names.filter(n => n !== svcName));
    } else {
      update("service_type_ids", [...ids, svcId]);
      update("service_type_names", [...names, svcName]);
    }
  };

  // Personal docs: configured from settings; fallback to legacy
  const legacyDocs = [
    { key: "doc_license_url", field: "doc_license_url", label: "Licencia de conducir" },
    { key: "doc_id_url", field: "doc_id_url", label: "Identificación oficial" },
    { key: "doc_vehicle_url", field: "doc_vehicle_url", label: "Tarjeta de circulación" },
    { key: "doc_insurance_url", field: "doc_insurance_url", label: "Póliza de seguro" },
  ];
  const dynamicDocs = configuredDocs.length > 0 ? configuredDocs : legacyDocs;

  // Vehicle docs: configured from settings; fallback to defaults
  const defaultVehicleDocs = [
    { key: "licencia", label: "Licencia de conducir", require_expiry: true },
    { key: "seguro", label: "Seguro", require_expiry: true },
    { key: "circulacion", label: "Circulación", require_expiry: true },
  ];
  const vehicleDocsConfig = configuredVehicleDocs.length > 0 ? configuredVehicleDocs : defaultVehicleDocs;

  // Get URL for a personal doc (supports both legacy fields and new doc_urls object)
  const getDocUrl = (doc) => {
    const urls = editDriver.doc_urls || {};
    return urls[doc.key] || editDriver[doc.key || doc.field] || null;
  };

  // Per-vehicle doc approve/reject helpers (stored in vehicle object itself)
  const saveVehicles = async (updated) => {
    update("vehicles", updated);
    await supabaseApi.drivers.update(driver.id, { vehicles: updated });
    queryClient.setQueryData<any[]>(["drivers"], (old = []) =>
      old.map(d => d.id === driver.id ? { ...d, vehicles: updated } : d)
    );
  };

  const approveVehicleDoc = async (vehicleIdx, docKey) => {
    const updated = (editDriver.vehicles || []).map((v, i) => {
      if (i !== vehicleIdx) return v;
      return { ...v, approved_docs: [...new Set([...(v.approved_docs || []), docKey])], rejected_docs: (v.rejected_docs || []).filter(k => k !== docKey) };
    });
    await saveVehicles(updated);
    toast.success("Documento aprobado");
  };

  const rejectVehicleDoc = async (vehicleIdx, docKey) => {
    const updated = (editDriver.vehicles || []).map((v, i) => {
      if (i !== vehicleIdx) return v;
      return { ...v, rejected_docs: [...new Set([...(v.rejected_docs || []), docKey])], approved_docs: (v.approved_docs || []).filter(k => k !== docKey) };
    });
    await saveVehicles(updated);
    toast.error("Documento rechazado");
  };

  const undoVehicleDoc = async (vehicleIdx, docKey) => {
    const updated = (editDriver.vehicles || []).map((v, i) => {
      if (i !== vehicleIdx) return v;
      return { ...v, approved_docs: (v.approved_docs || []).filter(k => k !== docKey), rejected_docs: (v.rejected_docs || []).filter(k => k !== docKey) };
    });
    await saveVehicles(updated);
  };

  // All configured personal docs approved?
  const allDocsApproved = dynamicDocs.every(d => docApproved[d.key]);
  const canApproveDriver = dynamicDocs.length === 0 || allDocsApproved;

  if (!driver) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[46.2rem] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center font-bold text-slate-600">
                {driver.full_name?.charAt(0)}
              </div>
              <span>{driver.full_name}</span>
            </div>
            <DriverSmsNotifier driver={driver} />
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="info">
          <TabsList className="grid grid-cols-6 w-full">
            <TabsTrigger value="info">Datos</TabsTrigger>
            <TabsTrigger value="vehicles">Vehículos</TabsTrigger>
            <TabsTrigger value="services">Servicios</TabsTrigger>
            <TabsTrigger value="banking">Bancario</TabsTrigger>
            <TabsTrigger value="docs">Docs</TabsTrigger>
            <TabsTrigger value="ratings">Califs.</TabsTrigger>
          </TabsList>

          <TabsContent value="info" className="space-y-4 mt-4">
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Nombre completo *</Label><Input value={editDriver.full_name || ""} onChange={e => update("full_name", e.target.value)} /></div>
              <div><Label>Teléfono</Label><Input value={editDriver.phone || ""} onChange={e => update("phone", e.target.value)} placeholder="Opcional" /></div>
            </div>
            <div><Label>Email (acceso)</Label><Input type="email" value={editDriver.email || ""} onChange={e => update("email", e.target.value)} placeholder="correo@ejemplo.com" /></div>
            <div><Label>Contraseña de acceso</Label><Input type="text" value={editDriver.password || ""} onChange={e => update("password", e.target.value)} placeholder="Contraseña para la app" /></div>
            <div>
              <Label>Ciudad</Label>
              <Select value={editDriver.city_id || ""} onValueChange={v => {
                const city = cities.find(c => c.id === v);
                update("city_id", v);
                update("city_name", city?.name || "");
              }}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Seleccionar ciudad" />
                </SelectTrigger>
                <SelectContent>
                  {(cities || []).filter(c => c.is_active !== false).map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.name}{c.state ? `, ${c.state}` : ""}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="bg-slate-50 rounded-xl p-3 text-xs text-slate-500 flex items-center gap-2">
              <Car className="w-4 h-4 text-slate-400" />
              Los datos del vehículo se sincronizan desde la pestaña <strong>Vehículos</strong>. Vehículo activo: <span className="font-mono font-bold text-slate-700">{editDriver.vehicle_brand} {editDriver.vehicle_model} · {editDriver.license_plate}</span>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Estado</Label>
                <Select value={editDriver.status || "offline"} onValueChange={v => update("status", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="available">Disponible</SelectItem>
                    <SelectItem value="busy">Ocupado</SelectItem>
                    <SelectItem value="offline">Desconectado</SelectItem>
                    <SelectItem value="suspended">Suspendido</SelectItem>
                    <SelectItem value="blocked">Bloqueado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Aprobación</Label>
                <Select value={editDriver.approval_status || "pending"} onValueChange={v => update("approval_status", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">Pendiente</SelectItem>
                    <SelectItem value="approved">Aprobado</SelectItem>
                    <SelectItem value="rejected">Rechazado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            {/* Suspension reason — shown when status is suspended or blocked */}
            {(editDriver.status === "suspended" || editDriver.status === "blocked") && (
              <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 space-y-3">
                <p className="text-sm font-semibold text-orange-800">📋 Motivo de suspensión (visible para el conductor)</p>
                <Textarea
                  value={editDriver.suspension_reason || ""}
                  onChange={e => update("suspension_reason", e.target.value)}
                  rows={3}
                  placeholder="Ej: Documentos vencidos, incumplimiento de políticas, quejas de pasajeros..."
                  className="border-orange-200 focus:ring-orange-400"
                />
                <p className="text-xs text-orange-600">⚠️ El conductor verá este mensaje en su pantalla al intentar conectarse.</p>
              </div>
            )}

            {/* Suspension block */}
            {driver.suspended_until && new Date(driver.suspended_until) > new Date() && (
              <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <TimerOff className="w-5 h-5 text-orange-500 flex-shrink-0" />
                    <div>
                      <p className="text-sm font-semibold text-orange-800">Suspendido automáticamente</p>
                      <p className="text-xs text-orange-600">Hasta: {new Date(driver.suspended_until).toLocaleString("es-MX")}</p>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    onClick={async () => {
                      await supabaseApi.drivers.update(driver.id, { suspended_until: null, status: "available", suspension_reason: null });
                      update("suspended_until", null); update("status", "available"); update("suspension_reason", null);
                      queryClient.invalidateQueries({ queryKey: ["drivers"] });
                      toast.success("Suspensión eliminada — conductor disponible");
                    }}
                    className="bg-orange-600 hover:bg-orange-700 text-white rounded-lg text-xs flex-shrink-0"
                  >
                    Quitar bloqueo
                  </Button>
                </div>
              </div>
            )}
          </TabsContent>

          {/* ── VEHICLES TAB ── */}
          <TabsContent value="vehicles" className="mt-4 space-y-3">
            {!editingVehicleId && (
              <AdminAddVehicleForm
                onAdd={(newVehicle) => {
                  setEditDriver(prev => {
                    const updated = [...(prev.vehicles || []), newVehicle];
                    supabaseApi.drivers.update(driver.id, { vehicles: updated });
                    queryClient.setQueryData<any[]>(["drivers"], (old = []) =>
                      old.map(d => d.id === driver.id ? { ...d, vehicles: updated } : d)
                    );
                    return { ...prev, vehicles: updated };
                  });
                  toast.success("Vehículo agregado");
                }}
                onCancel={() => {}}
                editingVehicle={null}
                vehicleDocs={vehicleDocsConfig}
              />
            )}
            {(!editDriver.vehicles || editDriver.vehicles.length === 0) && (
              <p className="text-xs text-slate-400 text-center py-6">Este conductor no tiene vehículos registrados.</p>
            )}
            {(editDriver.vehicles || []).map((v, i) => {
              // Filter docs by vehicle type
              const vtype = v.vehicle_type || "car";
              const docsForVehicle = vehicleDocsConfig.filter(d => !d.applies_to || d.applies_to === "both" || d.applies_to === vtype);

              // Check for expired docs to auto-flag
              const hasExpiredDoc = docsForVehicle.some(doc => {
                if (doc.require_expiry === false) return false;
                const expiry = v[`doc_${doc.key}_expiry`];
                if (!expiry) return false;
                return new Date(expiry) < new Date();
              });
              const isDisabled = !!v.admin_disabled || hasExpiredDoc;
              const isBeingEdited = editingVehicleId === (v.id || i);

              // Inline edit form
              if (isBeingEdited) {
                return (
                  <AdminAddVehicleForm
                    key={v.id || i}
                    editingVehicle={v}
                    vehicleDocs={vehicleDocsConfig}
                    onAdd={(updatedVehicle) => {
                      setEditDriver(prev => {
                        const updated = (prev.vehicles || []).map(x => x.id === updatedVehicle.id ? updatedVehicle : x);
                        supabaseApi.drivers.update(driver.id, { vehicles: updated });
                        queryClient.setQueryData<any[]>(["drivers"], (old = []) =>
                          old.map(d => d.id === driver.id ? { ...d, vehicles: updated } : d)
                        );
                        return { ...prev, vehicles: updated };
                      });
                      setEditingVehicleId(null);
                      toast.success("Vehículo actualizado");
                    }}
                    onCancel={() => setEditingVehicleId(null)}
                  />
                );
              }

              const toggleDisabled = async () => {
                const newDisabled = !v.admin_disabled;
                setEditDriver(prev => {
                  const updated = (prev.vehicles || []).map((x, j) => j === i ? { ...x, admin_disabled: newDisabled } : x);
                  supabaseApi.drivers.update(driver.id, { vehicles: updated });
                  queryClient.setQueryData<any[]>(["drivers"], (old = []) =>
                    old.map(d => d.id === driver.id ? { ...d, vehicles: updated } : d)
                  );
                  return { ...prev, vehicles: updated };
                });
                toast.success(newDisabled ? "Vehículo deshabilitado" : "Vehículo habilitado");
              };

              return (
                <div key={v.id || i} className={`border-2 rounded-xl p-4 space-y-3 ${isDisabled ? "border-red-200 bg-red-50/30 opacity-80" : v.is_active ? "border-blue-300 bg-blue-50/40" : "border-slate-200"}`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Car className={`w-4 h-4 ${isDisabled ? "text-red-400" : "text-slate-500"}`} />
                      <span className="font-semibold text-slate-800">{v.brand} {v.model}</span>
                      <span className="text-sm text-slate-500">{v.year} · {v.color}</span>
                      <span className="text-sm font-mono font-bold text-slate-700">{v.plates}</span>
                      {v.is_active && !isDisabled && <span className="text-[10px] font-bold text-blue-700 bg-blue-100 px-2 py-0.5 rounded-full">Activo</span>}
                      {hasExpiredDoc && <span className="text-[10px] font-bold text-red-700 bg-red-100 px-2 py-0.5 rounded-full">Doc vencido</span>}
                      {v.admin_disabled && !hasExpiredDoc && <span className="text-[10px] font-bold text-slate-600 bg-slate-200 px-2 py-0.5 rounded-full">Deshabilitado</span>}
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setEditingVehicleId(v.id || i)}
                        className="text-xs px-3 py-1.5 rounded-lg font-semibold bg-blue-50 text-blue-700 hover:bg-blue-100 transition-all flex-shrink-0"
                      >
                        Editar
                      </button>
                      <button
                        onClick={toggleDisabled}
                        disabled={hasExpiredDoc && !v.admin_disabled}
                        className={`text-xs px-3 py-1.5 rounded-lg font-semibold transition-all flex-shrink-0 ${
                          isDisabled ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-200" : "bg-red-100 text-red-700 hover:bg-red-200"
                        } disabled:opacity-40 disabled:cursor-not-allowed`}
                      >
                        {isDisabled ? "Habilitar" : "Deshabilitar"}
                      </button>
                    </div>
                  </div>

                  {/* Vehicle docs — one per row with approve/reject */}
                  <div className="space-y-2">
                    {docsForVehicle.map(doc => {
                      const urlKey = `doc_${doc.key}_url`;
                      const expiryKey = `doc_${doc.key}_expiry`;
                      const url = v[urlKey];
                      const expiry = v[expiryKey];
                      const days = expiry ? Math.ceil((new Date(expiry).getTime() - Date.now()) / 86400000) : null;
                      const isVDocApproved = (v.approved_docs || []).includes(doc.key);
                      const isVDocRejected = (v.rejected_docs || []).includes(doc.key);
                      const requireExpiry = doc.require_expiry !== false;

                      return (
                        <div key={doc.key} className={`p-3 rounded-xl border-2 transition-all ${isVDocApproved ? "border-emerald-300 bg-emerald-50" : isVDocRejected ? "border-red-200 bg-red-50" : url ? (days !== null && days < 0 ? "border-red-300 bg-red-50" : "border-amber-200 bg-amber-50") : "border-slate-100 bg-white"}`}>
                          <div className="flex items-center justify-between gap-2 flex-wrap">
                            <div className="flex items-center gap-2 min-w-0">
                              {isVDocApproved ? <CheckCircle className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />
                                : isVDocRejected ? <X className="w-3.5 h-3.5 text-red-500 flex-shrink-0" />
                                : url ? <Clock className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
                                : <X className="w-3.5 h-3.5 text-slate-300 flex-shrink-0" />}
                              <span className="text-sm font-medium text-slate-700 truncate">{doc.label}</span>
                              {doc.required && <span className="text-[10px] text-red-500">*</span>}
                              {isVDocApproved && <span className="text-[10px] bg-emerald-100 text-emerald-700 font-bold px-1.5 py-0.5 rounded-full">✓ Aprobado</span>}
                              {isVDocRejected && <span className="text-[10px] bg-red-100 text-red-700 font-bold px-1.5 py-0.5 rounded-full">✗ Rechazado</span>}
                              {days !== null && !isVDocApproved && !isVDocRejected && (
                                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${days < 0 ? "bg-red-100 text-red-700" : days <= 30 ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700"}`}>
                                  {days < 0 ? "Vencido" : `${days}d`}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-1.5 flex-wrap flex-shrink-0">
                              {url && <a href={url} target="_blank" rel="noreferrer" className="text-xs text-blue-600 hover:underline px-1.5 py-1">Ver</a>}
                              {url && (isVDocApproved || isVDocRejected) && (
                                <button onClick={() => undoVehicleDoc(i, doc.key)} className="text-xs px-2 py-1 rounded-lg bg-slate-100 text-slate-500 hover:bg-slate-200 transition-all">
                                  Deshacer
                                </button>
                              )}
                              {url && !isVDocApproved && !isVDocRejected && (
                                <>
                                  <button onClick={() => approveVehicleDoc(i, doc.key)} className="text-xs px-2 py-1 rounded-lg font-semibold bg-emerald-100 text-emerald-700 hover:bg-emerald-200 flex items-center gap-1 transition-all">
                                    <ThumbsUp className="w-3 h-3" /> Aprobar
                                  </button>
                                  <button onClick={() => rejectVehicleDoc(i, doc.key)} className="text-xs px-2 py-1 rounded-lg font-semibold bg-red-100 text-red-600 hover:bg-red-200 flex items-center gap-1 transition-all">
                                    <ThumbsDown className="w-3 h-3" /> Rechazar
                                  </button>
                                </>
                              )}
                              <label className="cursor-pointer">
                                <input type="file" accept="image/*,.pdf" className="hidden" onChange={async e => {
                                  const f = e.target.files?.[0]; if (!f) return;
                                  setUploadingDoc(doc.key + "_" + i);
                                  const { file_url } = await supabaseApi.uploads.uploadFile({ file: f });
                                  setEditDriver(prev => {
                                    const updatedVehicles = (prev.vehicles || []).map((x, j) => j === i ? { ...x, [urlKey]: file_url } : x);
                                    supabaseApi.drivers.update(driver.id, { vehicles: updatedVehicles });
                                    queryClient.setQueryData<any[]>(["drivers"], (old = []) =>
                                      old.map(d => d.id === driver.id ? { ...d, vehicles: updatedVehicles } : d)
                                    );
                                    return { ...prev, vehicles: updatedVehicles };
                                  });
                                  setUploadingDoc(null);
                                }} />
                                <span className="text-xs bg-slate-100 hover:bg-slate-200 px-2 py-1 rounded-lg flex items-center gap-1 text-slate-600 cursor-pointer">
                                  {uploadingDoc === doc.key + "_" + i ? "..." : <><Upload className="w-3 h-3" /> Subir</>}
                                </span>
                              </label>
                            </div>
                          </div>
                          {/* Expiry date input — only if require_expiry */}
                          {requireExpiry && (
                            <div className="mt-2 flex items-center gap-1">
                              <span className="text-[10px] text-slate-400">Vencimiento:</span>
                              <input type="date" value={expiry || ""}
                                onChange={async e => {
                                  const val = e.target.value;
                                  setEditDriver(prev => {
                                    const updatedVehicles = (prev.vehicles || []).map((x, j) => j === i ? { ...x, [expiryKey]: val } : x);
                                    supabaseApi.drivers.update(driver.id, { vehicles: updatedVehicles }).catch(err => console.error("Error updating vehicles:", err));
                                    queryClient.setQueryData<any[]>(["drivers"], (old = []) =>
                                      old.map(d => d.id === driver.id ? { ...d, vehicles: updatedVehicles } : d)
                                    );
                                    return { ...prev, vehicles: updatedVehicles };
                                  });
                                }}
                                className="border border-slate-200 rounded-md px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-300" />
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </TabsContent>

          <TabsContent value="services" className="mt-4 space-y-4">
            <div>
              <Label className="text-sm text-slate-700 mb-3 block">Tipos de servicio asignados</Label>
              <div className="space-y-2">
                {serviceTypes.map(svc => {
                  const active = (editDriver.service_type_ids || []).includes(svc.id);
                  return (
                    <div key={svc.id} className={`flex items-center justify-between p-3 rounded-xl border transition-all ${active ? "border-blue-300 bg-blue-50" : "border-slate-200 bg-white"}`}>
                      <div>
                        <p className={`text-sm font-medium ${active ? "text-blue-800" : "text-slate-700"}`}>{svc.name}</p>
                        {svc.category && <p className="text-[10px] text-slate-400">{svc.category}</p>}
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => { if (!active) toggleServiceType(svc.id, svc.name); }}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${active ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-500 hover:bg-blue-50 hover:text-blue-600"}`}
                        >
                          Sí
                        </button>
                        <button
                          onClick={() => { if (active) toggleServiceType(svc.id, svc.name); }}
                          className={`px-2.5 py-0.5 rounded-lg text-xs font-bold transition-all ${!active ? "bg-slate-700 text-white" : "bg-slate-100 text-slate-500 hover:bg-slate-200"}`}>
                          No
                        </button>
                      </div>
                    </div>
                  );
                })}
                {serviceTypes.length === 0 && (
                  <p className="text-sm text-slate-400 col-span-2">No hay tipos de servicio creados aún.</p>
                )}
              </div>
            </div>
            <div className="bg-slate-50 rounded-xl p-4">
              <p className="text-xs text-slate-500 font-medium mb-2">RESUMEN DEL CONDUCTOR</p>
              <div className="grid grid-cols-3 gap-3">
                <div className="text-center"><p className="text-lg font-bold text-slate-900">{driver.total_rides || 0}</p><p className="text-xs text-slate-400">Viajes</p></div>
                <div className="text-center"><p className="text-lg font-bold text-emerald-600">${totalEarnings.toFixed(0)}</p><p className="text-xs text-slate-400">Ganancias</p></div>
                <div className="text-center"><p className="text-lg font-bold text-amber-600">{driver.rating || 5} <Star className="w-3 h-3 inline fill-amber-400 text-amber-400" /></p><p className="text-xs text-slate-400">Calificación</p></div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="banking" className="mt-4 space-y-4">
            <div className="bg-blue-50 rounded-xl p-4 text-sm text-blue-700 mb-2">
              Datos para transferencias de pago al conductor.
            </div>
            <div><Label>Titular de la cuenta</Label><Input value={editDriver.bank_holder || ""} onChange={e => update("bank_holder", e.target.value)} placeholder="Nombre completo del titular" /></div>
            <div><Label>Banco</Label><Input value={editDriver.bank_name || ""} onChange={e => update("bank_name", e.target.value)} placeholder="Nombre del banco" /></div>
            <div><Label>Número de cuenta</Label><Input value={editDriver.bank_account || ""} onChange={e => update("bank_account", e.target.value)} placeholder="Número de cuenta" /></div>
            <div><Label>CLABE interbancaria</Label><Input value={editDriver.bank_clabe || ""} onChange={e => update("bank_clabe", e.target.value)} placeholder="18 dígitos" maxLength={18} /></div>
          </TabsContent>

          <TabsContent value="docs" className="mt-4 space-y-3">
            <p className="text-xs text-slate-500 bg-blue-50 rounded-xl px-4 py-2.5">Documentos personales del conductor. Los documentos de cada vehículo están en la pestaña <strong>Vehículos</strong>.</p>
            {/* Summary bar */}
            <div className="flex items-center gap-3 bg-slate-50 rounded-xl px-4 py-2.5 text-xs text-slate-600">
              <span className="text-emerald-600 font-semibold">✓ {Object.values(docApproved).filter(Boolean).length} aprobados</span>
              <span>·</span>
              <span className="text-red-500 font-semibold">✗ {Object.values(docRejected).filter(Boolean).length} rechazados</span>
              <span>·</span>
              <span>{dynamicDocs.length - Object.values(docApproved).filter(Boolean).length - Object.values(docRejected).filter(Boolean).length} pendientes</span>
            </div>

            {!canApproveDriver && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-700">
                ⚠️ Aprueba todos los documentos requeridos antes de aprobar al conductor.
              </div>
            )}
            {dynamicDocs.map(doc => {
              const docUrl = getDocUrl(doc);
              const isApproved = !!docApproved[doc.key];
              const isRejected = !!docRejected[doc.key];
              const expiry = docExpiries[doc.key] || "";
              const expiryDays = expiry ? Math.ceil((new Date(expiry).getTime() - Date.now()) / 86400000) : null;
              return (
                <div key={doc.key} className={`p-3 rounded-xl border-2 transition-all ${isApproved ? "border-emerald-300 bg-emerald-50" : isRejected ? "border-red-200 bg-red-50" : docUrl ? "border-amber-200 bg-amber-50" : "border-slate-100"}`}>
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-2 flex-wrap">
                      {isApproved ? <CheckCircle className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                        : isRejected ? <X className="w-4 h-4 text-red-500 flex-shrink-0" />
                        : docUrl ? <Clock className="w-4 h-4 text-amber-400 flex-shrink-0" />
                        : <X className="w-4 h-4 text-slate-300 flex-shrink-0" />}
                      <span className="text-sm font-medium text-slate-700">{doc.label}</span>
                      {doc.required && <span className="text-[10px] text-red-500">*</span>}
                      {isApproved && <span className="text-[10px] bg-emerald-100 text-emerald-700 font-bold px-2 py-0.5 rounded-full">Aprobado</span>}
                      {isRejected && <span className="text-[10px] bg-red-100 text-red-700 font-bold px-2 py-0.5 rounded-full">Rechazado</span>}
                      {expiryDays !== null && (
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${expiryDays < 0 ? "bg-red-100 text-red-700" : expiryDays <= 30 ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700"}`}>
                          {expiryDays < 0 ? "Vencido" : `${expiryDays}d`}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {docUrl && (
                        <a href={docUrl} target="_blank" rel="noreferrer" className="text-xs text-blue-600 hover:underline px-2 py-1">Ver doc</a>
                      )}
                      {docUrl && !isApproved && !isRejected && (
                        <>
                          <button onClick={() => approveDoc(doc.key)} className="text-xs px-2.5 py-1 rounded-lg font-semibold bg-emerald-100 text-emerald-700 hover:bg-emerald-200 flex items-center gap-1 transition-all">
                            <ThumbsUp className="w-3 h-3" /> Aprobar
                          </button>
                          <button onClick={() => rejectDoc(doc.key)} className="text-xs px-2.5 py-1 rounded-lg font-semibold bg-red-100 text-red-600 hover:bg-red-200 flex items-center gap-1 transition-all">
                            <ThumbsDown className="w-3 h-3" /> Rechazar
                          </button>
                        </>
                      )}
                      {(isApproved || isRejected) && (
                        <button onClick={() => undoDocDecision(doc.key)} className="text-xs px-2.5 py-1 rounded-lg font-semibold bg-slate-100 text-slate-500 hover:bg-slate-200 transition-all">
                          Deshacer
                        </button>
                      )}
                      <label className="cursor-pointer">
                        <input type="file" accept="image/*,.pdf" className="hidden"
                          onChange={e => { const f = e.target.files?.[0]; if (f) handleDocUpload(doc.key, f); }} />
                        <span className="text-xs bg-slate-100 hover:bg-slate-200 px-2 py-1 rounded-lg flex items-center gap-1 text-slate-600 cursor-pointer">
                          {uploadingDoc === doc.key ? "..." : <><Upload className="w-3 h-3" /> Subir</>}
                        </span>
                      </label>
                    </div>
                  </div>
                  {/* Vigencia del documento personal */}
                  <div className="mt-2 flex items-center gap-1">
                    <span className="text-[10px] text-slate-400">Vigencia:</span>
                    <input type="date" value={expiry}
                      onChange={e => setDocExpiries(prev => ({ ...prev, [doc.key]: e.target.value }))}
                      className="border border-slate-200 rounded-md px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-300" />
                    {expiry && <button onClick={() => setDocExpiries(prev => ({ ...prev, [doc.key]: "" }))} className="text-[10px] text-slate-400 hover:text-red-400">✕</button>}
                  </div>
                </div>
              );
            })}
            {dynamicDocs.length === 0 && (
              <p className="text-xs text-slate-400 text-center py-6">Configure documentos requeridos en la sección de Configuración.</p>
            )}
          </TabsContent>

          <TabsContent value="ratings" className="mt-4 space-y-4">
            {(() => {
              const ratedRides = rides.filter(r => r.driver_id === driver?.id && (r.admin_rating > 0 || r.passenger_rating_for_driver > 0));
              const avgAdmin = ratedRides.filter(r => r.admin_rating > 0).length > 0
                ? (ratedRides.filter(r => r.admin_rating > 0).reduce((s, r) => s + r.admin_rating, 0) / ratedRides.filter(r => r.admin_rating > 0).length).toFixed(1)
                : null;
              const avgPass = ratedRides.filter(r => r.passenger_rating_for_driver > 0).length > 0
                ? (ratedRides.filter(r => r.passenger_rating_for_driver > 0).reduce((s, r) => s + r.passenger_rating_for_driver, 0) / ratedRides.filter(r => r.passenger_rating_for_driver > 0).length).toFixed(1)
                : null;
              return (
                <>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="bg-slate-50 rounded-xl p-3 text-center">
                      <p className="text-lg font-bold text-amber-600 flex items-center justify-center gap-1">{driver.rating || 5} <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" /></p>
                      <p className="text-xs text-slate-400">Calif. general</p>
                    </div>
                    <div className="bg-slate-50 rounded-xl p-3 text-center">
                      <p className="text-lg font-bold text-blue-600">{avgAdmin || "—"}</p>
                      <p className="text-xs text-slate-400">Por admin</p>
                    </div>
                    <div className="bg-slate-50 rounded-xl p-3 text-center">
                      <p className="text-lg font-bold text-violet-600">{avgPass || "—"}</p>
                      <p className="text-xs text-slate-400">Por pasajero</p>
                    </div>
                  </div>
                  <div className="space-y-2 max-h-80 overflow-y-auto">
                    {ratedRides.length === 0 && <p className="text-sm text-slate-400 text-center py-6">Sin calificaciones aún</p>}
                    {ratedRides.map(r => (
                      <div key={r.id} className="border border-slate-100 rounded-xl p-3 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="font-mono text-xs text-slate-400">#{r.service_id || r.id?.slice(-6)}</span>
                          <span className="text-xs text-slate-400">{r.passenger_name}</span>
                        </div>
                        {r.admin_rating > 0 && (
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] text-slate-400 w-16">Admin:</span>
                            <div className="flex items-center gap-0.5">
                              {[1,2,3,4,5].map(n => <Star key={n} className={`w-3.5 h-3.5 ${n <= r.admin_rating ? "fill-amber-400 text-amber-400" : "text-slate-200"}`} />)}
                            </div>
                            {r.admin_rating_comment && <span className="text-xs text-slate-400 italic truncate">&ldquo;{r.admin_rating_comment}&rdquo;</span>}
                          </div>
                        )}
                        {r.passenger_rating_for_driver > 0 && (
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] text-slate-400 w-16">Pasajero:</span>
                            <div className="flex items-center gap-0.5">
                              {[1,2,3,4,5].map(n => <Star key={n} className={`w-3.5 h-3.5 ${n <= r.passenger_rating_for_driver ? "fill-violet-400 text-violet-400" : "text-slate-200"}`} />)}
                            </div>
                            {r.passenger_rating_comment && <span className="text-xs text-slate-400 italic truncate">&ldquo;{r.passenger_rating_comment}&rdquo;</span>}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </>
              );
            })()}
          </TabsContent>
        </Tabs>

        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving} className="bg-slate-900 hover:bg-slate-800">
            {saving ? "Guardando..." : "Guardar cambios"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
