/**
 * RideSummaryScreen — Pantalla final para el CONDUCTOR
 *
 * Muestra:
 *  - Si el viaje fue completado o cancelado
 *  - Ganancia del conductor
 *  - Botón "Confirmar pago" si require_driver_confirmation = true
 *  - Calificación del pasajero (solo en viajes completados)
 */
import React, { useState } from "react";
import { motion } from "framer-motion";
import { CheckCircle2, XCircle, Star, AlertTriangle, ThumbsUp, ThumbsDown, Timer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabaseApi } from "@/lib/supabaseApi";
import { toast } from "sonner";

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
          <Star className={`w-9 h-9 transition-all ${s <= active ? "fill-amber-400 text-amber-400 scale-110" : "text-slate-200"}`} />
        </button>
      ))}
    </div>
  );
}

export default function RideSummaryScreen({ ride, driver, paymentMethodConfig, onDone }) {
  const isCompleted = ride.status === "completed";
  const isCancelled = ride.status === "cancelled";
  const hasCancellationFee = (ride.cancellation_fee || 0) > 0;
  const isWaitTimeExpired = ride.cancellation_reason === "Tiempo de espera agotado";
  const cancelledByPassenger = ride.cancelled_by === "passenger";
  const cancelledByAdmin = ride.cancelled_by === "admin";
  const cancelledByDriver = ride.cancelled_by === "driver";
  const earnings = ride.driver_earnings || 0;

  // Wallet + complementary: wallet covered part, remaining paid by another method
  const walletUsed = ride.wallet_amount_used || 0;
  const totalPrice = ride.final_price ?? ride.estimated_price ?? 0;
  const transferDistanceKm = ride.distance_km ?? ride?.extra_charges?.pricing_audit?.distance_km ?? null;
  const transferMinutes = ride.duration_minutes ?? ride?.extra_charges?.pricing_audit?.duration_min ?? null;
  const isProtectedFare = ride?.extra_charges?.pricing_audit?.mode === "protected";

  // require_driver_confirmation: depende de la configuración del método de pago.
  // Si no requiere confirmación, se marca como pagado automático para conductor y pasajero.
  const requireConfirmation = !!paymentMethodConfig?.require_driver_confirmation;

  // Monto que el cliente debe pagar al conductor:
  // - Si hay wallet: solo el faltante (el resto ya fue cubierto)
  // - Si no hay wallet: el total completo
  const amountClientOwes = walletUsed > 0
    ? Math.max(0, totalPrice - walletUsed)
    : totalPrice;

  const [paymentAction, setPaymentAction] = useState(null); // 'confirmed' | 'unpaid'
  const [rating, setRating] = useState(0);
  const [saving, setSaving] = useState(false);
  const [step, setStep] = useState("summary"); // 'summary' | 'rating'

  // Auto-handle payment for auto_charge or no confirmation required
  React.useEffect(() => {
    if (!isCompleted) return;
    if (!requireConfirmation && paymentAction === null) {
      supabaseApi.rideRequests.update(ride.id, { payment_status: "paid" }).catch(() => {});
      setPaymentAction("auto");
    }
   
  }, [isCompleted, requireConfirmation]);

  // Auto-transition to rating if payment already handled and not yet rated
  React.useEffect(() => {
    if (step !== "summary") return;
    if (isCompleted && !ride.driver_rating_for_passenger &&
        (paymentAction === "confirmed" || paymentAction === "auto" || paymentAction === "unpaid")) {
      setStep("rating");
    }
  }, [paymentAction]);

  const handleConfirmPaid = async () => {
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      toast.error("Sin internet: no puedes confirmar pago offline por seguridad.");
      return;
    }
    setSaving(true);
    try {
      await supabaseApi.rideRequests.update(ride.id, {
        payment_status: "paid",
        payment_confirmed_by_driver: true,
      });
      setPaymentAction("confirmed");
    } catch (err) {
      console.error("Error confirming payment:", err);
    }
    setSaving(false);
    // Move to rating step if completed
    if (isCompleted && !ride.driver_rating_for_passenger) {
      setStep("rating");
    }
  };

  const handleReportUnpaid = async () => {
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      toast.error("Sin internet: no puedes reportar adeudo offline por seguridad.");
      return;
    }
    setSaving(true);
    try {
      const price = ride.final_price ?? ride.estimated_price ?? 0;
      // Mark ride as debt + notify passenger
      await supabaseApi.rideRequests.update(ride.id, {
        payment_status: "debt",
        payment_reported_unpaid: true,
      });
      // Add to passenger pending balance if we have user_id
      if (ride.passenger_user_id) {
        try {
          const u = await supabaseApi.passengers.get(ride.passenger_user_id);
          if (u) {
            await supabaseApi.passengers.update(u.id, {
              pending_balance: (u.pending_balance || 0) + price,
            });
          }
        } catch (err) {
          console.error("Error updating passenger balance:", err);
        }
      }

      // Create support ticket automatically for unpaid payment report
      try {
        await supabaseApi.supportTickets.create({
          subject: `Pago no recibido - Servicio #${ride.service_id || ride.id}`,
          description: `El conductor reportó que no recibió el pago de $${price.toFixed(2)} por el servicio ${ride.service_type_name || "de transporte"}. Servicio completado el ${new Date(ride.ended_at || ride.updated_at).toLocaleString('es-MX')}.\n\nDetalles del servicio:\n- Pasajero: ${ride.passenger_name}\n- Teléfono: ${ride.passenger_phone || "No disponible"}\n- Método de pago: ${ride.payment_method || "efectivo"}\n- Monto adeudado: $${price.toFixed(2)}`,
          passenger_user_id: ride.passenger_user_id,
          passenger_name: ride.passenger_name,
          passenger_phone: ride.passenger_phone,
          ride_id: ride.id,
          service_id: ride.service_id,
          priority: "high",
          status: "open",
          category: "payment_issue",
          submitted_by: "driver_auto_report",
        });
        console.log("Support ticket created for unpaid payment report");
      } catch (ticketErr) {
        console.error("Error creating support ticket:", ticketErr);
        // Don't fail the whole operation if ticket creation fails
      }
    } catch (err) {
      console.error("Error reporting unpaid:", err);
    }
    setPaymentAction("unpaid");
    setSaving(false);
    if (isCompleted && !ride.driver_rating_for_passenger) {
      setStep("rating");
    }
  };

  const handleSubmitRating = async () => {
    if (rating === 0) { onDone(); return; }
    setSaving(true);
    try {
      await supabaseApi.rideRequests.update(ride.id, {
        driver_rating_for_passenger: rating,
      });
      // Update passenger's aggregate rating on road_assist_users
      if (ride.passenger_user_id) {
        try {
          const u = await supabaseApi.passengers.get(ride.passenger_user_id);
          if (u) {
            const count = (u.rating_count || 0) + 1;
            const newRating = parseFloat((((u.rating || 5) * (count - 1) + rating) / count).toFixed(2));
            await supabaseApi.passengers.update(u.id, { rating: newRating, rating_count: count });
          }
        } catch (err) {
          console.error("Error updating passenger rating:", err);
        }
      }
    } catch (err) {
      console.error("Error submitting rating:", err);
    }
    setSaving(false);
    onDone();
  };

  // ── Rating step ──
  if (step === "rating") {
    const labels = ["", "Muy malo", "Malo", "Regular", "Bueno", "Excelente"];
    return (
      <motion.div
        initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
        className="fixed inset-0 z-[200] bg-slate-900 flex flex-col items-center justify-center px-6"
        style={{ paddingTop: "env(safe-area-inset-top)", paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <div className="w-full max-w-sm text-center space-y-6">
          <div className="w-20 h-20 bg-amber-500/20 border-2 border-amber-400/40 rounded-3xl flex items-center justify-center mx-auto">
            <Star className="w-10 h-10 text-amber-400" />
          </div>
          <div>
            <h2 className="text-white font-black text-2xl">Califica al pasajero</h2>
            <p className="text-white/40 text-sm mt-1">{ride.passenger_name}</p>
          </div>
          <StarRating value={rating} onChange={setRating} />
          {rating > 0 && <p className="text-amber-400 font-semibold">{labels[rating]}</p>}
          <div className="flex gap-3">
            <button onClick={onDone} className="flex-1 py-3 text-sm text-white/40 border border-white/10 rounded-2xl font-medium">Omitir</button>
            <Button onClick={handleSubmitRating} disabled={saving}
              className="flex-1 bg-amber-500 hover:bg-amber-600 rounded-2xl min-h-[48px] text-sm font-bold text-white">
              {saving ? "Guardando..." : "Enviar"}
            </Button>
          </div>
        </div>
      </motion.div>
    );
  }

  // ── Summary step ──
  return (
    <motion.div
      initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[200] bg-slate-900 flex flex-col"
      style={{ paddingTop: "env(safe-area-inset-top)", paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="flex-1 overflow-y-auto px-5 py-8 flex flex-col gap-5">

        {/* Status header */}
        {isCompleted ? (
          <div className="text-center space-y-3">
            <div className="w-20 h-20 bg-emerald-500/20 border-2 border-emerald-400/40 rounded-3xl flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-10 h-10 text-emerald-400" />
            </div>
            <h1 className="text-white font-black text-2xl">¡Servicio completado!</h1>
            <p className="text-white/40 text-sm">Folio #{ride.service_id || ride.id?.slice(-6)}</p>
          </div>
        ) : isCancelled ? (
          <div className="text-center space-y-3">
            <div className={`w-20 h-20 border-2 rounded-3xl flex items-center justify-center mx-auto ${isWaitTimeExpired ? 'bg-amber-500/20 border-amber-400/40' : 'bg-red-500/20 border-red-400/40'}`}>
              {isWaitTimeExpired
                ? <Timer className="w-10 h-10 text-amber-400" />
                : <XCircle className="w-10 h-10 text-red-400" />}
            </div>
            <h1 className="text-white font-black text-2xl">
              {isWaitTimeExpired ? "Tiempo de espera agotado" : "Servicio cancelado"}
            </h1>
            {isWaitTimeExpired && (
              <p className="text-amber-400/80 text-sm">El pasajero no se presentó a tiempo. Se aplicó cargo por espera.</p>
            )}
            <p className="text-white/40 text-xs">Folio #{ride.service_id || ride.id?.slice(-6)}</p>
          </div>
        ) : null}

        {/* Earnings card — TARIFA arriba en grande, cobro pendiente / pagado, TU GANANCIA abajo */}
        {isCompleted && (
          <div className="bg-white/5 border border-blue-500/20 rounded-2xl p-5 text-center space-y-2">
            <p className="text-white/40 text-xs font-medium uppercase tracking-wide">Tarifa del servicio</p>
            <p className="text-white font-black text-5xl">${totalPrice.toFixed(2)}</p>

            {/* Pago combinado: desglose wallet */}
            {walletUsed > 0 && (
              <p className="text-violet-300 text-xs">💜 Wallet cubrió ${Math.min(walletUsed, totalPrice).toFixed(2)}</p>
            )}

            {/* Si requiere confirmación y aún no se ha accionado: mostrar monto a cobrar en rojo */}
            {requireConfirmation && paymentAction === null && amountClientOwes > 0 && (
              <div className="bg-red-500/20 border border-red-500/40 rounded-xl px-4 py-2.5 mt-1">
                <p className="text-red-300 text-xs font-medium uppercase tracking-wide mb-0.5">Por cobrar al cliente</p>
                <p className="text-red-400 font-black text-2xl">${amountClientOwes.toFixed(2)}</p>
                <p className="text-white/40 text-xs mt-1 capitalize">Método: {ride.payment_method || "efectivo"}</p>
              </div>
            )}

            {/* Si no requiere confirmación (auto) o ya fue confirmado: pagado */}
            {(!requireConfirmation || paymentAction === "confirmed" || paymentAction === "auto") && (
              <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl px-4 py-2 mt-1">
                <p className="text-emerald-400 font-semibold text-sm">
                  {paymentAction === "confirmed" ? "✅ Pago confirmado por conductor" : "✅ Pagado automáticamente"}
                </p>
              </div>
            )}

            {/* No pagó */}
            {paymentAction === "unpaid" && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-2 mt-1">
                <p className="text-red-400 font-semibold text-sm">⚠️ No pagado reportado</p>
              </div>
            )}

            <div className="border-t border-white/10 pt-3 space-y-1">
              {(ride.wallet_excess_amount || 0) > 0 && (
                <p className="text-red-400 text-sm font-bold">⚠️ Pasajero debe pagar en efectivo: ${ride.wallet_excess_amount.toFixed(2)}</p>
              )}
              {(ride.wallet_refund_amount || 0) > 0 && (
                <p className="text-violet-300 text-xs">↩️ Devuelto al wallet: ${ride.wallet_refund_amount.toFixed(2)}</p>
              )}
            </div>
          </div>
        )}

        {/* Cancellation fee card */}
        {isCancelled && (
          <div className={`border rounded-2xl p-4 space-y-2 ${hasCancellationFee ? 'bg-amber-500/10 border-amber-500/20' : 'bg-white/5 border-white/10'}`}>
            <p className={`text-xs font-medium uppercase tracking-wide text-center ${hasCancellationFee ? 'text-amber-300' : 'text-white/40'}`}>
              {isWaitTimeExpired ? "⏰ Cargo por tiempo de espera" : hasCancellationFee ? "💰 Cargo por cancelación" : "Cancelación sin cargo"}
            </p>

            {/* Who cancelled + reason */}
            <div className="text-center space-y-1">
              {ride.cancelled_by && (
                <p className="text-white/50 text-sm">
                  Cancelado por:{" "}
                  {cancelledByPassenger ? "🧑 Pasajero" : cancelledByAdmin ? "🛡️ Administrador" : "🚗 Conductor"}
                </p>
              )}
              {ride.cancellation_reason && (
                <p className="text-red-400/80 text-sm italic">"{ride.cancellation_reason}"</p>
              )}
            </div>

            {/* Fee breakdown */}
            {hasCancellationFee ? (
              <div className="bg-white/5 rounded-xl px-4 py-3 space-y-2 mt-1">
                <div className="flex justify-between text-sm">
                  <span className="text-white/50">Cargo por cancelación</span>
                  <span className="text-amber-300 font-bold">${ride.cancellation_fee.toFixed(2)}</span>
                </div>
                {(ride.commission_rate || 0) > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-white/40">Comisión plataforma ({ride.commission_rate}%)</span>
                    <span className="text-red-400/80">
                      -${(ride.platform_commission != null && ride.platform_commission > 0
                        ? ride.platform_commission
                        : parseFloat((ride.cancellation_fee * (ride.commission_rate / 100)).toFixed(2))
                      ).toFixed(2)}
                    </span>
                  </div>
                )}
                <div className="border-t border-emerald-500/30 pt-2 flex justify-between">
                  <span className="text-emerald-300 font-bold text-sm">✅ TU GANANCIA</span>
                  <span className="text-emerald-400 font-black text-xl">
                    ${(ride.driver_earnings > 0
                      ? ride.driver_earnings
                      : parseFloat((ride.cancellation_fee * (1 - (ride.commission_rate || 0) / 100)).toFixed(2))
                    ).toFixed(2)}
                  </span>
                </div>
              </div>
            ) : (
              <p className="text-white/30 text-xs text-center mt-1">
                {cancelledByPassenger ? "El pasajero canceló sin costo para ti." : cancelledByAdmin ? "El administrador canceló sin costo para ti." : "Sin cargo aplicado."}
              </p>
            )}
          </div>
        )}

        {/* Payment section (only for completed rides) */}
        {isCompleted && requireConfirmation && paymentAction === null && (
          <div className="bg-white/5 border border-blue-500/20 rounded-2xl p-5 space-y-4">
            <div className="text-center space-y-1">
              <p className="text-white font-semibold text-sm">¿Recibiste el pago del cliente?</p>
              {amountClientOwes > 0 && (
                <>
                  <p className="text-red-400 font-black text-2xl">${amountClientOwes.toFixed(2)}</p>
                  <p className="text-white/40 text-xs capitalize">Método: {ride.payment_method || "efectivo"}</p>
                  {walletUsed > 0 && (
                    <p className="text-violet-300 text-xs">💜 Wallet cubrió ${walletUsed.toFixed(2)}</p>
                  )}
                </>
              )}
            </div>
            <div className="flex gap-3">
              <button onClick={handleReportUnpaid} disabled={saving}
                className="flex-1 flex flex-col items-center gap-2 py-4 bg-red-500/10 border border-red-500/20 rounded-2xl text-red-400 hover:bg-red-500/20 transition-colors">
                <ThumbsDown className="w-5 h-5" />
                <span className="text-xs font-semibold">No pagó</span>
              </button>
              <button onClick={handleConfirmPaid} disabled={saving}
                className="flex-1 flex flex-col items-center gap-2 py-4 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl text-emerald-400 hover:bg-emerald-500/20 transition-colors">
                <ThumbsUp className="w-5 h-5" />
                <span className="text-xs font-semibold">Sí pagó</span>
              </button>
            </div>
          </div>
        )}

        {/* Payment confirmed */}
        {isCompleted && (paymentAction === "confirmed" || paymentAction === "auto") && (
          <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-4 flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0" />
            <p className="text-emerald-300 text-sm font-semibold">Pago confirmado ✓</p>
          </div>
        )}

        {/* Payment unpaid reported */}
        {isCompleted && paymentAction === "unpaid" && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-4 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-red-300 text-sm font-semibold">No pago reportado</p>
              <p className="text-white/40 text-xs mt-1">Se generó un adeudo al pasajero por ${totalPrice.toFixed(2)}</p>
            </div>
          </div>
        )}

        {/* Ride details — desglose completo */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-4 space-y-2.5 text-sm">
          <p className="text-white/40 text-xs font-medium uppercase tracking-wide">Detalle del servicio</p>
          <div className="flex justify-between"><span className="text-white/40">Pasajero</span><span className="text-white font-medium">{ride.passenger_name}</span></div>
          <div className="flex justify-between"><span className="text-white/40">Tipo de servicio</span><span className="text-white font-medium">{ride.service_type_name || "—"}</span></div>
          <div className="flex justify-between"><span className="text-white/40">Origen</span><span className="text-white font-medium text-right max-w-[65%]">{ride.pickup_address || "—"}</span></div>
          <div className="flex justify-between"><span className="text-white/40">Destino</span><span className="text-white font-medium text-right max-w-[65%]">{ride.dropoff_address || "—"}</span></div>
          {transferDistanceKm != null && (
            <div className="flex justify-between"><span className="text-white/40">Distancia</span><span className="text-white font-medium">{Number(transferDistanceKm).toFixed(2)} km</span></div>
          )}
          {transferMinutes != null && (
            <div className="flex justify-between"><span className="text-white/40">Tiempo de traslado</span><span className="text-white font-medium">{Math.round(Number(transferMinutes))} min</span></div>
          )}
          {(ride.pickup_lat && ride.pickup_lon) && (
            <div className="flex justify-between"><span className="text-white/40">Coordenadas origen</span><span className="text-white/70 text-right max-w-[65%] font-mono text-xs">{ride.pickup_lat}, {ride.pickup_lon}</span></div>
          )}
          {(ride.dropoff_lat && ride.dropoff_lon) && (
            <div className="flex justify-between"><span className="text-white/40">Coordenadas destino</span><span className="text-white/70 text-right max-w-[65%] font-mono text-xs">{ride.dropoff_lat}, {ride.dropoff_lon}</span></div>
          )}
          {isCompleted && (
            <div className="flex justify-between">
              <span className="text-white/40">Modalidad de cálculo</span>
              <span className={`text-xs font-bold ${isProtectedFare ? "text-emerald-300" : "text-blue-300"}`}>
                {isProtectedFare ? "Tarifa protegida" : "Tarifa dinámica"}
              </span>
            </div>
          )}
          {isCompleted && (
            <div className="border-t border-white/10 pt-2 mt-2 space-y-1.5">
              <p className="text-white/40 text-xs font-medium uppercase tracking-wide mb-1">Desglose de pago</p>
              <div className="flex justify-between"><span className="text-white/50">Costo del servicio</span><span className="text-white font-bold">${totalPrice.toFixed(2)}</span></div>
              {(ride.wallet_amount_used || 0) > 0 && (
                <div className="flex justify-between"><span className="text-violet-300">💜 Pagado con wallet</span><span className="text-violet-300 font-medium">-${Math.min(ride.wallet_amount_used, totalPrice).toFixed(2)}</span></div>
              )}
              {(ride.wallet_amount_used || 0) < totalPrice && ride.payment_method && ride.payment_method !== 'wallet' && (
                <div className="flex justify-between"><span className="text-white/50 capitalize">💳 {ride.payment_method === 'cash' ? 'Efectivo' : ride.payment_method}</span><span className="text-white font-medium">${Math.max(0, totalPrice - (ride.wallet_amount_used || 0)).toFixed(2)}</span></div>
              )}
              {(ride.wallet_excess_amount || 0) > 0 && (
                <div className="flex justify-between"><span className="text-red-400 font-semibold">⚠️ Pendiente pasajero (efectivo)</span><span className="text-red-400 font-bold">${ride.wallet_excess_amount.toFixed(2)}</span></div>
              )}
              <div className="border-t border-white/10 pt-1.5 flex justify-between">
                <span className="text-white/40">Comisión plataforma ({ride.commission_rate || 0}%)</span>
                <span className="text-red-400/80">-${(
                  ride.platform_commission != null && ride.platform_commission > 0
                    ? ride.platform_commission
                    : parseFloat(((totalPrice) * ((ride.commission_rate || 0) / 100)).toFixed(2))
                ).toFixed(2)}</span>
              </div>
              <div className="flex justify-between border-t border-emerald-500/30 pt-1.5 mt-1"><span className="text-emerald-300 font-bold text-sm">✅ TU GANANCIA</span><span className="text-emerald-400 font-black text-xl">${earnings.toFixed(2)}</span></div>
            </div>
          )}
          {!isCompleted && (
            <div className="flex justify-between"><span className="text-white/40">Método de pago</span><span className="text-white/70 capitalize">{ride.payment_method || "efectivo"}</span></div>
          )}
        </div>
      </div>

      {/* Done button — only show if not waiting for payment confirmation */}
      {(isCancelled || paymentAction !== null || !requireConfirmation) && (
        <div className="px-5 pb-5">
          <Button
            onClick={() => {
              if (isCompleted && !ride.driver_rating_for_passenger && paymentAction !== null) {
                setStep("rating");
              } else {
                onDone();
              }
            }}
            className={`w-full rounded-2xl h-14 font-bold text-base ${isCancelled && !cancelledByDriver ? "bg-emerald-600 hover:bg-emerald-700" : "bg-blue-600 hover:bg-blue-700"}`}
          >
            {isCancelled && !cancelledByDriver
              ? "✅ Aceptar — Volver en línea"
              : isCompleted && !ride.driver_rating_for_passenger
              ? "Calificar al pasajero"
              : "Volver al inicio"}
          </Button>
        </div>
      )}
    </motion.div>
  );
}
