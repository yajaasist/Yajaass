"use client";
export const dynamic = 'force-dynamic';

import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabaseApi } from "@/lib/supabaseApi";
import { toast } from "sonner";
import Layout from "@/components/admin/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Trophy, Plus, Play, CheckCircle2, XCircle, DollarSign, Trash2, ToggleLeft, ToggleRight, AlertCircle, Clock, Edit2 } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";

const CONDITION_LABELS = {
  min_rides_per_week: "Viajes mínimos por semana",
  min_rides_per_month: "Viajes mínimos por mes",
  min_earnings_per_week: "Ganancias mínimas por semana ($)",
  min_earnings_per_month: "Ganancias mínimas por mes ($)",
};

const STATUS_CONFIG = {
  pending:  { label: "Pendiente",  className: "bg-amber-100 text-amber-700" },
  approved: { label: "Aprobado",   className: "bg-blue-100 text-blue-700" },
  rejected: { label: "Rechazado",  className: "bg-red-100 text-red-700" },
  paid:     { label: "Pagado",     className: "bg-emerald-100 text-emerald-700" },
};

const EMPTY_RULE = {
  name: "", condition_type: "min_rides_per_week", condition_value: 10,
  bonus_amount: 100, period: "weekly", city_id: "", city_name: "",
  service_type_id: "", service_type_name: "", is_active: true,
};

