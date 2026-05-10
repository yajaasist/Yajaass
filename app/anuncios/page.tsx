"use client";
export const dynamic = 'force-dynamic';

import React, { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabaseApi } from "@/lib/supabaseApi";
import Layout from "@/components/admin/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Megaphone, Plus, Pencil, Trash2, Clock, Users } from "lucide-react";
import { toast } from "sonner";
import { formatCDMX, systemLocalToISO } from "@/components/shared/dateUtils";

const AUDIENCE_LABELS = { drivers: "Conductores", passengers: "Pasajeros", all: "Todos" };
const AUDIENCE_COLORS = { drivers: "bg-blue-100 text-blue-700", passengers: "bg-violet-100 text-violet-700", all: "bg-emerald-100 text-emerald-700" };

const EMPTY = {
  title: "", body: "", image_url: "", target_audience: "drivers",
  filter_city_id: "", filter_city_name: "", filter_service_type_id: "", filter_service_type_name: "",
  show_from: "", expires_at: "", is_active: true,
};

function AnunciosContent() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [editId, setEditId] = useState(null);
  const [saving, setSaving] = useState(false);

  const { data: announcements = [] } = useQuery({
    queryKey: ["announcements"],
    queryFn: () => supabaseApi.announcements.list(),
    staleTime: 30 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
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
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });

  const openCreate = () => { setForm(EMPTY); setEditId(null); setOpen(true); };
  const openEdit = (a) => {
    setForm({
      title: a.title || "", body: a.body || "", image_url: a.image_url || "",
      target_audience: a.target_audience || "drivers",
      filter_city_id: a.filter_city_id || "", filter_city_name: a.filter_city_name || "",
      filter_service_type_id: a.filter_service_type_id || "", filter_service_type_name: a.filter_service_type_name || "",
      show_from: a.show_from ? a.show_from.slice(0, 16) : "",
      expires_at: a.expires_at ? a.expires_at.slice(0, 16) : "",
      is_active: a.is_active !== false,
    });
    setEditId(a.id);
    setOpen(true);
  };

  const handleSave = async () => {
    if (!form.title.trim() || !form.body.trim()) { toast.error("Título y mensaje son obligatorios"); return; }
    setSaving(true);
    try {
      const data = {
        title: form.title,
        body: form.body,
        image_url: form.image_url,
        target_audience: form.target_audience,
        filter_city_id: form.filter_city_id || null,
        filter_city_name: form.filter_city_name || null,
        filter_service_type_id: form.filter_service_type_id || null,
        filter_service_type_name: form.filter_service_type_name || null,
        show_from: form.show_from ? systemLocalToISO(form.show_from) : null,
        expires_at: form.expires_at ? systemLocalToISO(form.expires_at) : null,
        is_active: form.is_active,
      };
      if (editId) {
        await supabaseApi.announcements.update(editId, data);
        toast.success("Anuncio actualizado");
      } else {
        await supabaseApi.announcements.create(data);
        toast.success("Anuncio creado");
      }
      qc.invalidateQueries({ queryKey: ["announcements"] });
      setSaving(false);
      setOpen(false);
    } catch (error: any) {
      toast.error(error.message || "Error al guardar");
      setSaving(false);
    }
  };

  const handleDelete = async (a: any) => {
    if (!window.confirm(`¿Eliminar el anuncio "${a.title}"?`)) return;
    try {
      await supabaseApi.announcements.delete(a.id);
      qc.invalidateQueries({ queryKey: ["announcements"] });
      toast.success("Anuncio eliminado");
    } catch (error: any) {
      toast.error(error.message || "Error al eliminar");
    }
  };

  const handleToggle = async (a: any) => {
    try {
      await supabaseApi.announcements.update(a.id, { is_active: !a.is_active });
      qc.invalidateQueries({ queryKey: ["announcements"] });
    } catch (error: any) {
      toast.error(error.message || "Error al actualizar");
    }
  };

  const now = new Date();
  const active = announcements.filter(a => {
    if (!a.is_active) return false;
    if (a.expires_at && new Date(a.expires_at) < now) return false;
    if (a.show_from && new Date(a.show_from) > now) return false;
    return true;
  });
  const inactive = announcements.filter(a => !active.includes(a));

  const setCity = (val) => {
    if (val === "all") { setForm(f => ({ ...f, filter_city_id: "", filter_city_name: "" })); return; }
    const city = cities.find(c => c.id === val);
    setForm(f => ({ ...f, filter_city_id: val, filter_city_name: city?.name || "" }));
  };

  const setService = (val) => {
    if (val === "all") { setForm(f => ({ ...f, filter_service_type_id: "", filter_service_type_name: "" })); return; }
    const svc = serviceTypes.find(s => s.id === val);
    setForm(f => ({ ...f, filter_service_type_id: val, filter_service_type_name: svc?.name || "" }));
  };

  return (
    <div className="space-y-6">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500 flex items-center justify-center">
              <Megaphone className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Anuncios</h1>
              <p className="text-sm text-slate-500">{active.length} activo{active.length !== 1 ? "s" : ""} · {announcements.length} total</p>
            </div>
          </div>
          <Button onClick={openCreate} className="bg-amber-500 hover:bg-amber-600 text-white rounded-xl">
            <Plus className="w-4 h-4 mr-2" /> Nuevo anuncio
          </Button>
        </div>

        {/* Active */}
        {active.length > 0 && (
          <div className="space-y-3">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Activos ahora</p>
            {active.map(a => <AnnouncementCard key={a.id} a={a} onEdit={openEdit} onDelete={handleDelete} onToggle={handleToggle} />)}
          </div>
        )}

        {/* Inactive */}
        {inactive.length > 0 && (
          <div className="space-y-3">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Inactivos / vencidos / programados</p>
            {inactive.map(a => <AnnouncementCard key={a.id} a={a} onEdit={openEdit} onDelete={handleDelete} onToggle={handleToggle} />)}
          </div>
        )}

        {announcements.length === 0 && (
          <div className="text-center py-16 text-slate-400">
            <Megaphone className="w-10 h-10 mx-auto mb-2 opacity-30" />
            <p className="text-sm">Sin anuncios aún. Crea el primero.</p>
          </div>
        )}

        {/* Dialog */}
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent className="dialog-size-2xl max-h-[90vh] overflow-y-auto p-4">
            <DialogHeader>
              <DialogTitle>{editId ? "Editar anuncio" : "Nuevo anuncio"}</DialogTitle>              <DialogDescription style={{ display: 'none' }}>Crear o editar anuncio del sistema</DialogDescription>            </DialogHeader>
            <div className="space-y-4 py-2">
              <div>
                <Label>Título *</Label>
                <Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="Ej: ¡Promoción especial este fin de semana!" className="mt-1" maxLength={80} />
              </div>
              <div>
                <Label>Mensaje *</Label>
                <Textarea value={form.body} onChange={e => setForm(f => ({ ...f, body: e.target.value }))} placeholder="Describe el anuncio..." rows={3} className="mt-1" maxLength={500} />
              </div>
              <div>
                <Label>Imagen (URL)</Label>
                <div className="mt-1 space-y-2">
                  {form.image_url && <img src={form.image_url} alt="Preview" className="w-full h-32 object-cover rounded-xl border" />}
                  <Input 
                    value={form.image_url} 
                    onChange={e => setForm(f => ({ ...f, image_url: e.target.value }))} 
                    placeholder="Pega la URL de la imagen aquí (ej: https://...)"
                    className="text-xs"
                  />
                  {form.image_url && <Button variant="ghost" size="sm" className="text-red-400 h-7" onClick={() => setForm(f => ({ ...f, image_url: "" }))}>Quitar imagen</Button>}
                </div>
              </div>
              <div>
                <Label>Dirigido a</Label>
                <Select value={form.target_audience} onValueChange={v => setForm(f => ({ ...f, target_audience: v }))}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="drivers">Conductores</SelectItem>
                    <SelectItem value="passengers">Pasajeros</SelectItem>
                    <SelectItem value="all">Todos</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Filtrar por ciudad</Label>
                  <Select value={form.filter_city_id || "all"} onValueChange={setCity}>
                    <SelectTrigger className="mt-1"><SelectValue placeholder="Todas" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todas las ciudades</SelectItem>
                      {cities.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Filtrar por servicio</Label>
                  <Select value={form.filter_service_type_id || "all"} onValueChange={setService}>
                    <SelectTrigger className="mt-1"><SelectValue placeholder="Todos" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos los servicios</SelectItem>
                      {serviceTypes.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="flex items-center gap-1"><Clock className="w-3 h-3" /> Mostrar desde</Label>
                  <Input type="datetime-local" value={form.show_from} onChange={e => setForm(f => ({ ...f, show_from: e.target.value }))} className="mt-1" />
                </div>
                <div>
                  <Label className="flex items-center gap-1"><Clock className="w-3 h-3" /> Expira el</Label>
                  <Input type="datetime-local" value={form.expires_at} onChange={e => setForm(f => ({ ...f, expires_at: e.target.value }))} className="mt-1" />
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Switch checked={form.is_active} onCheckedChange={v => setForm(f => ({ ...f, is_active: v }))} />
                <Label>Activo</Label>
              </div>
              {/* Preview */}
              {(form.title || form.body) && (
                <div className="rounded-xl border border-amber-200 bg-amber-50 overflow-hidden">
                  {form.image_url && <img src={form.image_url} alt="" className="w-full h-28 object-cover" />}
                  <div className="p-3">
                    <p className="font-bold text-slate-800 text-sm">{form.title || "Sin título"}</p>
                    <p className="text-xs text-slate-600 mt-0.5">{form.body || "Sin mensaje"}</p>
                    {form.target_audience && <Badge className={`mt-1.5 text-xs ${AUDIENCE_COLORS[form.target_audience]}`}>{AUDIENCE_LABELS[form.target_audience]}</Badge>}
                  </div>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
              <Button onClick={handleSave} disabled={saving} className="bg-amber-500 hover:bg-amber-600 text-white">
                {saving ? "Guardando..." : editId ? "Guardar cambios" : "Crear anuncio"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
    </div>
  );
}

export default function AnunciosPage() {
  return (
    <Layout currentPageName="Anuncios">
      <AnunciosContent />
    </Layout>
  );
}

function AnnouncementCard({ a, onEdit, onDelete, onToggle }) {
  const now = new Date();
  const expired = a.expires_at && new Date(a.expires_at) < now;
  const scheduled = a.show_from && new Date(a.show_from) > now;
  return (
    <div className={`rounded-xl border overflow-hidden shadow-sm ${!a.is_active || expired ? "opacity-60" : ""}`}>
      {a.image_url && <img src={a.image_url} alt="" className="w-full h-28 object-cover" />}
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap gap-1.5 mb-1.5">
              <Badge className={`text-xs ${AUDIENCE_COLORS[a.target_audience] || "bg-slate-100 text-slate-600"}`}>
                <Users className="w-3 h-3 mr-1" />{AUDIENCE_LABELS[a.target_audience] || a.target_audience}
              </Badge>
              {a.filter_city_name && <Badge variant="outline" className="text-xs">{a.filter_city_name}</Badge>}
              {a.filter_service_type_name && <Badge variant="outline" className="text-xs">{a.filter_service_type_name}</Badge>}
              {expired && <Badge className="text-xs bg-red-100 text-red-600">Vencido</Badge>}
              {scheduled && <Badge className="text-xs bg-slate-100 text-slate-500">Programado</Badge>}
              {!expired && !scheduled && a.is_active && <Badge className="text-xs bg-emerald-100 text-emerald-700">Activo</Badge>}
            </div>
            <p className="font-semibold text-slate-900 text-sm">{a.title}</p>
            <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{a.body}</p>
            <div className="flex gap-3 mt-1.5 text-[10px] text-slate-400">
              {a.show_from && <span>Desde: {formatCDMX(a.show_from, "shortdatetime")}</span>}
              {a.expires_at && <span>Expira: {formatCDMX(a.expires_at, "shortdatetime")}</span>}
            </div>
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            <Switch checked={!!a.is_active} onCheckedChange={() => onToggle(a)} />
            <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-blue-500" onClick={() => onEdit(a)}>
              <Pencil className="w-3.5 h-3.5" />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-red-500" onClick={() => onDelete(a)}>
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
