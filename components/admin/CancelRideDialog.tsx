"use client";

import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { AlertTriangle } from "lucide-react";
import { supabaseApi } from "@/lib/supabaseApi";
import { useQueryClient } from "@tanstack/react-query";

export default function CancelRideDialog({ ride, policies, open, onOpenChange }) {
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const queryClient = useQueryClient();

  const applicablePolicy = (policies || []).find(p => {
    if (!p.is_active) return false;
    // applies_to_status can be an array or a JSON string
    let statuses = p.applies_to_status;
    if (typeof statuses === "string") {
      try { statuses = JSON.parse(statuses); } catch { statuses = [statuses]; }
    }
    return Array.isArray(statuses) && statuses.includes(ride?.status);
  });

  const cancellationFee = applicablePolicy
    ? applicablePolicy.fee_type === "fixed"
      ? applicablePolicy.fee_amount
      : ((ride?.estimated_price || 0) * applicablePolicy.fee_amount) / 100
    : 0;

  // Check if within free cancellation window (use current time in configured TZ)
  const withinFreeWindow = applicablePolicy?.free_cancellation_minutes > 0 && (() => {
    const createdAt = ride?.created_date ? new Date(ride.created_date).getTime() : 0;
    const elapsedMin = (Date.now() - createdAt) / 60000;
    return elapsedMin <= applicablePolicy.free_cancellation_minutes;
  })();
  const effectiveFee = withinFreeWindow ? 0 : cancellationFee;

  const handleCancel = async () => {
    setSaving(true);
    const updates: any = {
      status: "cancelled",
      cancelled_by: "admin",
      cancellation_reason: reason,
      cancellation_fee: effectiveFee,
    };

    if (effectiveFee > 0 && ride.driver_id) {
      // Find driver to get commission rate
      let commissionRate = 20;
      try {
        const drivers = await supabaseApi.drivers.list({ id: ride.driver_id });
        commissionRate = drivers[0]?.commission_rate ?? 20;
      } catch {}
      const platformCommission = parseFloat((effectiveFee * commissionRate / 100).toFixed(2));
      const driverEarnings = parseFloat((effectiveFee - platformCommission).toFixed(2));
      updates.final_price = effectiveFee;
      updates.driver_earnings = driverEarnings;
      updates.platform_commission = platformCommission;
    } else {
      // No cost cancellation
      updates.final_price = 0;
      updates.driver_earnings = 0;
      updates.platform_commission = 0;
    }

    await supabaseApi.rideRequests.update(ride.id, updates);
    // Note: Driver status change is handled by the driver app when they acknowledge the cancellation
    queryClient.invalidateQueries({ queryKey: ["rides"] });
    queryClient.invalidateQueries({ queryKey: ["drivers"] });
    setSaving(false);
    onOpenChange(false);
    setReason("");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[30.8rem]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-red-600">
            <AlertTriangle className="w-5 h-5" /> Cancelar viaje
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="bg-red-50 rounded-xl p-4 text-sm space-y-3">
            <p className="font-medium text-red-800">
              ¿Cancelar el viaje de <strong>{ride?.passenger_name}</strong>?
            </p>
            {applicablePolicy ? (
              withinFreeWindow ? (
                <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3">
                  <p className="text-emerald-700 font-semibold text-sm">✓ Cancelación gratuita</p>
                  <p className="text-emerald-600 text-xs mt-0.5">Dentro del período de {applicablePolicy.free_cancellation_minutes} min — sin cargo al pasajero</p>
                </div>
              ) : effectiveFee > 0 ? (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                  <p className="text-amber-700 font-semibold text-sm">⚠️ Se cobrará cargo por cancelación</p>
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-amber-600 text-xs">Cargo ({applicablePolicy.fee_type === "fixed" ? "fijo" : `${applicablePolicy.fee_amount}%`})</span>
                    <span className="text-amber-800 font-black text-xl">${effectiveFee.toFixed(2)}</span>
                  </div>
                  <p className="text-amber-600/70 text-xs mt-1">Política: {applicablePolicy.name}</p>
                </div>
              ) : (
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
                  <p className="text-slate-600 text-xs">Sin cargo aplicable para el estado "{ride?.status}"</p>
                </div>
              )
            ) : (
              <div className="bg-slate-50 border border-slate-100 rounded-lg p-3">
                <p className="text-slate-500 text-xs">Sin política de cancelación activa — sin cargo</p>
              </div>
            )}
          </div>
          <div>
            <Label>Razón de cancelación</Label>
            <Textarea
              value={reason}
              onChange={e => setReason(e.target.value)}
              placeholder="Motivo de la cancelación..."
              rows={3}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Volver</Button>
          <Button variant="destructive" onClick={handleCancel} disabled={saving}>
            {saving ? "Cancelando..." : "Confirmar cancelación"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
