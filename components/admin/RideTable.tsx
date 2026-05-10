import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import StatusBadge from "@/components/shared/StatusBadge";
import RateDriverDialog from "./RateDriverDialog";
import RideDetailDialog from "./RideDetailDialog";
import EditRideDialog from "./EditRideDialog";
import ETABadge from "./ETABadge";
import { UserCheck, XCircle, CheckCircle2, MapPin, Clock, Star, Image, Pencil, Download, Trash2 } from "lucide-react";
import { formatCDMX, formatStoredLocal } from "@/components/shared/dateUtils";

const statusActions = {
  pending: null,
  scheduled: null,
  auction: null,
  assigned: { next: "admin_approved", label: "Aprobar inicio", icon: CheckCircle2, color: "bg-blue-600 hover:bg-blue-700" },
  admin_approved: { next: "in_progress", label: "Iniciar viaje", icon: CheckCircle2, color: "bg-indigo-600 hover:bg-indigo-700" },
  en_route: { next: "arrived", label: "Marcar llegó", icon: CheckCircle2, color: "bg-slate-600 hover:bg-slate-700" },
  arrived: { next: "in_progress", label: "Iniciar viaje", icon: CheckCircle2, color: "bg-indigo-600 hover:bg-indigo-700" },
  in_progress: { next: "completed", label: "Completar viaje", icon: CheckCircle2, color: "bg-emerald-600 hover:bg-emerald-700" },
  completed: null,
  cancelled: null,
};

// Color de fondo según estado del servicio
const rowBgColors = {
  pending:       "bg-red-50 border-l-red-400",
  auction:       "bg-red-50 border-l-orange-400",
  no_drivers:    "bg-red-100 border-l-red-600",     // sin conductores → rojo intenso
  assigned:      "bg-green-50 border-l-green-400",
  admin_approved:"bg-green-50 border-l-indigo-400",
  en_route:      "bg-green-50 border-l-violet-400",
  arrived:       "bg-green-50 border-l-cyan-400",
  in_progress:   "bg-green-50 border-l-emerald-500",
  completed:     "bg-white border-l-slate-300",
  cancelled:     "bg-white border-l-red-200",
  scheduled:     "bg-blue-50 border-l-blue-400",
};

function hasDriverAccepted(ride) {
  return !!(ride?.driver_accepted_at || ride?.en_route_at || ride?.arrived_at || ride?.in_progress_at);
}

function hasCancellationFee(ride) {
  const fee = Number(ride?.cancellation_fee ?? 0);
  const finalPrice = Number(ride?.final_price ?? 0);
  return fee > 0 || (ride?.status === "cancelled" && finalPrice > 0);
}

function getResolvedDriverName(ride, drivers = []) {
  if (ride?.driver_name) return ride.driver_name;
  if (!ride?.driver_id) return "";
  return drivers.find((driver) => driver.id === ride.driver_id)?.full_name || "";
}

function getRideVisualState(ride) {
  const normalizedReason = String(ride?.cancellation_reason || "").toLowerCase();
  const accepted = hasDriverAccepted(ride) || ride?.status === "completed";
  const hasAssignedDriver = !!(ride?.driver_id || ride?.driver_name);
  const noDrivers =
    ride?.status === "no_drivers" ||
    (!hasAssignedDriver && normalizedReason.includes("sin conductores"));

  if (ride?.status === "completed") {
    return {
      badgeLabel: "Completado",
      badgeClass: "bg-emerald-50 text-emerald-700 border-emerald-200",
      rowClass: "bg-emerald-50 border-l-emerald-500",
      showReason: false,
    };
  }

  if (noDrivers) {
    return {
      badgeLabel: "Sin conductores disponibles",
      badgeClass: "bg-red-100 text-red-800 border-red-400 font-bold",
      rowClass: "bg-red-50 border-l-red-500",
      showReason: true,
    };
  }

  if (ride?.status === "cancelled") {
    if (accepted && hasCancellationFee(ride)) {
      return {
        badgeLabel: "Cancelado con costo",
        badgeClass: "bg-orange-50 text-orange-700 border-orange-200",
        rowClass: "bg-orange-50 border-l-orange-400",
        showReason: false,
      };
    }

    return {
      badgeLabel: "Cancelado sin costo",
      badgeClass: "bg-red-50 text-red-700 border-red-200",
      rowClass: "bg-red-50 border-l-red-300",
      showReason: false,
    };
  }

  return {
    badgeLabel: null,
    badgeClass: "",
    rowClass: rowBgColors[ride?.status] || "bg-white border-l-slate-200",
    // Do not show stale no-driver/cancellation messages on active assigned rides.
    showReason: !!ride?.cancellation_reason && ["cancelled", "no_drivers"].includes(ride?.status),
  };
}

