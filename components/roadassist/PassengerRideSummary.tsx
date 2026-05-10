/**
 * PassengerRideSummary — Pantalla final para el PASAJERO
 *
 * Lógica de pago:
 *  - Si requiere confirmación del conductor (efectivo, etc.):
 *      → Muestra "Esperando confirmación de pago" con spinner
 *      → Cuando el conductor confirma (payment_status = "paid") → muestra "Pagado" + botón continuar a calificación
 *  - Si NO requiere confirmación (auto_charge, wallet, etc.):
 *      → Muestra "Pagado" directamente con botón continuar
 *
 * No desaparece hasta que el pasajero califique u omita.
 */
import React, { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { CheckCircle2, XCircle, Star, AlertCircle, Clock, Loader2, MessageCircle, Copy, Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabaseApi } from "@/lib/supabaseApi";
import { supabase } from "@/lib/supabase";

const PAYMENT_METHOD_LABELS = {
  cash: "Efectivo",
  card: "Tarjeta",
  transfer: "Transferencia",
  wallet: "Wallet",
};

function getPaymentMethodLabel(method, settings) {
  if (!method) return PAYMENT_METHOD_LABELS.cash;
  const configured = Array.isArray(settings?.payment_methods)
    ? settings.payment_methods.find((m) => m?.key === method)
    : undefined;
  if (configured?.label) return configured.label;
  return PAYMENT_METHOD_LABELS[method] || method;
}

function StarRating({ value, onChange }) {
  const [hovered, setHovered] = useState(0);
  const active = hovered || value;
  return (
    <div className="flex items-center gap-1.5 justify-center">
      {[1,2,3,4,5].map(s => (
        <button key={s}
          onMouseEnter={() => setHovered(s)} onMouseLeave={() => setHovered(0)}
          onTouchStart={() => setHovered(s)} onClick={() => { onChange(s); setHovered(0); }}
          className="p-0.5 transition-transform active:scale-90">
          <Star className={`w-9 h-9 transition-all ${s <= active ? "fill-amber-400 text-amber-400 scale-110" : "text-white/20"}`} />
        </button>
      ))}
    </div>
  );
}

function DebtPaymentSection({ ride, pendingBalance, settings }) {
  const [copied, setCopied] = useState(false);
  const paymentMethods = Array.isArray(settings?.payment_methods)
    ? settings.payment_methods.filter((m) => m && m.is_active)
    : [];
  const transferMethods = paymentMethods.filter(m => m.clabe || m.bank_name);
  const whatsappNumber = settings?.support_whatsapp_number;
  const debtAmount = pendingBalance > 0 ? pendingBalance : (ride.cancellation_fee || ride.final_price || 0);

  const isCancellation = ride.status === "cancelled";
  const serviceLabel = ride.service_id
    ? `Servicio #${ride.service_id}`
    : `Servicio de ${ride.service_type_name || "transporte"}`;

  const debtReason = isCancellation
    ? `Cargo por cancelación del ${serviceLabel}`
    : `No pago del ${serviceLabel}`;

  const copyClabe = (clabe) => {
    navigator.clipboard.writeText(clabe).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const openWhatsApp = () => {
    const msg = encodeURIComponent(
      `Hola, tengo un adeudo pendiente de $${debtAmount.toFixed(2)} por: ${debtReason}. Necesito ayuda para liquidarlo.`
    );
    window.open(`https://wa.me/${(whatsappNumber || "").replace(/\D/g, "")}?text=${msg}`, "_blank");
  };

  return (
    <div className="space-y-3">
      {/* Debt reason */}
      <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-4">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-red-300 font-bold text-sm">Tienes un adeudo pendiente</p>
            <p className="text-white/60 text-xs mt-1">{debtReason}</p>
            <p className="text-red-400 font-black text-2xl mt-2">${debtAmount.toFixed(2)}</p>
            <p className="text-white/40 text-xs mt-1">No podrás solicitar nuevos servicios hasta liquidarlo.</p>
          </div>
        </div>
      </div>

      {/* Payment options */}
      {transferMethods.length > 0 && (
        <div className="bg-white/5 border border-white/10 rounded-2xl p-4 space-y-3">
          <p className="text-white/60 text-xs font-semibold uppercase tracking-wide flex items-center gap-2">
            <Building2 className="w-3.5 h-3.5" /> Opciones de pago
          </p>
          {transferMethods.map((m, i) => (
            <div key={i} className="bg-white/5 rounded-xl p-3 space-y-1.5">
              <p className="text-white font-semibold text-sm">{m.label}</p>
              {m.bank_name && <p className="text-white/50 text-xs">Banco: <span className="text-white/80">{m.bank_name}</span></p>}
              {m.account_holder && <p className="text-white/50 text-xs">Beneficiario: <span className="text-white/80">{m.account_holder}</span></p>}
              {m.clabe && (
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-xs font-mono bg-white/10 text-white/90 px-2 py-1 rounded-lg flex-1 truncate">{m.clabe}</span>
                  <button onClick={() => copyClabe(m.clabe)}
                    className="px-2 py-1 bg-blue-600 rounded-lg text-white text-xs font-semibold flex items-center gap-1">
                    <Copy className="w-3 h-3" /> {copied ? "¡Copiado!" : "Copiar"}
                  </button>
                </div>
              )}
              <p className="text-amber-300/80 text-xs font-semibold">Referencia: ${debtAmount.toFixed(2)} — {debtReason}</p>
            </div>
          ))}
        </div>
      )}

      {/* WhatsApp support */}
      {whatsappNumber && (
        <button onClick={openWhatsApp}
          className="w-full flex items-center justify-center gap-2.5 bg-green-600/20 border border-green-500/30 text-green-300 py-3.5 rounded-2xl text-sm font-semibold hover:bg-green-600/30 transition-colors">
          <MessageCircle className="w-4 h-4" />
          Contactar soporte por WhatsApp
        </button>
      )}
    </div>
  );
}

export default function PassengerRideSummary({ ride: initialRide, user, onDone }) {
  const [ride, setRide] = useState(initialRide);
  const [step, setStep] = useState("summary"); // 'summary' | 'rating'
  const [rating, setRating] = useState(0);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const data = await supabaseApi.settings.list();
        if (data?.[0]) setSettings(data[0]);
      } catch (err) {
        // silently fail
      }
    })();
  }, []);

  const isCompleted = ride.status === "completed";
  const isCancelled = ride.status === "cancelled";
  const hasCancellationFee = (ride.cancellation_fee || 0) > 0;
  const pendingBalance = user?.pending_balance || 0;
  const hasDebt = pendingBalance > 0;

  const totalPrice = ride.final_price || ride.estimated_price || 0;
  const walletUsed = ride.wallet_amount_used || 0;
  const fareProtectionEnabled = !!settings?.fare_protection_enabled;
  const serviceDescription = ride.service_description || ride.service_type_description || "";
  const fareProtectionLabel = settings?.fare_protection_label || "Tarifa protegida";

  // Determine if payment needs driver confirmation.
  // Be defensive with settings payload to avoid runtime crashes from malformed entries.
  const paymentMethods = Array.isArray(settings?.payment_methods)
    ? settings.payment_methods.filter((m) => m && typeof m === "object")
    : [];
  const paymentMethodKey = ride.payment_method || "cash";
  const pmCfg = paymentMethods.find((m) => m.key === paymentMethodKey);
  const requireDriverConfirmation = pmCfg
    ? !!pmCfg.require_driver_confirmation && !pmCfg.auto_charge
    : (ride.payment_method === "cash" || !ride.payment_method);

  // Is payment already confirmed (by driver or auto)?
  const isPaid = ride.payment_status === "paid" || ride.payment_status === "not_required";

  // While waiting for confirmation: poll the ride every 5 seconds
  const waitingForPayment = isCompleted && requireDriverConfirmation && !isPaid;
  const pollRef = useRef<NodeJS.Timeout | null>(null);
  const channelRef = useRef<any>(null);

  useEffect(() => {
    if (!waitingForPayment || !ride?.id) return;

    // Clean up previous subscription first
    if (channelRef.current) {
      try {
        channelRef.current.unsubscribe();
      } catch (_) {}
      channelRef.current = null;
    }

    // Create new channel with unique timestamp to avoid collisions
    const channelName = `payment_confirm:${ride.id}:${Date.now()}`;
    const channel = supabase.channel(channelName);
    
    channel
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "ride_requests", filter: `id=eq.${ride.id}` }, (event) => {
        if (event.new?.id === ride.id) {
          setRide(prev => ({ ...prev, ...event.new }));
        }
      })
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          channelRef.current = channel;
        } else if (status === "CHANNEL_ERROR") {
          console.warn("Realtime subscription failed, using polling only");
        }
      });

    // Also poll every 5s as fallback
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      try {
        const data = await supabaseApi.rideRequests.list({ id: ride.id });
        if (data?.[0]) setRide(data[0]);
      } catch (_) {}
    }, 5000);

    return () => {
      if (channelRef.current) {
        try {
          channelRef.current.unsubscribe();
        } catch (_) {}
      }
      channelRef.current = null;
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [waitingForPayment, ride?.id]);

  // Stop polling when paid
  useEffect(() => {
    if (isPaid) {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
      if (channelRef.current) {
        try {
          channelRef.current.unsubscribe();
        } catch (_) {}
        channelRef.current = null;
      }
    }
  }, [isPaid]);

  // Keep the summary visible until the passenger explicitly continues to rating.

  const amountRemainingToPay = walletUsed > 0
    ? Math.max(0, totalPrice - walletUsed)
    : totalPrice;

  const handleSubmitRating = async () => {
    if (rating === 0) { onDone(); return; }
    setSaving(true);
    await supabaseApi.rideRequests.update(ride.id, {
      passenger_rating_for_driver: rating,
    });
    if (ride.driver_id) {
      try {
        const allRides = await supabaseApi.rideRequests.list({ driver_id: ride.driver_id });
        const rated = allRides.filter(r => r.passenger_rating_for_driver > 0);
        if (rated.length > 0) {
          const avg = rated.reduce((s, r) => s + r.passenger_rating_for_driver, 0) / rated.length;
          await supabaseApi.drivers.update(ride.driver_id, { rating: parseFloat(avg.toFixed(1)) });
        }
      } catch (_) {}
    }
    setRide(r => ({ ...r, passenger_rating_for_driver: rating }));
    setSaving(false);
    onDone();
  };

  // ── Rating step ──
  if (step === "rating" && isCompleted) {
    const labels = ["", "Muy malo", "Malo", "Regular", "Bueno", "Excelente"];
    return (
      <motion.div
        initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }}
        className="fixed inset-0 z-[200] bg-slate-900 flex flex-col items-center justify-center px-6"
        style={{ paddingTop: "env(safe-area-inset-top)", paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <div className="w-full max-w-sm text-center space-y-6">
          <div className="w-20 h-20 bg-amber-500/20 border-2 border-amber-400/40 rounded-3xl flex items-center justify-center mx-auto">
            <Star className="w-10 h-10 text-amber-400" />
          </div>
          <div>
            <h2 className="text-white font-black text-2xl">¿Cómo fue el servicio?</h2>
            <p className="text-white/40 text-sm mt-1">{ride.driver_name || "Tu conductor"}</p>
          </div>
          <StarRating value={rating} onChange={setRating} />
          {rating > 0 && <p className="text-amber-400 font-semibold">{labels[rating]}</p>}
          <div className="flex gap-3">
            <button onClick={onDone} className="flex-1 py-3 text-sm text-white/40 border border-white/10 rounded-2xl font-medium">Omitir</button>
            <Button onClick={handleSubmitRating} disabled={saving}
              className="flex-1 bg-amber-500 hover:bg-amber-600 rounded-2xl min-h-[48px] text-sm font-bold text-white">
              {saving ? "Guardando..." : "Enviar calificación"}
            </Button>
          </div>
        </div>
      </motion.div>
    );
  }

  // ── Waiting for driver payment confirmation ──
  if (waitingForPayment) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }}
        className="fixed inset-0 z-[200] bg-slate-900 flex flex-col items-center justify-center px-6"
        style={{ paddingTop: "env(safe-area-inset-top)", paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <div className="w-full max-w-sm text-center space-y-6">
          {/* Animated icon */}
          <div className="relative w-24 h-24 mx-auto flex items-center justify-center">
            <div className="absolute inset-0 rounded-full border-2 border-amber-400/20 animate-ping" />
            <div className="w-24 h-24 bg-amber-500/15 border-2 border-amber-400/40 rounded-full flex items-center justify-center">
              <Clock className="w-11 h-11 text-amber-400" />
            </div>
          </div>

          <div>
            <h2 className="text-white font-black text-2xl">Esperando confirmación</h2>
            <p className="text-white/50 text-sm mt-2 leading-relaxed">
              El conductor está confirmando el pago. Esta pantalla se actualizará automáticamente.
            </p>
          </div>

          {/* Amount to pay */}
          {amountRemainingToPay > 0 && (
            <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-5 text-center space-y-1">
              <p className="text-amber-300 text-xs font-semibold uppercase tracking-wide">Monto a pagar al conductor</p>
              <p className="text-amber-400 font-black text-4xl">${amountRemainingToPay.toFixed(2)}</p>
              <p className="text-white/30 text-xs">{getPaymentMethodLabel(ride.payment_method, settings)}</p>
            </div>
          )}

          {/* Service summary */}
          <div className="bg-white/5 border border-white/10 rounded-2xl p-4 text-left space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-white/40">Servicio</span>
              <span className="text-white font-medium">{ride.service_type_name || "—"}</span>
            </div>
            {serviceDescription && (
              <div className="text-white/50 text-xs leading-snug">{serviceDescription}</div>
            )}
            <div className="flex justify-between">
              <span className="text-white/40">Conductor</span>
              <span className="text-white">{ride.driver_name || "—"}</span>
            </div>
            <div className="flex justify-between border-t border-white/10 pt-2">
              <span className="text-white/40">Total</span>
              <span className="text-emerald-400 font-bold text-base">${totalPrice.toFixed(2)}</span>
            </div>
          </div>

          <div className="flex items-center gap-2 justify-center text-white/30 text-xs">
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            Actualizando en tiempo real...
          </div>
        </div>
      </motion.div>
    );
  }

  // ── Summary step (payment confirmed or auto) ──
  return (
    <motion.div
      initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }}
      className="fixed inset-0 z-[200] bg-slate-900 flex flex-col"
      style={{ paddingTop: "env(safe-area-inset-top)", paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="flex-1 overflow-y-auto px-5 py-8 flex flex-col gap-5">

        {/* Header */}
        {isCompleted && (
          <div className="text-center space-y-2">
            <div className="w-20 h-20 bg-emerald-500/20 border-2 border-emerald-400/30 rounded-3xl flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-10 h-10 text-emerald-400" />
            </div>
            <h1 className="text-white font-black text-2xl">¡Servicio completado!</h1>
            <p className="text-white/40 text-sm">Gracias por usar nuestro servicio</p>
          </div>
        )}

        {isCancelled && hasCancellationFee && (
          <div className="text-center space-y-2">
            <div className="w-20 h-20 bg-amber-500/20 border-2 border-amber-500/30 rounded-3xl flex items-center justify-center mx-auto">
              <AlertCircle className="w-10 h-10 text-amber-400" />
            </div>
            <h1 className="text-white font-black text-xl">Servicio cancelado con cargo</h1>
            <p className="text-white/40 text-sm">
              {ride.cancelled_by === "passenger" ? "Cancelaste fuera del tiempo de tolerancia" : "El servicio fue cancelado"}
            </p>
          </div>
        )}

        {isCancelled && !hasCancellationFee && (
          <div className="text-center space-y-2">
            <div className="w-20 h-20 bg-white/5 border-2 border-white/10 rounded-3xl flex items-center justify-center mx-auto">
              <XCircle className="w-10 h-10 text-white/40" />
            </div>
            <h1 className="text-white font-black text-xl">Servicio cancelado</h1>
            <p className="text-emerald-400 text-sm font-medium">Sin cargo por cancelación</p>
          </div>
        )}

        {/* Cost card */}
        {isCompleted && (
          <div className="bg-white/5 border border-white/10 rounded-2xl p-5 space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-white/40 text-sm">Costo total</span>
              <span className="text-white font-black text-2xl">${totalPrice.toFixed(2)}</span>
            </div>
            {serviceDescription && (
              <p className="text-white/50 text-xs leading-snug">{serviceDescription}</p>
            )}
            {fareProtectionEnabled && (
              <div className="bg-emerald-500/10 border border-emerald-500/25 rounded-xl px-3 py-2">
                <p className="text-emerald-300 text-xs font-semibold">✅ {fareProtectionLabel}</p>
              </div>
            )}
            {walletUsed > 0 && (
              <div className="flex justify-between items-center">
                <span className="text-violet-300 text-sm">💜 Cubierto con wallet</span>
                <span className="text-violet-300 font-semibold text-sm">-${Math.min(walletUsed, totalPrice).toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between items-center border-t border-white/10 pt-3">
              <span className="text-white/40 text-sm">Método</span>
              <span className="text-white/70 text-sm">{getPaymentMethodLabel(ride.payment_method, settings)}</span>
            </div>
            {/* Payment confirmed */}
            <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-4 py-3 text-center">
              <p className="text-emerald-400 font-bold text-base">✅ Pagado</p>
            </div>
          </div>
        )}

        {/* Cancellation fee */}
        {isCancelled && hasCancellationFee && (
          <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-5 text-center space-y-2">
            <p className="text-amber-300 text-xs font-medium uppercase tracking-wide">Cargo por cancelación tardía</p>
            <p className="text-amber-400 font-black text-4xl">${ride.cancellation_fee.toFixed(2)}</p>
            <p className="text-white/40 text-xs">Este monto será añadido a tu saldo pendiente</p>
          </div>
        )}

        {/* Debt warning with payment methods */}
        {(hasDebt || ride.payment_status === "debt" || ride.payment_reported_unpaid) && (
          <DebtPaymentSection
            ride={ride}
            pendingBalance={pendingBalance}
            settings={settings}
          />
        )}

        {/* No cancellation fee */}
        {isCancelled && !hasCancellationFee && (
          <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-4 flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0" />
            <p className="text-emerald-300 text-sm font-medium">Cancelación gratuita — dentro del tiempo de tolerancia</p>
          </div>
        )}

        {/* Cancelled by who */}
        {isCancelled && ride.cancelled_by && (
          <div className="bg-white/5 border border-white/10 rounded-2xl p-4 text-sm space-y-1.5">
            <div className="flex justify-between">
              <span className="text-white/40">Cancelado por</span>
              <span className="text-white/70 font-medium">
                {ride.cancelled_by === "passenger" ? "Tú (pasajero)" : ride.cancelled_by === "driver" ? "El conductor" : "Administrador"}
              </span>
            </div>
            {ride.cancellation_reason && (
              <div className="flex justify-between">
                <span className="text-white/40">Motivo</span>
                <span className="text-white/60 text-right max-w-[60%]">{ride.cancellation_reason}</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="px-5 pb-5 space-y-3">
        {isCompleted && !ride.passenger_rating_for_driver && (
          <Button
            onClick={() => setStep("rating")}
            className="w-full bg-amber-500 hover:bg-amber-600 rounded-2xl h-12 font-bold text-white"
          >
            <Star className="w-4 h-4 mr-2" /> Calificar al conductor
          </Button>
        )}
        <Button
          onClick={isCompleted && !ride.passenger_rating_for_driver ? () => setStep("rating") : onDone}
          variant={isCompleted && !ride.passenger_rating_for_driver ? "outline" : "default"}
          className={`w-full rounded-2xl h-12 font-bold ${
            isCompleted && !ride.passenger_rating_for_driver
              ? "border-white/20 text-white/50 bg-transparent hover:bg-white/5"
              : "bg-blue-600 hover:bg-blue-700 text-white"
          }`}
        >
          {isCompleted && !ride.passenger_rating_for_driver ? "Omitir calificación" : "Volver al inicio"}
        </Button>
      </div>
    </motion.div>
  );
}
