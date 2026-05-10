import React, { useState, useEffect } from "react";
import { supabaseApi } from "@/lib/supabaseApi";
import { futureCDMX } from "@/components/shared/dateUtils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { User, Phone, Mail, LogOut, Lock, KeyRound, CheckCircle, X, Trash2, ChevronRight, Star, MessageSquare, AlertCircle, Wallet, Camera, MapPin, Bell, Settings } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { getLocationPermissionState, requestLocationPermission, getNotificationPermissionState, requestNotificationPermission, openAppSettings } from "@/lib/permissionsService";
import type { AppPermissionState } from "@/lib/permissionsService";

function RatingsHistoryPanel({ rides = [], role, onClose, darkMode = false }) {
  const isDriver = role === "driver";
  const rated = rides.filter(r => isDriver ? r.passenger_rating_for_driver > 0 : r.driver_rating_for_passenger > 0)
    .sort((a, b) => new Date(b.completed_at || b.requested_at).getTime() - new Date(a.completed_at || a.requested_at).getTime());
  const avg = rated.length > 0
    ? (rated.reduce((s, r) => s + (isDriver ? r.passenger_rating_for_driver : r.driver_rating_for_passenger), 0) / rated.length).toFixed(1)
    : null;
  const bg = darkMode ? "bg-slate-900" : "bg-white";
  const card = darkMode ? "bg-white/5 border border-white/10" : "bg-slate-50 border border-slate-100";
  const text = darkMode ? "text-white" : "text-slate-900";
  const textMuted = darkMode ? "text-white/50" : "text-slate-400";
  const textSub = darkMode ? "text-white/70" : "text-slate-600";
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[150] bg-black/60 flex items-end" onClick={onClose}>
      <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
        transition={{ type: "spring", damping: 28, stiffness: 280 }}
        className={`w-full ${bg} rounded-t-3xl flex flex-col`}
        style={{ maxHeight: "85vh", paddingBottom: "env(safe-area-inset-bottom)" }}
        onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 pt-5 pb-4 flex-shrink-0">
          <div>
            <h3 className={`font-bold text-xl ${text}`}>Mis calificaciones</h3>
            {avg && (
              <div className="flex items-center gap-1.5 mt-1">
                <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
                <span className="font-bold text-lg text-amber-500">{avg}</span>
                <span className={`text-sm ${textMuted}`}>· {rated.length} reseña{rated.length !== 1 ? "s" : ""}</span>
              </div>
            )}
          </div>
          <button onClick={onClose} className={`w-9 h-9 rounded-full flex items-center justify-center ${darkMode ? "bg-white/10" : "bg-slate-100"}`}>
            <X className={`w-4 h-4 ${textMuted}`} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 pb-5 space-y-3">
          {rated.length === 0 ? (
            <div className="text-center py-16">
              <Star className={`w-12 h-12 mx-auto mb-3 ${textMuted} opacity-30`} />
              <p className={`text-sm ${textMuted}`}>Aún no tienes calificaciones</p>
            </div>
          ) : rated.map(ride => {
            const rating = isDriver ? ride.passenger_rating_for_driver : ride.driver_rating_for_passenger;
            const comment = isDriver ? ride.passenger_rating_comment : ride.driver_rating_comment;
            const raterName = isDriver ? ride.passenger_name : ride.driver_name;
            const date = new Date(ride.completed_at || ride.requested_at).toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" });
            return (
              <div key={ride.id} className={`${card} rounded-2xl p-4 space-y-2`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${darkMode ? "bg-blue-500/20" : "bg-blue-50"}`}>
                      <User className="w-4 h-4 text-blue-400" />
                    </div>
                    <div>
                      <p className={`font-semibold text-sm ${text}`}>{raterName || "—"}</p>
                      <p className={`text-xs ${textMuted}`}>{date}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-0.5 flex-shrink-0">
                    {[1,2,3,4,5].map(s => <Star key={s} className={`w-4 h-4 ${s <= rating ? "fill-amber-400 text-amber-400" : darkMode ? "text-white/20" : "text-slate-200"}`} />)}
                  </div>
                </div>
                {comment && (
                  <div className={`flex items-start gap-2 pt-2 border-t ${darkMode ? "border-white/10" : "border-slate-100"}`}>
                    <MessageSquare className={`w-3.5 h-3.5 ${textMuted} flex-shrink-0 mt-0.5`} />
                    <p className={`text-xs ${textSub} leading-relaxed`}>{comment}</p>
                  </div>
                )}
                <p className={`text-xs ${textMuted} truncate`}>{ride.pickup_address}{ride.dropoff_address ? ` → ${ride.dropoff_address}` : ""}</p>
              </div>
            );
          })}
        </div>
      </motion.div>
    </motion.div>
  );
}

const genToken = () => Math.random().toString(36).substring(2, 8).toUpperCase();

export default function RAProfileTab({ user, rides = [], onLogout, onUserUpdate, onDeleteAccount }) {
  const [showRatings, setShowRatings] = useState(false);
  const [showWallet, setShowWallet] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [locationPermission, setLocationPermission] = useState<AppPermissionState>("checking");
  const [notificationPermission, setNotificationPermission] = useState<AppPermissionState>("checking");

  useEffect(() => {
    getLocationPermissionState().then(setLocationPermission);
    getNotificationPermissionState().then(setNotificationPermission);
  }, []);

  const handlePhotoUpload = async (file) => {
    if (!file) return;
    setUploadingPhoto(true);
    try {
      const { file_url } = await supabaseApi.uploads.uploadFile({ file });
      await supabaseApi.passengers.update(user.id, { photo_url: file_url });
      onUserUpdate({ ...user, photo_url: file_url });
    } catch (err) {
      console.error("Photo upload error:", err);
    } finally {
      setUploadingPhoto(false);
    }
  };
  // Password change flow
  const [pwStep, setPwStep] = useState("idle");
  const [token, setToken] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [pwMsg, setPwMsg] = useState("");
  const [pwError, setPwError] = useState("");
  const [pwLoading, setPwLoading] = useState(false);

  // Delete account flow
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);

  const sendPasswordCode = async () => {
    setPwLoading(true);
    setPwError("");
    const code = genToken();
    const expires = futureCDMX(30 * 60 * 1000);
    await supabaseApi.passengers.update(user.id, { reset_token: code, reset_token_expires: expires });
    console.warn("Email sending requires Edge Function implementation. Code:", code);
    setPwLoading(false);
    setPwStep("confirm");
    setPwMsg(`Código generado: ${code} (email no implementado aún)`);
  };

  const confirmPassword = async () => {
    if (!token || !newPassword) { setPwError("Ingresa el código y la nueva contraseña"); return; }
    setPwLoading(true);
    setPwError("");
    const allPassengers = await supabaseApi.passengers.list();
    const fresh = allPassengers.filter((p) => p.email === user.email);
    const u = fresh?.[0];
    if (!u) { setPwError("Error al verificar. Intenta de nuevo."); setPwLoading(false); return; }
    if (u.reset_token !== token.trim().toUpperCase()) { setPwError("Código incorrecto"); setPwLoading(false); return; }
    if (new Date() > new Date(u.reset_token_expires)) { setPwError("Código expirado. Solicita uno nuevo."); setPwLoading(false); return; }

    await supabaseApi.passengers.update(user.id, { password: newPassword, reset_token: null, reset_token_expires: null });
    // TODO: Implement via Supabase Edge Function for email sending
    console.warn("Email confirmation not implemented yet");

    setPwLoading(false);
    setPwStep("idle");
    setPwMsg("¡Contraseña cambiada con éxito!");
    setToken("");
    setNewPassword("");
  };

  const handleDeleteAccount = async () => {
    if (deleteConfirmText !== "ELIMINAR") return;
    setDeleting(true);
    await supabaseApi.passengers.delete(user.id);
    if (onDeleteAccount) onDeleteAccount();
    else onLogout();
  };

  return (
    <div className="h-full overflow-y-auto px-4 py-5 space-y-5 pb-24 select-none">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-white font-bold text-lg">Mi perfil</h2>
      </div>

      {/* Avatar */}
      <div className="flex flex-col items-center py-4">
        <div className="relative mb-3">
          <div className="w-20 h-20 bg-blue-500/20 rounded-3xl border border-blue-500/30 overflow-hidden flex items-center justify-center">
            {user.photo_url
              ? <img src={user.photo_url} alt="Foto" className="w-full h-full object-cover" />
              : <span className="text-3xl font-black text-blue-400">{user.full_name?.charAt(0)}</span>}
          </div>
          <label className="absolute -bottom-1 -right-1 w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center cursor-pointer shadow-lg border-2 border-slate-900">
            <input type="file" accept="image/*" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handlePhotoUpload(f); }} />
            {uploadingPhoto ? <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Camera className="w-3.5 h-3.5 text-white" />}
          </label>
        </div>
        <p className="text-white font-bold text-lg">{user.full_name}</p>
        <p className="text-white/50 text-sm">{user.email}</p>
        <span className="mt-2 text-[11px] bg-blue-500/20 text-blue-300 border border-blue-500/30 px-3 py-0.5 rounded-full">
          Cliente / Pasajero
        </span>
      </div>

      {/* Pending balance warning — always visible when has debt */}
      {(user.pending_balance || 0) > 0 && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-red-300 font-semibold text-sm">Saldo pendiente de pago</p>
            <p className="text-red-400 font-black text-2xl mt-1">${user.pending_balance.toFixed(2)}</p>
            <p className="text-white/40 text-xs mt-1">Tienes un adeudo pendiente. No podrás solicitar nuevos servicios hasta liquidarlo con el operador.</p>
          </div>
        </div>
      )}

      {/* Wallet balance */}
      {(user.wallet_balance || 0) > 0 && (
        <button
          onClick={() => setShowWallet(v => !v)}
          className="w-full flex items-center justify-between bg-emerald-500/10 border border-emerald-500/30 rounded-2xl px-4 py-3 transition-all"
        >
          <div className="flex items-center gap-3">
            <Wallet className="w-5 h-5 text-emerald-400" />
            <div className="text-left">
              <p className="text-emerald-300 font-semibold text-sm">Saldo en billetera</p>
              <p className="text-emerald-400 font-black text-xl">${(user.wallet_balance || 0).toFixed(2)} <span className="text-emerald-400/50 text-xs font-normal">MXN</span></p>
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-emerald-400/50" />
        </button>
      )}
      {(user.wallet_balance || 0) === 0 && (
        <div className="flex items-center gap-3 bg-white/5 border border-white/10 rounded-2xl px-4 py-3">
          <Wallet className="w-5 h-5 text-white/30" />
          <div>
            <p className="text-white/50 text-sm">Saldo en billetera</p>
            <p className="text-white/70 font-bold text-lg">$0.00 <span className="text-white/30 text-xs font-normal">MXN</span></p>
          </div>
        </div>
      )}

      {/* Personal info */}
      <div className="bg-white/5 border border-white/10 rounded-2xl p-4 space-y-3">
        <p className="text-white/50 text-xs uppercase tracking-wide font-medium">Información personal</p>
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm">
            <User className="w-4 h-4 text-white/30" /><span className="text-white/70">{user.full_name}</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <Mail className="w-4 h-4 text-white/30" /><span className="text-white/70">{user.email}</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <Phone className="w-4 h-4 text-white/30" /><span className="text-white/70">{user.phone || "—"}</span>
          </div>
        </div>
      </div>

      {/* Change Password */}
      <div className="bg-white/5 border border-white/10 rounded-2xl p-4 space-y-3">
        <p className="text-white/50 text-xs uppercase tracking-wide font-medium flex items-center gap-2">
          <Lock className="w-3.5 h-3.5" /> Cambiar contraseña
        </p>
        {pwMsg && (
          <div className="flex items-start gap-2 bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-3">
            <CheckCircle className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
            <p className="text-emerald-300 text-xs">{pwMsg}</p>
          </div>
        )}
        {pwStep === "idle" && (
          <button onClick={sendPasswordCode} disabled={pwLoading}
            className="w-full flex items-center justify-center gap-2.5 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 disabled:opacity-60 text-white font-semibold rounded-xl min-h-[48px] text-sm shadow-lg shadow-blue-500/25 transition-all active:scale-95">
            <KeyRound className="w-4 h-4 flex-shrink-0" />
            {pwLoading ? "Enviando código..." : "Cambiar contraseña"}
          </button>
        )}
        {pwStep === "confirm" && (
          <div className="space-y-2">
            <Input placeholder="Código recibido por correo" value={token} onChange={e => { setToken(e.target.value); setPwError(""); }}
              className="tracking-widest font-mono text-center text-lg bg-white/10 border-white/20 text-white rounded-xl placeholder:font-sans placeholder:tracking-normal" />
            <Input type="password" placeholder="Nueva contraseña" value={newPassword} onChange={e => { setNewPassword(e.target.value); setPwError(""); }}
              className="bg-white/10 border-white/20 text-white rounded-xl" />
            {pwError && <p className="text-red-400 text-xs bg-red-400/10 rounded-lg p-2 text-center">{pwError}</p>}
            <div className="flex gap-2">
              <Button onClick={confirmPassword} disabled={pwLoading}
                className="flex-1 bg-emerald-600 hover:bg-emerald-500 rounded-xl min-h-[40px] text-sm">
                {pwLoading ? "Verificando..." : "Confirmar cambio"}
              </Button>
              <button onClick={() => { setPwStep("idle"); setPwMsg(""); setPwError(""); }}
                className="px-3 text-white/40 hover:text-white rounded-xl bg-white/5">
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Como te ven los conductores */}
      <div className="bg-white/5 border border-white/10 rounded-2xl p-4 space-y-3">
        <p className="text-white/50 text-xs uppercase tracking-wide font-medium flex items-center gap-2 mb-1">
          <User className="w-3.5 h-3.5" /> Cómo te ven los conductores
        </p>
        <div className="bg-white rounded-2xl p-4 flex items-center gap-4 shadow-lg">
          <div className="w-16 h-16 rounded-2xl overflow-hidden bg-blue-100 flex items-center justify-center flex-shrink-0">
            {user.photo_url
              ? <img src={user.photo_url} alt="" className="w-full h-full object-cover" />
              : <span className="text-2xl font-black text-blue-500">{user.full_name?.charAt(0)}</span>}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-slate-800 font-bold text-base leading-tight">{user.full_name}</p>
            {user.phone && <p className="text-slate-400 text-xs mt-0.5">{user.phone}</p>}
            <div className="flex items-center gap-1.5 mt-1.5">
              <div className="flex items-center gap-1 bg-amber-50 border border-amber-100 rounded-xl px-2 py-1">
                <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                <span className="text-amber-700 font-bold text-sm">{user.rating || "5.0"}</span>
              </div>
              <span className="text-slate-400 text-xs">· {(rides || []).filter(r => r.status === "completed").length} servicios</span>
            </div>
          </div>
        </div>
        <p className="text-white/30 text-xs text-center">Así aparece tu perfil cuando un conductor acepta tu servicio</p>
      </div>

      {/* Ratings section */}
      <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
        <p className="text-white/50 text-xs uppercase tracking-wide font-medium flex items-center gap-2 mb-3">
          <Star className="w-3.5 h-3.5" /> Calificaciones recibidas
        </p>
        <button
          onClick={() => setShowRatings(true)}
          className="w-full flex items-center justify-between bg-white/5 hover:bg-white/10 rounded-xl px-4 py-3 min-h-[44px] transition-colors border border-white/10"
        >
          <span className="text-sm text-white/70">Ver historial de calificaciones</span>
          <ChevronRight className="w-4 h-4 text-white/30" />
        </button>
      </div>

      {/* Permissions section */}
      <div className="bg-white/5 border border-white/10 rounded-2xl p-4 space-y-4">
        <p className="text-white/50 text-xs uppercase tracking-wide font-medium">Permisos de la aplicación</p>

        {/* Location Permission */}
        <div className="bg-white/10 border border-white/20 rounded-xl p-3 space-y-3">
          <div className="flex items-center gap-3">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${locationPermission === "granted" ? "bg-green-500/20" : locationPermission === "denied" ? "bg-red-500/20" : "bg-amber-500/20"}`}>
              <MapPin className={`w-4 h-4 ${locationPermission === "granted" ? "text-green-400" : locationPermission === "denied" ? "text-red-400" : "text-amber-400"}`} />
            </div>
            <div className="flex-1">
              <h4 className="font-semibold text-white text-sm">Ubicación</h4>
              <p className="text-white/50 text-xs">Necesario para mostrar tu posición en el mapa.</p>
            </div>
            <div className="text-right">
              <span className={`text-xs font-medium ${locationPermission === "granted" ? "text-green-400" : locationPermission === "denied" ? "text-red-400" : "text-amber-400"}`}>
                {locationPermission === "granted" ? "Concedido" : locationPermission === "denied" ? "Denegado" : locationPermission === "prompt" ? "Preguntar" : "Verificando..."}
              </span>
            </div>
          </div>
          {locationPermission === "denied" && (
            <Button onClick={() => openAppSettings()} className="w-full bg-slate-600 hover:bg-slate-700 rounded-xl min-h-[36px] text-xs">
              <Settings className="w-3 h-3 mr-2" />
              Abrir configuración
            </Button>
          )}
          {locationPermission === "prompt" && (
            <Button onClick={async () => {
              const granted = await requestLocationPermission();
              setLocationPermission(granted ? "granted" : "denied");
            }} className="w-full bg-blue-600 hover:bg-blue-700 rounded-xl min-h-[36px] text-xs">
              Solicitar permiso
            </Button>
          )}
        </div>

        {/* Notification Permission */}
        <div className="bg-white/10 border border-white/20 rounded-xl p-3 space-y-3">
          <div className="flex items-center gap-3">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${notificationPermission === "granted" ? "bg-green-500/20" : notificationPermission === "denied" ? "bg-red-500/20" : notificationPermission === "unsupported" ? "bg-gray-500/20" : "bg-amber-500/20"}`}>
              <Bell className={`w-4 h-4 ${notificationPermission === "granted" ? "text-green-400" : notificationPermission === "denied" ? "text-red-400" : notificationPermission === "unsupported" ? "text-gray-400" : "text-amber-400"}`} />
            </div>
            <div className="flex-1">
              <h4 className="font-semibold text-white text-sm">Notificaciones</h4>
              <p className="text-white/50 text-xs">Recibe alertas de servicios y actualizaciones.</p>
            </div>
            <div className="text-right">
              <span className={`text-xs font-medium ${notificationPermission === "granted" ? "text-green-400" : notificationPermission === "denied" ? "text-red-400" : notificationPermission === "unsupported" ? "text-gray-400" : "text-amber-400"}`}>
                {notificationPermission === "granted" ? "Concedido" : notificationPermission === "denied" ? "Denegado" : notificationPermission === "unsupported" ? "No soportado" : notificationPermission === "prompt" ? "Preguntar" : "Verificando..."}
              </span>
            </div>
          </div>
          {notificationPermission === "denied" && (
            <Button onClick={() => openAppSettings()} className="w-full bg-slate-600 hover:bg-slate-700 rounded-xl min-h-[36px] text-xs">
              <Settings className="w-3 h-3 mr-2" />
              Abrir configuración
            </Button>
          )}
          {notificationPermission === "prompt" && (
            <Button onClick={async () => {
              const granted = await requestNotificationPermission();
              setNotificationPermission(granted ? "granted" : "denied");
            }} className="w-full bg-blue-600 hover:bg-blue-700 rounded-xl min-h-[36px] text-xs">
              Solicitar permiso
            </Button>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="space-y-2">
        <button onClick={onLogout} className="w-full flex items-center justify-between bg-white/5 hover:bg-white/10 rounded-xl px-4 py-3 min-h-[52px] transition-colors border border-white/10">
          <div className="flex items-center gap-3">
            <LogOut className="w-4 h-4 text-white/50" />
            <span className="text-sm font-medium text-white/70">Cerrar sesión</span>
          </div>
          <ChevronRight className="w-4 h-4 text-white/30" />
        </button>

        <button onClick={() => setShowDeleteConfirm(true)} className="w-full flex items-center justify-between bg-red-500/10 hover:bg-red-500/20 rounded-xl px-4 py-3 min-h-[52px] transition-colors border border-red-500/20">
          <div className="flex items-center gap-3">
            <Trash2 className="w-4 h-4 text-red-400" />
            <span className="text-sm font-medium text-red-400">Eliminar cuenta</span>
          </div>
          <ChevronRight className="w-4 h-4 text-red-400/50" />
        </button>
      </div>

      {/* Ratings Panel */}
      <AnimatePresence>
        {showRatings && (
          <RatingsHistoryPanel
            rides={rides}
            role="passenger"
            onClose={() => setShowRatings(false)}
            darkMode={true}
          />
        )}
      </AnimatePresence>

      {/* Delete account confirmation sheet */}
      <AnimatePresence>
        {showDeleteConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/60 flex items-end"
            onClick={() => setShowDeleteConfirm(false)}
          >
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 300 }}
              className="w-full bg-slate-800 rounded-t-3xl p-6 space-y-4"
              onClick={e => e.stopPropagation()}
              style={{ paddingBottom: "max(24px, env(safe-area-inset-bottom))" }}
            >
              <div className="text-center">
                <div className="w-14 h-14 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-3">
                  <Trash2 className="w-7 h-7 text-red-400" />
                </div>
                <h3 className="font-bold text-xl text-white">Eliminar cuenta</h3>
                <p className="text-sm text-white/50 mt-2">Esta acción es irreversible. Se eliminarán todos tus datos permanentemente.</p>
              </div>
              <div>
                <p className="text-sm text-white/60 mb-2">Escribe <strong className="text-white">ELIMINAR</strong> para confirmar:</p>
                <input
                  type="text"
                  value={deleteConfirmText}
                  onChange={e => setDeleteConfirmText(e.target.value)}
                  placeholder="ELIMINAR"
                  className="w-full border border-red-500/40 bg-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-red-500 placeholder:text-white/30"
                />
              </div>
              <Button
                onClick={handleDeleteAccount}
                disabled={deleteConfirmText !== "ELIMINAR" || deleting}
                className="w-full bg-red-600 hover:bg-red-700 rounded-xl min-h-[44px]"
              >
                {deleting ? "Eliminando..." : "Eliminar mi cuenta definitivamente"}
              </Button>
              <Button variant="outline" onClick={() => setShowDeleteConfirm(false)} className="w-full rounded-xl min-h-[44px] border-white/20 text-white hover:bg-white/10">
                Cancelar
              </Button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
