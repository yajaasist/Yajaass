"use client"
export const dynamic = 'force-dynamic';

import React, { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabaseApi } from "@/lib/supabaseApi";
import * as bcryptjs from "bcryptjs";
import Layout from "@/components/admin/Layout";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, Trash2, Shield, Eye, EyeOff, Copy, ExternalLink, KeyRound } from "lucide-react";
import { toast } from "sonner";

const ALL_PAGES = [
  // Páginas — deben coincidir exactamente con currentPageName de cada page.tsx
  { page: "Landing", label: "Inicio (Landing)" },
  { page: "Dashboard", label: "Panel de control" },
  { page: "Analytics", label: "Analíticas" },
  { page: "LiveDrivers", label: "EN VIVO - Conductores" },
  { page: "Drivers", label: "Conductores" },
  { page: "Passengers", label: "Clientes / Pasajeros" },
  { page: "Chats", label: "Chats" },
  { page: "SOSAlerts", label: "Alertas SOS" },
  { page: "SupportTickets", label: "Tickets de soporte" },
  { page: "OfflineReconciliation", label: "Conciliación offline" },
  { page: "Notificaciones", label: "Notificaciones" },
  { page: "Anuncios", label: "Anuncios" },
  { page: "DriverEarnings", label: "Ganancias conductores" },
  { page: "Earnings", label: "Ganancias plataforma" },
  { page: "CashCutoff", label: "Corte de caja" },
  { page: "Liquidaciones", label: "Liquidaciones" },
  { page: "Invoices", label: "Facturación" },
  { page: "Bonos", label: "Bonos por desempeño" },
  { page: "Cities", label: "Ciudades" },
  { page: "ServiceTypes", label: "Tipos de servicio" },
  { page: "CancellationPolicies", label: "Cancelaciones" },
  { page: "PaymentMethods", label: "Métodos de pago" },
  { page: "GeoZones", label: "Zonas tarifarias" },
  { page: "RedZones", label: "Zonas rojas" },
  { page: "Companies", label: "Empresas (B2B)" },
  { page: "Surveys", label: "Encuestas" },
  { page: "AdminUsers", label: "Usuarios admin" },
  { page: "Settings", label: "Configuración" },
  // Permisos de acción (no son páginas, controlan acciones dentro del panel)
  { page: "edit_rides", label: "✏️ Permiso: Editar viajes" },
  { page: "delete_rides", label: "🗑️ Permiso: Eliminar viajes" },
  { page: "gasoline_services", label: "⛽ Permiso: Servicios de gasolina" },
];

const ROLE_LABELS = { admin: "Administrador", operator: "Operador", viewer: "Visualizador" };
const ROLE_COLORS = { admin: "bg-red-100 text-red-700", operator: "bg-blue-100 text-blue-700", viewer: "bg-slate-100 text-slate-600" };

