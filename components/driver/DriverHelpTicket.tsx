import React, { useState } from "react";
import { supabaseApi } from "@/lib/supabaseApi";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { motion } from "framer-motion";
import { HelpCircle, Plus, MessageSquare, ChevronLeft } from "lucide-react";
import { toast } from "sonner";
import moment from "moment";

const STATUS_LABELS = {
  open: { label: "Abierto", color: "text-blue-600 bg-blue-50" },
  in_review: { label: "En revisión", color: "text-amber-600 bg-amber-50" },
  resolved: { label: "Resuelto", color: "text-emerald-600 bg-emerald-50" },
  closed: { label: "Cerrado", color: "text-slate-500 bg-slate-50" },
};

const CATEGORIES = [
  { key: "pago", label: "Problema con pago" },
  { key: "viaje", label: "Problema con viaje" },
  { key: "vehiculo", label: "Problema con vehículo" },
  { key: "app", label: "Problema con la app" },
  { key: "otro", label: "Otro" },
];

export default function DriverHelpTicket({ driver, rideContext, onClose }: { driver: any; rideContext: any; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [view, setView] = useState(rideContext ? "new" : "list");
  const [form, setForm] = useState({
    category: rideContext ? "viaje" : "otro",
    subject: rideContext
      ? `Problema con servicio${rideContext.service_id ? " " + rideContext.service_id : ""}`
      : "",
    description: "",
    ride_id: rideContext?.ride_id || "",
    service_id: rideContext?.service_id || "",
  });
  const [saving, setSaving] = useState(false);

  const { data: tickets = [] } = useQuery({
    queryKey: ["myTickets", driver.id],
    queryFn: () => supabaseApi.supportTickets.list({ driver_id: driver.id }),
    enabled: !!driver.id,
  });

  const { data: driverRides = [] } = useQuery({
    queryKey: ["driverRidesForTicket", driver.id],
    queryFn: () => supabaseApi.rideRequests.list({ driver_id: driver.id }),
    enabled: !!driver.id && !rideContext,
    select: (data: any[]) => data.filter((r: any) => r.status === "completed").slice(0, 30),
  });

  const handleSubmit = async () => {
    if (!form.subject.trim() || !form.description.trim()) {
      toast.error("Completa asunto y descripción");
      return;
    }
    setSaving(true);
    const ticketNumber = `TKT-${Date.now().toString(36).toUpperCase()}`;
    await supabaseApi.supportTickets.create({
      ticket_number: ticketNumber,
      driver_id: driver.id,
      driver_name: driver.full_name,
      submitted_by: "driver",
      category: form.category,
      subject: form.subject,
      description: form.description,
      status: "open",
      priority: "medium",
      ride_id: form.ride_id || undefined,
      service_id: form.service_id || undefined,
    });
    queryClient.invalidateQueries({ queryKey: ["myTickets", driver.id] });
    toast.success("Ticket enviado. Te responderemos pronto.");
    setForm({ category: "otro", subject: "", description: "", ride_id: "", service_id: "" });
    setView("list");
    setSaving(false);
  };

  const handleRideSelect = (rideId: string) => {
    if (!rideId || rideId === "_none") {
      setForm((p: any) => ({ ...p, ride_id: "", service_id: "" }));
      return;
    }
    const ride = driverRides.find((r: any) => r.id === rideId);
    if (ride) {
      setForm((p: any) => ({
        ...p,
        ride_id: ride.id,
        service_id: ride.service_id || "",
        subject: p.subject || `Problema con servicio${ride.service_id ? " " + ride.service_id : ""}`,
        category: "viaje",
      }));
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-black/60 flex items-end"
      onClick={onClose}
    >
      <motion.div
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ type: "spring", damping: 30, stiffness: 300 }}
        className="w-full bg-white rounded-t-3xl max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
        style={{ paddingBottom: "max(24px, env(safe-area-inset-bottom))" }}
      >
        {/* Header */}
        <div className="flex items-center px-4 pt-4 pb-4 border-b sticky top-0 bg-white z-10 gap-2">
          {view === "new" ? (
            <button onClick={() => { if (rideContext) onClose(); else setView("list"); }} className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center select-none flex-shrink-0">
              <ChevronLeft className="w-5 h-5 text-slate-600" />
            </button>
          ) : (
            <button onClick={onClose} className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center select-none flex-shrink-0">
              <ChevronLeft className="w-5 h-5 text-slate-600" />
            </button>
          )}
          <div className="flex items-center gap-2 flex-1">
            <HelpCircle className="w-5 h-5 text-blue-600" />
            <h2 className="font-bold text-slate-900">{view === "new" ? "Nuevo ticket" : "Centro de ayuda"}</h2>
          </div>
          {view === "list" && (
            <Button size="sm" onClick={() => setView("new")} className="bg-blue-600 hover:bg-blue-700 rounded-xl h-9 text-xs">
              <Plus className="w-3.5 h-3.5 mr-1" /> Nuevo
            </Button>
          )}
        </div>

        <div className="px-5 py-4 space-y-4">
          {view === "new" ? (
            <div className="space-y-4">
              <h3 className="font-semibold text-slate-900">Nuevo ticket de soporte</h3>

              {/* Ride context (auto-filled or selectable) */}
              {rideContext ? (
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-3">
                  <p className="text-xs text-blue-700">
                    Viaje relacionado: <strong>{rideContext.service_id || rideContext.ride_id}</strong>
                  </p>
                </div>
              ) : (
                <div>
                  <Label>Viaje relacionado (opcional)</Label>
                  <Select value={form.ride_id || "_none"} onValueChange={handleRideSelect}>
                    <SelectTrigger className="mt-1 rounded-xl">
                      <SelectValue placeholder="Seleccionar viaje..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="_none">Sin viaje específico</SelectItem>
                      {driverRides.map(r => (
                        <SelectItem key={r.id} value={r.id}>
                          {r.service_id ? `#${r.service_id} · ` : ""}{r.passenger_name} — {r.pickup_address?.slice(0, 35)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div>
                <Label>Categoría</Label>
                <Select value={form.category} onValueChange={v => setForm(p => ({ ...p, category: v }))}>
                  <SelectTrigger className="mt-1 rounded-xl"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map(c => <SelectItem key={c.key} value={c.key}>{c.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Asunto *</Label>
                <Input value={form.subject} onChange={e => setForm(p => ({ ...p, subject: e.target.value }))} placeholder="Describe brevemente el problema" className="mt-1 rounded-xl" />
              </div>

              <div>
                <Label>Descripción *</Label>
                <Textarea value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} placeholder="Explica detalladamente tu problema..." rows={4} className="mt-1 rounded-xl" />
              </div>

              <Button onClick={handleSubmit} disabled={saving} className="w-full bg-blue-600 hover:bg-blue-700 rounded-xl min-h-[44px]">
                {saving ? "Enviando..." : "Enviar ticket"}
              </Button>
            </div>
          ) : (
            <>
              {tickets.length === 0 && (
                <div className="text-center py-10 text-slate-400">
                  <MessageSquare className="w-10 h-10 mx-auto mb-2 opacity-40" />
                  <p className="text-sm">No tienes tickets aún.</p>
                  <p className="text-xs mt-1">Crea uno si tienes un problema.</p>
                </div>
              )}
              <div className="space-y-3">
                {tickets.map(ticket => {
                  const st = STATUS_LABELS[ticket.status] || STATUS_LABELS.open;
                  return (
                    <div key={ticket.id} className="border border-slate-100 rounded-xl p-4 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="font-medium text-slate-900 text-sm">{ticket.subject}</p>
                          {ticket.service_id && <p className="text-[10px] text-slate-400 font-mono">Servicio: {ticket.service_id}</p>}
                        </div>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${st.color}`}>{st.label}</span>
                      </div>
                      <p className="text-xs text-slate-500 truncate">{ticket.description}</p>
                      {ticket.admin_response && (
                        <div className="bg-emerald-50 rounded-xl p-3">
                          <p className="text-xs font-semibold text-emerald-700 mb-1">Respuesta del administrador:</p>
                          <p className="text-xs text-emerald-800">{ticket.admin_response}</p>
                        </div>
                      )}
                      <p className="text-xs text-slate-400">{moment(ticket.created_date).fromNow()}</p>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}
