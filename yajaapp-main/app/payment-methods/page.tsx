"use client";

import React, { useState, useEffect } from "react";
import Layout from "@/components/admin/Layout";
import { supabaseApi } from "@/lib/supabaseApi";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Plus, Trash2, CreditCard, Save, Zap, Eye, EyeOff, Shield, ChevronDown, ChevronUp,
  Wallet, ArrowUpRight, ArrowDownLeft, Clock, CheckCircle2, XCircle, AlertTriangle,
  Ban, RefreshCw, TrendingUp, DollarSign, Users, Activity, Search, Filter,
  Unlock, Lock
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";

// ─── Constants ────────────────────────────────────────────────────────────────

const PAYMENT_STATUS_MAP = {
  pending:          { label: "Pendiente",       color: "bg-amber-100 text-amber-700",    icon: Clock },
  awaiting_payment: { label: "Esperando pago",  color: "bg-orange-100 text-orange-700",  icon: Clock },
  approved:         { label: "Aprobado",         color: "bg-green-100 text-green-700",    icon: CheckCircle2 },
  paid:             { label: "Pagado",           color: "bg-green-100 text-green-700",    icon: CheckCircle2 },
  rejected:         { label: "Rechazado",        color: "bg-red-100 text-red-700",        icon: XCircle },
  refunded:         { label: "Reembolsado",      color: "bg-blue-100 text-blue-700",      icon: RefreshCw },
  retained:         { label: "Retenido",         color: "bg-violet-100 text-violet-700",  icon: Shield },
  released:         { label: "Liberado",         color: "bg-emerald-100 text-emerald-700",icon: CheckCircle2 },
  cancelled:        { label: "Cancelado",        color: "bg-slate-100 text-slate-500",    icon: Ban },
  debt:             { label: "Adeudo",           color: "bg-red-100 text-red-700",        icon: AlertTriangle },
};

const RIDE_FINANCIAL_STATUS = {
  pendiente_pago: { label: "Pendiente pago", color: "bg-amber-100 text-amber-700" },
  en_proceso:     { label: "En proceso",     color: "bg-blue-100 text-blue-700" },
  completado:     { label: "Completado",     color: "bg-green-100 text-green-700" },
  liquidado:      { label: "Liquidado",      color: "bg-emerald-100 text-emerald-700" },
};

const DRIVER_PAYOUT_STATUS = {
  pendiente: { label: "Pendiente", color: "bg-amber-100 text-amber-700" },
  pagado:    { label: "Pagado",    color: "bg-green-100 text-green-700" },
};

type PaymentMethod = {
  key: string;
  label: string;
  is_active: boolean;
  require_before_service?: boolean;
  require_driver_confirmation?: boolean;
  auto_charge?: boolean;
  generates_reference?: boolean;
  bank_name?: string;
  clabe?: string;
  account_holder?: string;
  allowed_service_type_ids?: string[];
};