export default function AdminUsersPage() {
  const queryClient = useQueryClient();
  const [showDialog, setShowDialog] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [showPassId, setShowPassId] = useState<string | null>(null);

  const { data: users = [] } = useQuery({
    queryKey: ["adminUsers"],
    queryFn: async () => {
      try {
        return await supabaseApi.adminUsers.list();
      } catch (error) {
        console.error("Error fetching admin users:", error);
        return [];
      }
    },
  });

  const emptyUser = {
    email: "",
    full_name: "",
    role: "operator",
    password: "",
    allowed_pages: ALL_PAGES.map((p) => p.page),
    is_active: true,
  };

  const loginLink = typeof window !== "undefined" ? `${window.location.origin}/admin-login` : "";

  const copyLoginLink = () => {
    navigator.clipboard.writeText(loginLink);
    toast.success("Enlace copiado al portapapeles");
  };

  const openNew = () => {
    setEditing({ ...emptyUser });
    setShowDialog(true);
  };

  const openEdit = (u: any) => {
    const savedPages = Array.isArray(u.allowed_pages) ? u.allowed_pages : ALL_PAGES.map((p) => p.page);
    setEditing({ ...u, allowed_pages: savedPages });
    setShowDialog(true);
  };

  const togglePage = (page: string) => {
    setEditing((prev: any) => {
      const pages = prev.allowed_pages || [];
      return {
        ...prev,
        allowed_pages: pages.includes(page) ? pages.filter((p: string) => p !== page) : [...pages, page],
      };
    });
  };

  const selectAll = () => setEditing((prev: any) => ({ ...prev, allowed_pages: ALL_PAGES.map((p) => p.page) }));
  const selectNone = () => setEditing((prev: any) => ({ ...prev, allowed_pages: [] }));

  const handleSave = async () => {
    if (!editing?.email || !editing?.full_name) {
      toast.error("Email y nombre son requeridos");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        email: editing.email?.trim().toLowerCase(),
        full_name: editing.full_name?.trim(),
        role: editing.role,
        allowed_pages: editing.allowed_pages || [],
        is_active: editing.is_active !== false,
      };

      if (editing.password) {
        const hash = await bcryptjs.hash(editing.password, 10);
        Object.assign(payload, { password_hash: hash });
      }

      if (editing.id) {
        await supabaseApi.adminUsers.update(editing.id, payload);
      } else {
        if (!editing.password) {
          toast.error("La contraseña es requerida para nuevos usuarios");
          setSaving(false);
          return;
        }
        const hash = await bcryptjs.hash(editing.password, 10);
        await supabaseApi.adminUsers.create({ ...payload, password_hash: hash });
      }

      queryClient.invalidateQueries({ queryKey: ["adminUsers"] });
      setShowDialog(false);
      setEditing(null);
      toast.success("Usuario guardado correctamente");
    } catch (error: any) {
      toast.error(error.message || "Error al guardar usuario");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (u: any) => {
    try {
      await supabaseApi.adminUsers.delete(u.id);
      queryClient.invalidateQueries({ queryKey: ["adminUsers"] });
      toast.success("Usuario eliminado correctamente");
    } catch (error: any) {
      toast.error(error.message || "Error al eliminar usuario");
    }
  };

  const up = (field: string, val: any) => setEditing((prev: any) => ({ ...prev, [field]: val }));

  return (
    <Layout currentPageName="AdminUsers">
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Usuarios del panel</h1>
            <p className="text-sm text-slate-400 mt-0.5">Gestiona el acceso al panel administrativo</p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button variant="outline" onClick={copyLoginLink} className="rounded-xl gap-2">
              <Copy className="w-4 h-4" /> Copiar enlace de login
            </Button>
            <Button onClick={openNew} className="bg-slate-900 hover:bg-slate-800 rounded-xl">
              <Plus className="w-4 h-4 mr-2" /> Nuevo usuario
            </Button>
          </div>
        </div>

        {/* Login link preview */}
        {loginLink && (
          <Card className="p-4 border border-blue-100 bg-blue-50/50">
            <div className="flex items-center gap-3">
              <ExternalLink className="w-4 h-4 text-blue-500 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-blue-700 mb-0.5">Enlace de acceso para usuarios admin</p>
                <p className="text-xs text-blue-500 truncate">{loginLink}</p>
              </div>
              <Button size="sm" variant="outline" className="text-blue-600 border-blue-200 hover:bg-blue-100 flex-shrink-0" onClick={copyLoginLink}>
                <Copy className="w-3.5 h-3.5 mr-1" /> Copiar
              </Button>
            </div>
          </Card>
        )}

        {/* Users grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {users.map((u: any) => (
            <Card key={u.id} className="p-5 border-0 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center font-bold text-slate-600 text-sm">
                    {u.full_name?.charAt(0) || "?"}
                  </div>
                  <div>
                    <p className="font-semibold text-slate-900 text-sm">{u.full_name}</p>
                    <p className="text-xs text-slate-400">{u.email}</p>
                  </div>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ROLE_COLORS[u.role] || ROLE_COLORS.viewer}`}>
                  {ROLE_LABELS[u.role] || u.role}
                </span>
              </div>
              <div className="mb-3">
                <p className="text-xs text-slate-400 mb-1.5">Acceso a páginas:</p>
                <div className="flex flex-wrap gap-1">
                  {(u.allowed_pages || [])
                    .slice(0, 5)
                    .map((p: string) => {
                      const pg = ALL_PAGES.find((x) => x.page === p);
                      return pg ? (
                        <Badge key={p} variant="outline" className="text-xs py-0 px-1.5">
                          {pg.label}
                        </Badge>
                      ) : null;
                    })}
                  {(u.allowed_pages || []).length > 5 && (
                    <Badge variant="outline" className="text-xs py-0 px-1.5 bg-slate-50">
                      +{(u.allowed_pages || []).length - 5}
                    </Badge>
                  )}
                </div>
              </div>
              <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                <div className="flex items-center gap-1.5">
                  <div className={`w-1.5 h-1.5 rounded-full ${u.is_active ? "bg-emerald-400" : "bg-slate-300"}`} />
                  <span className="text-xs text-slate-400">{u.is_active ? "Activo" : "Inactivo"}</span>
                </div>
                <div className="flex gap-1">
                  <Button variant="ghost" size="sm" className="h-7 px-2 text-xs text-slate-500 hover:text-slate-800" onClick={() => openEdit(u)}>
                    <Pencil className="w-3.5 h-3.5 mr-1" /> Editar
                  </Button>
                  <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-red-400 hover:text-red-600" onClick={() => handleDelete(u)}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            </Card>
          ))}
          {users.length === 0 && (
            <div className="col-span-3 text-center py-16 text-slate-400">
              <Shield className="w-10 h-10 mx-auto mb-2 opacity-40" />
              <p className="text-sm">No hay usuarios configurados</p>
            </div>
          )}
        </div>

        {/* Edit dialog */}
        <Dialog open={showDialog} onOpenChange={(v) => { setShowDialog(v); if (!v) setEditing(null); }}>
          <DialogContent className="dialog-size-2xl max-h-[90vh] overflow-y-auto p-4">
            <DialogHeader>
              <DialogTitle>{editing?.id ? "Editar usuario" : "Nuevo usuario"}</DialogTitle>              <DialogDescription style={{ display: 'none' }}>Formulario para gestionar usuario administrador</DialogDescription>            </DialogHeader>
            {editing && (
              <div className="space-y-4 py-2">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Nombre *</Label>
                    <Input value={editing.full_name} onChange={(e) => up("full_name", e.target.value)} />
                  </div>
                  <div>
                    <Label>Correo *</Label>
                    <Input type="email" value={editing.email} onChange={(e) => up("email", e.target.value)} />
                  </div>
                </div>
                <div>
                  <Label className="flex items-center gap-1.5">
                    <KeyRound className="w-3.5 h-3.5" /> Contraseña
                  </Label>
                  <div className="relative mt-1">
                    <Input
                      type={showPassId === "edit" ? "text" : "password"}
                      value={editing.password || ""}
                      onChange={(e) => up("password", e.target.value)}
                      placeholder={editing.id ? "Dejar vacío para no cambiar" : "Contraseña de acceso"}
                      className="pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassId(showPassId === "edit" ? null : "edit")}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      {showPassId === "edit" ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  <p className="text-xs text-slate-400 mt-1">Si dejas vacío, el usuario debe cambiar contraseña en primer acceso.</p>
                </div>
                <div>
                  <Label>Rol</Label>
                  <select
                    className="w-full border border-slate-200 rounded-md p-2 text-sm mt-1"
                    value={editing.role}
                    onChange={(e) => up("role", e.target.value)}
                  >
                    <option value="admin">Administrador (acceso total)</option>
                    <option value="operator">Operador</option>
                    <option value="viewer">Visualizador (solo lectura)</option>
                  </select>
                </div>
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <Label>Páginas permitidas</Label>
                    <div className="flex gap-2">
                      <button onClick={selectAll} className="text-xs text-blue-600 hover:underline">
                        Todas
                      </button>
                      <span className="text-slate-300">|</span>
                      <button onClick={selectNone} className="text-xs text-slate-500 hover:underline">
                        Ninguna
                      </button>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 bg-slate-50 rounded-xl p-3">
                    {ALL_PAGES.map((pg) => (
                      <label key={pg.page} className="flex items-center gap-2 cursor-pointer text-sm text-slate-700 hover:text-slate-900">
                        <input
                          type="checkbox"
                          checked={(editing.allowed_pages || []).includes(pg.page)}
                          onChange={() => togglePage(pg.page)}
                          className="rounded"
                        />
                        {pg.label}
                      </label>
                    ))}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Switch checked={editing.is_active} onCheckedChange={(v) => up("is_active", v)} />
                  <Label>Usuario activo</Label>
                </div>
              </div>
            )}
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setShowDialog(false);
                  setEditing(null);
                }}
              >
                Cancelar
              </Button>
              <Button onClick={handleSave} disabled={saving || !editing?.email || !editing?.full_name}>
                {saving ? "Guardando..." : "Guardar"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
}
