"use client";

import React, { useState } from "react";
import { supabaseApi } from "@/lib/supabaseApi";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { motion, AnimatePresence } from "framer-motion";
import { HelpCircle, Plus, ChevronLeft, X } from "lucide-react";

const STATUS_MAP = {
  open: { label: "Abierto", color: "bg-amber-100 text-amber-700" },
  in_review: { label: "En revisión", color: "bg-blue-100 text-blue-700" },
  resolved: { label: "Resuelto", color: "bg-emerald-100 text-emerald-700" },
  closed: { label: "Cerrado", color: "bg-slate-100 text-slate-500" },
};

const CATEGORIES = [
  { value: "pago", label: "Pago" },
  { value: "viaje", label: "Viaje" },
  { value: "vehiculo", label: "Vehículo" },
  { value: "app", label: "App" },
  { value: "otro", label: "Otro" },
];

/**
 * TicketsPanel — shared between driver and passenger views.
 */
export default function TicketsPanel({
  role, driverId, passengerUserId, passengerName, driverName, passengerPhone,
  rideContext, onClose, darkMode = true
}) {
  const [view, setView] = useState(rideContext ? "new" : "list");
  const [form, setForm] = useState({
    subject: rideContext?.service_id ? `Problema con servicio ${rideContext.service_id}` : "",
    description: "",
    category: "viaje",
    ride_id: rideContext?.ride_id || "",
    service_id: rideContext?.service_id || "",
  });
  const [submitting, setSubmitting] = useState(false);
  const queryClient = useQueryClient();

  const filterKey = role === "driver" ? { driver_id: driverId } : { passenger_user_id: passengerUserId };

  const { data: tickets = [] } = useQuery({
    queryKey: ["tickets", role, driverId || passengerUserId],
    queryFn: () => supabaseApi.supportTickets.list(filterKey),
    enabled: !!(driverId || passengerUserId),
  });

  const { data: passengerRides = [] } = useQuery({
    queryKey: ["passengerRidesForTicket", passengerUserId, passengerPhone],
    queryFn: async () => {
      if (passengerPhone) {
        const all = await supabaseApi.rideRequests.list({ passenger_phone: passengerPhone });
        return all.filter(r => r.status === "completed").slice(0, 30);
      }
      return [];
    },
    enabled: role === "passenger" && !rideContext && !!(passengerUserId || passengerPhone),
  });

  const { data: driverRides = [] } = useQuery({
    queryKey: ["driverRidesForTicketPanel", driverId],
    queryFn: async () => {
      const all = await supabaseApi.rideRequests.list({ driver_id: driverId });
      return all.filter(r => r.status === "completed").slice(0, 30);
    },
    enabled: role === "driver" && !rideContext && !!driverId,
  });

  const ridesForSelector = role === "passenger" ? passengerRides : driverRides;

  const handleRideSelect = (rideId) => {
    if (!rideId || rideId === "_none") {
      setForm(f => ({ ...f, ride_id: "", service_id: "" }));
      return;
    }
    const ride = ridesForSelector.find(r => r.id === rideId);
    if (ride) {
      setForm(f => ({
        ...f,
        ride_id: ride.id,
        service_id: ride.service_id || "",
        subject: f.subject || `Problema con servicio${ride.service_id ? " " + ride.service_id : ""}`,
        category: "viaje",
      }));
    }
  };

  const handleSubmit = async () => {
    if (!form.subject || !form.description) return;
    setSubmitting(true);
    const ticketNum = `TKT-${Date.now().toString(36).toUpperCase()}`;
    await supabaseApi.supportTickets.create({
      ticket_number: ticketNum,
      subject: form.subject,
      description: form.description,
      category: form.category,
      status: "open",
      priority: "medium",
      submitted_by: role,
      ...(role === "driver" ? { driver_id: driverId, driver_name: driverName } : {}),
      ...(role === "passenger" ? { passenger_user_id: passengerUserId, passenger_name: passengerName, passenger_phone: passengerPhone || "" } : {}),
      ...(form.ride_id ? { ride_id: form.ride_id } : {}),
      ...(form.service_id ? { service_id: form.service_id } : {}),
    });
    queryClient.invalidateQueries({ queryKey: ["tickets", role, driverId || passengerUserId] });
    setSubmitting(false);
    setView("list");
    setForm({ subject: "", description: "", category: "viaje", ride_id: "", service_id: "" });
  };

  const bg = darkMode ? "bg-slate-900 text-white" : "bg-white text-slate-900";
  const card = darkMode ? "bg-white/5 border border-white/10" : "bg-slate-50 border border-slate-200";
  const inputCls = darkMode ? "bg-white/10 border-white/20 text-white placeholder:text-white/40 rounded-xl" : "rounded-xl";
  const labelCls = darkMode ? "text-white/60 text-xs font-medium" : "text-slate-600 text-xs font-medium";

  return (
    <motion.div
      initial={{ opacity: 0, y: 60 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 60 }}
      className={`fixed inset-0 z-50 flex flex-col ${bg}`}
      style={{ paddingTop: "max(20px, env(safe-area-inset-top))", paddingBottom: "max(16px, env(safe-area-inset-bottom))" }}
    >
      <div className="flex items-center gap-3 px-4 pb-3 border-b border-white/10 flex-shrink-0">
        <button onClick={onClose} className={`w-9 h-9 rounded-xl flex items-center justify-center ${darkMode ? "bg-white/10 text-white/60" : "bg-slate-100 text-slate-500"}`}>
          <X className="w-4 h-4" />
        </button>
        <div className="flex items-center gap-2">
          <HelpCircle className={`w-5 h-5 ${darkMode ? "text-blue-400" : "text-blue-600"}`} />
          <h2 className={`font-bold text-lg ${darkMode ? "text-white" : "text-slate-900"}`}>Ayuda y soporte</h2>
        </div>
        {view === "list" && (
          <button onClick={() => setView("new")} className="ml-auto flex items-center gap-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold px-3 py-2 rounded-xl">
            <Plus className="w-3.5 h-3.5" /> Nuevo ticket
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4">
        <AnimatePresence mode="wait">
          {view === "list" && (
            <motion.div key="list" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-3">
              {tickets.length === 0 && (
                <div className="text-center py-16">
                  <HelpCircle className={`w-12 h-12 mx-auto mb-3 ${darkMode ? "text-white/20" : "text-slate-300"}`} />
                  <p className={`text-sm ${darkMode ? "text-white/40" : "text-slate-400"}`}>No tienes tickets de soporte aún</p>
                  <button onClick={() => setView("new")} className="mt-4 text-blue-400 text-sm underline">
                    Crear mi primer ticket
                  </button>
                </div>
              )}
              {tickets.map(t => {
                const st = STATUS_MAP[t.status] || STATUS_MAP.open;
                return (
                  <div key={t.id} className={`rounded-2xl p-4 ${card}`}>
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div>
                        <p className={`font-semibold text-sm ${darkMode ? "text-white" : "text-slate-900"}`}>{t.subject}</p>
                        <p className={`text-[10px] font-mono mt-0.5 ${darkMode ? "text-white/30" : "text-slate-400"}`}>{t.ticket_number}</p>
                        {t.service_id && <p className={`text-[10px] ${darkMode ? "text-white/30" : "text-slate-400"}`}>Servicio: {t.service_id}</p>}
                      </div>
                      <span className={`text-[10px] px-2 py-1 rounded-full font-semibold flex-shrink-0 ${st.color}`}>{st.label}</span>
                    </div>
                    <p className={`text-xs leading-relaxed ${darkMode ? "text-white/50" : "text-slate-500"}`}>{t.description}</p>
                    {t.admin_response && (
                      <div className={`mt-3 rounded-xl p-3 ${darkMode ? "bg-emerald-500/10 border border-emerald-500/20" : "bg-emerald-50 border border-emerald-200"}`}>
                        <p className={`text-xs font-semibold mb-1 ${darkMode ? "text-emerald-400" : "text-emerald-700"}`}>Respuesta del equipo:</p>
                        <p className={`text-xs ${darkMode ? "text-emerald-300/80" : "text-emerald-800"}`}>{t.admin_response}</p>
                      </div>
                    )}
                  </div>
                );
              })}
            </motion.div>
          )}

          {view === "new" && (
            <motion.div key="new" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }} className="space-y-4">
              <button onClick={() => setView("list")} className={`flex items-center gap-1.5 text-sm ${darkMode ? "text-white/60 hover:text-white" : "text-slate-500 hover:text-slate-800"}`}>
                <ChevronLeft className="w-4 h-4" /> Volver
              </button>
              <h3 className={`font-bold text-base ${darkMode ? "text-white" : "text-slate-900"}`}>Nuevo ticket de soporte</h3>

              {rideContext ? (
                <div className={`rounded-xl p-3 ${darkMode ? "bg-blue-500/10 border border-blue-500/20" : "bg-blue-50 border border-blue-200"}`}>
                  <p className={`text-xs ${darkMode ? "text-blue-300" : "text-blue-700"}`}>
                    Relacionado con: <strong>{rideContext.service_id || rideContext.ride_id}</strong>
                  </p>
                </div>
              ) : ridesForSelector.length > 0 ? (
                <div>
                  <label className={labelCls}>Viaje relacionado (opcional)</label>
                  <Select value={form.ride_id || "_none"} onValueChange={handleRideSelect}>
                    <SelectTrigger className={`mt-1 ${inputCls}`}>
                      <SelectValue placeholder="Sin viaje específico" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="_none">Sin viaje específico</SelectItem>
                      {ridesForSelector.map(r => (
                        <SelectItem key={r.id} value={r.id}>
                          {r.service_id ? `#${r.service_id} · ` : ""}{r.passenger_name || r.pickup_address?.slice(0, 30)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : null}

              <div>
                <label className={labelCls}>Categoría</label>
                <Select value={form.category} onValueChange={v => setForm(f => ({ ...f, category: v }))}>
                  <SelectTrigger className={`mt-1 ${inputCls}`}><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className={labelCls}>Asunto *</label>
                <Input value={form.subject} onChange={e => setForm(f => ({ ...f, subject: e.target.value }))} placeholder="Describe brevemente el problema" className={`mt-1 ${inputCls}`} />
              </div>
              <div>
                <label className={labelCls}>Descripción detallada *</label>
                <Textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={4} placeholder="Explica con detalle qué sucedió..." className={`mt-1 ${inputCls} resize-none`} />
              </div>
              <Button onClick={handleSubmit} disabled={!form.subject || !form.description || submitting} className="w-full bg-blue-600 hover:bg-blue-500 rounded-2xl h-12 font-bold">
                {submitting ? "Enviando..." : "Enviar ticket"}
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
