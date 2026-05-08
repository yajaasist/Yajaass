"use client";
export const dynamic = 'force-dynamic';

import React, { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabaseApi } from "@/lib/supabaseApi";
import { toast } from "sonner";
import Layout from "@/components/admin/Layout";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Pencil, Trash2, ShieldAlert, Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";

const emptyPolicy = {
  name: "", description: "", fee_type: "fixed", fee_amount: "",
  free_cancellation_minutes: 5, applies_to_status: [], is_active: true,
};

const statusLabels = {
  assigned: "Asignado",
  en_route: "En camino",
  arrived: "Llegó",
  in_progress: "En curso",
};

export default function CancellationPoliciesPage() {
  const [editPolicy, setEditPolicy] = useState(null);
  const [showDialog, setShowDialog] = useState(false);
  const [saving, setSaving] = useState(false);
  const [waitLimitSecs, setWaitLimitSecs] = useState<number | "">("");
  const [savingWait, setSavingWait] = useState(false);
  const queryClient = useQueryClient();

  const { data: policies = [] } = useQuery({
    queryKey: ["policies"],
    queryFn: () => supabaseApi.cancellationPolicies.list(),
  });

  const { data: settingsList = [] } = useQuery({
    queryKey: ["appSettings"],
    queryFn: () => supabaseApi.settings.list(),
  });
  const settings = settingsList[0];

  // Sync slider with DB value when settings load
  React.useEffect(() => {
    if (settings?.wait_time_limit_seconds != null && waitLimitSecs === "") {
      setWaitLimitSecs(settings.wait_time_limit_seconds);
    }
  }, [settings]);

  const handleSaveWaitTime = async () => {
    if (!settings?.id) return;
    setSavingWait(true);
    try {
      await supabaseApi.settings.update(settings.id, { wait_time_limit_seconds: Number(waitLimitSecs) || 300 });
      queryClient.invalidateQueries({ queryKey: ["appSettings"] });
      toast.success("Tiempo de espera actualizado");
    } catch (err: any) {
      toast.error(err.message || "Error al guardar");
    }
    setSavingWait(false);
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      const data = {
        ...editPolicy,
        fee_amount: parseFloat(editPolicy.fee_amount) || 0,
        free_cancellation_minutes: parseInt(editPolicy.free_cancellation_minutes) || 0,
      };
      if (editPolicy.id) {
        await supabaseApi.cancellationPolicies.update(editPolicy.id, data);
        toast.success("Política actualizada");
      } else {
        await supabaseApi.cancellationPolicies.create(data);
        toast.success("Política creada");
      }
      queryClient.invalidateQueries({ queryKey: ["policies"] });
      setSaving(false);
      setShowDialog(false);
      setEditPolicy(null);
    } catch (error: any) {
      toast.error(error.message || "Error al guardar");
      setSaving(false);
    }
  };

  const handleDelete = async (p: any) => {
    if (!window.confirm(`¿Eliminar la política "${p.name}"?`)) return;
    try {
      await supabaseApi.cancellationPolicies.delete(p.id);
      queryClient.invalidateQueries({ queryKey: ["policies"] });
      toast.success("Política eliminada");
    } catch (error: any) {
      toast.error(error.message || "Error al eliminar");
    }
  };

  const toggleStatus = (status) => {
    const current = editPolicy.applies_to_status || [];
    const updated = current.includes(status) ? current.filter(s => s !== status) : [...current, status];
    setEditPolicy(prev => ({ ...prev, applies_to_status: updated }));
  };

  const update = (field, value) => setEditPolicy(prev => ({ ...prev, [field]: value }));

  return (
    <Layout currentPageName="CancellationPolicies">
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Políticas de cancelación</h1>
            <p className="text-sm text-slate-400 mt-0.5">Configura los cargos por cancelación</p>
          </div>
          <Button onClick={() => { setEditPolicy({ ...emptyPolicy }); setShowDialog(true); }} className="bg-slate-900 hover:bg-slate-800 rounded-xl">
            <Plus className="w-4 h-4 mr-2" /> Nueva política
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Wait time config card */}
          <Card className="p-6 border-0 shadow-sm md:col-span-2">
            <div className="flex items-start gap-3 mb-4">
              <div className="p-2.5 rounded-xl bg-blue-50 text-blue-600">
                <Clock className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-semibold text-slate-900">Tiempo de espera del conductor</h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Tiempo máximo de espera al llegar al punto de recogida. Cuando expire, el conductor podrá cancelar el servicio con cargo al pasajero.
                  El cargo se toma de la política activa que aplique al estado <strong>"Llegó"</strong>.
                </p>
              </div>
            </div>
            <div className="flex items-end gap-4">
              <div className="flex-1 max-w-xs">
                <Label className="text-xs text-slate-500 mb-1 block">Tiempo límite (segundos)</Label>
                <Input
                  type="number"
                  min={30}
                  step={30}
                  value={waitLimitSecs}
                  onChange={e => setWaitLimitSecs(e.target.value === "" ? "" : Number(e.target.value))}
                  placeholder="300"
                />
                {waitLimitSecs !== "" && (
                  <p className="text-xs text-slate-400 mt-1">
                    = {Math.floor(Number(waitLimitSecs) / 60)} min {Number(waitLimitSecs) % 60} seg
                  </p>
                )}
              </div>
              <Button onClick={handleSaveWaitTime} disabled={savingWait} className="bg-slate-900 hover:bg-slate-800 rounded-xl">
                {savingWait ? "Guardando..." : "Guardar"}
              </Button>
            </div>
          </Card>

          {policies.map(policy => (
            <Card key={policy.id} className="p-6 border-0 shadow-sm">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-red-50 text-red-600">
                    <ShieldAlert className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-slate-900">{policy.name}</h3>
                    <p className="text-xs text-slate-400 mt-0.5">{policy.description}</p>
                  </div>
                </div>
                <div className={`w-2 h-2 rounded-full mt-2 ${policy.is_active ? "bg-emerald-400" : "bg-slate-300"}`} />
              </div>

              <div className="grid grid-cols-2 gap-3 mb-4">
                <div className="bg-slate-50 rounded-lg p-3">
                  <p className="text-xs text-slate-400">Cargo</p>
                  <p className="font-bold text-slate-900">
                    {policy.fee_type === "fixed" ? `$${policy.fee_amount}` : `${policy.fee_amount}%`}
                  </p>
                </div>
                <div className="bg-slate-50 rounded-lg p-3">
                  <p className="text-xs text-slate-400">Cancelación gratis</p>
                  <p className="font-bold text-slate-900">{policy.free_cancellation_minutes} min</p>
                </div>
              </div>

              <div className="flex flex-wrap gap-1.5 mb-4">
                {(policy.applies_to_status || []).map(s => (
                  <Badge key={s} variant="outline" className="text-xs">{statusLabels[s] || s}</Badge>
                ))}
              </div>

              <div className="flex items-center gap-2 pt-3 border-t border-slate-100">
                <Button variant="ghost" size="sm" className="flex-1 text-xs" onClick={() => { setEditPolicy(policy); setShowDialog(true); }}>
                  <Pencil className="w-3.5 h-3.5 mr-1" /> Editar
                </Button>
                <Button variant="ghost" size="sm" className="text-xs text-red-500 hover:text-red-600" onClick={() => handleDelete(policy)}>
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            </Card>
          ))}
        </div>

        <Dialog open={showDialog} onOpenChange={v => { setShowDialog(v); if (!v) setEditPolicy(null); }}>
          <DialogContent className="dialog-size-lg max-h-[90vh] overflow-y-auto p-4">
            <DialogHeader>
              <DialogTitle>{editPolicy?.id ? "Editar política" : "Nueva política"}</DialogTitle>
              <DialogDescription style={{ display: 'none' }}>Configurar política de cancelación</DialogDescription>
            </DialogHeader>
            {editPolicy && (
              <div className="space-y-4 py-2">
                <div><Label>Nombre *</Label><Input value={editPolicy.name} onChange={e => update("name", e.target.value)} /></div>
                <div><Label>Descripción</Label><Textarea value={editPolicy.description} onChange={e => update("description", e.target.value)} rows={2} /></div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Tipo de cargo</Label>
                    <Select value={editPolicy.fee_type} onValueChange={v => update("fee_type", v)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="fixed">Monto fijo ($)</SelectItem>
                        <SelectItem value="percentage">Porcentaje (%)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div><Label>Monto *</Label><Input type="number" value={editPolicy.fee_amount} onChange={e => update("fee_amount", e.target.value)} /></div>
                </div>
                <div><Label>Minutos de cancelación gratis</Label><Input type="number" value={editPolicy.free_cancellation_minutes} onChange={e => update("free_cancellation_minutes", e.target.value)} /></div>
                <div>
                  <Label className="mb-2 block">Aplica en estados</Label>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(statusLabels).map(([key, label]) => (
                      <Badge
                        key={key}
                        variant={editPolicy.applies_to_status?.includes(key) ? "default" : "outline"}
                        className="cursor-pointer"
                        onClick={() => toggleStatus(key)}
                      >
                        {label}
                      </Badge>
                    ))}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Switch checked={editPolicy.is_active} onCheckedChange={v => update("is_active", v)} />
                  <Label>Política activa</Label>
                </div>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => { setShowDialog(false); setEditPolicy(null); }}>Cancelar</Button>
              <Button onClick={handleSave} disabled={saving || !editPolicy?.name}>
                {saving ? "Guardando..." : "Guardar"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
}