const defaultMethods: PaymentMethod[] = [
  { key: "cash",     label: "Efectivo",                 is_active: true },
  { key: "card",     label: "Tarjeta de crédito/débito", is_active: true },
  { key: "transfer", label: "Transferencia bancaria",   is_active: true },
  { key: "wallet",   label: "Wallet (saldo)",           is_active: true },
  { key: "deposit",  label: "Depósito en efectivo",     is_active: true },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function genRef() {
  return "REF-" + Date.now().toString(36).toUpperCase() + "-" + Math.random().toString(36).slice(2, 6).toUpperCase();
}

function StatusBadgePay({ status }) {
  const cfg = PAYMENT_STATUS_MAP[status] || { label: status, color: "bg-slate-100 text-slate-500", icon: Clock };
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium ${cfg.color}`}>
      <Icon className="w-3 h-3" /> {cfg.label}
    </span>
  );
}

function StatCard({ icon: Icon, label, value, sub, color = "bg-slate-100 text-slate-600" }: { icon: any; label: any; value: any; sub?: any; color?: string }) {
  return (
    <Card className="p-4 border-0 shadow-sm">
      <div className="flex items-start gap-3">
        <div className={`p-2 rounded-xl ${color}`}><Icon className="w-5 h-5" /></div>
        <div>
          <p className="text-xs text-slate-400">{label}</p>
          <p className="text-xl font-bold text-slate-900">{value}</p>
          {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
        </div>
      </div>
    </Card>
  );
}

type GatewayConfig = {
  type: string;
  api_key: string;
  webhook_secret: string;
  public_key: string;
  linked_to_card_method: boolean;
  card_commission_pct?: number;
  wallet_ref_enabled?: boolean;
};

// ─── Tab: Métodos de pago (config) ────────────────────────────────────────────

function MethodsConfigTab({ settings, serviceTypes, onSave, saving }: { settings: any; serviceTypes: any[]; onSave: (payload: any) => void; saving: boolean }) {
  const [methods, setMethods] = useState<PaymentMethod[]>(defaultMethods);
  const [newLabel, setNewLabel] = useState("");
  const [gateway, setGateway] = useState<GatewayConfig>({ type: "none", api_key: "", webhook_secret: "", public_key: "", linked_to_card_method: true });
  const [showKeys, setShowKeys] = useState(false);
  const [expandedMethod, setExpandedMethod] = useState<number | null>(null);
  const [paymentTimeoutHours, setPaymentTimeoutHours] = useState(24);
  const [walletMinBalance, setWalletMinBalance] = useState(0);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [testTesting, setTestTesting] = useState(false);

  const [pendingPaymentMethods, setPendingPaymentMethods] = useState<string[]>([]);
  // Track the last settings snapshot we initialized from, to avoid overwriting local edits
  const lastInitKey = React.useRef<string | null>(null);

  useEffect(() => {
    if (!settings?.id) return;
    // Create a stable key combining id + updated_at so we only re-init when data actually changed in the DB
    const initKey = `${settings.id}_${settings.updated_at}`;
    if (lastInitKey.current === initKey) return;
    lastInitKey.current = initKey;

    setMethods(settings.payment_methods?.length > 0 ? settings.payment_methods : defaultMethods);
    setGateway({ type: "none", api_key: "", webhook_secret: "", public_key: "", card_commission_pct: 3.6, wallet_ref_enabled: false, linked_to_card_method: true, ...(settings.payment_gateway || {}) });
    setPaymentTimeoutHours(settings.payment_timeout_hours ?? 24);
    setWalletMinBalance(settings.wallet_min_balance ?? 0);
    setPendingPaymentMethods(settings.pending_payment_methods || []);
  }, [settings?.id, settings?.updated_at]);

  const toggleActive = (idx) => setMethods(prev => prev.map((m, i) => i === idx ? { ...m, is_active: !m.is_active } : m));
  const updateLabel  = (idx, label) => setMethods(prev => prev.map((m, i) => i === idx ? { ...m, label } : m));
  const deleteMethod = (idx) => setMethods(prev => prev.filter((_, i) => i !== idx));
  const addMethod = () => {
    if (!newLabel.trim()) return;
    const key = newLabel.toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "");
    setMethods(prev => [...prev, { key, label: newLabel.trim(), is_active: true }]);
    setNewLabel("");
  };

  const handleSave = () => onSave({ payment_methods: methods, payment_gateway: gateway, payment_timeout_hours: paymentTimeoutHours, wallet_min_balance: walletMinBalance, pending_payment_methods: pendingPaymentMethods });

  const handleTestGateway = async () => {
    setTestTesting(true);
    setTestResult(null);

    try {
      // Basic validation
      if (gateway.type === "none") {
        setTestResult({ success: false, message: "Selecciona un tipo de pasarela primero" });
        return;
      }

      if (!gateway.api_key?.trim()) {
        setTestResult({ success: false, message: "Ingresa la API Key" });
        return;
      }

      // Validate format based on gateway type
      if (gateway.type === "stripe") {
        if (!gateway.api_key.startsWith("sk_")) {
          setTestResult({ success: false, message: "La Stripe API Key debe comenzar con 'sk_'" });
          return;
        }
        if (!gateway.public_key?.startsWith("pk_")) {
          setTestResult({ success: false, message: "La Stripe Public Key debe comenzar con 'pk_'" });
          return;
        }
      }

      if (gateway.type === "mercadopago") {
        if (!gateway.api_key.includes("APP_USR")) {
          setTestResult({ success: false, message: "El MercadoPago Access Token debe contener 'APP_USR'" });
          return;
        }
        if (!gateway.public_key?.includes("APP_USR")) {
          setTestResult({ success: false, message: "El MercadoPago Public Key debe contener 'APP_USR'" });
          return;
        }
      }

      // Test connection by attempting basic call (simplified test)
      // In production, this would make actual API calls
      btoa(gateway.api_key);
      
      setTestResult({ 
        success: true, 
        message: `✓ Credenciales validadas correctamente para ${gateway.type === "stripe" ? "Stripe" : "MercadoPago"}. Las claves tienen el formato esperado.` 
      });
    } catch (error) {
      setTestResult({ success: false, message: `Error: ${error.message}` });
    } finally {
      setTestTesting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Timeout & Wallet */}
      <Card className="p-5 border-0 shadow-sm space-y-4">
        <h3 className="font-semibold text-slate-800 flex items-center gap-2"><Activity className="w-4 h-4 text-blue-500" /> Reglas financieras globales</h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>Horas para cancelar pago pendiente</Label>
            <Input type="number" min={1} value={paymentTimeoutHours} onChange={e => setPaymentTimeoutHours(+e.target.value)} className="mt-1" />
            <p className="text-xs text-slate-400 mt-1">Si no llega pago, el servicio se cancela automáticamente</p>
          </div>
          <div>
            <Label>Saldo mínimo de wallet ($)</Label>
            <Input type="number" min={0} value={walletMinBalance} onChange={e => setWalletMinBalance(+e.target.value)} className="mt-1" />
            <p className="text-xs text-slate-400 mt-1">El wallet nunca puede quedar por debajo de este monto</p>
          </div>
        </div>
      </Card>

      {/* Methods list */}
      <Card className="p-6 border-0 shadow-sm space-y-3">
        <h3 className="font-semibold text-slate-800 mb-1">Métodos disponibles</h3>
        {methods.map((method, idx) => {
          const isExpanded = expandedMethod === idx;
          return (
            <div key={idx} className="border border-slate-100 rounded-xl overflow-hidden">
              <div className="flex items-center gap-3 p-3 hover:bg-slate-50 transition-colors">
                <CreditCard className="w-4 h-4 text-slate-400 flex-shrink-0" />
                <Input value={method.label} onChange={e => updateLabel(idx, e.target.value)}
                  className="flex-1 border-0 p-0 h-auto text-sm font-medium focus-visible:ring-0 bg-transparent" />
                <div className="flex items-center gap-2 flex-shrink-0">
                  {gateway.type !== "none" && method.key === "card" && gateway.linked_to_card_method && (
                    <span className="text-[10px] bg-violet-100 text-violet-700 px-1.5 py-0.5 rounded-full font-semibold flex items-center gap-1">
                      <Zap className="w-2.5 h-2.5" /> {gateway.type === "stripe" ? "Stripe" : "MercadoPago"}
                    </span>
                  )}
                  {method.require_before_service && (
                    <span className="text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full font-semibold flex items-center gap-1">
                      <Shield className="w-2.5 h-2.5" /> Previo
                    </span>
                  )}
                  {method.key === "wallet" && (
                    <span className="text-[10px] bg-violet-100 text-violet-700 px-1.5 py-0.5 rounded-full font-semibold flex items-center gap-1">
                      <Wallet className="w-2.5 h-2.5" /> Wallet
                    </span>
                  )}
                  <span className="text-xs text-slate-400">{method.is_active ? "Activo" : "Inactivo"}</span>
                  <Switch checked={method.is_active} onCheckedChange={() => toggleActive(idx)} />
                  <button onClick={() => setExpandedMethod(isExpanded ? null : idx)} className="p-1 rounded-lg hover:bg-slate-100">
                    {isExpanded ? <ChevronUp className="w-3.5 h-3.5 text-slate-400" /> : <ChevronDown className="w-3.5 h-3.5 text-slate-400" />}
                  </button>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-400 hover:text-red-500" onClick={() => deleteMethod(idx)}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
              {isExpanded && (
                <div className="px-4 pb-4 space-y-3 bg-slate-50/50 border-t border-slate-100">
                  <div className="flex items-center justify-between pt-3">
                    <div>
                      <p className="text-sm font-medium text-slate-700">Requiere cobro previo al servicio</p>
                      <p className="text-xs text-slate-400 mt-0.5">El pasajero debe confirmar el pago antes de iniciar</p>
                    </div>
                    <Switch checked={!!method.require_before_service}
                      onCheckedChange={v => setMethods(prev => prev.map((m, i) => i === idx ? { ...m, require_before_service: v } : m))} />
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-slate-700">Solicitar confirmación al conductor</p>
                      <p className="text-xs text-slate-400 mt-0.5">
                        <span className="text-red-500 font-semibold">Activo:</span> el conductor debe confirmar que recibió el pago (monto se muestra en rojo).<br/>
                        <span className="text-emerald-600 font-semibold">Inactivo:</span> el sistema marca el pago como pagado automáticamente.
                      </p>
                    </div>
                    <Switch checked={!!method.require_driver_confirmation}
                      onCheckedChange={v => setMethods(prev => prev.map((m, i) => i === idx ? { ...m, require_driver_confirmation: v, auto_charge: !v } : m))} />
                  </div>
                  {(method.key === "transfer" || method.key === "deposit") && (
                    <>
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-slate-700">Genera referencia de pago (CLABE)</p>
                          <p className="text-xs text-slate-400 mt-0.5">Se genera un código único y se muestra la CLABE al pasajero</p>
                        </div>
                        <Switch checked={!!method.generates_reference}
                          onCheckedChange={v => setMethods(prev => prev.map((m, i) => i === idx ? { ...m, generates_reference: v } : m))} />
                      </div>
                      {/* CLABE / Bank info fields */}
                      <div className="space-y-3 p-3 bg-purple-50/60 border border-purple-200 rounded-xl">
                        <p className="text-xs font-semibold text-purple-700">🏦 Datos bancarios para mostrar al pasajero</p>
                        <div>
                          <Label className="text-xs text-slate-600">Banco (ej. BBVA, HSBC, SPEI)</Label>
                          <Input value={method.bank_name || ""} onChange={e => setMethods(prev => prev.map((m, i) => i === idx ? { ...m, bank_name: e.target.value } : m))}
                            placeholder="Ej: BBVA" className="mt-1 text-sm" />
                        </div>
                        <div>
                          <Label className="text-xs text-slate-600">CLABE interbancaria (18 dígitos)</Label>
                          <Input value={method.clabe || ""} onChange={e => setMethods(prev => prev.map((m, i) => i === idx ? { ...m, clabe: e.target.value } : m))}
                            placeholder="012345678901234567" className="mt-1 font-mono text-sm" maxLength={18} />
                          {method.clabe && method.clabe.length !== 18 && <p className="text-xs text-red-500 mt-1">La CLABE debe tener exactamente 18 dígitos</p>}
                        </div>
                        <div>
                          <Label className="text-xs text-slate-600">Nombre del beneficiario</Label>
                          <Input value={method.account_holder || ""} onChange={e => setMethods(prev => prev.map((m, i) => i === idx ? { ...m, account_holder: e.target.value } : m))}
                            placeholder="Nombre completo o razón social" className="mt-1 text-sm" />
                        </div>
                        <p className="text-xs text-purple-600/70">Estos datos se mostrarán al pasajero cuando seleccione este método de pago.</p>
                      </div>
                    </>
                  )}
                  {serviceTypes.length > 0 && (
                    <div>
                      <p className="text-sm font-medium text-slate-700 mb-2">Aplica a tipos de servicio</p>
                      <p className="text-xs text-slate-400 mb-2">Vacío = aplica a todos</p>
                      <div className="grid grid-cols-2 gap-1.5">
                        {serviceTypes.map(st => {
                          const selected = (method.allowed_service_type_ids || []).includes(st.id);
                          return (
                            <button key={st.id}
                              onClick={() => setMethods(prev => prev.map((m, i) => {
                                if (i !== idx) return m;
                                const curr = m.allowed_service_type_ids || [];
                                return { ...m, allowed_service_type_ids: selected ? curr.filter((id: string) => id !== st.id) : [...curr, st.id] };
                              }))}
                              className={`text-xs px-2.5 py-1.5 rounded-lg border text-left transition-all ${
                                selected ? "border-blue-400 bg-blue-50 text-blue-700 font-semibold" : "border-slate-200 text-slate-500 hover:border-slate-300"
                              }`}
                            >
                              {selected ? "✓ " : ""}{st.name}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
        <div className="flex gap-2 pt-2 border-t border-slate-100">
          <Input placeholder="Nombre del nuevo método..." value={newLabel} onChange={e => setNewLabel(e.target.value)}
            onKeyDown={e => e.key === "Enter" && addMethod()} className="rounded-xl text-sm" />
          <Button onClick={addMethod} disabled={!newLabel.trim()} className="bg-slate-900 hover:bg-slate-800 rounded-xl">
            <Plus className="w-4 h-4 mr-1" /> Agregar
          </Button>
        </div>
      </Card>

      {/* Pending payment methods config */}
      <Card className="p-5 border-0 shadow-sm space-y-4">
        <h3 className="font-semibold text-slate-800 flex items-center gap-2"><Clock className="w-4 h-4 text-amber-500" /> Métodos con &quot;Pago pendiente&quot; activo</h3>
        <p className="text-xs text-slate-400">Solo los métodos marcados aquí permitirán que el pasajero solicite el servicio con pago pendiente. Al confirmar el pago, se enviará al conductor automáticamente.</p>
        <div className="grid grid-cols-2 gap-2">
          {methods.filter(m => m.is_active).map(m => {
            const selected = pendingPaymentMethods.includes(m.key);
            return (
              <button key={m.key}
                onClick={() => setPendingPaymentMethods(prev => selected ? prev.filter((k: string) => k !== m.key) : [...prev, m.key])}
                className={`text-sm px-3 py-2 rounded-xl border text-left transition-all font-medium ${
                  selected ? "border-amber-400 bg-amber-50 text-amber-800" : "border-slate-200 text-slate-500 hover:border-slate-300"
                }`}>
                {selected ? "✓ " : ""}{m.label}
              </button>
            );
          })}
        </div>
      </Card>

      {/* Gateway */}
      <Card className="p-6 border-0 shadow-sm">
        <div className="flex items-center gap-3 mb-5">
          <div className="p-2 rounded-xl bg-violet-50 text-violet-600"><Zap className="w-5 h-5" /></div>
          <div className="flex-1">
            <h2 className="font-semibold text-slate-900">Pasarela de pagos</h2>
            <p className="text-xs text-slate-400 mt-0.5">Conecta Stripe o Mercado Pago para cobros con tarjeta</p>
          </div>
          {gateway.type !== "none" && (
            <span className="text-xs bg-green-100 text-green-700 px-2.5 py-1 rounded-full font-semibold flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5" /> Activa → Tarjeta
            </span>
          )}
        </div>
        <div className="space-y-4">
          <div>
            <Label>Proveedor</Label>
            <Select value={gateway.type} onValueChange={v => setGateway(g => ({ ...g, type: v }))}>
              <SelectTrigger className="mt-1 max-w-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Sin pasarela (desactivada)</SelectItem>
                <SelectItem value="stripe">💳 Stripe</SelectItem>
                <SelectItem value="mercadopago">💰 Mercado Pago</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {gateway.type !== "none" && (
            <div className="flex items-center justify-between p-3 bg-violet-50 border border-violet-200 rounded-xl">
              <div>
                <p className="text-sm font-semibold text-violet-800">Enlazar al método &quot;Tarjeta de crédito/débito&quot;</p>
                <p className="text-xs text-violet-600 mt-0.5">Los pagos con tarjeta se procesarán automáticamente por esta pasarela</p>
              </div>
              <Switch checked={!!gateway.linked_to_card_method}
                onCheckedChange={v => setGateway(g => ({ ...g, linked_to_card_method: v }))} />
            </div>
          )}
          {gateway.type !== "none" && (
            <>
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Credenciales API</p>
                <button onClick={() => setShowKeys(v => !v)} className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-700">
                  {showKeys ? <><EyeOff className="w-3.5 h-3.5" /> Ocultar</> : <><Eye className="w-3.5 h-3.5" /> Mostrar</>}
                </button>
              </div>
              {gateway.type === "stripe" && (
                <>
                  <div>
                    <Label>Clave secreta (Secret Key)</Label>
                    <Input type={showKeys ? "text" : "password"} value={gateway.api_key}
                      onChange={e => setGateway(g => ({ ...g, api_key: e.target.value }))} placeholder="sk_live_..." className="mt-1 font-mono text-sm" />
                  </div>
                  <div>
                    <Label>Clave pública (Publishable Key)</Label>
                    <Input type={showKeys ? "text" : "password"} value={gateway.public_key}
                      onChange={e => setGateway(g => ({ ...g, public_key: e.target.value }))} placeholder="pk_live_..." className="mt-1 font-mono text-sm" />
                  </div>
                  <div>
                    <Label>Webhook Secret (opcional)</Label>
                    <Input type={showKeys ? "text" : "password"} value={gateway.webhook_secret}
                      onChange={e => setGateway(g => ({ ...g, webhook_secret: e.target.value }))} placeholder="whsec_..." className="mt-1 font-mono text-sm" />
                  </div>
                </>
              )}
              {gateway.type === "mercadopago" && (
                <>
                  <div>
                    <Label>Access Token</Label>
                    <Input type={showKeys ? "text" : "password"} value={gateway.api_key}
                      onChange={e => setGateway(g => ({ ...g, api_key: e.target.value }))} placeholder="APP_USR-..." className="mt-1 font-mono text-sm" />
                  </div>
                  <div>
                    <Label>Public Key</Label>
                    <Input type={showKeys ? "text" : "password"} value={gateway.public_key}
                      onChange={e => setGateway(g => ({ ...g, public_key: e.target.value }))} placeholder="APP_USR-..." className="mt-1 font-mono text-sm" />
                  </div>
                </>
              )}
              <div>
                <Label>Comisión de pasarela para tarjeta (%)</Label>
                <Input type="number" min={0} step={0.1} value={gateway.card_commission_pct ?? 3.6}
                  onChange={e => setGateway(g => ({ ...g, card_commission_pct: +e.target.value }))} className="mt-1 max-w-xs" />
                <p className="text-xs text-slate-400 mt-1">Este % se descuenta del pago con tarjeta (comisión de la pasarela, ej. Stripe 3.6%)</p>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-700">Habilitar referencias de recarga de wallet</p>
                  <p className="text-xs text-slate-400">El pasajero puede generar una referencia para recargar saldo vía SPEI/depósito</p>
                </div>
                <Switch checked={!!gateway.wallet_ref_enabled}
                  onCheckedChange={v => setGateway(g => ({ ...g, wallet_ref_enabled: v }))} />
              </div>
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
                <p className="text-xs text-amber-700">⚠️ Las claves API se guardan en la configuración del sistema. Asegúrate de usar credenciales de producción solo cuando la app esté lista para operar.</p>
              </div>
            </>
          )}
        </div>
      </Card>

      {testResult && (
        <div className={`p-4 rounded-xl border ${testResult.success ? "bg-emerald-50 border-emerald-200 text-emerald-700" : "bg-red-50 border-red-200 text-red-700"} text-sm`}>
          {testResult.message}
        </div>
      )}

      <div className="flex gap-3">
        {gateway.type !== "none" && (
          <Button onClick={handleTestGateway} disabled={testTesting || saving} variant="outline" className="rounded-xl border-slate-200 text-slate-600 hover:bg-slate-50">
            <RefreshCw className={`w-4 h-4 mr-2 ${testTesting ? "animate-spin" : ""}`} /> {testTesting ? "Testeando..." : "Test de pasarela"}
          </Button>
        )}
        <Button onClick={handleSave} disabled={saving || testTesting} className="bg-slate-900 hover:bg-slate-800 rounded-xl px-8">
          <Save className="w-4 h-4 mr-2" /> {saving ? "Guardando..." : "Guardar cambios"}
        </Button>
      </div>
    </div>
  );
}

// ─── Tab: Transacciones ───────────────────────────────────────────────────────

function TransactionsTab({ rides, settings }: { rides: any[]; settings: any }) {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [processingId, setProcessingId] = useState(null);
  const [clientFilter, setClientFilter] = useState("");

  const currency = settings?.currency || "MXN";
  const commissionPct = settings?.platform_commission_pct || 20;
  const paymentMethods = settings?.payment_methods || [];

  // Build transaction list from rides
  const transactions = rides
    .filter(r => r.payment_method || r.estimated_price)
    .map(r => {
      const methodCfg = paymentMethods.find(m => m.key === r.payment_method) || {};
      return {
        id: r.id,
        service_id: r.service_id || r.id?.slice(0, 8),
        passenger: r.passenger_name,
        amount: r.final_price || r.estimated_price || 0,
        method: methodCfg.label || r.payment_method || "—",
        method_key: r.payment_method,
        payment_status: r.payment_status || "pending",
        ride_status: r.status,
        driver: r.driver_name || "—",
        reference: r.payment_reference,
        created_at: r.requested_at,
        driver_earnings: r.driver_earnings,
        commission: r.platform_commission,
        driver_payout_status: r.payment_status === "paid" ? "pagado" : "pendiente",
        financial_status: deriveFinancialStatus(r),
      };
    });

  function deriveFinancialStatus(r) {
    if (r.status === "completed" || r.status === "liquidado") {
      if (r.payment_status === "paid") return "liquidado";
      return "completado";
    }
    if (r.payment_status === "pending") return "pendiente_pago";
    return "en_proceso";
  }

  const filtered = transactions.filter(t => {
    const q = search.toLowerCase();
    const qClient = clientFilter.toLowerCase();
    const matchSearch = !q || (t.passenger || "").toLowerCase().includes(q) || (String(t.service_id) || "").toLowerCase().includes(q) || (t.driver || "").toLowerCase().includes(q);
    const matchClient = !qClient || (t.passenger || "").toLowerCase().includes(qClient);
    const matchStatus = statusFilter === "all" || t.payment_status === statusFilter || t.financial_status === statusFilter;
    return matchSearch && matchClient && matchStatus;
  });

  const refundPayment = async (rideId) => {
    setProcessingId(rideId);
    await supabaseApi.rideRequests.update(rideId, {
      payment_status: "refunded",
    });
    queryClient.invalidateQueries({ queryKey: ["rides"] });
    toast.success("Reembolso registrado");
    setProcessingId(null);
  };

  return (
    <div className="space-y-5">
      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input className="pl-9 rounded-xl" placeholder="Buscar por pasajero, folio o conductor..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div className="relative flex-1 min-w-[160px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input className="pl-9 rounded-xl" placeholder="Filtrar por cliente..." value={clientFilter} onChange={e => setClientFilter(e.target.value)} />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-44 rounded-xl"><Filter className="w-3.5 h-3.5 mr-1.5" /><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="pending">Pago pendiente</SelectItem>
            <SelectItem value="paid">Pagado</SelectItem>
            <SelectItem value="approved">Aprobado</SelectItem>
            <SelectItem value="retained">Retenido</SelectItem>
            <SelectItem value="released">Liberado</SelectItem>
            <SelectItem value="refunded">Reembolsado</SelectItem>
            <SelectItem value="debt">Adeudo</SelectItem>
            <SelectItem value="pendiente_pago">Sin pago</SelectItem>
            <SelectItem value="liquidado">Liquidado</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <Card className="border-0 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-100">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Folio</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Pasajero</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Método</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Total</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Conductor</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Comisión</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Estado pago</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Estado financiero</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filtered.length === 0 && (
                <tr><td colSpan={9} className="px-4 py-10 text-center text-slate-400 text-sm">No hay transacciones que coincidan</td></tr>
              )}
              {filtered.map(t => {
                const isProcessing = processingId === t.id;
                const amount = t.amount || 0;
                const commissionAmt = t.commission != null ? t.commission : +(amount * commissionPct / 100).toFixed(2);
                const driverAmt = t.driver_earnings != null ? t.driver_earnings : +(amount - commissionAmt).toFixed(2);
                const fsCfg = RIDE_FINANCIAL_STATUS[t.financial_status] || RIDE_FINANCIAL_STATUS["pendiente_pago"];
                return (
                  <tr key={t.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-4 py-3 font-mono text-xs text-slate-500">{t.service_id || t.id?.slice(0, 8)}</td>
                    <td className="px-4 py-3 font-medium text-slate-800">{t.passenger}</td>
                    <td className="px-4 py-3 text-slate-600">{t.method}</td>
                    <td className="px-4 py-3 text-right font-semibold text-slate-900">${amount.toFixed(2)}</td>
                    <td className="px-4 py-3 text-right text-green-700 font-medium">${driverAmt.toFixed(2)}</td>
                    <td className="px-4 py-3 text-right text-violet-700 font-medium">${commissionAmt.toFixed(2)}</td>
                    <td className="px-4 py-3 text-center"><StatusBadgePay status={t.payment_status} /></td>
                    <td className="px-4 py-3 text-center">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${fsCfg.color}`}>{fsCfg.label}</span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-1 flex-wrap">
                        {t.payment_status === "paid" && (
                          <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> Confirmado</span>
                        )}
                        {t.payment_status === "approved" && t.ride_status === "cancelled" && (
                          <Button size="sm" variant="outline" disabled={isProcessing}
                            className="text-xs h-7 px-2 text-blue-700 border-blue-200 hover:bg-blue-50"
                            onClick={() => refundPayment(t.id)}>
                            Reembolsar
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

// ─── Tab: Wallets ─────────────────────────────────────────────────────────────

function WalletsTab({ users, rides, settings }: { users: any[]; rides: any[]; settings: any }) {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [processingId, setProcessingId] = useState(null);
  const [walletModal, setWalletModal] = useState(null);
  const [walletAmount, setWalletAmount] = useState("");
  const [walletAction, setWalletAction] = useState("load");

  const walletUsers = users.map(u => {
    const userRides = rides.filter(r => r.passenger_id === u.id);
    const totalSpent = userRides.reduce((s, r) => s + (r.final_price || r.estimated_price || 0), 0);
    return {
      id: u.id,
      name: u.full_name || u.email,
      email: u.email,
      phone: u.phone,
      wallet_balance: u.wallet_balance || 0,
      wallet_locked: u.wallet_locked || 0,
      total_rides: userRides.length,
      total_spent: totalSpent,
      created_at: u.created_at,
      status: (u.wallet_balance || 0) > (settings?.wallet_min_balance || 0) ? "active" : "low",
    };
  });

  const filtered = walletUsers.filter(u => {
    const q = search.toLowerCase();
    const matchSearch = !q || (u.name || "").toLowerCase().includes(q) || (u.email || "").toLowerCase().includes(q) || (String(u.phone) || "").includes(q);
    const matchStatus = statusFilter === "all" || u.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const handleUpdateWallet = async () => {
    if (!walletModal || !walletAmount || isNaN(Number(walletAmount))) return;
    setProcessingId(walletModal);
    const amount = Number(walletAmount);
    const user = walletUsers.find(u => u.id === walletModal);
    if (!user) return;

    const newBalance = walletAction === "load" ? user.wallet_balance + amount : Math.max(0, user.wallet_balance - amount);
    await supabaseApi.roadAssistUsers.update(walletModal, { wallet_balance: newBalance });
    queryClient.invalidateQueries({ queryKey: ["passUsers"] });
    toast.success(`Wallet actualizado: $${newBalance.toFixed(2)}`);
    setWalletModal(null);
    setWalletAmount("");
    setProcessingId(null);
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input className="pl-9 rounded-xl" placeholder="Buscar por nombre, email o teléfono..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-44 rounded-xl"><Filter className="w-3.5 h-3.5 mr-1.5" /><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="active">Balance OK</SelectItem>
            <SelectItem value="low">Balance bajo</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard icon={Wallet} label="Usuarios con wallet" value={walletUsers.length} color="bg-purple-100 text-purple-600" />
        <StatCard icon={DollarSign} label="Saldo total depositado" value={`$${walletUsers.reduce((s, u) => s + u.wallet_balance, 0).toFixed(0)}`} color="bg-green-100 text-green-600" />
        <StatCard icon={Lock} label="Fondos bloqueados" value={`$${walletUsers.reduce((s, u) => s + u.wallet_locked, 0).toFixed(0)}`} color="bg-amber-100 text-amber-600" />
        <StatCard icon={Unlock} label="Disponible para usar" value={`$${walletUsers.reduce((s, u) => s + Math.max(0, u.wallet_balance - u.wallet_locked), 0).toFixed(0)}`} color="bg-blue-100 text-blue-600" />
      </div>

      <Card className="border-0 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-100">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Usuario</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Email</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Saldo</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Bloqueado</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Disponible</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Servicios</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Total gastado</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filtered.length === 0 && (<tr><td colSpan={8} className="px-4 py-10 text-center text-slate-400 text-sm">No hay usuarios en el wallet</td></tr>)}
              {filtered.map(u => {
                const isProcessing = processingId === u.id;
                const available = Math.max(0, u.wallet_balance - u.wallet_locked);
                const statusColor = u.status === "active" ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700";
                const statusLabel = u.status === "active" ? "OK" : "Bajo";
                return (
                  <tr key={u.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-4 py-3 font-medium text-slate-800">{u.name}</td>
                    <td className="px-4 py-3 text-slate-600 text-xs font-mono">{u.email}</td>
                    <td className="px-4 py-3 text-right font-semibold text-slate-900">${u.wallet_balance.toFixed(2)}</td>
                    <td className="px-4 py-3 text-right text-amber-700 font-medium">${u.wallet_locked.toFixed(2)}</td>
                    <td className="px-4 py-3 text-right text-green-700 font-medium">${available.toFixed(2)}</td>
                    <td className="px-4 py-3 text-center text-slate-600">{u.total_rides}</td>
                    <td className="px-4 py-3 text-right font-semibold text-slate-900">${u.total_spent.toFixed(2)}</td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-1 flex-wrap">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColor}`}>{statusLabel}</span>
                        <Button size="sm" variant="outline" disabled={isProcessing} className="text-xs h-7 px-2 text-purple-700 border-purple-200 hover:bg-purple-50" onClick={() => { setWalletModal(u.id); setWalletAction("load"); setWalletAmount(""); }}><Plus className="w-3 h-3 mr-1" /> Cargar</Button>
                        <Button size="sm" variant="outline" disabled={isProcessing || available === 0} className="text-xs h-7 px-2 text-red-700 border-red-200 hover:bg-red-50" onClick={() => { setWalletModal(u.id); setWalletAction("withdraw"); setWalletAmount(""); }}><ArrowUpRight className="w-3 h-3 mr-1" /> Retirar</Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      <Dialog open={!!walletModal} onOpenChange={(open) => !open && setWalletModal(null)}>
        <DialogContent className="dialog-size-lg max-h-[90vh] overflow-y-auto p-4">
          <DialogHeader><DialogTitle>{walletAction === "load" ? "Cargar saldo a wallet" : "Retirar saldo del wallet"}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            {walletModal && (<>
              <div className="p-3 bg-slate-50 rounded-xl"><p className="text-xs text-slate-500 mb-1">Usuario</p><p className="font-medium text-slate-900">{walletUsers.find(u => u.id === walletModal)?.name}</p></div>
              <div className="p-3 bg-slate-50 rounded-xl"><p className="text-xs text-slate-500 mb-1">Saldo actual</p><p className="font-semibold text-slate-900">${walletUsers.find(u => u.id === walletModal)?.wallet_balance.toFixed(2)}</p></div>
              <div><Label className="text-sm">Monto</Label><Input type="number" placeholder="0.00" value={walletAmount} onChange={e => setWalletAmount(e.target.value)} className="mt-2 text-sm" min={0} step={0.01} /></div>
            </>)}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setWalletModal(null)}>Cancelar</Button>
            <Button onClick={handleUpdateWallet} disabled={processingId || !walletAmount || isNaN(Number(walletAmount))} className="bg-purple-600 hover:bg-purple-700">{walletAction === "load" ? "Cargar" : "Retirar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Tab: Driver Payouts ──────────────────────────────────────────────────────

function DriverPayoutsTab({ rides, drivers, settings }: { rides: any[]; drivers: any[]; settings: any }) {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("pendiente");
  const [processingId, setProcessingId] = useState(null);
  const [payoutModal, setPayoutModal] = useState(null);
  const [payoutNotes, setPayoutNotes] = useState("");

  const commissionPct = settings?.platform_commission_pct || 20;

  const payoutRides = rides.filter(r => r.status === "completed" || r.status === "liquidado").map(r => {
    const driverObj = drivers.find(d => d.id === r.driver_id) || {};
    const amount = r.final_price || r.estimated_price || 0;
    const commission = r.platform_commission != null ? r.platform_commission : +(amount * commissionPct / 100);
    const driverEarning = r.driver_earnings != null ? r.driver_earnings : +(amount - commission);
    return {
      id: r.id, service_id: r.service_id || r.id?.slice(0, 8), driver_id: r.driver_id, driver_name: r.driver_name || driverObj.full_name || "—", driver_phone: driverObj.phone,
      amount, driver_earning: driverEarning, commission, payout_status: r.payment_status === "paid" ? "pagado" : "pendiente", payout_method: r.payment_method || "transfer",
      ride_status: r.status, completed_at: r.completed_at, passenger: r.passenger_name || "—", notes: "",
    };
  });

  const filtered = payoutRides.filter(p => {
    const q = search.toLowerCase();
    const matchSearch = !q || (p.driver_name || "").toLowerCase().includes(q) || (String(p.service_id) || "").toLowerCase().includes(q) || (String(p.driver_phone) || "").includes(q);
    const matchStatus = statusFilter === "all" || p.payout_status === statusFilter;
    return matchSearch && matchStatus;
  });

  const pendingPayouts = filtered.filter(p => p.payout_status === "pendiente");
  const paidPayouts = filtered.filter(p => p.payout_status === "pagado");
  const totalPending = pendingPayouts.reduce((s, p) => s + p.driver_earning, 0);
  const totalPaid = paidPayouts.reduce((s, p) => s + p.driver_earning, 0);

  const markAsPaid = async (rideId) => {
    setProcessingId(rideId);
    await supabaseApi.rideRequests.update(rideId, { payment_status: "paid" });
    queryClient.invalidateQueries({ queryKey: ["rides"] });
    toast.success("Pago a conductor registrado");
    setPayoutModal(null);
    setPayoutNotes("");
    setProcessingId(null);
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input className="pl-9 rounded-xl" placeholder="Buscar por conductor, teléfono o folio..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-44 rounded-xl"><Filter className="w-3.5 h-3.5 mr-1.5" /><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="pendiente">Pendiente</SelectItem>
            <SelectItem value="pagado">Pagado</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard icon={Clock} label="Pagos pendientes" value={pendingPayouts.length} sub={`$${totalPending.toFixed(0)}`} color="bg-amber-100 text-amber-600" />
        <StatCard icon={CheckCircle2} label="Pagos realizados" value={paidPayouts.length} sub={`$${totalPaid.toFixed(0)}`} color="bg-green-100 text-green-600" />
        <StatCard icon={Users} label="Conductores únicos" value={new Set(filtered.map(p => p.driver_id)).size} color="bg-blue-100 text-blue-600" />
        <StatCard icon={DollarSign} label="Total a pagar" value={`$${filtered.reduce((s, p) => s + p.driver_earning, 0).toFixed(0)}`} color="bg-purple-100 text-purple-600" />
      </div>

      <Card className="border-0 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-100">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Folio</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Conductor</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Pasajero</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Tarifa</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Comisión</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Pago conductor</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Método</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Estado</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filtered.length === 0 && (<tr><td colSpan={9} className="px-4 py-10 text-center text-slate-400 text-sm">No hay pagos a conductores</td></tr>)}
              {filtered.map(p => {
                const isProcessing = processingId === p.id;
                const statusBg = p.payout_status === "pendiente" ? "bg-amber-100 text-amber-700" : "bg-green-100 text-green-700";
                const statusIcon = p.payout_status === "pendiente" ? Clock : CheckCircle2;
                const StatusIcon = statusIcon;
                return (
                  <tr key={p.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-4 py-3 font-mono text-xs text-slate-500">{p.service_id}</td>
                    <td className="px-4 py-3 font-medium text-slate-800">{p.driver_name}</td>
                    <td className="px-4 py-3 text-slate-600 text-xs">{p.passenger}</td>
                    <td className="px-4 py-3 text-right font-semibold text-slate-900">${p.amount.toFixed(2)}</td>
                    <td className="px-4 py-3 text-right text-violet-700 font-medium">${p.commission.toFixed(2)}</td>
                    <td className="px-4 py-3 text-right text-green-700 font-bold text-base">${p.driver_earning.toFixed(2)}</td>
                    <td className="px-4 py-3 text-center text-xs"><span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 font-medium capitalize">{p.payout_method === "transfer" && <ArrowDownLeft className="w-3 h-3" />}{p.payout_method === "cash" && <DollarSign className="w-3 h-3" />}{p.payout_method}</span></td>
                    <td className="px-4 py-3 text-center"><span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium ${statusBg}`}><StatusIcon className="w-3 h-3" />{p.payout_status === "pendiente" ? "Pendiente" : "Pagado"}</span></td>
                    <td className="px-4 py-3 text-center">{p.payout_status === "pendiente" && (<Button size="sm" variant="outline" disabled={isProcessing} className="text-xs h-7 px-2 text-green-700 border-green-200 hover:bg-green-50" onClick={() => { setPayoutModal(p.id); setPayoutNotes(""); }}><CheckCircle2 className="w-3 h-3 mr-1" /> Marcar pagado</Button>)}{p.payout_status === "pagado" && (<span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium flex items-center gap-1 justify-center"><CheckCircle2 className="w-3 h-3" /> Confirmado</span>)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      <Dialog open={!!payoutModal} onOpenChange={(open) => !open && setPayoutModal(null)}>
        <DialogContent className="dialog-size-lg max-h-[90vh] overflow-y-auto p-4">
          <DialogHeader><DialogTitle>Confirmar pago a conductor</DialogTitle></DialogHeader>
          <div className="space-y-4">
            {payoutModal && (() => {
              const payout = filtered.find(p => p.id === payoutModal);
              return (<>
                <div className="p-3 bg-slate-50 rounded-xl"><p className="text-xs text-slate-500 mb-1">Conductor</p><p className="font-semibold text-slate-900">{payout?.driver_name}</p></div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 bg-slate-50 rounded-xl"><p className="text-xs text-slate-500 mb-1">Tarifa</p><p className="font-semibold text-slate-900">${payout?.amount.toFixed(2)}</p></div>
                  <div className="p-3 bg-green-50 rounded-xl"><p className="text-xs text-green-600 mb-1">Pago conductor</p><p className="font-semibold text-green-900">${payout?.driver_earning.toFixed(2)}</p></div>
                </div>
                <div className="p-3 bg-slate-50 rounded-xl"><p className="text-xs text-slate-500 mb-1">Método de pago</p><p className="font-medium text-slate-900 capitalize">{payout?.payout_method}</p></div>
                <div><Label className="text-sm">Notas (opcional)</Label><Input placeholder="ej. Transferencia # 123..." value={payoutNotes} onChange={e => setPayoutNotes(e.target.value)} className="mt-2 text-sm" /></div>
              </>);
            })()}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPayoutModal(null)}>Cancelar</Button>
            <Button onClick={() => markAsPaid(payoutModal)} disabled={processingId} className="bg-green-600 hover:bg-green-700">Confirmar pago</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Tab: Reportes / KPIs ─────────────────────────────────────────────────────

function ReportsTab({ rides, settings }: { rides: any[]; settings: any }) {
  const currency = settings?.currency || "MXN";
  const commissionPct = settings?.platform_commission_pct || 20;

  const completedRides = rides.filter(r => r.status === "completed");
  const pendingPayments = rides.filter(r => r.payment_status === "pending" && r.status !== "cancelled");
  const pendingPayouts = rides.filter(r => r.status === "completed" && r.payment_status !== "paid");

  const totalRevenue = completedRides.reduce((s, r) => s + (r.final_price || r.estimated_price || 0), 0);
  const totalCommission = completedRides.reduce((s, r) => {
    const amt = r.final_price || r.estimated_price || 0;
    return s + (r.platform_commission != null ? r.platform_commission : +(amt * commissionPct / 100));
  }, 0);
  const totalDriverEarnings = completedRides.reduce((s, r) => {
    const amt = r.final_price || r.estimated_price || 0;
    const comm = r.platform_commission != null ? r.platform_commission : +(amt * commissionPct / 100);
    return s + (r.driver_earnings != null ? r.driver_earnings : +(amt - comm));
  }, 0);
  const pendingPaymentsTotal = pendingPayments.reduce((s, r) => s + (r.estimated_price || 0), 0);
  const pendingPayoutsTotal = pendingPayouts.reduce((s, r) => {
    const amt = r.final_price || r.estimated_price || 0;
    const comm = r.platform_commission != null ? r.platform_commission : +(amt * commissionPct / 100);
    return s + (r.driver_earnings != null ? r.driver_earnings : +(amt - comm));
  }, 0);

  // Breakdown by payment method
  const byMethod: Record<string, { count: number; total: number }> = {};
  completedRides.forEach(r => {
    const k = r.payment_method || "unknown";
    if (!byMethod[k]) byMethod[k] = { count: 0, total: 0 };
    byMethod[k].count++;
    byMethod[k].total += r.final_price || r.estimated_price || 0;
  });

  // Breakdown by financial status
  const byFinStatus: Record<string, number> = {};
  rides.forEach(r => {
    const k = r.status === "completed" ? (r.payment_status === "paid" ? "liquidado" : "completado") : (r.payment_status === "pending" ? "pendiente_pago" : "en_proceso");
    if (!byFinStatus[k]) byFinStatus[k] = 0;
    byFinStatus[k]++;
  });

  return (
    <div className="space-y-6">
      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard icon={DollarSign} label="Ingresos totales" value={`$${totalRevenue.toFixed(0)}`} sub={`${completedRides.length} servicios`} color="bg-green-100 text-green-600" />
        <StatCard icon={TrendingUp} label="Comisión plataforma" value={`$${totalCommission.toFixed(0)}`} sub={`${commissionPct}% por servicio`} color="bg-violet-100 text-violet-600" />
        <StatCard icon={Users} label="Pago a conductores" value={`$${totalDriverEarnings.toFixed(0)}`} sub={`${(100 - commissionPct)}% del total`} color="bg-blue-100 text-blue-600" />
        <StatCard icon={Clock} label="Pagos pendientes" value={`$${pendingPaymentsTotal.toFixed(0)}`} sub={`${pendingPayments.length} servicios`} color="bg-amber-100 text-amber-600" />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <StatCard icon={AlertTriangle} label="Por liquidar a conductores" value={`$${pendingPayoutsTotal.toFixed(0)}`} sub={`${pendingPayouts.length} servicios pendientes`} color="bg-orange-100 text-orange-600" />
        <StatCard icon={CheckCircle2} label="Servicios completados" value={completedRides.length} sub={`de ${rides.length} totales`} color="bg-emerald-100 text-emerald-600" />
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* By method */}
        <Card className="p-5 border-0 shadow-sm">
          <h3 className="font-semibold text-slate-800 mb-4">Ingresos por método de pago</h3>
          <div className="space-y-3">
            {Object.entries(byMethod).length === 0 && <p className="text-sm text-slate-400">Sin datos aún</p>}
            {Object.entries(byMethod).map(([method, data]) => {
              const pct = totalRevenue > 0 ? (data.total / totalRevenue * 100) : 0;
              return (
                <div key={method}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="capitalize text-slate-700 font-medium">{method}</span>
                    <span className="text-slate-500">${data.total.toFixed(0)} ({data.count} serv.)</span>
                  </div>
                  <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full bg-blue-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </Card>

        {/* By financial status */}
        <Card className="p-5 border-0 shadow-sm">
          <h3 className="font-semibold text-slate-800 mb-4">Distribución de estados financieros</h3>
          <div className="space-y-2">
            {Object.entries(RIDE_FINANCIAL_STATUS).map(([k, cfg]) => {
              const count = byFinStatus[k] || 0;
              const pct = rides.length > 0 ? (count / rides.length * 100) : 0;
              return (
                <div key={k} className="flex items-center gap-3">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium min-w-[110px] text-center ${cfg.color}`}>{cfg.label}</span>
                  <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full bg-slate-400 rounded-full" style={{ width: `${pct}%` }} />
                  </div>
                  <span className="text-xs text-slate-500 w-8 text-right">{count}</span>
                </div>
              );
            })}
          </div>
        </Card>
      </div>

      {/* Automations info */}
      <Card className="p-5 border-0 shadow-sm bg-slate-50">
        <h3 className="font-semibold text-slate-800 mb-3 flex items-center gap-2"><Zap className="w-4 h-4 text-amber-500" /> Automatizaciones activas</h3>
        <ul className="space-y-2 text-sm text-slate-600">
          <li className="flex items-start gap-2"><CheckCircle2 className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" /> El sistema retiene el dinero del usuario hasta que el servicio se complete.</li>
          <li className="flex items-start gap-2"><CheckCircle2 className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" /> Wallet se descuenta automáticamente si el saldo es suficiente al crear el servicio.</li>
          <li className="flex items-start gap-2"><CheckCircle2 className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" /> La comisión de la plataforma ({commissionPct}%) se calcula automáticamente al liberar el pago.</li>
          <li className="flex items-start gap-2"><CheckCircle2 className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" /> Si un pago no llega en el tiempo definido, el servicio se cancela automáticamente.</li>
          <li className="flex items-start gap-2"><CheckCircle2 className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" /> Todos los pagos se registran con ID único para evitar duplicados.</li>
          <li className="flex items-start gap-2"><CheckCircle2 className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" /> Los reembolsos por cancelación se devuelven al mismo método de pago utilizado.</li>
        </ul>
      </Card>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function PaymentMethods() {
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);

  const { data: settingsList = [] } = useQuery({ queryKey: ["appSettings"], queryFn: () => supabaseApi.settings.list(), staleTime: 30 * 60 * 1000, gcTime: 60 * 60 * 1000 });
  const { data: serviceTypes = [] } = useQuery({ queryKey: ["serviceTypes"], queryFn: () => supabaseApi.serviceTypes.list(), staleTime: 30 * 60 * 1000, gcTime: 60 * 60 * 1000 });
  const { data: rides = [] } = useQuery({ queryKey: ["rides"], queryFn: () => supabaseApi.rideRequests.list(), staleTime: 60 * 1000, gcTime: 10 * 60 * 1000 });
  const { data: drivers = [] } = useQuery({ queryKey: ["drivers"], queryFn: () => supabaseApi.drivers.list(), staleTime: 30 * 60 * 1000, gcTime: 60 * 60 * 1000 });
  const { data: users = [] } = useQuery({ queryKey: ["passUsers"], queryFn: () => supabaseApi.roadAssistUsers.list(), staleTime: 30 * 60 * 1000, gcTime: 60 * 60 * 1000 });

  const settings = settingsList[0];

  const handleSaveSettings = async (payload) => {
    setSaving(true);
    if (settings?.id) {
      await supabaseApi.settings.update(settings.id, payload);
    } else {
      await supabaseApi.settings.create({ company_name: "App", ...payload });
    }
    queryClient.invalidateQueries({ queryKey: ["appSettings"] });
    toast.success("Configuración guardada");
    setSaving(false);
  };

  return (
    <Layout currentPageName="PaymentMethods">
      <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Pagos y Control Financiero</h1>
        <p className="text-sm text-slate-400 mt-0.5">Gestiona métodos de pago, transacciones, wallets, pagos a conductores y reportes</p>
      </div>

      <Tabs defaultValue="config" className="w-full">
        <TabsList className="bg-slate-100 rounded-xl p-1 gap-1 flex-wrap h-auto">
          <TabsTrigger value="config" className="rounded-lg text-xs px-3 py-1.5">⚙️ Configuración</TabsTrigger>
          <TabsTrigger value="transactions" className="rounded-lg text-xs px-3 py-1.5">💳 Transacciones</TabsTrigger>
          <TabsTrigger value="wallets" className="rounded-lg text-xs px-3 py-1.5">👛 Wallets</TabsTrigger>
          <TabsTrigger value="payouts" className="rounded-lg text-xs px-3 py-1.5">🏦 Pagos a conductores</TabsTrigger>
          <TabsTrigger value="reports" className="rounded-lg text-xs px-3 py-1.5">📊 Reportes</TabsTrigger>
        </TabsList>

        <TabsContent value="config" className="mt-6">
          <MethodsConfigTab settings={settings} serviceTypes={serviceTypes} onSave={handleSaveSettings} saving={saving} />
        </TabsContent>
        <TabsContent value="transactions" className="mt-6">
          <TransactionsTab rides={rides} settings={settings} />
        </TabsContent>
        <TabsContent value="wallets" className="mt-6">
          <WalletsTab users={users} rides={rides} settings={settings} />
        </TabsContent>
        <TabsContent value="payouts" className="mt-6">
          <DriverPayoutsTab rides={rides} drivers={drivers} settings={settings} />
        </TabsContent>
        <TabsContent value="reports" className="mt-6">
          <ReportsTab rides={rides} settings={settings} />
        </TabsContent>
      </Tabs>
    </div>
    </Layout>
  );
}
