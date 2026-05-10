"use client";

import React, { useState } from "react";
import { supabaseApi } from "@/lib/supabaseApi";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import Layout from "@/components/admin/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MapContainer, TileLayer, Polygon, useMapEvents } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { Plus, Pencil, Trash2, Map, Check, X, Layers, EyeOff, Eye } from "lucide-react";
import { toast } from "sonner";

const COLORS = ["#3B82F6","#10B981","#F59E0B","#EF4444","#8B5CF6","#EC4899","#06B6D4","#84CC16"];

function PolygonDrawer({ drawing, onPointAdd, polygon }) {
  useMapEvents({
    click(e) {
      if (drawing) onPointAdd([e.latlng.lat, e.latlng.lng]);
    }
  });
  return polygon?.length > 1 ? (
    <Polygon positions={polygon} pathOptions={{ color: "#3B82F6", fillColor: "#3B82F6", fillOpacity: 0.25, weight: 2 }} />
  ) : null;
}

function AllZonesLayer({ zones, selectedId, onSelect }) {
  return zones.map(z => (
    z.is_active && z.coordinates?.length > 2 ? (
      <Polygon
        key={z.id}
        positions={z.coordinates}
        pathOptions={{
          color: z.color || "#3B82F6",
          fillColor: z.color || "#3B82F6",
          fillOpacity: selectedId === z.id ? 0.4 : 0.2,
          weight: selectedId === z.id ? 3 : 1.5
        }}
        eventHandlers={{ click: () => onSelect(z.id) }}
      />
    ) : null
  ));
}

function MapToggleSection({ zones, selectedId, setSelectedId }) {
  const [mapVisible, setMapVisible] = React.useState(true);
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs text-slate-400">Mapa general de zonas</p>
        <button
          onClick={() => setMapVisible(v => !v)}
          className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-700 border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white hover:bg-slate-50 transition-colors"
        >
          {mapVisible ? <><EyeOff className="w-3.5 h-3.5" /> Ocultar mapa</> : <><Eye className="w-3.5 h-3.5" /> Mostrar mapa</>}
        </button>
      </div>
      {mapVisible ? (
        <div className="rounded-2xl overflow-hidden border border-slate-200 shadow-sm h-96" style={{ position: 'relative', zIndex: 0, isolation: 'isolate' }}>
          <MapContainer center={[19.4326, -99.1332]} zoom={10} className="h-full w-full" style={{ zIndex: 0 }}>
            <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
            <AllZonesLayer zones={zones} selectedId={selectedId} onSelect={setSelectedId} />
          </MapContainer>
        </div>
      ) : (
        <div
          className="rounded-2xl border border-slate-200 bg-slate-50 flex items-center justify-center h-16 cursor-pointer hover:bg-slate-100 transition-colors"
          onClick={() => setMapVisible(true)}
        >
          <Map className="w-4 h-4 mr-2 text-slate-400" />
          <span className="text-sm text-slate-400">Mapa oculto — clic para mostrar</span>
        </div>
      )}
    </div>
  );
}

const emptyZone = {
  name: "", tarifa_base: "", tarifa_por_km: "", tarifa_fija: "",
  tipo_tarifa: "dinamica", prioridad: 1, color: "#3B82F6", is_active: true, coordinates: [],
  service_tariff_priority: "zone", company_tariff_priority: "zone"
};

