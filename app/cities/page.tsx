"use client";
export const dynamic = 'force-dynamic';

import React, { useState } from "react";
import Layout from "@/components/admin/Layout";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabaseApi } from "@/lib/supabaseApi";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Plus, MapPin, Pencil, Trash2, Globe, AlertCircle, Map, Layers } from "lucide-react";
import { toast } from "sonner";
import AdminMapPicker from "@/components/admin/AdminMapPicker";

const empty = { name: "", state: "", country: "México", is_active: true, center_lat: "", center_lon: "", geofence_radius_km: 50 };

export default function CitiesPage() {
  const [editCity, setEditCity] = useState<any>(null);
  const [showDialog, setShowDialog] = useState(false);
  const [showMapPicker, setShowMapPicker] = useState(false);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [filterActive, setFilterActive] = useState<boolean | null>(null);
  const queryClient = useQueryClient();

  const { data: cities = [] } = useQuery({
    queryKey: ["cities"],
    queryFn: () => supabaseApi.cities.list(),
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });

  const { data: drivers = [] } = useQuery({
    queryKey: ["drivers"],
    queryFn: () => supabaseApi.drivers.list(),
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });

  const { data: geoZones = [] } = useQuery({
    queryKey: ["geoZones"],
    queryFn: () => supabaseApi.geoZones.list(),
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });

  const { data: redZones = [] } = useQuery({
    queryKey: ["redZones"],
    queryFn: () => supabaseApi.redZones.list(),
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });

  const getDriverCount = (cityId: string) => drivers.filter((d: any) => d.city_id === cityId).length;
  
  const getGeoZoneCount = (cityId: string) => geoZones.filter((z: any) => z.city_id === cityId).length;
  
  const getRedZoneCount = (cityId: string) => redZones.filter((z: any) => z.city_id === cityId).length;

  // CRÍTICO #1, #2, #4: Validación exhaustiva
  const validateCity = (city: any) => {
    if (!city.name?.trim()) return "El nombre de la ciudad es obligatorio";
    
    // Validar nombre único (CRÍTICO #4)
    const duplicateName = cities.some((c: any) => 
      c.id !== city.id && c.name.toLowerCase() === city.name.toLowerCase()
    );
    if (duplicateName) return "Ya existe una ciudad con este nombre";
    
    // Validar coordenadas (CRÍTICO #1)
    if (city.center_lat || city.center_lon) {
      const lat = parseFloat(city.center_lat);
      const lon = parseFloat(city.center_lon);
      
      if (isNaN(lat) || isNaN(lon)) return "Coordenadas inválidas";
      if (lat < -90 || lat > 90) return "Latitud debe estar entre -90 y 90";
      if (lon < -180 || lon > 180) return "Longitud debe estar entre -180 y 180";
    }
    
    // Validar radio geocerca (CRÍTICO #2)
    if (city.geofence_radius_km) {
      const radius = parseFloat(city.geofence_radius_km);
      if (radius <= 0) return "Radio geocerca debe ser positivo";
      if (radius > 500) return "Radio geocerca no puede exceder 500 km";
    }
    
    return null;
  };

  const handleSave = async () => {
    const error = validateCity(editCity);
    if (error) {
      toast.error(error);
      return;
    }

    setSaving(true);
    try {
      const data = {
        ...editCity,
        center_lat: editCity.center_lat ? parseFloat(editCity.center_lat) : undefined,
        center_lon: editCity.center_lon ? parseFloat(editCity.center_lon) : undefined,
        geofence_radius_km: editCity.geofence_radius_km ? parseFloat(editCity.geofence_radius_km) : 50,
      };
      
      console.log("[Cities] Guardando ciudad:", data);
      
      if (editCity.id) {
        await supabaseApi.cities.update(editCity.id, data);
        toast.success("✅ Ciudad actualizada");
      } else {
        await supabaseApi.cities.create(data);
        toast.success("✅ Ciudad creada");
      }
      queryClient.invalidateQueries({ queryKey: ["cities"] });
      setShowDialog(false);
      setEditCity(null);
    } catch (error: any) {
      console.error("[Cities] Error al guardar:", error);
      toast.error(error.message || "Error al guardar ciudad");
    } finally {
      setSaving(false);
    }
  };

  // CRÍTICO #3: Protección de eliminación
  const handleDelete = async (city: any) => {
    const driverCount = getDriverCount(city.id);
    const geoZoneCount = getGeoZoneCount(city.id);
    const redZoneCount = getRedZoneCount(city.id);
    
    const hasDependencies = driverCount > 0 || geoZoneCount > 0 || redZoneCount > 0;
    
    if (hasDependencies) {
      const deps = [];
      if (driverCount > 0) deps.push(`${driverCount} conductor(es)`);
      if (geoZoneCount > 0) deps.push(`${geoZoneCount} zona(s) tarifaria(s)`);
      if (redZoneCount > 0) deps.push(`${redZoneCount} zona(s) roja(s)`);
      
      toast.error(`No se puede eliminar "${city.name}" porque tiene:\n• ${deps.join("\n• ")}`);
      return;
    }

    if (!window.confirm(`¿Eliminar ciudad "${city.name}"?`)) return;

    try {
      await supabaseApi.cities.delete(city.id);
      queryClient.invalidateQueries({ queryKey: ["cities"] });
      toast.success("Ciudad eliminada");
    } catch (error: any) {
      toast.error("Error al eliminar ciudad");
      console.error(error);
    }
  };

  const handleToggle = async (city: any) => {
    try {
      await supabaseApi.cities.update(city.id, { is_active: !city.is_active });
      queryClient.invalidateQueries({ queryKey: ["cities"] });
    } catch (error) {
      toast.error("Error al actualizar ciudad");
      console.error(error);
    }
  };

  // CRÍTICO #6: Búsqueda y filtros
  const filteredCities = cities.filter((city: any) => {
    const matchesSearch = !search || 
      city.name?.toLowerCase().includes(search.toLowerCase()) ||
      city.state?.toLowerCase().includes(search.toLowerCase()) ||
      city.country?.toLowerCase().includes(search.toLowerCase());
    
    const matchesActive = filterActive === null || city.is_active === filterActive;
    
    return matchesSearch && matchesActive;
  });

  const handleMapConfirm = (address: string, lat: number, lon: number) => {
    setEditCity((p: any) => ({
      ...p,
      center_lat: lat,
      center_lon: lon,
    }));
    setShowMapPicker(false);
  };

  return (
    <Layout currentPageName="Cities">
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Ciudades</h1>
            <p className="text-sm text-slate-400 mt-0.5">
              {filteredCities.length} de {cities.length} ciudades
            </p>
          </div>
          <Button onClick={() => { setEditCity({ ...empty }); setShowDialog(true); }} className="bg-slate-900 hover:bg-slate-800 rounded-xl">
            <Plus className="w-4 h-4 mr-2" /> Nueva ciudad
          </Button>
        </div>

        {/* CRÍTICO #6: Búsqueda y filtros */}
        <div className="flex flex-col sm:flex-row gap-3">
          <Input
            placeholder="Buscar por nombre, estado o país..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="flex-1"
          />
          <select
            value={filterActive === null ? "todos" : filterActive ? "activas" : "inactivas"}
            onChange={e => setFilterActive(e.target.value === "todos" ? null : e.target.value === "activas")}
            className="px-3 py-2 border border-slate-200 rounded-lg bg-white text-sm"
          >
            <option value="todos">Todas</option>
            <option value="activas">Activas</option>
            <option value="inactivas">Inactivas</option>
          </select>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredCities.map((city: any) => {
            const driverCount = getDriverCount(city.id);
            const geoZoneCount = getGeoZoneCount(city.id);
            const redZoneCount = getRedZoneCount(city.id);
            
            return (
              <Card key={city.id} className="p-5 border-0 shadow-sm hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center">
                      <MapPin className="w-5 h-5 text-blue-600" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-slate-900">{city.name}</h3>
                      <p className="text-xs text-slate-400">{city.state && `${city.state}, `}{city.country}</p>
                    </div>
                  </div>
                  <Switch checked={!!city.is_active} onCheckedChange={() => handleToggle(city)} />
                </div>
                
                {/* CRÍTICO #7: Indicador de dependencias */}
                <div className="space-y-2 mb-3">
                  <div className="flex items-center gap-2 text-xs">
                    <Globe className="w-3.5 h-3.5 text-slate-400" />
                    <span className="text-slate-600">{driverCount} conductor(es)</span>
                  </div>
                  {geoZoneCount > 0 && (
                    <div className="flex items-center gap-2 text-xs">
                      <Layers className="w-3.5 h-3.5 text-amber-500" />
                      <span className="text-slate-600">{geoZoneCount} zona(s) tarifaria(s)</span>
                    </div>
                  )}
                  {redZoneCount > 0 && (
                    <div className="flex items-center gap-2 text-xs">
                      <AlertCircle className="w-3.5 h-3.5 text-red-500" />
                      <span className="text-slate-600">{redZoneCount} zona(s) roja(s)</span>
                    </div>
                  )}
                </div>
                
                {city.center_lat && (
                  <div className="text-xs text-slate-400 mb-3 flex items-center gap-1">
                    <Map className="w-3.5 h-3.5" />
                    {parseFloat(city.center_lat).toFixed(4)}, {parseFloat(city.center_lon).toFixed(4)}
                    {city.geofence_radius_km && ` · ${city.geofence_radius_km}km`}
                  </div>
                )}
                
                <div className="flex gap-2 pt-3 border-t border-slate-100">
                  <Button variant="outline" size="sm" className="flex-1 text-xs rounded-lg" onClick={() => { setEditCity(city); setShowDialog(true); }}>
                    <Pencil className="w-3.5 h-3.5 mr-1" /> Editar
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-8 w-8 text-red-500 hover:text-red-600 hover:bg-red-50"
                    onClick={() => handleDelete(city)}
                    disabled={driverCount > 0 || geoZoneCount > 0 || redZoneCount > 0}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </Card>
            );
          })}
          
          {filteredCities.length === 0 && (
            <div className="col-span-3 text-center py-16 text-slate-400">
              <MapPin className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p>{search ? "No hay ciudades que coincidan" : "No hay ciudades registradas aún"}</p>
            </div>
          )}
        </div>

        {/* Dialog de edición */}
        <Dialog open={showDialog} onOpenChange={v => { setShowDialog(v); if (!v) setEditCity(null); }}>
          <DialogContent className="dialog-size-lg max-h-[90vh] overflow-y-auto p-4">
            <DialogHeader>
              <DialogTitle>{editCity?.id ? "Editar ciudad" : "Nueva ciudad"}</DialogTitle>
              <DialogDescription style={{ display: 'none' }}>Formulario para editar o crear ciudad</DialogDescription>
            </DialogHeader>
            {editCity && (
              <div className="space-y-4 py-2">
                {/* Nombre (CRÍTICO #4) */}
                <div>
                  <Label>Nombre de la ciudad *</Label>
                  <Input 
                    value={editCity.name} 
                    onChange={e => setEditCity((p: any) => ({ ...p, name: e.target.value }))}
                    placeholder="Ej. Ciudad de México"
                  />
                </div>
                
                {/* Estado/País */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Estado / Provincia</Label>
                    <Input 
                      value={editCity.state || ""} 
                      onChange={e => setEditCity((p: any) => ({ ...p, state: e.target.value }))}
                      placeholder="Ej. CDMX"
                    />
                  </div>
                  <div>
                    <Label>País</Label>
                    <Input 
                      value={editCity.country || ""} 
                      onChange={e => setEditCity((p: any) => ({ ...p, country: e.target.value }))}
                      placeholder="México"
                    />
                  </div>
                </div>
                
                {/* CRÍTICO #1, #5: Mapa interactivo para coordenadas */}
                <div>
                  <Label>Ubicación central *</Label>
                  <div className="mt-2 p-4 bg-slate-50 rounded-lg border border-slate-200">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setShowMapPicker(true)}
                      className="w-full mb-2"
                    >
                      <Map className="w-4 h-4 mr-2" />
                      {editCity.center_lat ? "Cambiar ubicación" : "Seleccionar ubicación en mapa"}
                    </Button>
                    
                    {editCity.center_lat && (
                      <div className="text-xs text-slate-600">
                        <p>Latitud: {parseFloat(editCity.center_lat).toFixed(6)}</p>
                        <p>Longitud: {parseFloat(editCity.center_lon).toFixed(6)}</p>
                      </div>
                    )}
                    
                    {/* Fallback: entrada manual */}
                    <div className="grid grid-cols-2 gap-2 mt-2">
                      <div>
                        <Label className="text-xs">Lat</Label>
                        <Input 
                          type="number" 
                          placeholder="19.4326" 
                          step="0.0001"
                          value={editCity.center_lat || ""} 
                          onChange={e => setEditCity((p: any) => ({ ...p, center_lat: e.target.value }))}
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Lon</Label>
                        <Input 
                          type="number" 
                          placeholder="-99.1332" 
                          step="0.0001"
                          value={editCity.center_lon || ""} 
                          onChange={e => setEditCity((p: any) => ({ ...p, center_lon: e.target.value }))}
                        />
                      </div>
                    </div>
                  </div>
                </div>
                
                {/* CRÍTICO #2: Radio geocerca con validación */}
                <div>
                  <Label>Radio geocerca (km) *</Label>
                  <Input 
                    type="number" 
                    placeholder="50" 
                    min="0.1"
                    max="500"
                    step="0.1"
                    value={editCity.geofence_radius_km || ""} 
                    onChange={e => setEditCity((p: any) => ({ ...p, geofence_radius_km: e.target.value }))}
                  />
                  <p className="text-xs text-slate-500 mt-1">
                    Rango: 0.1 - 500 km. Define el área de operación alrededor de la ciudad.
                  </p>
                </div>
                
                {/* Toggle activa */}
                <div className="flex items-center gap-3">
                  <Switch 
                    checked={!!editCity.is_active} 
                    onCheckedChange={v => setEditCity((p: any) => ({ ...p, is_active: v }))} 
                  />
                  <Label>Ciudad activa</Label>
                </div>
              </div>
            )}
            
            <DialogFooter>
              <Button 
                variant="outline" 
                onClick={() => { setShowDialog(false); setEditCity(null); }}
              >
                Cancelar
              </Button>
              <Button 
                onClick={handleSave} 
                disabled={saving || !editCity?.name}
              >
                {saving ? "Guardando..." : "Guardar"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Map Picker Dialog */}
        <AdminMapPicker
          open={showMapPicker}
          onOpenChange={setShowMapPicker}
          lat={editCity?.center_lat ? parseFloat(editCity.center_lat) : undefined}
          lon={editCity?.center_lon ? parseFloat(editCity.center_lon) : undefined}
          label="Centro de ciudad"
          isDropoff={false}
          onConfirm={handleMapConfirm}
        />
      </div>
    </Layout>
  );
}
