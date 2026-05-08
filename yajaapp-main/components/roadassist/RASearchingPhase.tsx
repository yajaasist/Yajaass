import React, { useState, useEffect } from "react";
import { Car, CheckCircle, XCircle } from "lucide-react";

export default function SearchingPhase({
  ride,
  onCancel,
  cancelling,
  title = "Buscando conductor",
  subtitle = "Estamos encontrando el conductor más cercano para ti",
}) {
  const [dots, setDots] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setDots(d => (d + 1) % 4), 500);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="flex flex-col items-center justify-center px-4 py-5 text-center gap-4 bg-white rounded-2xl">
      <div className="relative w-28 h-28 flex items-center justify-center">
        {[1, 2, 3].map(i => (
          <div key={i} className="absolute rounded-full border-2 border-blue-400/30 animate-ping"
            style={{ width: `${i * 38}px`, height: `${i * 38}px`, animationDelay: `${(i - 1) * 0.4}s`, animationDuration: "1.8s" }} />
        ))}
        <div className="w-14 h-14 bg-blue-500 rounded-full flex items-center justify-center shadow-lg shadow-blue-500/40 relative z-10">
          <Car className="w-7 h-7 text-white" />
        </div>
      </div>
      <div>
        <h2 className="text-slate-900 font-black text-xl">{title}{".".repeat(dots)}</h2>
        <p className="text-slate-500 text-sm mt-1.5 leading-relaxed">{subtitle}</p>
      </div>
      <div className="w-full bg-slate-50 border border-slate-100 rounded-2xl p-3 text-left space-y-1.5">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-emerald-400 flex-shrink-0" />
          <p className="text-slate-700 text-sm truncate">{ride?.pickup_address}</p>
        </div>
        {ride?.dropoff_address && (
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-red-400 flex-shrink-0" />
            <p className="text-slate-600 text-sm truncate">{ride.dropoff_address}</p>
          </div>
        )}
        <div className="flex items-center justify-between pt-1.5 border-t border-slate-100">
          <span className="text-slate-400 text-xs">{ride?.service_type_name}</span>
          <span className="text-emerald-600 font-bold text-sm">${(ride?.estimated_price || 0).toFixed(0)}</span>
        </div>
      </div>
      <div className="flex items-center gap-3 w-full">
        {["Solicitado", "Buscando", "Asignando"].map((step, i) => (
          <div key={i} className="flex-1 flex flex-col items-center gap-1.5">
            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold
              ${i === 0 ? "bg-emerald-500 text-white" : i === 1 ? "bg-blue-500/20 border-2 border-blue-400 text-blue-600" : "bg-slate-100 text-slate-300"}`}>
              {i === 0 ? <CheckCircle className="w-3.5 h-3.5" /> : i === 1 ? <div className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" /> : <div className="w-1.5 h-1.5 rounded-full bg-slate-300" />}
            </div>
            <span className={`text-[10px] font-medium ${i === 0 ? "text-emerald-500" : i === 1 ? "text-blue-500" : "text-slate-300"}`}>{step}</span>
          </div>
        ))}
      </div>
      {onCancel && (
        <button
          onClick={onCancel}
          disabled={cancelling}
          className="w-full flex items-center justify-center gap-2 text-red-400 text-sm font-semibold border border-red-500/30 py-3 rounded-2xl bg-red-500/10 active:bg-red-500/20 transition-colors disabled:opacity-50">
          <XCircle className="w-4 h-4" />
          {cancelling ? "Cancelando..." : "Cancelar solicitud"}
        </button>
      )}
    </div>
  );
}
