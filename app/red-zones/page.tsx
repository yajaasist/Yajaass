"use client";

import React, { useState } from "react";
import Layout from "@/components/admin/Layout";
import { supabaseApi } from "@/lib/supabaseApi";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { MapContainer, TileLayer, Polygon, useMapEvents } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { Plus, Pencil, Trash2, Map, Check, X, ShieldAlert, Clock, EyeOff, Eye, AlertTriangle, MapPin } from "lucide-react";
import { toast } from "sonner";

const DAYS_ES = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

function PolygonDrawer({ drawing, onPointAdd, polygon }) {
  useMapEvents({
    click(e) {
      if (drawing) onPointAdd([e.latlng.lat, e.latlng.lng]);
    }
  });
  return polygon?.length > 1 ? (
    <Polygon positions={polygon} pathOptions={{ color: "#EF4444", fillColor: "#EF4444", fillOpacity: 0.3, weight: 2 }} />
  ) : null;
}

function AllRedZonesLayer({ zones }) {
  return zones.map(z =>
    z.is_active && z.coordinates?.length > 2 ? (
      <Polygon key={z.id} positions={z.coordinates}
        pathOptions={{ color: "#EF4444", fillColor: "#EF4444", fillOpacity: 0.25, weight: 2 }} />
    ) : null
  );
}

const empty = { name: "", reason: "", is_active: true, coordinates: [], use_schedule: false, active_hours_start: "22:00", active_hours_end: "06:00", active_days: [] };

