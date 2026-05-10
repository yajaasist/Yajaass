"use client";

import React, { useState } from "react";
import { supabaseApi } from "@/lib/supabaseApi";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import Layout from "@/components/admin/Layout";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { MessageSquare, Search, Save, Send, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import moment from "moment";

const STATUS_CONFIG = {
  open:      { label: "Abierto",     color: "bg-blue-100 text-blue-700 border-blue-200" },
  in_review: { label: "En revisión", color: "bg-amber-100 text-amber-700 border-amber-200" },
  resolved:  { label: "Resuelto",    color: "bg-emerald-100 text-emerald-700 border-emerald-200" },
  closed:    { label: "Cerrado",     color: "bg-slate-100 text-slate-600 border-slate-200" },
};

const PRIORITY_CONFIG = {
  low:    { label: "Baja",  color: "bg-slate-100 text-slate-600" },
  medium: { label: "Media", color: "bg-amber-100 text-amber-700" },
  high:   { label: "Alta",  color: "bg-red-100 text-red-700" },
};

const CATEGORY_LABELS = {
  pago: "Pagos", viaje: "Viaje", vehiculo: "Vehículo", app: "App", otro: "Otro",
};

function SupportTicketsContent() {
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState(null);
  const [response, setResponse] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState(() => moment().format("YYYY-MM-DD"));
  const [dateTo, setDateTo] = useState(() => moment().format("YYYY-MM-DD"));

  const { data: tickets = [] } = useQuery({
    queryKey: ["supportTickets"],
    queryFn: () => supabaseApi.supportTickets.list(),
    staleTime: 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });

  const filtered = tickets.filter(t => {
    const matchStatus = statusFilter === "all" || t.status === statusFilter;
    const q = search.toLowerCase().trim();
    const matchSearch = !q || 
      (t.subject || "").toLowerCase().includes(q) ||
      (t.driver_name || "").toLowerCase().includes(q) ||
      (t.passenger_name || "").toLowerCase().includes(q) ||
      (String(t.passenger_phone) || "").includes(q) ||
      (t.ticket_number || "").toLowerCase().includes(q) ||
      (String(t.service_id) || "").toLowerCase().includes(q);
    const matchDate = true; // support_tickets has no timestamp column
    return matchStatus && matchSearch && matchDate;
  });

  const handleSaveResponse = async () => {
    await supabaseApi.supportTickets.update(selected.id, { admin_response: response });
    queryClient.invalidateQueries({ queryKey: ["supportTickets"] });
    setSelected(prev => ({ ...prev, admin_response: response }));
    toast.success("Respuesta guardada (sin enviar)");
  };

  const handleSendResponse = async () => {
    if (!response.trim()) return;
    await supabaseApi.supportTickets.update(selected.id, { admin_response: response, status: "in_review" });
    queryClient.invalidateQueries({ queryKey: ["supportTickets"] });
    setSelected(prev => ({ ...prev, admin_response: response, status: "in_review" }));
    toast.success("Respuesta enviada — caso en revisión hasta que el usuario conteste");
  };

  const handleDelete = async (ticket) => {
    if (!window.confirm(`¿Eliminar el ticket "${ticket.subject}"? Esta acción no se puede deshacer.`)) return;
    await supabaseApi.supportTickets.delete(ticket.id);
    queryClient.invalidateQueries({ queryKey: ["supportTickets"] });
    if (selected?.id === ticket.id) { setSelected(null); setResponse(""); }
    toast.success("Ticket eliminado");
  };

  const handleStatusChange = async (ticket, newStatus) => {
    await supabaseApi.supportTickets.update(ticket.id, { status: newStatus });
    queryClient.invalidateQueries({ queryKey: ["supportTickets"] });
    // Update local selected state so dialog reflects change immediately
    if (selected?.id === ticket.id) {
      setSelected(prev => ({ ...prev, status: newStatus }));
    }
    toast.success("Estado actualizado");
  };

  const openCount = tickets.filter(t => t.status === "open").length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Tickets de soporte</h1>
          <p className="text-sm text-slate-400 mt-0.5">
            {openCount > 0
              ? <span className="text-amber-600 font-medium">{openCount} ticket{openCount > 1 ? "s" : ""} abierto{openCount > 1 ? "s" : ""}</span>
              : "Sin tickets pendientes"}
          </p>
        </div>
        <div className="flex gap-2 flex-wrap items-center">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input placeholder="Buscar por nombre, teléfono, folio..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 rounded-xl w-56" />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-40 rounded-xl">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="open">Abiertos</SelectItem>
              <SelectItem value="in_review">En revisión</SelectItem>
              <SelectItem value="resolved">Resueltos</SelectItem>
              <SelectItem value="closed">Cerrados</SelectItem>
            </SelectContent>
          </Select>
          <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="rounded-xl w-36" />
          <span className="text-xs text-slate-400">→</span>
          <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="rounded-xl w-36" />
        </div>
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-12 text-slate-400">
          <MessageSquare className="w-10 h-10 mx-auto mb-2 opacity-40" />
          <p className="text-sm">Sin tickets en esta categoría.</p>
        </div>
      )}

      <div className="space-y-3">
        {filtered.map(ticket => {
          const st = STATUS_CONFIG[ticket.status] || STATUS_CONFIG.open;
          const pr = PRIORITY_CONFIG[ticket.priority] || PRIORITY_CONFIG.medium;
          return (
            <Card key={ticket.id} className="p-4 border-0 shadow-sm hover:shadow-md transition-shadow cursor-pointer" onClick={() => { setSelected(ticket); setResponse(ticket.admin_response || ""); }}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${st.color}`}>{st.label}</span>
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${pr.color}`}>{pr.label}</span>
                    <span className="text-xs text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">{CATEGORY_LABELS[ticket.category] || ticket.category}</span>
                  </div>
                  <p className="font-semibold text-slate-900 text-sm truncate">{ticket.subject}</p>
                  <p className="text-xs text-slate-500 truncate mt-0.5">{ticket.description}</p>
                  <div className="flex flex-wrap items-center gap-2 mt-1">
                    <p className="text-xs text-slate-400">
                      {ticket.submitted_by === "passenger" ? "👤" : "🚗"} {ticket.driver_name || ticket.passenger_name || "—"}
                    </p>
                    {ticket.service_id && (
                      <span className="text-[10px] font-mono bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded">{ticket.service_id}</span>
                    )}
                    {ticket.passenger_phone && (
                      <span className="text-[10px] text-slate-400">📞 {ticket.passenger_phone}</span>
                    )}
                  </div>
                </div>
                {ticket.status === "open" && (
                  <div className="flex-shrink-0">
                    <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
                  </div>
                )}
              </div>
            </Card>
          );
        })}
      </div>

      {/* Detail dialog */}
      <Dialog open={!!selected} onOpenChange={v => { if (!v) { setSelected(null); setResponse(""); } }}>
        <DialogContent className="dialog-size-2xl max-h-[90vh] overflow-y-auto p-4">
          <DialogHeader>
            <DialogTitle>Ticket de soporte</DialogTitle>
            <DialogDescription style={{ display: 'none' }}>Detalles y respuesta del ticket de soporte</DialogDescription>
          </DialogHeader>
          {selected && (
            <div className="space-y-4 py-2">
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${STATUS_CONFIG[selected.status]?.color}`}>
                  {STATUS_CONFIG[selected.status]?.label}
                </span>
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${PRIORITY_CONFIG[selected.priority]?.color}`}>
                  Prioridad {PRIORITY_CONFIG[selected.priority]?.label}
                </span>
              </div>
              <div className="flex flex-wrap gap-4">
                <div>
                  <p className="text-xs text-slate-400">{selected.submitted_by === "passenger" ? "Pasajero" : "Conductor"}</p>
                  <p className="font-semibold text-slate-900">{selected.driver_name || selected.passenger_name || "—"}</p>
                  {selected.passenger_phone && <p className="text-xs text-slate-500">📞 {selected.passenger_phone}</p>}
                </div>
                {selected.service_id && (
                  <div>
                    <p className="text-xs text-slate-400">ID de servicio</p>
                    <p className="font-mono text-sm text-slate-700">{selected.service_id}</p>
                  </div>
                )}
              </div>
              <div>
                <p className="text-xs text-slate-400">Asunto</p>
                <p className="font-medium text-slate-800">{selected.subject}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Descripción</p>
                <p className="text-sm text-slate-700 bg-slate-50 rounded-xl p-3">{selected.description}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400 mb-1">Categoría: {CATEGORY_LABELS[selected.category]}</p>
                <p className="text-xs text-slate-400">Ticket #{selected.ticket_number}</p>
              </div>
              <div>
                <Label>Respuesta del administrador</Label>
                <Textarea
                  value={response}
                  onChange={e => setResponse(e.target.value)}
                  placeholder="Escribe tu respuesta al conductor..."
                  rows={3}
                  className="mt-1"
                />
              </div>
              <div>
                <Label className="text-xs">Cambiar estado</Label>
                <div className="flex gap-2 mt-1 flex-wrap">
                  {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
                    <button key={key} onClick={() => handleStatusChange(selected, key)}
                      className={`text-xs px-3 py-1.5 rounded-lg border font-medium transition-all ${selected.status === key ? cfg.color + " font-bold" : "bg-white text-slate-500 border-slate-200 hover:border-slate-400"}`}>
                      {cfg.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
          <DialogFooter className="flex-wrap gap-2">
            <Button variant="outline" onClick={() => { setSelected(null); setResponse(""); }}>Cerrar</Button>
            <Button variant="destructive" size="sm" onClick={() => handleDelete(selected)} className="mr-auto">
              <Trash2 className="w-3.5 h-3.5 mr-1.5" /> Eliminar
            </Button>
            <Button variant="outline" onClick={handleSaveResponse} className="text-slate-700 border-slate-300">
              <Save className="w-3.5 h-3.5 mr-1.5" /> Guardar sin enviar
            </Button>
            <Button onClick={handleSendResponse} disabled={!response.trim()} className="bg-blue-600 hover:bg-blue-700">
              <Send className="w-3.5 h-3.5 mr-1.5" /> Enviar respuesta
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export const dynamic = "force-dynamic";

export default function SupportTickets() {
  return (
    <Layout currentPageName="SupportTickets">
      <SupportTicketsContent />
    </Layout>
  );
}