/** Devuelve true si el ride auto/auction aún está dentro de la ventana de búsqueda de 3 minutos */
function isAutoSearching(ride, searchWindowSeconds = 180) {
  if (ride.assignment_mode !== "auto" && ride.assignment_mode !== "auction") return false;
  if (ride.status === "no_drivers") return false; // Si no hay conductores, habilitar botón
  if (!ride.requested_at) return false;
  if (ride.driver_accepted_at || ride.en_route_at) return false;
  const ageMs = Date.now() - new Date(ride.requested_at).getTime();
  return ageMs < searchWindowSeconds * 1000;
}

export default function RideTable({ rides = [], onAssign, onCancel, onUpdateStatus, onDelete, canEdit = true, canDelete = true, drivers = [], settings }) {
  const [rateRide, setRateRide] = useState(null);
  const [detailRide, setDetailRide] = useState(null);
  const [editRide, setEditRide] = useState(null);
  const [localOverrides, setLocalOverrides] = useState({}); // rideId -> updatedRide

  // Merge parent rides with local optimistic edits
  const displayRides = rides.map(r => localOverrides[r.id] ? { ...r, ...localOverrides[r.id] } : r);

  const handleRideSaved = (updatedRide) => {
    setLocalOverrides(prev => ({ ...prev, [updatedRide.id]: updatedRide }));
  };

  const exportCSV = () => {
    const csv = ["Pasajero,Conductor,Recogida,Destino,Servicio,Estado,Precio estimado,Precio final,KM,Pago,Fecha",
      ...rides.map(r => [
        r.passenger_name||"",r.driver_name||"",r.pickup_address||"",r.dropoff_address||"",
        r.service_type_name||"",r.status||"",r.estimated_price||"",r.final_price||"",
        r.distance_km||"",r.payment_method||"",
        r.created_date ? formatStoredLocal(r.created_date, "datetime") : ""
      ].map(v => `"${String(v).replace(/"/g,'""')}"`).join(","))
    ].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "viajes.csv"; a.click();
  };

  if (rides.length === 0) {
    return (
      <div className="text-center py-16 text-slate-400 bg-white rounded-2xl border border-slate-100">
        <Clock className="w-10 h-10 mx-auto mb-3 opacity-20" />
        <p className="font-medium">No hay viajes que mostrar</p>
        <p className="text-sm mt-1 opacity-60">Crea un viaje nuevo para comenzar</p>
      </div>
    );
  }

  return (
    <>
      <div className="flex justify-end mb-2">
        <Button variant="outline" size="sm" onClick={exportCSV} className="rounded-xl text-xs gap-1.5">
          <Download className="w-3.5 h-3.5" /> Exportar CSV
        </Button>
      </div>
      <div className="space-y-2">
        {displayRides.map(ride => {
          const action = statusActions[ride.status];
          const visualState = getRideVisualState(ride);
          const rowBg = visualState.rowClass;
          const resolvedDriverName = getResolvedDriverName(ride, drivers);
          const shouldShowDriverName =
            !!resolvedDriverName &&
            (ride.status === "completed" || hasCancellationFee(ride) || hasDriverAccepted(ride) || ride.status !== "assigned");

          return (
            <div
              key={ride.id}
              className={`rounded-2xl border border-slate-100 border-l-4 ${rowBg} p-4 hover:shadow-md transition-all cursor-pointer group`}
              onClick={() => setDetailRide(ride)}
            >
              <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1.5">
                    <p className="font-semibold text-slate-900 text-sm">{ride.passenger_name}</p>
                    <StatusBadge status={ride.status} label={visualState.badgeLabel || undefined} className={visualState.badgeClass} />
                    {ride.service_type_name && (
                      <span className="text-[11px] px-2 py-0.5 bg-slate-100 text-slate-500 rounded-full">{ride.service_type_name}</span>
                    )}
                    {/* ETA prominente junto al estado */}
                    {(() => {
                      const d = ride.driver_id ? drivers.find(dr => dr.id === ride.driver_id) : null;
                      return d ? <ETABadge ride={ride} driver={d} settings={settings} /> : null;
                    })()}
                    {ride.admin_rating && (
                      <Badge variant="outline" className="text-xs bg-amber-50 text-amber-700 border-amber-200">
                        <Star className="w-2.5 h-2.5 fill-amber-400 text-amber-400 mr-0.5" />{ride.admin_rating}
                      </Badge>
                    )}
                    {ride.proof_photo_url && (
                      <a href={ride.proof_photo_url} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()}>
                        <Badge variant="outline" className="text-xs bg-green-50 text-green-700 border-green-200">
                          <Image className="w-2.5 h-2.5 mr-0.5" />Foto
                        </Badge>
                      </a>
                    )}
                  </div>

                  <div className="space-y-0.5">
                    <div className="flex items-start gap-1.5 text-xs text-slate-500">
                      <MapPin className="w-3 h-3 mt-0.5 flex-shrink-0 text-emerald-500" />
                      <span className="truncate">{ride.pickup_address}</span>
                    </div>
                    {ride.dropoff_address && (
                      <div className="flex items-start gap-1.5 text-xs text-slate-400">
                        <MapPin className="w-3 h-3 mt-0.5 flex-shrink-0 text-red-400" />
                        <span className="truncate">{ride.dropoff_address}</span>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-3 mt-2 flex-wrap">
                    {shouldShowDriverName ? (
                      ride.status !== "assigned" || hasDriverAccepted(ride) ? (
                        <span className="flex items-center gap-1 text-xs text-slate-500 bg-slate-50 px-2 py-0.5 rounded-full">
                          <span className="w-1.5 h-1.5 bg-slate-400 rounded-full" />
                          {resolvedDriverName}
                        </span>
                      ) : (
                        <span className="text-xs text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full">Pendiente de aceptación</span>
                      )
                    ) : ride.status === "no_drivers" || visualState.badgeLabel === "Sin conductores disponibles" ? (
                      <span className="text-xs text-red-600 bg-red-50 px-2 py-0.5 rounded-full">Sin conductor</span>
                    ) : (
                      <span className="text-xs text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">Sin conductor</span>
                    )}

                    {ride.company_name && ride.company_price ? (
                      <span className="text-xs font-semibold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">
                        💼 ${ride.company_price}
                      </span>
                    ) : ride.estimated_price ? (
                      <span className="text-xs font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
                        ${ride.estimated_price}
                      </span>
                    ) : null}
                    {ride.city_name && (
                      <span className="text-xs text-slate-400">{ride.city_name}</span>
                    )}
                    {ride.passenger_user_id ? (
                      <span className="text-xs text-blue-500 bg-blue-50 px-2 py-0.5 rounded-full" title="Solicitado desde la app de pasajero">
                        📱 Pasajero
                      </span>
                    ) : ride.created_by ? (
                      <span className="text-xs text-purple-500 bg-purple-50 px-2 py-0.5 rounded-full" title={`Registrado por: ${ride.created_by}`}>
                        👤 {ride.created_by.split("@")[0]}
                      </span>
                    ) : null}
                    <span className="text-xs text-slate-300">{formatCDMX(ride.requested_at || ride.created_date, "shortdatetime")}</span>
                  </div>
                  {visualState.showReason && ride.cancellation_reason && (
                    <p className="text-xs text-red-500 mt-1.5 bg-red-50 px-2 py-1 rounded-lg">❌ {ride.cancellation_reason}</p>
                  )}
                </div>

                {/* Actions */}
                <div className="flex flex-wrap items-center gap-2 flex-shrink-0" onClick={e => e.stopPropagation()}>
                  {! ["completed", "cancelled"].includes(ride.status) && (() => {
                    const searching = isAutoSearching(ride, settings?.total_search_window_seconds ?? 180);
                    return (
                      <div title={searching ? `Búsqueda automática en curso — disponible en ${Math.ceil((settings?.total_search_window_seconds ?? 180) - (Date.now() - new Date(ride.requested_at).getTime()) / 1000)}s si no hay asignación` : undefined}>
                        <Button
                          size="sm"
                          disabled={searching}
                          className="h-8 text-xs bg-slate-800 hover:bg-slate-700 rounded-xl disabled:opacity-50 disabled:cursor-not-allowed"
                          onClick={() => !searching && onAssign(ride)}
                        >
                          <UserCheck className="w-3.5 h-3.5 mr-1" /> {ride.driver_id ? "Reasignar" : "Asignar"}
                        </Button>
                      </div>
                    );
                  })()}
                  {action && (
                    <Button size="sm" className={`h-8 text-xs rounded-xl text-white ${action.color}`} onClick={() => onUpdateStatus(ride, action.next)}>
                      <action.icon className="w-3.5 h-3.5 mr-1" /> {action.label}
                    </Button>
                  )}
                  {canEdit && (
                    <Button size="sm" variant="outline" className="h-8 text-xs rounded-xl border-slate-200 text-slate-600 hover:bg-slate-50" onClick={() => setEditRide(ride)}>
                      <Pencil className="w-3.5 h-3.5 mr-1" /> Editar
                    </Button>
                  )}
                  {/* Admin rating only for rides NOT from passenger app — those are rated by the passenger */}
                  {ride.status === "completed" && !ride.admin_rating && ride.driver_id && !ride.passenger_user_id && (
                    <Button size="sm" variant="outline" className="h-8 text-xs rounded-xl border-amber-200 text-amber-700 hover:bg-amber-50" onClick={() => setRateRide(ride)}>
                      <Star className="w-3.5 h-3.5 mr-1" /> Calificar
                    </Button>
                  )}
                  {! ["completed", "cancelled"].includes(ride.status) && (
                    <Button size="sm" variant="outline" className="h-8 text-xs rounded-xl text-red-500 border-red-200 hover:bg-red-50" onClick={() => onCancel(ride)}>
                      <XCircle className="w-3.5 h-3.5 mr-1" /> Cancelar
                    </Button>
                  )}
                  {["completed", "cancelled"].includes(ride.status) && onDelete && canDelete && (
                    <Button size="sm" variant="outline" className="h-8 text-xs rounded-xl text-red-400 border-red-200 hover:bg-red-50" onClick={() => onDelete(ride)}>
                      <Trash2 className="w-3.5 h-3.5 mr-1" /> Eliminar
                    </Button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <RateDriverDialog ride={rateRide} open={!!rateRide} onOpenChange={v => !v && setRateRide(null)} />
      <RideDetailDialog ride={detailRide} open={!!detailRide} onOpenChange={v => !v && setDetailRide(null)} onAssign={canEdit ? onAssign : null} />
      <EditRideDialog ride={editRide} open={!!editRide} onOpenChange={v => !v && setEditRide(null)} onSaved={handleRideSaved} />
    </>
  );
}
