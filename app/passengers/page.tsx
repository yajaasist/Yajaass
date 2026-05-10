"use client";

import React, { useState } from "react";
import { supabaseApi } from "@/lib/supabaseApi";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import Layout from "@/components/admin/Layout";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Users, Search, Phone, Mail, Calendar, CheckCircle, XCircle, UserPlus, Download, Pencil, Star, ChevronLeft } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { es } from "date-fns/locale";

const EMPTY_FORM = { full_name: "", email: "", phone: "", password: "" };

// ─── Passenger Profile Modal ───────────────────────────────────────────────────
function PassengerProfileModal({ passenger, onClose }) {
  const [tab, setTab] = useState("services");
  const [dateFilter, setDateFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [ratingFilter, setRatingFilter] = useState("all");

  const { data: rides = [] } = useQuery({
    queryKey: ["passengerRides", passenger.id],
    queryFn: async () => {
      const all = await supabaseApi.rideRequests.list();
      return all.filter(r => r.passenger_user_id === passenger.id);
    },
    staleTime: 30 * 1000,
    gcTime: 10 * 60 * 1000,
  });

  const now = new Date();
  const filteredRides = rides.filter(r => {
    const rDate = new Date(r.requested_at);
    if (dateFilter === "7d" && (now.getTime() - rDate.getTime()) > 7 * 86400000) return false;
    if (dateFilter === "30d" && (now.getTime() - rDate.getTime()) > 30 * 86400000) return false;
    if (dateFilter === "90d" && (now.getTime() - rDate.getTime()) > 90 * 86400000) return false;
    if (statusFilter !== "all" && r.status !== statusFilter) return false;
    return true;
  });

  const completedRides = filteredRides.filter(r => r.status === "completed");
  const totalSpent = completedRides.reduce((s, r) => s + (r.final_price || r.estimated_price || 0), 0);

  const ratedRides = rides.filter(r => r.driver_rating_for_passenger > 0 || r.passenger_rating_for_driver > 0);
  const filteredRatings = ratedRides.filter(r => {
    if (ratingFilter === "positive" && !((r.passenger_rating_for_driver || 0) >= 4)) return false;
    if (ratingFilter === "negative" && !((r.passenger_rating_for_driver || 0) < 3 && r.passenger_rating_for_driver > 0)) return false;
    return true;
  });

  const avgDriverRating = ratedRides.filter(r => r.driver_rating_for_passenger > 0).length > 0
    ? (ratedRides.filter(r => r.driver_rating_for_passenger > 0).reduce((s, r) => s + r.driver_rating_for_passenger, 0) / ratedRides.filter(r => r.driver_rating_for_passenger > 0).length).toFixed(1)
    : "—";

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col">
        <div className="flex items-center gap-3 p-5 border-b">
          <button onClick={onClose} className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center hover:bg-slate-200">
            <ChevronLeft className="w-5 h-5 text-slate-600" />
          </button>
          <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold">
            {(passenger.full_name || "?").charAt(0).toUpperCase()}
          </div>
          <div className="flex-1">
            <h2 className="font-bold text-slate-900">{passenger.full_name}</h2>
            <p className="text-xs text-slate-400">{passenger.email} · {passenger.phone}</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right">
              <p className="text-xs text-slate-400">Wallet</p>
              <p className="font-bold text-slate-900">${(passenger.wallet_balance || 0).toFixed(2)}</p>
            </div>
            <Badge className={passenger.is_active !== false ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"}>
              {passenger.is_active !== false ? "Activo" : "Inactivo"}
            </Badge>
          </div>
        </div>

        <div className="grid grid-cols-4 divide-x border-b">
          <div className="p-4 text-center">
            <p className="text-2xl font-bold text-slate-900">{rides.length}</p>
            <p className="text-xs text-slate-400">Total servicios</p>
          </div>
          <div className="p-4 text-center">
            <p className="text-2xl font-bold text-emerald-700">{completedRides.length}</p>
            <p className="text-xs text-slate-400">Completados</p>
          </div>
          <div className="p-4 text-center">
            <p className="text-2xl font-bold text-slate-900">${totalSpent.toFixed(0)}</p>
            <p className="text-xs text-slate-400">Total gastado</p>
          </div>
          <div className="p-4 text-center">
            <p className="text-2xl font-bold text-amber-600">{avgDriverRating}</p>
            <p className="text-xs text-slate-400">Calif. promedio</p>
          </div>
        </div>

        <Tabs value={tab} onValueChange={setTab} className="flex-1 flex flex-col overflow-hidden">
          <TabsList className="bg-slate-50 rounded-none border-b px-4 pt-2 justify-start gap-1 h-auto">
            <TabsTrigger value="services" className="rounded-lg text-xs px-3 py-1.5">🚗 Servicios</TabsTrigger>
            <TabsTrigger value="ratings" className="rounded-lg text-xs px-3 py-1.5">⭐ Calificaciones</TabsTrigger>
          </TabsList>

          <TabsContent value="services" className="flex-1 overflow-hidden flex flex-col m-0">
            <div className="flex gap-2 p-4 border-b">
              <Select value={dateFilter} onValueChange={setDateFilter}>
                <SelectTrigger className="w-36 rounded-xl text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todo el tiempo</SelectItem>
                  <SelectItem value="7d">Últimos 7 días</SelectItem>
                  <SelectItem value="30d">Últimos 30 días</SelectItem>
                  <SelectItem value="90d">Últimos 90 días</SelectItem>
                </SelectContent>
              </Select>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-36 rounded-xl text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los estados</SelectItem>
                  <SelectItem value="completed">Completados</SelectItem>
                  <SelectItem value="cancelled">Cancelados</SelectItem>
                  <SelectItem value="in_progress">En progreso</SelectItem>
                </SelectContent>
              </Select>
              <span className="text-xs text-slate-400 self-center ml-auto">{filteredRides.length} servicios</span>
            </div>
            <div className="overflow-y-auto flex-1 p-4 space-y-2">
              {filteredRides.length === 0 && <p className="text-center text-slate-400 text-sm py-8">Sin servicios que mostrar</p>}
              {filteredRides.map(r => (
                <div key={r.id} className="border border-slate-100 rounded-xl p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs text-slate-400">#{r.service_id || r.id?.slice(-6)}</span>
                        <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${
                          r.status === "completed" ? "bg-green-100 text-green-700" :
                          r.status === "cancelled" ? "bg-red-100 text-red-600" :
                          "bg-blue-100 text-blue-700"
                        }`}>{r.status === "completed" ? "Completado" : r.status === "cancelled" ? "Cancelado" : r.status}</span>
                      </div>
                      <p className="text-sm text-slate-700 mt-1 truncate">📍 {r.pickup_address}</p>
                      {r.dropoff_address && <p className="text-xs text-slate-400 truncate">→ {r.dropoff_address}</p>}
                      <p className="text-xs text-slate-400 mt-1">{r.requested_at ? format(new Date(r.requested_at), "d MMM yyyy HH:mm", { locale: es }) : ""}</p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="font-bold text-slate-900">${(r.final_price || r.estimated_price || 0).toFixed(2)}</p>
                      <p className="text-xs text-slate-400 capitalize">{r.payment_method || "—"}</p>
                      {r.passenger_rating_for_driver > 0 && (
                        <div className="flex items-center gap-0.5 justify-end mt-1">
                          <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                          <span className="text-xs text-amber-600">{r.passenger_rating_for_driver}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="ratings" className="flex-1 overflow-hidden flex flex-col m-0">
            <div className="flex gap-2 p-4 border-b">
              <Select value={ratingFilter} onValueChange={setRatingFilter}>
                <SelectTrigger className="w-44 rounded-xl text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas las calificaciones</SelectItem>
                  <SelectItem value="positive">Positivas (4-5 ⭐)</SelectItem>
                  <SelectItem value="negative">Negativas (1-2 ⭐)</SelectItem>
                </SelectContent>
              </Select>
              <span className="text-xs text-slate-400 self-center ml-auto">{filteredRatings.length} calificaciones</span>
            </div>
            <div className="overflow-y-auto flex-1 p-4 space-y-3">
              {filteredRatings.length === 0 && <p className="text-center text-slate-400 text-sm py-8">Sin calificaciones registradas</p>}
              {filteredRatings.map(r => (
                <div key={r.id} className="border border-slate-100 rounded-xl p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs text-slate-400">#{r.service_id || r.id?.slice(-6)}</span>
                    <span className="text-xs text-slate-400">{r.requested_at ? format(new Date(r.requested_at), "d MMM yyyy", { locale: es }) : ""}</span>
                  </div>
                  {r.passenger_rating_for_driver > 0 && (
                    <div className="bg-amber-50 rounded-lg p-3">
                      <p className="text-xs text-amber-700 font-medium mb-1">Pasajero calificó al conductor</p>
                      <div className="flex items-center gap-1">
                        {[1,2,3,4,5].map(n => <Star key={n} className={`w-4 h-4 ${n <= r.passenger_rating_for_driver ? "fill-amber-400 text-amber-400" : "text-slate-200"}`} />)}
                        <span className="text-sm font-bold text-amber-700 ml-1">{r.passenger_rating_for_driver}/5</span>
                      </div>
                      {r.passenger_rating_comment && <p className="text-xs text-amber-600 mt-1 italic">"{r.passenger_rating_comment}"</p>}
                    </div>
                  )}
                  {r.driver_rating_for_passenger > 0 && (
                    <div className="bg-blue-50 rounded-lg p-3">
                      <p className="text-xs text-blue-700 font-medium mb-1">Conductor calificó al pasajero</p>
                      <div className="flex items-center gap-1">
                        {[1,2,3,4,5].map(n => <Star key={n} className={`w-4 h-4 ${n <= r.driver_rating_for_passenger ? "fill-blue-400 text-blue-400" : "text-slate-200"}`} />)}
                        <span className="text-sm font-bold text-blue-700 ml-1">{r.driver_rating_for_passenger}/5</span>
                      </div>
                      {r.driver_rating_comment && <p className="text-xs text-blue-600 mt-1 italic">"{r.driver_rating_comment}"</p>}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

function PassengersContent() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [editPassenger, setEditPassenger] = useState(null);
  const [profilePassenger, setProfilePassenger] = useState(null);
  const [editForm, setEditForm] = useState(EMPTY_FORM);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const openEdit = (p) => {
    setEditPassenger(p);
    setEditForm({ full_name: p.full_name || "", email: p.email || "", phone: p.phone || "", password: "" });
  };

  const handleEdit = async () => {
    if (!editForm.full_name || !editForm.email) { toast.error("Nombre y correo son obligatorios"); return; }
    setSaving(true);
    const updates: any = { full_name: editForm.full_name.trim(), email: editForm.email.trim().toLowerCase(), phone: editForm.phone.trim() };
    if (editForm.password) updates.password = editForm.password;
    await supabaseApi.passengers.update(editPassenger.id, updates);
    toast.success("Usuario actualizado");
    setSaving(false);
    setEditPassenger(null);
    queryClient.invalidateQueries({ queryKey: ["passengers"] });
  };

  const toggleBlock = async (p) => {
    const newActive = p.is_active === false ? true : false;
    await supabaseApi.passengers.update(p.id, { is_active: newActive });
    toast.success(newActive ? "Usuario desbloqueado" : "Usuario bloqueado");
    queryClient.invalidateQueries({ queryKey: ["passengers"] });
  };

  const handleCreate = async () => {
    if (!form.full_name || !form.phone || !form.email) { toast.error("Nombre, teléfono y correo son obligatorios"); return; }
    setSaving(true);
    const emailLow = form.email.trim().toLowerCase();
    const existingP = await supabaseApi.passengers.list();
    if (existingP.some(p => p.email === emailLow)) { toast.error("Ya existe un cliente con ese correo"); setSaving(false); return; }
    const existingD = await supabaseApi.drivers.list();
    if (existingD.some(d => d.email === emailLow)) { toast.error("Ese correo ya está registrado como conductor"); setSaving(false); return; }
    await supabaseApi.passengers.create({ full_name: form.full_name.trim(), email: emailLow, phone: form.phone.trim(), password: form.password, is_active: true });
    toast.success("Usuario creado correctamente");
    setSaving(false);
    setShowAdd(false);
    setForm(EMPTY_FORM);
    queryClient.invalidateQueries({ queryKey: ["passengers"] });
  };

  const { data: passengers = [], isLoading } = useQuery({
    queryKey: ["passengers"],
    queryFn: () => supabaseApi.passengers.list(),
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });

  const filtered = passengers.filter(p => {
    const q = search.toLowerCase();
    return (
      p.full_name?.toLowerCase().includes(q) ||
      p.email?.toLowerCase().includes(q) ||
      p.phone?.toLowerCase().includes(q) ||
      p.vehicle_plate?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6 max-w-6xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Clientes / Pasajeros</h1>
          <p className="text-sm text-slate-400 mt-0.5">Usuarios registrados en la app de asistencia vial</p>
        </div>
        <div className="flex items-center gap-3">
          <Badge className="bg-blue-100 text-blue-700 text-sm px-3 py-1">
            {passengers.length} registrados
          </Badge>
            <Button variant="outline" onClick={() => {
            const csv = ["Nombre,Email,Teléfono,Estado,Fecha registro",
              ...passengers.map(p => [p.full_name,p.email||"",p.phone||"",p.is_active!==false?"Activo":"Inactivo",p.created_at ? new Date(p.created_at).toLocaleDateString("es") : ""].join(","))
            ].join("\n");
            const blob = new Blob([csv], { type: "text/csv" });
            const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "pasajeros.csv"; a.click();
          }} className="gap-2">
            <Download className="w-4 h-4" /> Exportar
          </Button>
          <Button onClick={() => setShowAdd(true)} className="bg-blue-600 hover:bg-blue-700 gap-2">
            <UserPlus className="w-4 h-4" /> Agregar usuario
          </Button>
        </div>
      </div>

      <Dialog open={!!editPassenger} onOpenChange={open => { if (!open) setEditPassenger(null); }}>
        <DialogContent className="max-w-[26.4rem] sm:max-w-[46.2rem] max-h-[90vh] overflow-y-auto p-4">
          <DialogHeader><DialogTitle>Editar usuario</DialogTitle></DialogHeader>
          <div className="grid gap-3 py-2">
            {[
              { field: "full_name", label: "Nombre completo *", placeholder: "Juan Pérez", type: "text" },
              { field: "email", label: "Email *", placeholder: "juan@email.com", type: "email" },
              { field: "phone", label: "Teléfono", placeholder: "+52 55 1234 5678", type: "tel" },
              { field: "password", label: "Nueva contraseña (dejar vacío para no cambiar)", placeholder: "••••••••", type: "password" },
            ].map(({ field, label, placeholder, type }) => (
              <div key={field} className="grid gap-1">
                <Label>{label}</Label>
                <Input type={type} placeholder={placeholder} value={editForm[field]} onChange={e => setEditForm(f => ({ ...f, [field]: e.target.value }))} />
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditPassenger(null)}>Cancelar</Button>
            <Button onClick={handleEdit} disabled={saving} className="bg-blue-600 hover:bg-blue-700">
              {saving ? "Guardando..." : "Guardar cambios"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent className="max-w-[26.4rem] sm:max-w-[46.2rem] max-h-[90vh] overflow-y-auto p-4">
          <DialogHeader><DialogTitle>Nuevo usuario de app</DialogTitle></DialogHeader>
          <div className="grid gap-3 py-2">
            {[
              { field: "full_name", label: "Nombre completo *", placeholder: "Juan Pérez", type: "text" },
              { field: "email", label: "Email *", placeholder: "juan@email.com", type: "email" },
              { field: "phone", label: "Teléfono *", placeholder: "+52 55 1234 5678", type: "tel" },
              { field: "password", label: "Contraseña", placeholder: "••••••••", type: "password" },
            ].map(({ field, label, placeholder, type }) => (
              <div key={field} className="grid gap-1">
                <Label>{label}</Label>
                <Input type={type} placeholder={placeholder} value={form[field]} onChange={e => setForm(f => ({ ...f, [field]: e.target.value }))} />
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAdd(false)}>Cancelar</Button>
            <Button onClick={handleCreate} disabled={saving} className="bg-blue-600 hover:bg-blue-700">
              {saving ? "Guardando..." : "Crear usuario"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <Input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Buscar por nombre, email, teléfono o placa..."
          className="pl-9"
        />
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <Card className="p-12 text-center border-0 shadow-sm">
          <Users className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500 font-medium">No hay clientes registrados aún</p>
          <p className="text-slate-400 text-sm mt-1">Los usuarios que se registren en la app de pasajeros aparecerán aquí</p>
        </Card>
      ) : (
        <div className="grid gap-3">
          {filtered.map(p => (
            <Card key={p.id} className="p-4 border-0 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-4 flex-1 min-w-0">
                  <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold text-sm flex-shrink-0">
                    {(p.full_name || "?").charAt(0).toUpperCase()}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-slate-900">{p.full_name}</p>
                      <Badge className={p.is_active !== false ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"}>
                        {p.is_active !== false ? <><CheckCircle className="w-3 h-3 mr-1" />Activo</> : <><XCircle className="w-3 h-3 mr-1" />Inactivo</>}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-4 mt-1 flex-wrap">
                      {p.email && (
                        <span className="flex items-center gap-1 text-xs text-slate-500">
                          <Mail className="w-3 h-3" /> {p.email}
                        </span>
                      )}
                      {p.phone && (
                        <span className="flex items-center gap-1 text-xs text-slate-500">
                          <Phone className="w-3 h-3" /> {p.phone}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex flex-col items-end gap-2 flex-shrink-0">
                  <div className="flex items-center gap-2">
                    <Button size="sm" variant="outline" onClick={() => setProfilePassenger(p)} className="h-8 px-2 gap-1 text-xs text-blue-600 border-blue-200 hover:bg-blue-50">
                      <Star className="w-3 h-3" /> Ver perfil
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => openEdit(p)} className="h-8 px-2 gap-1 text-xs">
                      <Pencil className="w-3 h-3" /> Editar
                    </Button>
                    {p.created_at && (
                      <p className="text-[11px] text-slate-300 flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {format(new Date(p.created_at), "d MMM yyyy", { locale: es })}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {profilePassenger && (
        <PassengerProfileModal passenger={profilePassenger} onClose={() => setProfilePassenger(null)} />
      )}
    </div>
  );
}

export const dynamic = "force-dynamic";

export default function Passengers() {
  return (
    <Layout currentPageName="Passengers">
      <PassengersContent />
    </Layout>
  );
}