export default function RedZones() {
  const queryClient = useQueryClient();
  const [showDialog, setShowDialog] = useState(false);
  const [editing, setEditing] = useState(null);
  const [drawing, setDrawing] = useState(false);
  const [polygon, setPolygon] = useState([]);
  const [saving, setSaving] = useState(false);
  const [showMap, setShowMap] = useState(true);

  const { data: zones = [] } = useQuery({
    queryKey: ["redZones"],
    queryFn: () => supabaseApi.redZones.list(),
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });

  const up = (k, v) => setEditing(prev => ({ ...prev, [k]: v }));

  const openNew = () => { setEditing({ ...empty }); setPolygon([]); setDrawing(false); setShowDialog(true); };
  const openEdit = (z) => { setEditing({ ...z }); setPolygon(z.coordinates || []); setDrawing(false); setShowDialog(true); };

  const handleSave = async () => {
    if (!editing.name) { toast.error("Ingresa un nombre"); return; }
    if (polygon.length < 3) { toast.error("Dibuja al menos 3 puntos"); return; }
    setSaving(true);
    const data = { ...editing, coordinates: polygon };
    try {
      if (editing.id) {
        await supabaseApi.redZones.update(editing.id, data);
      } else {
        await supabaseApi.redZones.create(data);
      }
      queryClient.invalidateQueries({ queryKey: ["redZones"] });
      setSaving(false);
      setShowDialog(false);
      toast.success("Zona roja guardada");
    } catch (err) {
      toast.error("Error al guardar zona");
      setSaving(false);
    }
  };

  const handleDelete = async (z) => {
    if (!window.confirm(`¿Eliminar zona "${z.name}"?`)) return;
    try {
      await supabaseApi.redZones.delete(z.id);
      queryClient.invalidateQueries({ queryKey: ["redZones"] });
      toast.success("Zona roja eliminada");
    } catch (err) {
      toast.error("Error al eliminar zona");
    }
  };

  const toggleActive = async (z) => {
    try {
      await supabaseApi.redZones.update(z.id, { is_active: !z.is_active });
      queryClient.invalidateQueries({ queryKey: ["redZones"] });
    } catch (err) {
      toast.error("Error al cambiar estado de zona");
    }
  };

  const activeCount = zones.filter(z => z.is_active).length;
  const scheduledCount = zones.filter(z => z.use_schedule).length;

  return (
    <Layout currentPageName="RedZones">
      <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5 mb-1">
            <div className="w-9 h-9 bg-red-100 rounded-xl flex items-center justify-center">
              <ShieldAlert className="w-5 h-5 text-red-600" />
            </div>
            <h1 className="text-2xl font-bold text-slate-900">Zonas Rojas</h1>
          </div>
          <p className="text-sm text-slate-400 pl-11">Polígonos de zonas restringidas. Los viajes con origen o destino en estas zonas mostrarán alerta al operador.</p>
        </div>
        <Button onClick={openNew} className="bg-red-600 hover:bg-red-700 rounded-xl shadow-sm shadow-red-200">
          <Plus className="w-4 h-4 mr-2" /> Nueva zona roja
        </Button>
      </div>

      {/* Stats bar */}
      {zones.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-red-50 rounded-xl p-4 text-center border border-red-100">
            <p className="text-2xl font-bold text-red-700">{zones.length}</p>
            <p className="text-xs text-red-500 mt-0.5">Total zonas</p>
          </div>
          <div className="bg-emerald-50 rounded-xl p-4 text-center border border-emerald-100">
            <p className="text-2xl font-bold text-emerald-700">{activeCount}</p>
            <p className="text-xs text-emerald-500 mt-0.5">Activas</p>
          </div>
          <div className="bg-orange-50 rounded-xl p-4 text-center border border-orange-100">
            <p className="text-2xl font-bold text-orange-700">{scheduledCount}</p>
            <p className="text-xs text-orange-500 mt-0.5">Con horario</p>
          </div>
        </div>
      )}

      {/* Map section with toggle */}
      {zones.length > 0 && (
        <div className="rounded-2xl overflow-hidden border border-red-100 shadow-sm">
          <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-red-50 to-rose-50 border-b border-red-100">
            <div className="flex items-center gap-2">
              <MapPin className="w-4 h-4 text-red-500" />
              <span className="text-sm font-semibold text-red-700">Mapa de zonas restringidas</span>
              <Badge className="bg-red-100 text-red-600 border-0 text-xs">{activeCount} activas</Badge>
            </div>
            <Button variant="ghost" size="sm" onClick={() => setShowMap(v => !v)}
              className="rounded-lg text-red-600 hover:bg-red-100 text-xs gap-1.5">
              {showMap ? <><EyeOff className="w-3.5 h-3.5" /> Ocultar mapa</> : <><Eye className="w-3.5 h-3.5" /> Ver mapa</>}
            </Button>
          </div>
          {showMap && (
            <div style={{ height: 300 }}>
              <MapContainer center={[19.4326, -99.1332]} zoom={10} className="h-full w-full">
                <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                <AllRedZonesLayer zones={zones} />
              </MapContainer>
            </div>
          )}
        </div>
      )}

      {/* Empty state */}
      {zones.length === 0 && (
        <div className="text-center py-16 border-2 border-dashed border-red-100 rounded-2xl bg-red-50/30">
          <div className="w-16 h-16 bg-red-100 rounded-2xl flex items-center justify-center mx-auto mb-3">
            <ShieldAlert className="w-8 h-8 text-red-400" />
          </div>
          <h3 className="font-semibold text-slate-700 mb-1">Sin zonas rojas configuradas</h3>
          <p className="text-sm text-slate-400 mb-4">Crea polígonos de zonas restringidas para alertar a los operadores.</p>
          <Button onClick={openNew} className="bg-red-600 hover:bg-red-700 rounded-xl">
            <Plus className="w-4 h-4 mr-2" /> Crear primera zona
          </Button>
        </div>
      )}

      {/* Zone cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {zones.map(z => (
          <Card key={z.id} className={`border-0 shadow-sm overflow-hidden transition-all hover:shadow-md ${z.is_active ? "" : "opacity-60"}`}>
            {/* Color top bar */}
            <div className={`h-1.5 ${z.is_active ? "bg-gradient-to-r from-red-500 to-rose-600" : "bg-slate-200"}`} />
            <div className="p-5">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2.5">
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${z.is_active ? "bg-red-100" : "bg-slate-100"}`}>
                    <AlertTriangle className={`w-4.5 h-4.5 ${z.is_active ? "text-red-600" : "text-slate-400"} w-[18px] h-[18px]`} />
                  </div>
                  <div>
                    <h3 className="font-semibold text-slate-900 text-sm leading-tight">{z.name}</h3>
                    <p className="text-xs text-slate-400 mt-0.5">{z.coordinates?.length || 0} puntos del polígono</p>
                  </div>
                </div>
                <Switch checked={z.is_active} onCheckedChange={() => toggleActive(z)} />
              </div>

              {z.reason && (
                <p className="text-xs text-slate-600 mb-3 bg-slate-50 rounded-lg p-2.5 leading-relaxed border border-slate-100">
                  {z.reason}
                </p>
              )}

              {z.use_schedule && z.active_hours_start && z.active_hours_end && (
                <div className="flex items-center gap-1.5 text-xs text-orange-700 bg-orange-50 border border-orange-100 rounded-lg px-2.5 py-1.5 mb-3">
                  <Clock className="w-3.5 h-3.5 flex-shrink-0" />
                  <span className="font-medium">{z.active_hours_start} – {z.active_hours_end}</span>
                  {(z.active_days || []).length > 0 && (
                    <span className="text-orange-500 ml-0.5">· {(z.active_days || []).map(d => DAYS_ES[d]).join(", ")}</span>
                  )}
                </div>
              )}

              <div className="flex items-center justify-between mt-auto pt-3 border-t border-slate-100">
                <Badge className={`text-xs border-0 ${z.is_active ? "bg-red-100 text-red-700" : "bg-slate-100 text-slate-500"}`}>
                  {z.is_active ? "Activa" : "Inactiva"}
                </Badge>
                <div className="flex gap-1">
                  <Button variant="ghost" size="sm" className="rounded-lg h-8 text-slate-500 hover:text-slate-700 hover:bg-slate-100" onClick={() => openEdit(z)}>
                    <Pencil className="w-3.5 h-3.5 mr-1" /> Editar
                  </Button>
                  <Button variant="ghost" size="sm" className="rounded-lg h-8 text-red-400 hover:text-red-600 hover:bg-red-50" onClick={() => handleDelete(z)}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Edit/Create Dialog */}
      <Dialog open={showDialog} onOpenChange={v => { setShowDialog(v); if (!v) { setDrawing(false); setPolygon([]); } }}>
        <DialogContent className="dialog-size-3xl max-h-[90vh] overflow-y-auto p-4" style={{ width: '90vw', maxWidth: '1100px' }}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-700">
              <ShieldAlert className="w-5 h-5" />
              {editing?.id ? "Editar zona roja" : "Nueva zona roja"}
            </DialogTitle>
          </DialogHeader>
          {editing && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 py-2">
              <div className="space-y-4">
                <div>
                  <Label>Nombre *</Label>
                  <Input value={editing.name} onChange={e => up("name", e.target.value)} placeholder="Ej. Zona Norte Restringida" className="mt-1" />
                </div>
                <div>
                  <Label>Motivo / descripción</Label>
                  <Textarea value={editing.reason} onChange={e => up("reason", e.target.value)} placeholder="Ej. Alta siniestralidad, eventos especiales..." rows={3} className="mt-1" />
                </div>
                <div className="flex items-center gap-3">
                  <Switch checked={editing.is_active} onCheckedChange={v => up("is_active", v)} />
                  <Label>Zona activa</Label>
                </div>

                <div className="space-y-3 pt-2 border-t border-slate-100">
                  <div className="flex items-center gap-3">
                    <Switch checked={!!editing.use_schedule} onCheckedChange={v => up("use_schedule", v)} />
                    <div>
                      <Label className="flex items-center gap-1.5"><Clock className="w-3.5 h-3.5" /> Restricción por horario</Label>
                      <p className="text-xs text-slate-400">La zona solo estará activa en el horario especificado</p>
                    </div>
                  </div>
                  {editing.use_schedule && (
                    <div className="space-y-3 pl-2">
                      <div className="flex gap-3 items-end">
                        <div className="flex-1">
                          <Label className="text-xs">Hora inicio</Label>
                          <input type="time" value={editing.active_hours_start || "22:00"} onChange={e => up("active_hours_start", e.target.value)} className="mt-1 w-full border border-input rounded-md px-3 py-1.5 text-sm" />
                        </div>
                        <div className="flex-1">
                          <Label className="text-xs">Hora fin</Label>
                          <input type="time" value={editing.active_hours_end || "06:00"} onChange={e => up("active_hours_end", e.target.value)} className="mt-1 w-full border border-input rounded-md px-3 py-1.5 text-sm" />
                        </div>
                      </div>
                      <div>
                        <Label className="text-xs mb-1.5 block">Días activos (vacío = todos)</Label>
                        <div className="flex flex-wrap gap-1.5">
                          {DAYS_ES.map((day, i) => {
                            const active = (editing.active_days || []).includes(i);
                            return (
                              <button key={i} type="button"
                                onClick={() => { const days = editing.active_days || []; up("active_days", active ? days.filter(d => d !== i) : [...days, i]); }}
                                className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all border ${active ? "bg-red-600 text-white border-red-600" : "border-slate-300 text-slate-600 hover:border-red-300"}`}>
                                {day}
                              </button>
                            );
                          })}
                        </div>
                        {(editing.active_days || []).length === 0 && <p className="text-xs text-slate-400 mt-1">Sin selección = aplica todos los días</p>}
                      </div>
                    </div>
                  )}
                </div>

                <div className="bg-red-50 border border-red-100 rounded-xl p-3">
                  <p className="text-xs font-semibold text-red-700 mb-1.5">📍 Cómo dibujar la zona:</p>
                  <ol className="text-xs text-red-600 space-y-0.5 list-decimal list-inside">
                    <li>Activa el modo dibujo con el botón</li>
                    <li>Haz clic en el mapa para agregar puntos</li>
                    <li>Mínimo 3 puntos forman el polígono</li>
                  </ol>
                </div>
                <div className="flex gap-2">
                  <Button type="button" onClick={() => setDrawing(v => !v)}
                    className={`flex-1 rounded-xl ${drawing ? "bg-red-600 hover:bg-red-700" : "bg-slate-700 hover:bg-slate-800"}`}>
                    {drawing ? <><Check className="w-4 h-4 mr-1.5" /> Dibujando ({polygon.length} pts)</> : <><Map className="w-4 h-4 mr-1.5" /> Activar dibujo</>}
                  </Button>
                  <Button type="button" variant="outline" onClick={() => setPolygon([])} className="rounded-xl">
                    <X className="w-4 h-4 mr-1" /> Limpiar
                  </Button>
                </div>
                {polygon.length > 0 && (
                  <p className="text-xs text-slate-500">{polygon.length} puntos {polygon.length < 3 && <span className="text-red-500">(mínimo 3)</span>}</p>
                )}
              </div>
              <div className="rounded-xl overflow-hidden border border-slate-200 h-96 lg:h-auto" style={{ minHeight: 360 }}>
                <MapContainer center={polygon.length > 0 ? polygon[0] : [19.4326, -99.1332]} zoom={12} className="h-full w-full" style={{ height: "100%", minHeight: 360 }}>
                  <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                  <PolygonDrawer drawing={drawing} onPointAdd={pt => setPolygon(prev => [...prev, pt])} polygon={polygon} />
                </MapContainer>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving || polygon.length < 3} className="bg-red-600 hover:bg-red-700">
              {saving ? "Guardando..." : "Guardar zona roja"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
    </Layout>
  );
}