function GeoZonesContent() {
  const queryClient = useQueryClient();
  const [showDialog, setShowDialog] = useState(false);
  const [editing, setEditing] = useState(null);
  const [drawing, setDrawing] = useState(false);
  const [polygon, setPolygon] = useState([]);
  const [saving, setSaving] = useState(false);
  const [selectedId, setSelectedId] = useState(null);

  const { data: zones = [] } = useQuery({
    queryKey: ["geoZones"],
    queryFn: () => supabaseApi.geoZones.list(),
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });

  const { data: rides = [] } = useQuery({
    queryKey: ["ridesForZones"],
    queryFn: () => supabaseApi.rideRequests.list(),
    staleTime: 30 * 1000,
    gcTime: 10 * 60 * 1000,
  });

  const up = (k, v) => setEditing(prev => ({ ...prev, [k]: v }));

  const openNew = () => {
    setEditing({ ...emptyZone });
    setPolygon([]);
    setDrawing(false);
    setShowDialog(true);
  };

  const openEdit = (z) => {
    setEditing({ ...z });
    setPolygon(z.coordinates || []);
    setDrawing(false);
    setShowDialog(true);
  };

  const handlePointAdd = (pt) => setPolygon(prev => [...prev, pt]);

  const handleSave = async () => {
    if (!editing.name) { toast.error("Ingresa un nombre"); return; }
    if (polygon.length < 3) { toast.error("Dibuja al menos 3 puntos en el mapa"); return; }
    setSaving(true);
    const data = {
      ...editing,
      coordinates: polygon,
      tarifa_base: parseFloat(editing.tarifa_base) || 0,
      tarifa_por_km: parseFloat(editing.tarifa_por_km) || 0,
      tarifa_fija: editing.tarifa_fija ? parseFloat(editing.tarifa_fija) : undefined,
      prioridad: parseInt(editing.prioridad) || 1,
      service_tariff_priority: editing.service_tariff_priority || "zone",
      company_tariff_priority: editing.company_tariff_priority || "zone",
    };
    try {
      if (editing.id) {
        await supabaseApi.geoZones.update(editing.id, data);
      } else {
        await supabaseApi.geoZones.create(data);
      }
      queryClient.invalidateQueries({ queryKey: ["geoZones"] });
      setSaving(false);
      setShowDialog(false);
      toast.success("Zona guardada");
    } catch (error) {
      toast.error("Error al guardar zona");
      setSaving(false);
    }
  };

  const handleDelete = async (z) => {
    if (!window.confirm(`¿Eliminar zona "${z.name}"?`)) return;
    try {
      await supabaseApi.geoZones.delete(z.id);
      queryClient.invalidateQueries({ queryKey: ["geoZones"] });
      toast.success("Zona eliminada");
    } catch (error) {
      toast.error("Error al eliminar zona");
    }
  };

  const toggleActive = async (z) => {
    try {
      await supabaseApi.geoZones.update(z.id, { is_active: !z.is_active });
      queryClient.invalidateQueries({ queryKey: ["geoZones"] });
    } catch (error) {
      toast.error("Error al actualizar zona");
    }
  };

  // Stats per zone
  const zoneStats = (zoneId) => {
    const zRides = rides.filter(r => r.status === "completed" && r.geo_zone_id === zoneId);
    const revenue = zRides.reduce((s, r) => s + (r.final_price || r.estimated_price || 0), 0);
    return { count: zRides.length, revenue };
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Zonas tarifarias</h1>
          <p className="text-sm text-slate-400 mt-0.5">Geocercas con tarifas diferenciadas por zona</p>
        </div>
        <Button onClick={openNew} className="bg-slate-900 hover:bg-slate-800 rounded-xl">
          <Plus className="w-4 h-4 mr-2" /> Nueva zona
        </Button>
      </div>

      <MapToggleSection zones={zones} selectedId={selectedId} setSelectedId={setSelectedId} />

      {zones.length === 0 && (
        <div className="text-center py-12 text-slate-400">
          <Layers className="w-10 h-10 mx-auto mb-2 opacity-40" />
          <p className="text-sm">No hay zonas tarifarias. Crea la primera.</p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {zones.map(z => {
          const stats = zoneStats(z.id);
          return (
            <Card
              key={z.id}
              className={`p-5 border-0 shadow-sm hover:shadow-md transition-shadow cursor-pointer ${selectedId === z.id ? "ring-2 ring-blue-500" : ""}`}
              onClick={() => setSelectedId(z.id === selectedId ? null : z.id)}
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded-full" style={{ backgroundColor: z.color || "#3B82F6" }} />
                  <h3 className="font-semibold text-slate-900">{z.name}</h3>
                </div>
                <div className="flex items-center gap-2">
                  <Switch checked={z.is_active} onCheckedChange={() => toggleActive(z)} onClick={e => e.stopPropagation()} />
                </div>
              </div>
              <div className="space-y-1.5 mb-3">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Tipo</span>
                  <Badge variant="outline" className="text-xs">{z.tipo_tarifa === "fija" ? "Tarifa fija" : "Dinámica"}</Badge>
                </div>
                {z.tipo_tarifa === "fija" ? (
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500">Tarifa fija</span>
                    <span className="font-medium">${z.tarifa_fija || 0}</span>
                  </div>
                ) : (
                  <>
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-500">Base</span>
                      <span className="font-medium">${z.tarifa_base || 0}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-500">Por km</span>
                      <span className="font-medium">${z.tarifa_por_km || 0}</span>
                    </div>
                  </>
                )}
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Prioridad</span>
                  <span className="font-medium">{z.prioridad || 1}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Servicios normales</span>
                  <Badge variant="outline" className="text-xs">
                    {z.service_tariff_priority === "zone" ? "Zona" : "Servicio"}
                  </Badge>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Servicios corporativos</span>
                  <Badge variant="outline" className="text-xs">
                    {z.company_tariff_priority === "zone" ? "Zona" : "Empresa"}
                  </Badge>
                </div>
              </div>
              <div className="flex gap-3 bg-slate-50 rounded-xl p-2.5 mb-3">
                <div className="text-center flex-1">
                  <p className="text-xs text-slate-400">Servicios</p>
                  <p className="font-bold text-slate-800">{stats.count}</p>
                </div>
                <div className="text-center flex-1">
                  <p className="text-xs text-slate-400">Ingresos</p>
                  <p className="font-bold text-emerald-600">${stats.revenue.toFixed(0)}</p>
                </div>
              </div>
              <div className="flex gap-2 pt-3 border-t border-slate-100" onClick={e => e.stopPropagation()}>
                <Button variant="outline" size="sm" className="flex-1 rounded-lg" onClick={() => openEdit(z)}>
                  <Pencil className="w-3.5 h-3.5 mr-1.5" /> Editar
                </Button>
                <Button variant="ghost" size="sm" className="text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg" onClick={() => handleDelete(z)}>
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            </Card>
          );
        })}
      </div>

      {/* Create/Edit Dialog */}
      <Dialog open={showDialog} onOpenChange={v => { setShowDialog(v); if (!v) { setDrawing(false); setPolygon([]); } }}>
        <DialogContent className="dialog-size-3xl max-h-[90vh] overflow-y-auto p-4" style={{ width: '90vw', maxWidth: '1100px' }}>
          <DialogHeader>
            <DialogTitle>{editing?.id ? "Editar zona tarifaria" : "Nueva zona tarifaria"}</DialogTitle>
          </DialogHeader>
          {editing && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 py-2">
              {/* Form */}
              <div className="space-y-4">
                <div>
                  <Label>Nombre de la zona *</Label>
                  <Input value={editing.name} onChange={e => up("name", e.target.value)} placeholder="Ej. Centro Histórico" className="mt-1" />
                </div>
                <div>
                  <Label>Tipo de tarifa</Label>
                  <Select value={editing.tipo_tarifa} onValueChange={v => up("tipo_tarifa", v)}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="dinamica">Dinámica (base + km)</SelectItem>
                      <SelectItem value="fija">Fija (precio único)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {editing.tipo_tarifa === "fija" ? (
                  <div>
                    <Label>Tarifa fija ($)</Label>
                    <Input type="number" value={editing.tarifa_fija} onChange={e => up("tarifa_fija", e.target.value)} placeholder="0.00" className="mt-1" />
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>Tarifa base ($)</Label>
                      <Input type="number" value={editing.tarifa_base} onChange={e => up("tarifa_base", e.target.value)} placeholder="30" className="mt-1" />
                    </div>
                    <div>
                      <Label>Por kilómetro ($)</Label>
                      <Input type="number" value={editing.tarifa_por_km} onChange={e => up("tarifa_por_km", e.target.value)} placeholder="8" className="mt-1" />
                    </div>
                  </div>
                )}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Prioridad</Label>
                    <Input type="number" value={editing.prioridad} onChange={e => up("prioridad", e.target.value)} placeholder="1" className="mt-1" />
                  </div>
                  <div>
                    <Label>Color</Label>
                    <div className="flex gap-2 mt-1 flex-wrap">
                      {COLORS.map(c => (
                        <button key={c} onClick={() => up("color", c)}
                          className={`w-7 h-7 rounded-full border-2 transition-all ${editing.color === c ? "border-slate-900 scale-110" : "border-transparent"}`}
                          style={{ backgroundColor: c }} />
                      ))}
                    </div>
                  </div>
                </div>

                {/* Tariff Priority Settings */}
                <div className="bg-slate-50 rounded-xl p-4 space-y-4">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                    <h3 className="font-semibold text-slate-900 text-sm">Prioridades de Tarifa</h3>
                  </div>

                  <div>
                    <Label className="text-sm font-medium">Servicios normales</Label>
                    <p className="text-xs text-slate-500 mb-2">¿Qué tarifa tiene prioridad para viajes normales?</p>
                    <Select value={editing.service_tariff_priority} onValueChange={v => up("service_tariff_priority", v)}>
                      <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="zone">
                          <div>
                            <div className="font-medium">Tarifa de zona</div>
                            <div className="text-xs text-slate-500">Usa la tarifa configurada en esta zona</div>
                          </div>
                        </SelectItem>
                        <SelectItem value="service">
                          <div>
                            <div className="font-medium">Tarifa general del servicio</div>
                            <div className="text-xs text-slate-500">Usa la tarifa base del tipo de servicio</div>
                          </div>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label className="text-sm font-medium">Servicios corporativos</Label>
                    <p className="text-xs text-slate-500 mb-2">¿Qué tarifa tiene prioridad para viajes de empresas?</p>
                    <Select value={editing.company_tariff_priority} onValueChange={v => up("company_tariff_priority", v)}>
                      <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="zone">
                          <div>
                            <div className="font-medium">Tarifa de zona</div>
                            <div className="text-xs text-slate-500">Respeta la tarifa de esta zona</div>
                          </div>
                        </SelectItem>
                        <SelectItem value="company">
                          <div>
                            <div className="font-medium">Tarifa negociada de empresa</div>
                            <div className="text-xs text-slate-500">Respeta la tarifa especial de la empresa</div>
                          </div>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <Switch checked={editing.is_active} onCheckedChange={v => up("is_active", v)} />
                  <Label>Zona activa</Label>
                </div>

                {/* Drawing instructions */}
                <div className="bg-blue-50 rounded-xl p-3">
                  <p className="text-xs font-semibold text-blue-700 mb-1">📍 Cómo dibujar la zona:</p>
                  <ol className="text-xs text-blue-600 space-y-0.5 list-decimal list-inside">
                    <li>Activa el modo dibujo con el botón de abajo</li>
                    <li>Haz clic en el mapa para agregar puntos del polígono</li>
                    <li>Mínimo 3 puntos para formar la zona</li>
                    <li>Usa "Limpiar" para empezar de nuevo</li>
                  </ol>
                </div>

                <div className="flex gap-2">
                  <Button
                    type="button"
                    onClick={() => setDrawing(v => !v)}
                    className={`flex-1 rounded-xl ${drawing ? "bg-emerald-600 hover:bg-emerald-700" : "bg-slate-700 hover:bg-slate-800"}`}
                  >
                    {drawing ? <><Check className="w-4 h-4 mr-1.5" /> Dibujando ({polygon.length} pts)</> : <><Map className="w-4 h-4 mr-1.5" /> Activar dibujo</>}
                  </Button>
                  <Button type="button" variant="outline" onClick={() => setPolygon([])} className="rounded-xl">
                    <X className="w-4 h-4 mr-1" /> Limpiar
                  </Button>
                </div>
                {polygon.length > 0 && (
                  <p className="text-xs text-slate-500">{polygon.length} puntos definidos {polygon.length < 3 && <span className="text-amber-500">(mínimo 3)</span>}</p>
                )}
              </div>

              {/* Map */}
              <div className="rounded-xl overflow-hidden border border-slate-200 h-96 lg:h-auto" style={{ minHeight: 360, position: 'relative', zIndex: 0, isolation: 'isolate' }}>
                <MapContainer center={polygon.length > 0 ? polygon[0] : [19.4326, -99.1332]} zoom={12} className="h-full w-full" style={{ height: "100%", minHeight: 360, zIndex: 0 }}>
                  <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                  <PolygonDrawer drawing={drawing} onPointAdd={handlePointAdd} polygon={polygon} />
                </MapContainer>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving || polygon.length < 3}>
              {saving ? "Guardando..." : "Guardar zona"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export const dynamic = "force-dynamic";

export default function GeoZones() {
  return (
    <Layout currentPageName="GeoZones">
      <GeoZonesContent />
    </Layout>
  );
}
