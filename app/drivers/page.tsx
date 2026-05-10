"use client";
export const dynamic = 'force-dynamic';

import React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { supabaseApi } from "@/lib/supabaseApi";
import Layout from "@/components/admin/Layout";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import StatusBadge from "@/components/shared/StatusBadge";
import DriverDetailDialog from "@/components/admin/DriverDetailDialog";
import { Plus, Search, Star, Car, Phone, Copy, Check, CheckCircle, XCircle, MapPin, Briefcase, Download, TimerOff, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";

const approvalColors = {
  pending: "bg-amber-50 text-amber-700 border-amber-200",
  approved: "bg-emerald-50 text-emerald-700 border-emerald-200",
  rejected: "bg-red-50 text-red-700 border-red-200",
};
const approvalLabels = { pending: "Pendiente", approved: "Aprobado", rejected: "Rechazado" };

export default function DriversPage() {
  const [search, setSearch] = React.useState("");
  const [cityFilter, setCityFilter] = React.useState("all");
  const [approvalFilter, setApprovalFilter] = React.useState("all");
  const [selectedDriver, setSelectedDriver] = React.useState(null);
  const [showDetail, setShowDetail] = React.useState(false);
  const [copiedCode, setCopiedCode] = React.useState(null);
  const queryClient = useQueryClient();

  const { data: drivers = [] } = useQuery({
    queryKey: ["drivers"],
    queryFn: async () => {
      try {
        return await supabaseApi.drivers.list();
      } catch (error) {
        toast.error("Error al cargar conductores");
        return [];
      }
    },
    staleTime: 30 * 1000,
    gcTime: 10 * 60 * 1000,
  });

  React.useEffect(() => {
    if (selectedDriver && drivers.length > 0) {
      const fresh = drivers.find((d: any) => d.id === selectedDriver.id);
      if (fresh) setSelectedDriver(fresh);
    }
  }, [drivers, selectedDriver]);

  React.useEffect(() => {
    const channel = supabase.channel("drivers_panel").on(
      "postgres_changes",
      { event: "*", schema: "public", table: "Driver" },
      () => queryClient.invalidateQueries({ queryKey: ["drivers"] })
    ).subscribe();
    return () => { channel.unsubscribe(); };
  }, [queryClient]);

  const { data: cities = [] } = useQuery({
    queryKey: ["cities"],
    queryFn: async () => {
      try {
        return await supabaseApi.cities.list();
      } catch { return []; }
    },
    staleTime: 30 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
  });

  const { data: serviceTypes = [] } = useQuery({
    queryKey: ["serviceTypes"],
    queryFn: async () => {
      try {
        return await supabaseApi.serviceTypes.list();
      } catch { return []; }
    },
    staleTime: 30 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
  });

  const { data: rides = [] } = useQuery({
    queryKey: ["rides"],
    queryFn: async () => {
      try {
        return await supabaseApi.rideRequests.list();
      } catch { return []; }
    },
    staleTime: 30 * 1000,
    gcTime: 10 * 60 * 1000,
  });

  const { data: settingsList = [] } = useQuery({
    queryKey: ["appSettings"],
    queryFn: async () => {
      try {
        return await supabaseApi.settings.list();
      } catch { return []; }
    },
    staleTime: 60 * 60 * 1000,
    gcTime: 120 * 60 * 1000,
  });

  const settings = settingsList[0] || null;

  const handleApprove = async (driver: any) => {
    try {
      await supabaseApi.drivers.update(driver.id, { approval_status: "approved" });
      queryClient.invalidateQueries({ queryKey: ["drivers"] });
      toast.success(`${driver.full_name || "Conductor"} aprobado`);
    } catch (error) {
      toast.error("Error al aprobar conductor");
    }
  };

  const handleReject = async (driver: any) => {
    try {
      await supabaseApi.drivers.update(driver.id, { approval_status: "rejected" });
      queryClient.invalidateQueries({ queryKey: ["drivers"] });
      toast.error(`${driver.full_name || "Conductor"} rechazado`);
    } catch (error) {
      toast.error("Error al rechazar conductor");
    }
  };

  const handleDelete = async (driver: any) => {
    if (!window.confirm(`¿Eliminar a ${driver.full_name || "Conductor"}? Esta acción es irreversible.`)) return;
    try {
      await supabaseApi.drivers.delete(driver.id);
      queryClient.invalidateQueries({ queryKey: ["drivers"] });
      toast.success(`${driver.full_name || "Conductor"} eliminado`);
    } catch (error) {
      toast.error("Error al eliminar conductor");
    }
  };

  const handleNewDriver = () => {
    // Create a template driver object without saving to DB yet
    const newDriver = {
      id: undefined, // No ID yet - will be created on save
      full_name: "",
      email: "",
      phone: "",
      license_plate: "",
      vehicle_brand: "",
      vehicle_model: "",
      vehicle_year: "",
      vehicle_color: "",
      city_id: "",
      city_name: "",
      status: "offline",
      approval_status: "pending",
      total_rides: 0,
      rating: 5,
      service_type_ids: [],
      service_type_names: [],
      photo_url: "",
      vehicles: [],
      // This flag tells DriverDetailDialog this is a new driver
      _isNewDriver: true,
    };
    setSelectedDriver(newDriver);
    setShowDetail(true);
  };

  const copyShareLink = (driver: any) => {
    if (!driver.email) {
      toast.error("El conductor no tiene correo configurado");
      return;
    }
    const url = window.location.origin + `/driver-app?driverEmail=${encodeURIComponent(driver.email)}`;
    navigator.clipboard.writeText(url);
    setCopiedCode(driver.id);
    toast.success("Enlace copiado");
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const filtered = drivers.filter((d: any) => {
    const q = search.toLowerCase();
    const matchSearch = !search ||
      d.full_name?.toLowerCase().includes(q) ||
      d.license_plate?.toLowerCase().includes(q) ||
      d.email?.toLowerCase().includes(q);
    const matchCity = cityFilter === "all" || d.city_id === cityFilter;
    const matchApproval = approvalFilter === "all" || d.approval_status === approvalFilter;
    return matchSearch && matchCity && matchApproval;
  });

  return (
    <Layout currentPageName="Drivers">
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Conductores</h1>
            <p className="text-sm text-slate-400 mt-0.5">{drivers.length} registrados</p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => {
                const csv = ["Nombre,Email,Teléfono,Placa,Vehículo,Ciudad,Servicios,Estado,Calificación,Viajes totales",
                  ...drivers.map((d: any) => [
                    d.full_name,
                    d.email || "",
                    d.phone || "",
                    d.license_plate || "",
                    [d.vehicle_brand, d.vehicle_model, d.vehicle_year].filter(Boolean).join(" "),
                    d.city_name || "",
                    (d.service_type_names || []).join("|"),
                    d.status || "",
                    d.rating || 5,
                    d.total_rides || 0,
                  ].join(","))
                ].join("\n");
                const blob = new Blob([csv], { type: "text/csv" });
                const a = document.createElement("a");
                a.href = URL.createObjectURL(blob);
                a.download = "conductores.csv";
                a.click();
                toast.success("Archivo exportado");
              }}
              className="rounded-xl"
            >
              <Download className="w-4 h-4 mr-2" /> Exportar
            </Button>
            <Button onClick={handleNewDriver} className="bg-slate-900 hover:bg-slate-800 rounded-xl">
              <Plus className="w-4 h-4 mr-2" /> Nuevo conductor
            </Button>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              placeholder="Buscar por nombre, placa o correo..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10 rounded-xl"
            />
          </div>
          <Select value={cityFilter} onValueChange={setCityFilter}>
            <SelectTrigger className="w-48 rounded-xl">
              <MapPin className="w-4 h-4 mr-2 text-slate-400" />
              <SelectValue placeholder="Todas las ciudades" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas las ciudades</SelectItem>
              {cities.map((c: any) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={approvalFilter} onValueChange={setApprovalFilter}>
            <SelectTrigger className="w-48 rounded-xl">
              <CheckCircle className="w-4 h-4 mr-2 text-slate-400" />
              <SelectValue placeholder="Todos" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="pending">Pendientes</SelectItem>
              <SelectItem value="approved">Aprobados</SelectItem>
              <SelectItem value="rejected">Rechazados</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((driver: any) => (
            <Card key={driver.id} className="p-5 border-0 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-full bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center text-sm font-bold text-slate-600">
                    {driver.full_name?.charAt(0) || "D"}
                  </div>
                  <div>
                    <h3 className="font-semibold text-slate-900 text-sm">{driver.full_name || "Desconocido"}</h3>
                    <div className="flex items-center gap-1 mt-0.5">
                      <Star className="w-3 h-3 text-amber-400 fill-amber-400" />
                      <span className="text-xs text-slate-500">
                        {driver.rating || 5} · {driver.total_rides || 0} viajes
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <StatusBadge status={driver.status} label="" />
                  <Badge
                    variant="outline"
                    className={`text-xs ${approvalColors[driver.approval_status || "pending"]}`}
                  >
                    {approvalLabels[driver.approval_status || "pending"]}
                  </Badge>
                </div>
              </div>

              <div className="space-y-1.5 mb-3">
                <p className="text-xs text-slate-500 flex items-center gap-1.5">
                  <Car className="w-3.5 h-3.5" />
                  {driver.vehicle_brand || "Marca"} {driver.vehicle_model || "Modelo"} {driver.vehicle_year || ""} · {driver.license_plate || "S/P"}
                </p>
                {driver.phone && (
                  <p className="text-xs text-slate-500 flex items-center gap-1.5">
                    <Phone className="w-3.5 h-3.5" /> {driver.phone}
                  </p>
                )}
                {driver.city_name && (
                  <p className="text-xs text-slate-500 flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5" /> {driver.city_name}
                  </p>
                )}
                {driver.service_type_names?.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {driver.service_type_names.map((s: string) => (
                      <Badge key={s} variant="outline" className="text-xs py-0 px-1.5">
                        {s}
                      </Badge>
                    ))}
                  </div>
                )}
                <div className="flex items-center gap-2 flex-wrap pt-1">
                  <Badge className={`text-xs py-0.5 px-2 ${
                    (driver.acceptance_rate || 100) >= 80 ? "bg-emerald-100 text-emerald-800" :
                    (driver.acceptance_rate || 100) >= 60 ? "bg-amber-100 text-amber-800" :
                    "bg-red-100 text-red-800"
                  }`}>
                    ✓ {driver.acceptance_rate || 100}% aceptación
                  </Badge>
                  {settings?.soft_block_low_acceptance_rate_enabled && (driver.acceptance_rate || 100) < (settings?.low_acceptance_rate_threshold || 60) && (
                    <Badge className="text-xs py-0.5 px-2 bg-purple-100 text-purple-800">
                      🚫 Soft Block
                    </Badge>
                  )}
                </div>
              </div>

              {driver.suspended_until && new Date(driver.suspended_until) > new Date() && (
                <div className="flex items-center gap-2 bg-orange-50 border border-orange-200 rounded-lg px-3 py-2 mb-3">
                  <TimerOff className="w-3.5 h-3.5 text-orange-500 flex-shrink-0" />
                  <p className="text-xs text-orange-700 flex-1">Suspendido por cancelación</p>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 text-xs text-orange-700 hover:bg-orange-100 px-2"
                    onClick={async () => {
                      try {
                        const res = await fetch(`/api/drivers?id=${driver.id}`, {
                          method: 'PATCH',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({
                            suspended_until: null,
                            status: "available",
                          })
                        });
                        if (!res.ok) throw new Error('Failed to unsuspend');
                        queryClient.invalidateQueries({ queryKey: ["drivers"] });
                        toast.success("Suspensión eliminada");
                      } catch (error) {
                        toast.error("Error al eliminar suspensión");
                      }
                    }}
                  >
                    Quitar
                  </Button>
                </div>
              )}

              {driver.approval_status === "pending" && (
                <div className="flex gap-2 mb-3">
                  <Button
                    size="sm"
                    className="flex-1 h-8 text-xs bg-emerald-600 hover:bg-emerald-700 rounded-lg"
                    onClick={() => handleApprove(driver)}
                  >
                    <CheckCircle className="w-3 h-3 mr-1" /> Aprobar
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1 h-8 text-xs text-red-600 border-red-200 hover:bg-red-50 rounded-lg"
                    onClick={() => handleReject(driver)}
                  >
                    <XCircle className="w-3 h-3 mr-1" /> Rechazar
                  </Button>
                </div>
              )}

              <div className="flex items-center gap-2 pt-3 border-t border-slate-100">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1 text-xs rounded-lg"
                  onClick={() => {
                    setSelectedDriver(driver);
                    setShowDetail(true);
                  }}
                >
                  <Briefcase className="w-3.5 h-3.5 mr-1" /> Gestionar
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs rounded-lg"
                  onClick={() => copyShareLink(driver)}
                >
                  {copiedCode === driver.id ? (
                    <Check className="w-3.5 h-3.5" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs rounded-lg text-red-500 border-red-200 hover:bg-red-50"
                  onClick={() => handleDelete(driver)}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            </Card>
          ))}
        </div>

        <DriverDetailDialog
          driver={selectedDriver}
          open={showDetail}
          onOpenChange={(v) => {
            setShowDetail(v);
            if (!v) setSelectedDriver(null);
          }}
          cities={cities}
          serviceTypes={serviceTypes.filter((s: any) => s.is_active)}
          rides={rides}
        />
      </div>
    </Layout>
  );
}
