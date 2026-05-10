"use client";

import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { supabaseApi } from "@/lib/supabaseApi";
import { useQueryClient } from "@tanstack/react-query";
import { Star } from "lucide-react";
import { toast } from "sonner";

export default function RateDriverDialog({ ride, open, onOpenChange }) {
  const [rating, setRating] = useState(5);
  const [hover, setHover] = useState(0);
  const [comment, setComment] = useState("");
  const [saving, setSaving] = useState(false);
  const queryClient = useQueryClient();

  const handleSave = async () => {
    setSaving(true);
    await supabaseApi.rideRequests.update(ride.id, {
      admin_rating: rating,
      admin_rating_comment: comment,
    });
    // Update driver average rating ONLY — do not change driver status
    if (ride.driver_id) {
      const driverRides = await supabaseApi.rideRequests.list({ driver_id: ride.driver_id });
      // Include current rating in the calculation (it was just saved to the ride)
      const allRated = [...driverRides.filter(r => r.admin_rating && r.id !== ride.id), { admin_rating: rating }];
      const avg = allRated.reduce((s, r) => s + r.admin_rating, 0) / allRated.length;
      // Only update rating field — never touch status, suspension, or any other driver field
      await supabaseApi.drivers.update(ride.driver_id, { rating: parseFloat(avg.toFixed(1)) });
    }
    queryClient.invalidateQueries({ queryKey: ["rides"] });
    queryClient.invalidateQueries({ queryKey: ["drivers"] });
    toast.success("Calificación guardada");
    setSaving(false);
    onOpenChange(false);
    setComment("");
    setRating(5);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[26.4rem]">
        <DialogHeader>
          <DialogTitle>Calificar conductor</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="text-center">
            <p className="text-sm text-slate-500 mb-1">Viaje de <span className="font-medium text-slate-800">{ride?.passenger_name}</span></p>
            <p className="text-xs text-slate-400">Conductor: {ride?.driver_name}</p>
          </div>
          <div className="flex items-center justify-center gap-1">
            {[1,2,3,4,5].map(n => (
              <button
                key={n}
                onMouseEnter={() => setHover(n)}
                onMouseLeave={() => setHover(0)}
                onClick={() => setRating(n)}
                className="p-1 transition-transform hover:scale-110"
              >
                <Star className={`w-8 h-8 transition-colors ${n <= (hover || rating) ? "fill-amber-400 text-amber-400" : "text-slate-200"}`} />
              </button>
            ))}
          </div>
          <p className="text-center text-sm font-medium text-slate-700">
            {rating === 1 ? "Muy malo" : rating === 2 ? "Malo" : rating === 3 ? "Regular" : rating === 4 ? "Bueno" : "Excelente"}
          </p>
          <div>
            <Label>Comentario (opcional)</Label>
            <Textarea value={comment} onChange={e => setComment(e.target.value)} rows={2} placeholder="Observaciones sobre el servicio..." />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving} className="bg-amber-500 hover:bg-amber-600">
            {saving ? "Guardando..." : "Guardar calificación"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