export default function BonosPage() {
  const qc = useQueryClient();
  const [activeTab, setActiveTab] = useState("rules");
  const [showRuleDialog, setShowRuleDialog] = useState(false);
  const [editingRule, setEditingRule] = useState(null);
  const [form, setForm] = useState(EMPTY_RULE);
  const [calculating, setCalculating] = useState(false);
  const [calcPeriod, setCalcPeriod] = useState("current_week");
  const [filterStatus, setFilterStatus] = useState("all");

  const { data: rules = [] } = useQuery({
    queryKey: ["bonusRules"],
    queryFn: () => supabaseApi.bonusRules.list(),
    staleTime: 30 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
  });

  const { data: logs = [] } = useQuery({
    queryKey: ["bonusLogs"],
    queryFn: () => supabaseApi.bonusLogs.list(),
    staleTime: 30 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
  });

  const { data: drivers = [] } = useQuery({
    queryKey: ["drivers_bonus"],
    queryFn: () => supabaseApi.drivers.list(),
    staleTime: 30 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
  });

  const { data: rides = [] } = useQuery({
    queryKey: ["rides_bonus"],
    queryFn: () => supabaseApi.rideRequests.list(),
    staleTime: 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });

  const { data: cities = [] } = useQuery({
    queryKey: ["cities"],
    queryFn: () => supabaseApi.cities.list(),
    staleTime: 30 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
  });

  const { data: serviceTypes = [] } = useQuery({
    queryKey: ["serviceTypes"],
    queryFn: () => supabaseApi.serviceTypes.list(),
    staleTime: 30 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
  });

  const saveMutation = useMutation<any, any, any>({
    mutationFn: async (data: any) => {
      if (editingRule) {
        return supabaseApi.bonusRules.update(editingRule.id, data);
      } else {
        return supabaseApi.bonusRules.create(data);
      }
    },
    onSuccess: () => { 
      qc.invalidateQueries({ queryKey: ["bonusRules"] }); 
      setShowRuleDialog(false);
      toast.success(editingRule ? "Regla actualizada" : "Regla creada");
    },
    onError: (error: any) => toast.error(error.message || "Error al guardar"),
  });

  const deleteMutation = useMutation<any, any, string>({
    mutationFn: async (id: string) => supabaseApi.bonusRules.delete(id),
    onSuccess: () => { 
      qc.invalidateQueries({ queryKey: ["bonusRules"] });
      toast.success("Regla eliminada");
    },
    onError: (error: any) => toast.error(error.message || "Error al eliminar"),
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, val }: any) => supabaseApi.bonusRules.update(id, { is_active: val }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["bonusRules"] }),
    onError: (error: any) => toast.error(error.message || "Error al actualizar"),
  });

  const logMutation = useMutation<any, any, any>({
    mutationFn: async (data: any) => supabaseApi.bonusLogs.create(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["bonusLogs"] }),
    onError: (error: any) => toast.error(error.message || "Error al crear log"),
  });

  const updateLogMutation = useMutation({
    mutationFn: async ({ id, data }: any) => {
      return await supabaseApi.bonusLogs.update(id, data);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["bonusLogs"] });
      toast.success("Estado actualizado");
    },
    onError: (error: any) => toast.error(error.message || "Error al actualizar"),
  });

  const openCreate = () => { setEditingRule(null); setForm(EMPTY_RULE); setShowRuleDialog(true); };
  const openEdit = (rule: any) => { setEditingRule(rule); setForm({ ...rule }); setShowRuleDialog(true); };

  const calculateBonuses = async () => {
    try {
      setCalculating(true);
      const activeRules = rules.filter(r => r.is_active);
      if (!activeRules.length) { 
        toast.info("No hay reglas activas");
        setCalculating(false); 
        return; 
      }

      const now = new Date();
      let periodStart, periodEnd, periodLabel;
      if (calcPeriod === "current_week") {
        const firstDay = new Date(now);
        firstDay.setDate(now.getDate() - now.getDay() + 1);
        const lastDay = new Date(firstDay);
        lastDay.setDate(firstDay.getDate() + 6);
        periodStart = firstDay;
        periodEnd = lastDay;
        periodLabel = `Semana ${format(now, "w", { locale: es })} ${format(now, "yyyy")}`;
      } else if (calcPeriod === "last_week") {
        const last = new Date(now);
        last.setDate(now.getDate() - 7);
        const firstDay = new Date(last);
        firstDay.setDate(last.getDate() - last.getDay() + 1);
        const lastDay = new Date(firstDay);
        lastDay.setDate(firstDay.getDate() + 6);
        periodStart = firstDay;
        periodEnd = lastDay;
        periodLabel = `Semana ${format(last, "w", { locale: es })} ${format(last, "yyyy")}`;
      } else if (calcPeriod === "current_month") {
        periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
        periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        periodLabel = format(now, "MMMM yyyy", { locale: es });
      } else {
        const last = new Date(now);
        last.setMonth(now.getMonth() - 1);
        periodStart = new Date(last.getFullYear(), last.getMonth(), 1);
        periodEnd = new Date(last.getFullYear(), last.getMonth() + 1, 0);
        periodLabel = format(last, "MMMM yyyy", { locale: es });
      }

      const completedRides = rides.filter(r => r.status === "completed");
      const periodRides = completedRides.filter(r => {
        const d = r.completed_at || r.requested_at;
        if (!d) return false;
        const dt = new Date(d);
        return dt >= periodStart && dt <= periodEnd;
      });

      const existingKeys = new Set(
        logs.filter(l => l.period_label === periodLabel).map(l => `${l.driver_id}_${l.rule_id}`)
      );

      const created = [];
      for (const rule of activeRules) {
        const isPeriodMatch = (rule.period === "weekly" && calcPeriod.includes("week")) ||
          (rule.period === "monthly" && calcPeriod.includes("month"));
        if (!isPeriodMatch) continue;

        for (const driver of drivers) {
          if (rule.city_id && driver.city_id !== rule.city_id) continue;
          if (rule.service_type_id && !(driver.service_type_ids || []).includes(rule.service_type_id)) continue;

          const key = `${driver.id}_${rule.id}`;
          if (existingKeys.has(key)) continue;

          let driverRides = periodRides.filter(r => r.driver_id === driver.id);
          if (rule.service_type_id) driverRides = driverRides.filter(r => r.service_type_id === rule.service_type_id);

          let achieved = 0;
          if ((rule.condition_type || "").includes("rides")) {
            achieved = driverRides.length;
          } else {
            achieved = driverRides.reduce((s, r) => s + (r.driver_earnings || 0), 0);
          }

          if (achieved >= rule.condition_value) {
            created.push(logMutation.mutateAsync({
              driver_id: driver.id,
              driver_name: driver.full_name || "Desconocido",
              rule_id: rule.id,
              rule_name: rule.name,
              period_label: periodLabel,
              period_start: periodStart.toISOString(),
              period_end: periodEnd.toISOString(),
              condition_type: rule.condition_type,
              condition_value: rule.condition_value,
              achieved_value: achieved,
              bonus_amount: rule.bonus_amount,
              city_name: rule.city_name || "",
              service_type_name: rule.service_type_name || "",
              status: "pending",
            }));
          }
        }
      }

      await Promise.all(created);
      toast.success(`${created.length} bonos calculados`);
      setActiveTab("logs");
    } catch (error: any) {
      toast.error(error.message || "Error al calcular bonos");
    } finally {
      setCalculating(false);
    }
  };

  const filteredLogs = filterStatus === "all" ? logs : logs.filter(l => l.status === filterStatus);
  const pendingCount = logs.filter(l => l.status === "pending").length;
  const totalPending = logs.filter(l => l.status === "pending").reduce((s, l) => s + l.bonus_amount, 0);

  return (
    <Layout currentPageName="Bonos">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center">
              <Trophy className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Bonos por desempeño</h1>
              <p className="text-sm text-slate-500">Reglas automáticas y log de bonos calculados</p>
            </div>
          </div>
          <Button onClick={openCreate} className="bg-amber-500 hover:bg-amber-600 text-white rounded-xl">
            <Plus className="w-4 h-4 mr-2" /> Nueva regla
          </Button>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="p-4">
            <p className="text-xs text-slate-500">Reglas activas</p>
            <p className="text-2xl font-bold text-slate-900">{rules.filter(r => r.is_active).length}</p>
          </Card>
          <Card className="p-4">
            <p className="text-xs text-slate-500">Bonos pendientes</p>
            <p className="text-2xl font-bold text-amber-600">{pendingCount}</p>
          </Card>
          <Card className="p-4">
            <p className="text-xs text-slate-500">Monto pendiente</p>
            <p className="text-2xl font-bold text-emerald-600">${totalPending.toLocaleString()}</p>
          </Card>
          <Card className="p-4">
            <p className="text-xs text-slate-500">Bonos pagados</p>
            <p className="text-2xl font-bold text-blue-600">{logs.filter(l => l.status === "paid").length}</p>
          </Card>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="rounded-xl">
            <TabsTrigger value="rules">Reglas</TabsTrigger>
            <TabsTrigger value="logs" className="relative">
              Log de bonos
              {pendingCount > 0 && (
                <span className="ml-1.5 bg-amber-500 text-white text-[9px] font-black rounded-full min-w-[16px] h-4 flex items-center justify-center px-1">
                  {pendingCount}
                </span>
              )}
            </TabsTrigger>
          </TabsList>

          {/* ── RULES TAB ── */}
          <TabsContent value="rules" className="mt-4 space-y-4">
            {/* Calculate panel */}
            <Card className="p-4 border-amber-200 bg-amber-50">
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
                <div className="flex-1">
                  <p className="text-sm font-semibold text-amber-800">Calcular bonos del período</p>
                  <p className="text-xs text-amber-600 mt-0.5">Evalúa todas las reglas activas contra los viajes completados</p>
                </div>
                <div className="flex gap-2 items-center flex-wrap">
                  <Select value={calcPeriod} onValueChange={setCalcPeriod}>
                    <SelectTrigger className="w-44 h-9 rounded-lg bg-white border-amber-200">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="current_week">Semana actual</SelectItem>
                      <SelectItem value="last_week">Semana pasada</SelectItem>
                      <SelectItem value="current_month">Mes actual</SelectItem>
                      <SelectItem value="last_month">Mes pasado</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button onClick={calculateBonuses} disabled={calculating}
                    className="bg-amber-500 hover:bg-amber-600 text-white rounded-lg h-9">
                    <Play className="w-3.5 h-3.5 mr-1.5" />
                    {calculating ? "Calculando..." : "Calcular"}
                  </Button>
                </div>
              </div>
            </Card>

            {rules.length === 0 && (
              <div className="text-center py-16 text-slate-400">
                <Trophy className="w-12 h-12 mx-auto mb-3 text-slate-200" />
                <p className="font-medium">No hay reglas aún</p>
                <p className="text-sm mt-1">Crea tu primera regla de bono</p>
              </div>
            )}

            <div className="grid md:grid-cols-2 gap-4">
              {rules.map(rule => (
                <Card key={rule.id} className={`p-4 border-l-4 ${rule.is_active ? "border-l-amber-400" : "border-l-slate-200"}`}>
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-slate-900">{rule.name}</p>
                        <Badge className={rule.is_active ? "bg-emerald-100 text-emerald-700 text-[10px]" : "bg-slate-100 text-slate-500 text-[10px]"}>
                          {rule.is_active ? "Activa" : "Inactiva"}
                        </Badge>
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">{CONDITION_LABELS[rule.condition_type]}</p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-xl font-black text-amber-600">${rule.bonus_amount}</p>
                      <p className="text-[10px] text-slate-400">{rule.period === "weekly" ? "semanal" : "mensual"}</p>
                    </div>
                  </div>
                  <div className="bg-slate-50 rounded-lg px-3 py-2 text-xs text-slate-600 mb-3">
                    Si logra <strong>{(rule.condition_type || "").includes("earnings") ? `$${rule.condition_value}` : `${rule.condition_value} viajes`}</strong>
                    {rule.city_name ? ` en ${rule.city_name}` : ""}
                    {rule.service_type_name ? ` (${rule.service_type_name})` : ""}
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" className="flex-1 rounded-lg h-8 text-xs" onClick={() => openEdit(rule)}>
                      <Edit2 className="w-3 h-3 mr-1" /> Editar
                    </Button>
                    <Button variant="ghost" size="sm" className="rounded-lg h-8 px-2 text-xs"
                      onClick={() => toggleMutation.mutate({ id: rule.id, val: !rule.is_active })}>
                      {rule.is_active ? <ToggleRight className="w-4 h-4 text-emerald-500" /> : <ToggleLeft className="w-4 h-4 text-slate-400" />}
                    </Button>
                    <Button variant="ghost" size="sm" className="rounded-lg h-8 px-2 text-xs text-red-500 hover:bg-red-50"
                      onClick={() => window.confirm("¿Eliminar esta regla?") && deleteMutation.mutate(rule.id)}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          </TabsContent>

          {/* ── LOGS TAB ── */}
          <TabsContent value="logs" className="mt-4 space-y-4">
            <div className="flex gap-2 flex-wrap">
              {["all","pending","approved","rejected","paid"].map(s => (
                <Button key={s} size="sm" variant={filterStatus === s ? "default" : "outline"}
                  onClick={() => setFilterStatus(s)}
                  className={`rounded-lg h-8 text-xs ${filterStatus === s ? "bg-slate-900" : ""}`}>
                  {s === "all" ? "Todos" : STATUS_CONFIG[s].label}
                  {s === "pending" && pendingCount > 0 && (
                    <span className="ml-1.5 bg-amber-500 text-white rounded-full text-[9px] min-w-[14px] h-3.5 flex items-center justify-center px-0.5">
                      {pendingCount}
                    </span>
                  )}
                </Button>
              ))}
            </div>

            {filteredLogs.length === 0 && (
              <div className="text-center py-16 text-slate-400">
                <Clock className="w-12 h-12 mx-auto mb-3 text-slate-200" />
                <p className="font-medium">No hay registros aún</p>
                <p className="text-sm mt-1">Calcula los bonos desde la pestaña Reglas</p>
              </div>
            )}

            <div className="space-y-3">
              {filteredLogs.map(log => (
                <Card key={log.id} className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold text-slate-900">{log.driver_name}</p>
                        <Badge className={`text-[10px] ${STATUS_CONFIG[log.status]?.className || ""}`}>
                          {STATUS_CONFIG[log.status]?.label}
                        </Badge>
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">{log.rule_name} · {log.period_label}</p>
                      <p className="text-xs text-slate-400 mt-1">
                        {CONDITION_LABELS[log.condition_type]}: logró <strong className="text-slate-600">
                          {(log.condition_type || "").includes("earnings") ? `$${log.achieved_value?.toFixed(0)}` : log.achieved_value}
                        </strong> / mínimo {(log.condition_type || "").includes("earnings") ? `$${log.condition_value}` : log.condition_value}
                        {log.city_name ? ` · ${log.city_name}` : ""}
                      </p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-xl font-black text-emerald-600">${log.bonus_amount}</p>
                      {log.status === "pending" && (
                        <div className="flex gap-1 mt-2">
                          <Button size="sm"
                            className="h-7 px-2 text-[10px] bg-emerald-500 hover:bg-emerald-600 rounded-lg"
                            onClick={() => updateLogMutation.mutate({ id: log.id, data: { status: "approved" } })}>
                            <CheckCircle2 className="w-3 h-3 mr-0.5" /> Aprobar
                          </Button>
                          <Button size="sm" variant="outline"
                            className="h-7 px-2 text-[10px] text-red-500 border-red-200 hover:bg-red-50 rounded-lg"
                            onClick={() => updateLogMutation.mutate({ id: log.id, data: { status: "rejected" } })}>
                            <XCircle className="w-3 h-3" />
                          </Button>
                        </div>
                      )}
                      {log.status === "approved" && (
                        <Button size="sm"
                          className="h-7 px-2 text-[10px] bg-blue-500 hover:bg-blue-600 rounded-lg mt-2"
                          onClick={() => updateLogMutation.mutate({ id: log.id, data: { status: "paid" } })}>
                          <DollarSign className="w-3 h-3 mr-0.5" /> Marcar pagado
                        </Button>
                      )}
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </TabsContent>
        </Tabs>

        {/* Rule create/edit dialog */}
        <Dialog open={showRuleDialog} onOpenChange={setShowRuleDialog}>
          <DialogContent className="dialog-size-xl max-h-[90vh] overflow-y-auto p-4 rounded-2xl">
            <DialogHeader>
              <DialogTitle>{editingRule ? "Editar regla" : "Nueva regla de bono"}</DialogTitle>              <DialogDescription style={{ display: 'none' }}>Gestionar reglas de bonificación para conductores</DialogDescription>            </DialogHeader>
            <div className="space-y-4 py-2">
              <div>
                <label className="text-xs font-medium text-slate-600 mb-1 block">Nombre de la regla</label>
                <Input placeholder="Ej: Bono 20 viajes semanales CDMX" value={form.name}
                  onChange={e => setForm(p => ({ ...p, name: e.target.value }))} className="rounded-xl" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-slate-600 mb-1 block">Período</label>
                  <Select value={form.period} onValueChange={v => setForm(p => ({ ...p, period: v }))}>
                    <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="weekly">Semanal</SelectItem>
                      <SelectItem value="monthly">Mensual</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-600 mb-1 block">Condición</label>
                  <Select value={form.condition_type} onValueChange={v => setForm(p => ({ ...p, condition_type: v }))}>
                    <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(CONDITION_LABELS).map(([k, v]) => (
                        <SelectItem key={k} value={k}>{v}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-slate-600 mb-1 block">
                    {(form.condition_type || "").includes("earnings") ? "Ganancias mínimas ($)" : "Viajes mínimos"}
                  </label>
                  <Input type="number" min={1} value={form.condition_value}
                    onChange={e => setForm(p => ({ ...p, condition_value: parseFloat(e.target.value) || 0 }))}
                    className="rounded-xl" />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-600 mb-1 block">Monto del bono ($)</label>
                  <Input type="number" min={1} value={form.bonus_amount}
                    onChange={e => setForm(p => ({ ...p, bonus_amount: parseFloat(e.target.value) || 0 }))}
                    className="rounded-xl" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-slate-600 mb-1 block">Ciudad (opcional)</label>
                  <Select value={form.city_id || "__all__"} onValueChange={v => {
                    const c = cities.find(x => x.id === v);
                    setForm(p => ({ ...p, city_id: v === "__all__" ? "" : v, city_name: c?.name || "" }));
                  }}>
                    <SelectTrigger className="rounded-xl"><SelectValue placeholder="Todas" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__all__">Todas las ciudades</SelectItem>
                      {cities.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-600 mb-1 block">Tipo de servicio (opcional)</label>
                  <Select value={form.service_type_id || "__all__"} onValueChange={v => {
                    const s = serviceTypes.find(x => x.id === v);
                    setForm(p => ({ ...p, service_type_id: v === "__all__" ? "" : v, service_type_name: s?.name || "" }));
                  }}>
                    <SelectTrigger className="rounded-xl"><SelectValue placeholder="Todos" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__all__">Todos los servicios</SelectItem>
                      {serviceTypes.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="bg-slate-50 rounded-xl px-4 py-3 text-sm text-slate-600">
                <AlertCircle className="w-4 h-4 inline mr-1.5 text-slate-400" />
                Si el conductor completa <strong>{(form.condition_type || "").includes("earnings") ? `$${form.condition_value}` : `${form.condition_value} viajes`}</strong>
                {form.period === "weekly" ? " en la semana" : " en el mes"}
                {form.city_name ? ` en ${form.city_name}` : ""},
                {" "}recibirá un bono de <strong className="text-emerald-600">${form.bonus_amount}</strong>.
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowRuleDialog(false)} className="rounded-xl">Cancelar</Button>
              <Button onClick={() => saveMutation.mutate(form)}
                disabled={!form.name || !form.condition_value || !form.bonus_amount || saveMutation.isPending}
                className="bg-amber-500 hover:bg-amber-600 text-white rounded-xl">
                {saveMutation.isPending ? "Guardando..." : editingRule ? "Guardar cambios" : "Crear regla"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
}
