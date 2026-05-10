"use client";

import React, { useState, useMemo } from "react";
import Layout from "@/components/admin/Layout";
import { supabaseApi } from "@/lib/supabaseApi";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import {
  FileText, Building2, Search, Download, Plus, CheckCircle2, Eye, Trash2, Send, Clock, XCircle
} from "lucide-react";
import { formatCDMX, todayCDMX, startOfDayCDMX, endOfDayCDMX, nowCDMX } from "@/components/shared/dateUtils";
import { toast } from "sonner";

const STATUS_MAP = {
  draft:     { label: "Borrador",   color: "bg-slate-100 text-slate-600" },
  sent:      { label: "Enviada",    color: "bg-blue-100 text-blue-700" },
  paid:      { label: "Pagada",     color: "bg-emerald-100 text-emerald-700" },
  cancelled: { label: "Cancelada",  color: "bg-red-100 text-red-700" },
};

function NewInvoiceDialog({ open, onClose, companies = [], rides = [] }) {
  const queryClient = useQueryClient();
  const [companyId, setCompanyId] = useState("");
  const [dateFrom, setDateFrom] = useState(() => `${todayCDMX().slice(0, 8)}01`);
  const [dateTo, setDateTo] = useState(() => todayCDMX());
  const [selectedRideIds, setSelectedRideIds] = useState([]);
  const [invoiceNumber, setInvoiceNumber] = useState(`INV-${Date.now().toString().slice(-6)}`);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [step, setStep] = useState(1); // 1 = select company+dates, 2 = select rides, 3 = confirm

  const company = companies.find(c => c.id === companyId);

  const availableRides = useMemo(() => {
    if (!companyId) return [];
    const from = startOfDayCDMX(dateFrom);
    const to = endOfDayCDMX(dateTo);
    return rides.filter(r => {
      if (r.company_id !== companyId) return false;
      if (r.status !== "completed") return false;
      const d = new Date(r.requested_at || "");
      if (Number.isNaN(d.getTime())) return false;
      return d >= from && d <= to;
    });
  }, [companyId, dateFrom, dateTo, rides]);

  const selectedRides = availableRides.filter(r => selectedRideIds.includes(r.id));
  const taxPct = company?.tax_pct ?? 0;
  const subtotal = selectedRides.reduce((s, r) => s + (r.company_price || r.final_price || r.estimated_price || 0), 0);
  const taxAmount = subtotal * (taxPct / 100);
  const total = subtotal + taxAmount;

  const toggleAll = () => {
    if (selectedRideIds.length === availableRides.length) setSelectedRideIds([]);
    else setSelectedRideIds(availableRides.map(r => r.id));
  };

  const toggleRide = (id) => {
    setSelectedRideIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const handleSave = async () => {
    if (!companyId || selectedRides.length === 0) return;
    setSaving(true);
    try {
      const invoiceData = {
        invoice_number: invoiceNumber,
        company_id: companyId,
        company_name: company.razon_social,
        ride_ids: selectedRides.map(r => r.id),
        service_ids: selectedRides.map(r => r.service_id).filter(Boolean),
        period_from: startOfDayCDMX(dateFrom).toISOString(),
        period_to: endOfDayCDMX(dateTo).toISOString(),
        subtotal, tax_pct: taxPct, tax_amount: taxAmount, total,
        ride_count: selectedRides.length,
        status: "draft",
        notes,
      };
      await supabaseApi.invoices.create(invoiceData);
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      setSaving(false);
      toast.success("Factura creada");
      onClose();
    } catch (error) {
      toast.error("Error al crear factura");
      setSaving(false);
    }
  };

  const exportCSV = () => {
    const folioFields = company?.folio_fields || [];
    const folioHeaders = folioFields.map(f => f.label);
    const headers = ["Folio","Fecha","Pasajero","Conductor","Origen","Destino","Servicio","Pago","Costo Empresa", ...folioHeaders];
    const rows = selectedRides.map(r => {
      const folioAnswers = folioFields.map(f => {
        const ans = (r.questionnaire_answers || []).find(a => a.question === f.label || a.question === f.key);
        return ans?.answer || "";
      });
      return [r.service_id||"", formatCDMX(r.requested_at,"shortdatetime"), r.passenger_name||"", r.driver_name||"", r.pickup_address||"", r.dropoff_address||"", r.service_type_name||"", r.payment_method||"", (r.company_price||r.final_price||r.estimated_price||0).toFixed(2), ...folioAnswers];
    });
    const csv = [headers, ...rows].map(row => row.map(v => `"${String(v).replace(/"/g,'""')}"`).join(",")).join("\n");
    const blob = new Blob(["\ufeff"+csv], {type:"text/csv;charset=utf-8;"});
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href=url; a.download=`factura_${company?.razon_social}_${dateFrom}_${dateTo}.csv`; a.click(); URL.revokeObjectURL(url);
  };

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="dialog-size-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-blue-600" /> Nueva Factura
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {/* Step 1: Company & dates */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="sm:col-span-1">
              <Label>Empresa *</Label>
              <Select value={companyId} onValueChange={v => { setCompanyId(v); setSelectedRideIds([]); }}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Seleccionar empresa" /></SelectTrigger>
                <SelectContent>
                  {companies.map(c => <SelectItem key={c.id} value={c.id}>{c.razon_social}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Desde</Label>
              <Input type="date" value={dateFrom} onChange={e => { setDateFrom(e.target.value); setSelectedRideIds([]); }} className="mt-1" />
            </div>
            <div>
              <Label>Hasta</Label>
              <Input type="date" value={dateTo} onChange={e => { setDateTo(e.target.value); setSelectedRideIds([]); }} className="mt-1" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Número de factura</Label>
              <Input value={invoiceNumber} onChange={e => setInvoiceNumber(e.target.value)} className="mt-1" />
            </div>
            <div>
              <Label>Notas</Label>
              <Input value={notes} onChange={e => setNotes(e.target.value)} className="mt-1" placeholder="Observaciones..." />
            </div>
          </div>

          {/* Services table */}
          {companyId && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <Label className="flex items-center gap-2">
                  Servicios disponibles ({availableRides.length})
                  <span className="text-slate-400 font-normal">— {selectedRideIds.length} seleccionados</span>
                </Label>
                <div className="flex gap-2">
                  <Button type="button" variant="outline" size="sm" onClick={toggleAll} className="rounded-lg text-xs">
                    {selectedRideIds.length === availableRides.length ? "Deseleccionar todo" : "Seleccionar todo"}
                  </Button>
                  {selectedRideIds.length > 0 && (
                    <Button type="button" variant="outline" size="sm" onClick={exportCSV} className="rounded-lg text-xs">
                      <Download className="w-3.5 h-3.5 mr-1" /> CSV
                    </Button>
                  )}
                </div>
              </div>

              {availableRides.length === 0 ? (
                <p className="text-center text-slate-400 py-6 text-sm border-2 border-dashed border-slate-200 rounded-xl">Sin servicios completados en el período</p>
              ) : (
                <div className="border border-slate-200 rounded-xl overflow-hidden max-h-72 overflow-y-auto">
                  <table className="w-full text-xs">
                    <thead className="sticky top-0 bg-slate-50 border-b">
                      <tr>
                        <th className="w-8 px-3 py-2.5"><Checkbox checked={selectedRideIds.length === availableRides.length} onCheckedChange={toggleAll} /></th>
                        <th className="px-3 py-2.5 text-left text-slate-500 font-semibold">Fecha</th>
                        <th className="px-3 py-2.5 text-left text-slate-500 font-semibold">Folio</th>
                        <th className="px-3 py-2.5 text-left text-slate-500 font-semibold">Pasajero</th>
                        <th className="px-3 py-2.5 text-left text-slate-500 font-semibold">Conductor</th>
                        <th className="px-3 py-2.5 text-left text-slate-500 font-semibold">Servicio</th>
                        <th className="px-3 py-2.5 text-right text-slate-500 font-semibold">Costo</th>
                        {company?.folio_fields?.map(f => (
                          <th key={f.key} className="px-3 py-2.5 text-left text-slate-500 font-semibold whitespace-nowrap">{f.label}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {availableRides.map(r => {
                        const checked = selectedRideIds.includes(r.id);
                        return (
                          <tr key={r.id} className={`border-b border-slate-100 cursor-pointer ${checked ? "bg-blue-50" : "hover:bg-slate-50"}`} onClick={() => toggleRide(r.id)}>
                            <td className="px-3 py-2"><Checkbox checked={checked} onCheckedChange={() => toggleRide(r.id)} /></td>
                            <td className="px-3 py-2 text-slate-500 whitespace-nowrap">{formatCDMX(r.requested_at,"short")}</td>
                            <td className="px-3 py-2 font-mono text-slate-400">{r.service_id||"—"}</td>
                            <td className="px-3 py-2 text-slate-700">{r.passenger_name}</td>
                            <td className="px-3 py-2 text-slate-600">{r.driver_name||"—"}</td>
                            <td className="px-3 py-2">{r.service_type_name||"—"}</td>
                            <td className="px-3 py-2 text-right font-semibold text-blue-600">${(r.company_price||r.final_price||r.estimated_price||0).toFixed(2)}</td>
                            {company?.folio_fields?.map(f => {
                              const ans = (r.questionnaire_answers||[]).find(a => a.question===f.label||a.question===f.key);
                              return <td key={f.key} className="px-3 py-2 text-slate-500">{ans?.answer||"—"}</td>;
                            })}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Totals */}
          {selectedRides.length > 0 && (
            <div className="bg-blue-50 rounded-xl p-4 space-y-1.5 text-sm">
              <p className="font-semibold text-blue-800 mb-2">{selectedRides.length} servicios seleccionados</p>
              <div className="flex justify-between"><span className="text-slate-600">Subtotal</span><span className="font-bold text-blue-700">${subtotal.toFixed(2)}</span></div>
              {taxPct > 0 && <div className="flex justify-between"><span className="text-slate-600">Impuesto ({taxPct}%)</span><span className="font-medium">${taxAmount.toFixed(2)}</span></div>}
              <div className="flex justify-between border-t border-blue-200 pt-1.5"><span className="font-bold text-slate-900">Total a facturar</span><span className="font-bold text-blue-700 text-base">${total.toFixed(2)}</span></div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving || !companyId || selectedRideIds.length === 0} className="bg-blue-600 hover:bg-blue-700">
            {saving ? "Guardando..." : "Crear factura"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function InvoiceDetailDialog({ invoice, companies = [], rides = [], onClose, onStatusChange }) {
  const company = companies.find(c => c.id === invoice?.company_id);
  const invoiceRides = rides.filter(r => (invoice?.ride_ids || []).includes(r.id));
  const status = STATUS_MAP[invoice?.status] || STATUS_MAP.draft;

  const exportCSV = () => {
    const folioFields = company?.folio_fields || [];
    const headers = ["Folio","Fecha","Pasajero","Conductor","Origen","Destino","Servicio","Costo Empresa", ...folioFields.map(f => f.label)];
    const rows = invoiceRides.map(r => {
      const folioAnswers = folioFields.map(f => {
        const ans = (r.questionnaire_answers||[]).find(a => a.question===f.label||a.question===f.key);
        return ans?.answer||"";
      });
      return [r.service_id||"", formatCDMX(r.requested_at,"shortdatetime"), r.passenger_name||"", r.driver_name||"", r.pickup_address||"", r.dropoff_address||"", r.service_type_name||"", (r.company_price||r.final_price||r.estimated_price||0).toFixed(2), ...folioAnswers];
    });
    const csv = [headers, ...rows].map(row => row.map(v => `"${String(v).replace(/"/g,'""')}"`).join(",")).join("\n");
    const blob = new Blob(["\ufeff"+csv], {type:"text/csv;charset=utf-8;"});
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href=url; a.download=`factura_${invoice.invoice_number}.csv`; a.click(); URL.revokeObjectURL(url);
  };

  return (
    <Dialog open={!!invoice} onOpenChange={v => !v && onClose()}>
      <DialogContent className="dialog-size-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <FileText className="w-5 h-5 text-blue-600" />
            Factura {invoice?.invoice_number}
            <Badge className={`${status.color} border-0 text-xs`}>{status.label}</Badge>
          </DialogTitle>
        </DialogHeader>
        {invoice && (
          <div className="space-y-5 py-2">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
              <div><p className="text-xs text-slate-400">Empresa</p><p className="font-semibold">{invoice.company_name}</p></div>
              {company?.rfc && <div><p className="text-xs text-slate-400">RFC</p><p className="font-medium">{company.rfc}</p></div>}
              <div><p className="text-xs text-slate-400">Período</p><p className="font-medium">{formatCDMX(invoice.period_from,"date")} → {formatCDMX(invoice.period_to,"date")}</p></div>
              <div><p className="text-xs text-slate-400">Servicios</p><p className="font-bold">{invoice.ride_count}</p></div>
              <div><p className="text-xs text-slate-400">Total</p><p className="font-bold text-blue-700 text-base">${(invoice.total||0).toFixed(2)}</p></div>
            </div>

            <div className="overflow-x-auto border border-slate-200 rounded-xl">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b">
                    <th className="px-3 py-2.5 text-left text-slate-500 font-semibold">Fecha</th>
                    <th className="px-3 py-2.5 text-left text-slate-500 font-semibold">Folio</th>
                    <th className="px-3 py-2.5 text-left text-slate-500 font-semibold">Pasajero</th>
                    <th className="px-3 py-2.5 text-left text-slate-500 font-semibold">Conductor</th>
                    <th className="px-3 py-2.5 text-left text-slate-500 font-semibold">Servicio</th>
                    <th className="px-3 py-2.5 text-right text-slate-500 font-semibold">Costo</th>
                    {company?.folio_fields?.map(f => <th key={f.key} className="px-3 py-2.5 text-left text-slate-500 font-semibold">{f.label}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {invoiceRides.map(r => (
                    <tr key={r.id} className="border-b border-slate-50 hover:bg-slate-50">
                      <td className="px-3 py-2 text-slate-500">{formatCDMX(r.requested_at,"short")}</td>
                      <td className="px-3 py-2 font-mono text-slate-400">{r.service_id||"—"}</td>
                      <td className="px-3 py-2 text-slate-700">{r.passenger_name}</td>
                      <td className="px-3 py-2 text-slate-600">{r.driver_name||"—"}</td>
                      <td className="px-3 py-2">{r.service_type_name||"—"}</td>
                      <td className="px-3 py-2 text-right font-semibold text-blue-600">${(r.company_price||r.final_price||r.estimated_price||0).toFixed(2)}</td>
                      {company?.folio_fields?.map(f => {
                        const ans = (r.questionnaire_answers||[]).find(a => a.question===f.label||a.question===f.key);
                        return <td key={f.key} className="px-3 py-2 text-slate-500">{ans?.answer||"—"}</td>;
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="bg-slate-50 rounded-xl p-4 space-y-1.5 text-sm">
              <div className="flex justify-between"><span className="text-slate-500">Subtotal</span><span className="font-medium">${(invoice.subtotal||0).toFixed(2)}</span></div>
              {(invoice.tax_pct||0) > 0 && <div className="flex justify-between"><span className="text-slate-500">Impuesto ({invoice.tax_pct}%)</span><span className="font-medium">${(invoice.tax_amount||0).toFixed(2)}</span></div>}
              <div className="flex justify-between border-t pt-1.5"><span className="font-bold">Total</span><span className="font-bold text-blue-700 text-base">${(invoice.total||0).toFixed(2)}</span></div>
            </div>

            {invoice.notes && <p className="text-sm text-slate-500 italic">Notas: {invoice.notes}</p>}
          </div>
        )}
        <DialogFooter className="flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={exportCSV} className="rounded-xl"><Download className="w-3.5 h-3.5 mr-1.5" /> CSV</Button>
          {invoice?.status === "draft" && <Button size="sm" onClick={() => onStatusChange(invoice, "sent")} className="bg-blue-600 hover:bg-blue-700 rounded-xl"><Send className="w-3.5 h-3.5 mr-1.5" /> Marcar enviada</Button>}
          {invoice?.status === "sent" && <Button size="sm" onClick={() => onStatusChange(invoice, "paid")} className="bg-emerald-600 hover:bg-emerald-700 rounded-xl"><CheckCircle2 className="w-3.5 h-3.5 mr-1.5" /> Marcar pagada</Button>}
          {invoice?.status === "paid" && <Button size="sm" variant="outline" onClick={() => onStatusChange(invoice, "sent")} className="rounded-xl text-amber-600 border-amber-200 hover:bg-amber-50"><Clock className="w-3.5 h-3.5 mr-1.5" /> Revertir a por cobrar</Button>}
          {invoice?.status === "cancelled" && <Button size="sm" variant="outline" onClick={() => onStatusChange(invoice, "sent")} className="rounded-xl text-blue-600 border-blue-200 hover:bg-blue-50"><Clock className="w-3.5 h-3.5 mr-1.5" /> Reactivar (por cobrar)</Button>}
          {!["cancelled"].includes(invoice?.status) && <Button size="sm" variant="outline" onClick={() => { onStatusChange(invoice, "cancelled"); onClose(); }} className="rounded-xl text-orange-600 border-orange-200 hover:bg-orange-50"><XCircle className="w-3.5 h-3.5 mr-1.5" /> Cancelar factura</Button>}
          <Button variant="outline" onClick={onClose} className="rounded-xl">Cerrar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function Invoices() {
  const queryClient = useQueryClient();
  const [showNew, setShowNew] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [companyFilter, setCompanyFilter] = useState("all");

  const { data: invoices = [] } = useQuery({
    queryKey: ["invoices"],
    queryFn: () => supabaseApi.invoices.list(),
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });
  const { data: companies = [] } = useQuery({
    queryKey: ["companies"],
    queryFn: () => supabaseApi.companies.list(),
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });
  const { data: rides = [] } = useQuery({
    queryKey: ["allRides"],
    queryFn: () => supabaseApi.rideRequests.list(),
    staleTime: 30 * 1000,
    gcTime: 10 * 60 * 1000,
  });

  const handleStatusChange = async (invoice, newStatus) => {
    const updates: any = { status: newStatus };
    if (newStatus === "paid") updates.paid_at = nowCDMX();
    const res = await fetch(`/api/invoices?id=${invoice.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates)
    });
    if (!res.ok) throw new Error('Failed to update invoice');
    queryClient.invalidateQueries({ queryKey: ["invoices"] });
    setSelectedInvoice(prev => prev?.id === invoice.id ? { ...prev, ...updates } : prev);
    toast.success(`Factura marcada como ${STATUS_MAP[newStatus]?.label}`);
  };

  const handleDelete = async (invoice) => {
    if (!window.confirm(`¿Eliminar permanentemente la factura ${invoice.invoice_number}? Esta acción no se puede deshacer.`)) return;
    const res = await fetch(`/api/invoices?id=${invoice.id}`, {
      method: 'DELETE'
    });
    if (!res.ok) throw new Error('Failed to delete invoice');
    queryClient.invalidateQueries({ queryKey: ["invoices"] });
    toast.success("Factura eliminada");
  };

  const filtered = invoices.filter(inv => {
    if (statusFilter !== "all" && inv.status !== statusFilter) return false;
    if (companyFilter !== "all" && inv.company_id !== companyFilter) return false;
    if (search && !(inv.company_name || "").toLowerCase().includes(search.toLowerCase()) && !(String(inv.invoice_number) || "").toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const totalPending = invoices.filter(i => ["draft","sent"].includes(i.status)).reduce((s, i) => s + (i.total||0), 0);
  const totalPaid = invoices.filter(i => i.status === "paid").reduce((s, i) => s + (i.total||0), 0);

  return (
    <Layout currentPageName="Invoices">
      <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Facturación</h1>
          <p className="text-sm text-slate-400 mt-0.5">Gestiona facturas de servicios corporativos por empresa</p>
        </div>
        <Button onClick={() => setShowNew(true)} className="rounded-xl bg-blue-600 hover:bg-blue-700">
          <Plus className="w-4 h-4 mr-2" /> Nueva factura
        </Button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: "Total facturas", value: invoices.length, bg: "bg-slate-50", text: "text-slate-700" },
          { label: "Por cobrar", value: `$${totalPending.toFixed(0)}`, bg: "bg-amber-50", text: "text-amber-700" },
          { label: "Cobradas", value: `$${totalPaid.toFixed(0)}`, bg: "bg-emerald-50", text: "text-emerald-700" },
          { label: "Empresas activas", value: companies.filter(c => c.is_active !== false).length, bg: "bg-blue-50", text: "text-blue-700" },
        ].map(k => (
          <div key={k.label} className={`${k.bg} rounded-xl p-4 text-center`}>
            <p className={`text-xl font-bold ${k.text}`}>{k.value}</p>
            <p className={`text-xs ${k.text} opacity-70 mt-0.5`}>{k.label}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar empresa o número..." className="pl-10 rounded-xl" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-44 rounded-xl">
            <SelectValue placeholder="Estado" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los estados</SelectItem>
            <SelectItem value="draft">Borrador</SelectItem>
            <SelectItem value="sent">Enviada</SelectItem>
            <SelectItem value="paid">Pagada</SelectItem>
            <SelectItem value="cancelled">Cancelada</SelectItem>
          </SelectContent>
        </Select>
        <Select value={companyFilter} onValueChange={setCompanyFilter}>
          <SelectTrigger className="w-52 rounded-xl">
            <Building2 className="w-3.5 h-3.5 mr-2 text-slate-400" />
            <SelectValue placeholder="Empresa" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas las empresas</SelectItem>
            {companies.map(c => <SelectItem key={c.id} value={c.id}>{c.razon_social}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Invoices list */}
      {filtered.length === 0 && (
        <div className="text-center py-16 text-slate-400">
          <FileText className="w-10 h-10 mx-auto mb-2 opacity-40" />
          <p className="text-sm">{invoices.length === 0 ? "No hay facturas creadas aún. Crea la primera." : "Sin resultados para los filtros aplicados."}</p>
        </div>
      )}

      <div className="space-y-3">
        {filtered.map(inv => {
          const status = STATUS_MAP[inv.status] || STATUS_MAP.draft;
          return (
            <Card key={inv.id} className="p-5 border-0 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center flex-shrink-0">
                    <FileText className="w-5 h-5 text-blue-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-slate-900 text-sm">{inv.invoice_number}</span>
                      <Badge className={`${status.color} border-0 text-xs`}>{status.label}</Badge>
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">{inv.company_name} · {inv.ride_count} servicios</p>
                    <p className="text-xs text-slate-400">{formatCDMX(inv.period_from,"date")} → {formatCDMX(inv.period_to,"date")}</p>
                    {inv.notes && <p className="text-xs text-slate-400 italic mt-0.5 truncate">{inv.notes}</p>}
                  </div>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                  <div className="text-right">
                    <p className="font-bold text-blue-700">${(inv.total||0).toFixed(0)}</p>
                    {inv.tax_pct > 0 && <p className="text-xs text-slate-400">IVA {inv.tax_pct}% incl.</p>}
                  </div>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="sm" className="rounded-xl" onClick={() => setSelectedInvoice(inv)}>
                      <Eye className="w-4 h-4" />
                    </Button>
                    {inv.status === "paid" && (
                      <Button variant="ghost" size="sm" className="rounded-xl text-amber-400 hover:text-amber-600" title="Revertir a por cobrar" onClick={() => handleStatusChange(inv, "sent")}>
                        <Clock className="w-4 h-4" />
                      </Button>
                    )}
                    {inv.status === "cancelled" && (
                      <Button variant="ghost" size="sm" className="rounded-xl text-blue-400 hover:text-blue-600" title="Reactivar factura" onClick={() => handleStatusChange(inv, "sent")}>
                        <Clock className="w-4 h-4" />
                      </Button>
                    )}
                    {!["cancelled"].includes(inv.status) && (
                      <Button variant="ghost" size="sm" className="rounded-xl text-orange-400 hover:text-orange-600" title="Cancelar factura" onClick={() => handleStatusChange(inv, "cancelled")}>
                        <XCircle className="w-4 h-4" />
                      </Button>
                    )}
                    <Button variant="ghost" size="sm" className="rounded-xl text-red-400 hover:text-red-600" title="Eliminar" onClick={() => handleDelete(inv)}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      <NewInvoiceDialog open={showNew} onClose={() => setShowNew(false)} companies={companies} rides={rides} />
      {selectedInvoice && (
        <InvoiceDetailDialog
          invoice={selectedInvoice}
          companies={companies}
          rides={rides}
          onClose={() => setSelectedInvoice(null)}
          onStatusChange={handleStatusChange}
        />
      )}
    </div>
    </Layout>
  );
}
