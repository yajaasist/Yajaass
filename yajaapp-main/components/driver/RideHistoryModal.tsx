import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { MapContainer, TileLayer, Marker, Popup, Polyline } from "react-leaflet";
import L from "leaflet";
import type { LatLngTuple } from "leaflet";
import { AnimatePresence, motion } from "framer-motion";
import {
  MapPin, CheckCircle2, XCircle, ChevronLeft, Star, Clock,
  Download, AlertCircle, Map
} from "lucide-react";
import { formatCDMX } from "@/components/shared/dateUtils";
import RatingModal from "@/components/driver/RatingModal";
import TicketsPanel from "@/components/shared/TicketsPanel";

const _greenIcon = new L.Icon({
  iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41], iconAnchor: [12, 41],
});
const _redIcon = new L.Icon({
  iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41], iconAnchor: [12, 41],
});

async function _geocode(address) {
  if (!address) return null;
  const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&limit=1`, { headers: { "Accept-Language": "es" } });
  const data = await res.json();
  if (data[0]) return { lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon) };
  return null;
}

async function _downloadRideTicket(ride, driver) {
  const { default: jsPDF } = await import("jspdf");
  const doc = new jsPDF();
  const lineH = 8; let y = 20;
  const line = (text, indent = 14) => { doc.text(text, indent, y); y += lineH; };
  doc.setFontSize(18); doc.setFont(undefined, "bold"); line("TICKET DE VIAJE");
  doc.setFontSize(10); doc.setFont(undefined, "normal"); y += 2;
  line(`Folio: ${ride.service_id || ride.id}`);
  line(`Fecha: ${new Date(ride.requested_at).toLocaleString("es-MX")}`);
  y += 4; doc.setFont(undefined, "bold"); line("CONDUCTOR"); doc.setFont(undefined, "normal");
  line(`Nombre: ${driver?.full_name || "-"}`);
  line(`Vehículo: ${driver?.vehicle_brand || ""} ${driver?.vehicle_model || ""} ${driver?.license_plate || ""}`);
  y += 4; doc.setFont(undefined, "bold"); line("PASAJERO"); doc.setFont(undefined, "normal");
  line(`Nombre: ${ride.passenger_name || "-"}`);
  if (ride.passenger_phone) line(`Teléfono: ${ride.passenger_phone}`);
  y += 4; doc.setFont(undefined, "bold"); line("RUTA"); doc.setFont(undefined, "normal");
  doc.splitTextToSize(`Origen: ${ride.pickup_address || "-"}`, 180).forEach(l => line(l));
  if (ride.dropoff_address) doc.splitTextToSize(`Destino: ${ride.dropoff_address}`, 180).forEach(l => line(l));
  if (ride.distance_km) line(`Distancia: ${ride.distance_km} km`);
  if (ride.duration_minutes) line(`Duración: ${ride.duration_minutes} min`);
  y += 4; doc.setFont(undefined, "bold"); line("PAGO"); doc.setFont(undefined, "normal");
  line(`Método: ${ride.payment_method || "efectivo"}`);
  line(`Total: $${(ride.final_price || ride.estimated_price || 0).toFixed(2)}`);
  line(`Ganancia conductor: $${(ride.driver_earnings || 0).toFixed(2)}`);
  doc.save(`viaje-${ride.service_id || ride.id}.pdf`);
}

function RideDetailMap({ ride }) {
  const [pickupCoords, setPickupCoords] = React.useState(ride.pickup_lat && ride.pickup_lon ? { lat: ride.pickup_lat, lon: ride.pickup_lon } : null);
  const [dropoffCoords, setDropoffCoords] = React.useState(ride.dropoff_lat && ride.dropoff_lon ? { lat: ride.dropoff_lat, lon: ride.dropoff_lon } : null);
  React.useEffect(() => {
    if (!pickupCoords && ride.pickup_address) _geocode(ride.pickup_address).then(setPickupCoords);
    if (!dropoffCoords && ride.dropoff_address) _geocode(ride.dropoff_address).then(setDropoffCoords);
  }, []);
  const center: LatLngTuple = pickupCoords ? [pickupCoords.lat, pickupCoords.lon] : [19.4326, -99.1332];
  const positions = [...(pickupCoords ? [[pickupCoords.lat, pickupCoords.lon]] : []), ...(dropoffCoords ? [[dropoffCoords.lat, dropoffCoords.lon]] : [])];
  return (
    <div className="rounded-xl overflow-hidden border border-slate-200" style={{ height: 200 }}>
      <MapContainer center={center} zoom={13} style={{ height: "100%", width: "100%" }} scrollWheelZoom={false}>
        <TileLayer url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png" />
        {pickupCoords && <Marker position={[pickupCoords.lat, pickupCoords.lon]} icon={_greenIcon}><Popup>Recogida</Popup></Marker>}
        {dropoffCoords && <Marker position={[dropoffCoords.lat, dropoffCoords.lon]} icon={_redIcon}><Popup>Destino</Popup></Marker>}
        {positions.length === 2 && <Polyline positions={positions} color="#3B82F6" dashArray="6 4" weight={3} />}
      </MapContainer>
    </div>
  );
}

function RideDetailModal({ ride: initialRide, driver, settings, onClose }) {
  const [showMap, setShowMap] = useState(false);
  const [showTicket, setShowTicket] = useState(false);
  const [showRating, setShowRating] = useState(false);
  const [ride, setRide] = React.useState(initialRide);
  const price = ride.final_price || ride.estimated_price || 0;
  const commissionRate = ride.commission_rate ?? driver?.commission_rate ?? settings?.platform_commission_pct ?? 20;
  const earnings = ride.driver_earnings != null
    ? ride.driver_earnings
    : parseFloat((price * (1 - commissionRate / 100)).toFixed(2));
  const platformCommission = ride.platform_commission != null
    ? ride.platform_commission
    : parseFloat((price * commissionRate / 100).toFixed(2));
  const ratingExpires = ride.rating_window_expires_at
    ? new Date(ride.rating_window_expires_at)
    : ride.completed_at ? new Date(new Date(ride.completed_at).getTime() + 24 * 3600 * 1000) : null;
  const canRate = ride.status === "completed" && !ride.driver_rating_for_passenger && ratingExpires && new Date() < ratingExpires;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-black/60 flex items-end" onClick={onClose}>
      <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
        transition={{ type: "spring", damping: 30, stiffness: 300 }}
        className="w-full bg-white rounded-t-3xl max-h-[85vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
        style={{ paddingBottom: "max(24px, env(safe-area-inset-bottom))" }}>
        <div className="flex items-center p-4 border-b sticky top-0 bg-white z-10 gap-2">
          <button onClick={onClose} className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center select-none flex-shrink-0">
            <ChevronLeft className="w-5 h-5 text-slate-600" />
          </button>
          <h2 className="font-bold text-slate-900 text-lg flex-1">{ride.status === "cancelled" ? "Viaje cancelado" : "Detalle del viaje"}</h2>
        </div>
        <div className="p-5 space-y-5">
          {ride.status === "cancelled" ? (
            <div className="bg-red-50 rounded-2xl p-5 text-center">
              <XCircle className="w-10 h-10 text-red-400 mx-auto mb-2" />
              <p className="text-sm font-semibold text-red-600">Servicio cancelado</p>
              {ride.cancellation_reason && <p className="text-xs text-red-400 mt-1">{ride.cancellation_reason}</p>}
              {ride.cancelled_by && <p className="text-xs text-red-400">Por: {ride.cancelled_by === "driver" ? "Conductor" : ride.cancelled_by === "admin" ? "Administrador" : "Pasajero"}</p>}
            </div>
          ) : (
            <div className="bg-emerald-50 rounded-2xl p-5 text-center space-y-2">
              <p className="text-xs text-emerald-600 font-medium mb-1">Tu ganancia</p>
              <p className="text-4xl font-bold text-emerald-700">${earnings.toFixed(2)}</p>
              {price > 0 && (
                <div className="text-xs text-slate-500 space-y-0.5 pt-1 border-t border-emerald-100">
                  <div className="flex justify-between px-2"><span>Tarifa del servicio</span><span className="font-medium text-slate-700">${price.toFixed(2)}</span></div>
                  <div className="flex justify-between px-2"><span>Comisión plataforma ({commissionRate}%)</span><span className="text-red-500">-${platformCommission.toFixed(2)}</span></div>
                  <div className="flex justify-between px-2 font-semibold text-emerald-600"><span>Tu ganancia neta</span><span>${earnings.toFixed(2)}</span></div>
                </div>
              )}
            </div>
          )}
          <div className="bg-slate-50 rounded-2xl p-4 space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-slate-500">Pasajero</span>
              <span className="font-semibold text-slate-900">{ride.passenger_name}</span>
            </div>
            {ride.passenger_phone && <div className="flex justify-between text-sm"><span className="text-slate-500">Teléfono</span><a href={`tel:${ride.passenger_phone}`} className="font-semibold text-blue-600">{ride.passenger_phone}</a></div>}
            <div className="flex justify-between text-sm"><span className="text-slate-500">Servicio</span><span className="font-semibold text-slate-900">{ride.service_type_name || "—"}</span></div>
            <div className="flex justify-between text-sm"><span className="text-slate-500">Pago</span><span className="font-semibold text-slate-900 capitalize">{ride.payment_method || "efectivo"}</span></div>
            {ride.distance_km && <div className="flex justify-between text-sm"><span className="text-slate-500">Distancia</span><span className="font-semibold text-slate-900">{ride.distance_km} km</span></div>}
            <div className="flex justify-between text-sm"><span className="text-slate-500">Fecha</span><span className="font-semibold text-slate-900">{formatCDMX(ride.requested_at, "shortdatetime")}</span></div>
          </div>
          <div className="space-y-2">
            <div className="flex items-start gap-3 p-3 bg-emerald-50 rounded-xl">
              <div className="w-3 h-3 rounded-full bg-emerald-500 mt-1 flex-shrink-0" />
              <div><p className="text-xs text-emerald-700 font-medium">Recogida</p><p className="text-sm text-slate-800">{ride.pickup_address}</p></div>
            </div>
            {ride.dropoff_address && (
              <div className="flex items-start gap-3 p-3 bg-red-50 rounded-xl">
                <div className="w-3 h-3 rounded-full bg-red-500 mt-1 flex-shrink-0" />
                <div><p className="text-xs text-red-700 font-medium">Destino</p><p className="text-sm text-slate-800">{ride.dropoff_address}</p></div>
              </div>
            )}
          </div>
          {ride.admin_rating && (
            <div className="bg-amber-50 rounded-2xl p-4">
              <p className="text-xs text-amber-700 font-medium mb-2">Calificación recibida</p>
              <div className="flex items-center gap-1.5">
                {[1,2,3,4,5].map(n => <Star key={n} className={`w-6 h-6 ${n <= ride.admin_rating ? "fill-amber-400 text-amber-400" : "text-slate-200"}`} />)}
                <span className="text-sm text-amber-700 font-semibold ml-1">{ride.admin_rating}/5</span>
              </div>
              {ride.admin_rating_comment && <p className="text-xs text-amber-700 mt-2 italic">"{ride.admin_rating_comment}"</p>}
            </div>
          )}
          {ride.proof_photo_url && (
            <div>
              <p className="text-xs text-slate-500 font-medium mb-2">Foto de prueba</p>
              <a href={ride.proof_photo_url} target="_blank" rel="noreferrer">
                <img src={ride.proof_photo_url} alt="Prueba" className="w-full rounded-xl object-cover max-h-48" />
              </a>
            </div>
          )}
          <Button variant="outline" className="w-full rounded-xl select-none min-h-[44px]" onClick={() => setShowMap(v => !v)}>
            <Map className="w-4 h-4 mr-2" /> {showMap ? "Ocultar mapa" : "Ver mapa del viaje"}
          </Button>
          {showMap && <RideDetailMap ride={ride} />}
          {ride.notes && <div className="bg-amber-50 rounded-xl p-3 text-sm text-amber-700">📝 {ride.notes}</div>}
          {ride.status === "completed" && (
            <>
              {canRate && (
                <Button onClick={() => setShowRating(true)} className="w-full rounded-xl bg-amber-500 hover:bg-amber-600 text-white min-h-[44px]">
                  <Star className="w-4 h-4 mr-2" /> Calificar al pasajero
                </Button>
              )}
              {ride.driver_rating_for_passenger > 0 && (
                <div className="bg-amber-50 rounded-2xl p-3 flex items-center gap-2">
                  <div className="flex items-center gap-0.5">
                    {[1,2,3,4,5].map(n => <Star key={n} className={`w-4 h-4 ${n <= ride.driver_rating_for_passenger ? "fill-amber-400 text-amber-400" : "text-slate-200"}`} />)}
                  </div>
                  <p className="text-xs text-amber-700">Tu calificación al pasajero</p>
                </div>
              )}
              <Button variant="outline" className="w-full rounded-xl select-none min-h-[44px]" onClick={() => _downloadRideTicket(ride, driver)}>
                <Download className="w-4 h-4 mr-2" /> Descargar ticket de viaje
              </Button>
              <Button variant="outline" className="w-full rounded-xl select-none min-h-[44px] border-red-200 text-red-600 hover:bg-red-50" onClick={() => setShowTicket(true)}>
                <AlertCircle className="w-4 h-4 mr-2" /> Reportar problema con este viaje
              </Button>
            </>
          )}
        </div>
      </motion.div>
      <AnimatePresence>
        {showTicket && <TicketsPanel role="driver" driverId={driver?.id} passengerUserId={ride?.passenger_user_id} passengerName={ride?.passenger_name} passengerPhone={ride?.passenger_phone} driverName={driver?.full_name} rideContext={{ ride_id: ride.id, service_id: ride.service_id, passenger_name: ride.passenger_name }} onClose={() => setShowTicket(false)} darkMode={false} />}
        {showRating && <RatingModal ride={ride} raterRole="driver" targetName={ride.passenger_name} targetPhoto={ride.passenger_photo_url} onClose={(skipped) => { setShowRating(false); if (!skipped) setRide(r => ({ ...r, driver_rating_for_passenger: 1 })); }} />}
      </AnimatePresence>
    </motion.div>
  );
}

export default function RideHistoryModal({ rides = [], driver, settings, onClose }) {
  const [selectedRide, setSelectedRide] = useState(null);
  return (
    <>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 z-[120] bg-black/60 flex items-end" onClick={onClose}>
        <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
          transition={{ type: "spring", damping: 30, stiffness: 300 }}
          className="w-full bg-white rounded-t-3xl max-h-[85vh] flex flex-col"
          onClick={e => e.stopPropagation()}
          style={{ paddingBottom: "max(24px, env(safe-area-inset-bottom))" }}>
          <div className="flex items-center p-4 border-b gap-2">
            <button onClick={onClose} className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center select-none flex-shrink-0">
              <ChevronLeft className="w-5 h-5 text-slate-600" />
            </button>
            <h2 className="font-bold text-slate-900 text-lg flex-1">Historial</h2>
          </div>
          <div className="overflow-y-auto flex-1 p-4 space-y-2">
            {rides.length === 0 && <p className="text-center text-slate-400 py-10 text-sm">No tienes viajes aún</p>}
            {rides.map(ride => {
              const isCancelled = ride.status === "cancelled";
              const _ridePrice = ride.final_price || ride.estimated_price || 0;
              const _commRate = ride.commission_rate ?? driver?.commission_rate ?? settings?.platform_commission_pct ?? 20;
              const earnings = ride.driver_earnings != null
                ? ride.driver_earnings
                : parseFloat((_ridePrice * (1 - _commRate / 100)).toFixed(2));
              return (
                <button key={ride.id}
                  className={`w-full text-left border rounded-2xl p-4 active:scale-[0.99] transition-all select-none min-h-[72px] ${isCancelled ? "bg-red-50 border-red-100 hover:bg-red-100/60" : "bg-white border-slate-100 hover:bg-slate-50"}`}
                  onClick={() => setSelectedRide(ride)}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        {isCancelled ? <XCircle className="w-4 h-4 text-red-400 flex-shrink-0" /> : <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />}
                        <p className="font-semibold text-slate-900 text-sm truncate">{ride.passenger_name}</p>
                        {isCancelled && <span className="text-[10px] bg-red-100 text-red-500 rounded-full px-2 py-0.5 font-medium flex-shrink-0">Cancelado</span>}
                      </div>
                      <p className="text-xs text-slate-400 mt-0.5 flex items-center gap-1 truncate"><MapPin className="w-3 h-3 flex-shrink-0" />{ride.pickup_address}</p>
                      {ride.dropoff_address && <p className="text-xs text-slate-400 truncate pl-4">→ {ride.dropoff_address}</p>}
                      <p className="text-xs text-slate-300 mt-1 flex items-center gap-1"><Clock className="w-3 h-3" />{formatCDMX(ride.requested_at, "shortdatetime")}</p>
                    </div>
                    <div className="flex flex-col items-end gap-1 flex-shrink-0">
                      {earnings > 0 ? <span className={`font-bold text-base ${isCancelled ? "text-slate-400" : "text-emerald-600"}`}>${earnings.toFixed(0)}</span> : <span className="text-xs text-slate-300">$0</span>}
                      {ride.admin_rating && !isCancelled && <div className="flex items-center gap-0.5"><Star className="w-3 h-3 fill-amber-400 text-amber-400" /><span className="text-xs text-amber-600">{ride.admin_rating}</span></div>}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </motion.div>
      </motion.div>
      <AnimatePresence>
        {selectedRide && <RideDetailModal ride={selectedRide} driver={driver} settings={settings} onClose={() => setSelectedRide(null)} />}
      </AnimatePresence>
    </>
  );
}
