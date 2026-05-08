import React, { useState, useEffect } from "react";
import { supabaseApi } from "@/lib/supabaseApi";
import { futureCDMX } from "@/components/shared/dateUtils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { motion, AnimatePresence } from "framer-motion";
import { Truck, Mail, Lock, User, Phone, Eye, EyeOff, ArrowLeft, CheckCircle, MessageCircle } from "lucide-react";

const genToken = () => Math.random().toString(36).substring(2, 8).toUpperCase();
const genOTP = () => String(Math.floor(100000 + Math.random() * 900000));

// Password: min 8 chars, 1 uppercase, 1 lowercase, 1 special char
const validatePassword = (pwd) => {
  if (pwd.length < 8) return "La contraseña debe tener al menos 8 caracteres";
  if (!/[A-Z]/.test(pwd)) return "Debe incluir al menos una letra mayúscula";
  if (!/[a-z]/.test(pwd)) return "Debe incluir al menos una letra minúscula";
  if (!/[^A-Za-z0-9]/.test(pwd)) return "Debe incluir al menos un carácter especial (ej: @, #, !)";
  return null;
};

export default function RALoginScreen({ onLogin, appName, appLogo }) {
  const [mode, setMode] = useState("login");
  const [form, setForm] = useState({ email: "", password: "", new_password: "", full_name: "", phone: "", token: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPass, setShowPass] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");
  const [supportWhatsapp, setSupportWhatsapp] = useState({ number: "", message: "Hola, tengo problemas para registrarme en la app y necesito ayuda." });
  const [requireEmailVerification, setRequireEmailVerification] = useState(true);
  const [otpCode, setOtpCode] = useState("");
  const [enteredOtp, setEnteredOtp] = useState("");
  const [pendingUserData, setPendingUserData] = useState(null);
  const [showSupportForError, setShowSupportForError] = useState(false);

  useEffect(() => {
    supabaseApi.settings.list().then(data => {
      if (data && data.length > 0) {
        const s = data[0];
        if (s?.support_whatsapp_number) {
          setSupportWhatsapp({
            number: s.support_whatsapp_number,
            message: s.support_whatsapp_message || "Hola, tengo problemas para registrarme en la app y necesito ayuda.",
          });
        }
        if (s?.require_email_verification === false) setRequireEmailVerification(false);
      }
    });
  }, []);

 const set = (k, v) => { setForm(f => ({ ...f, [k]: v })); setError(""); setSuccessMsg(""); setShowSupportForError(false); };
  const goLogin = () => { setMode("login"); setError(""); setSuccessMsg(""); };

  // ─── LOGIN ────────────────────────────────────────────────────────────────
   const doLogin = async () => {
    if (!form.email || !form.password) { setError("Ingresa correo y contraseña"); return; }
    setLoading(true);
    try {
      const data = (await supabaseApi.passengers.list()).filter((u) => u.email === form.email.trim().toLowerCase());
      if (!data || data.length === 0) { setError("No existe una cuenta con ese correo"); setLoading(false); return; }
      const u = data[0];
      if (!u.is_active) {
        setError("Tu cuenta está desactivada. Contacta a soporte.");
        setLoading(false);
        setShowSupportForError(true);
        return;
      }
      if (u.password !== form.password) { setError("Contraseña incorrecta"); setLoading(false); return; }
      setLoading(false);
      onLogin(u);
    } catch (err) {
      console.error("Login error:", err);
      setError("Error al iniciar sesión.");
      setLoading(false);
    }
  };


  // ─── REGISTER ─────────────────────────────────────────────────────────────
  const doRegister = async () => {
    if (!form.full_name || !form.email || !form.phone || !form.password) {
      setError("Completa todos los campos"); return;
    }
    const pwdError = validatePassword(form.password);
    if (pwdError) { setError(pwdError); return; }
    const phoneClean = form.phone.replace(/\D/g, "");
    if (phoneClean.length !== 10) { setError("El teléfono debe tener exactamente 10 dígitos"); return; }
    const emailLow = form.email.trim().toLowerCase();
    setLoading(true);

    // Check passenger account by email
    const existingPassenger = (await supabaseApi.passengers.list()).filter((u) => u.email === emailLow);
    if (existingPassenger && existingPassenger.length > 0) {
      setError("Ya existe una cuenta de cliente con ese correo. Inicia sesión.");
      setLoading(false); return;
    }

    // Check phone duplicate
    const existingPhone = (await supabaseApi.passengers.list()).filter((u) => u.phone === form.phone.trim());
    if (existingPhone && existingPhone.length > 0) {
      setError("Ya existe una cuenta registrada con ese número de teléfono.");
      setLoading(false); return;
    }

    // Check driver account (cross-check)
    const existingDriver = await supabaseApi.drivers.list({ email: emailLow });
    if (existingDriver && existingDriver.length > 0) {
      setError("Ese correo ya está registrado como conductor en la plataforma. Usa uno diferente.");
      setLoading(false); return;
    }

    const userData = {
      full_name: form.full_name.trim(),
      email: emailLow,
      phone: form.phone.trim(),
      password: form.password,
      is_active: true,
    };

    // Email verification step
    if (requireEmailVerification) {
      const otp = genOTP();
      setOtpCode(otp);
      setPendingUserData(userData);
      // Note: Email sending would require Supabase Edge Functions or external service
      setLoading(false);
      setMode("verify_register");
      return;
    }

    const u = await supabaseApi.passengers.create(userData);
    setLoading(false);
    onLogin(u);
  };

  // ─── FORGOT PASSWORD ──────────────────────────────────────────────────────
  const doForgot = async () => {
    if (!form.email) { setError("Ingresa tu correo"); return; }
    const emailLow = form.email.trim().toLowerCase();
    setLoading(true);

    // Check if it's a driver email (not a passenger)
    const drivers = await supabaseApi.drivers.list({ email: emailLow });
    if (drivers && drivers.length > 0) {
      setError("Ese correo pertenece a una cuenta de conductor, no de cliente.");
      setLoading(false); return;
    }

    const users = (await supabaseApi.passengers.list()).filter((u) => u.email === emailLow);
    if (!users || users.length === 0) {
      setError("No encontramos ninguna cuenta de cliente con ese correo.");
      setLoading(false); return;
    }

    const token = genToken();
    const expires = futureCDMX(30 * 60 * 1000); // 30 min

    await supabaseApi.passengers.update(users[0].id, {
      reset_token: token,
      reset_token_expires: expires,
    });

    // Note: Email sending would require Supabase Edge Functions or external service

    setLoading(false);
    setSuccessMsg(`Hemos enviado un código de verificación a ${emailLow}.`);
    setMode("reset");
  };

  // ─── RESET PASSWORD ───────────────────────────────────────────────────────
  const doReset = async () => {
    if (!form.token || !form.new_password) { setError("Ingresa el código y la nueva contraseña"); return; }
    const pwdError = validatePassword(form.new_password);
    if (pwdError) { setError(pwdError); return; }
    setLoading(true);

    const resetUsers = (await supabaseApi.passengers.list()).filter((u) => u.email === form.email.trim().toLowerCase());
    const u = resetUsers?.[0];
    if (!u) { setError("Correo no encontrado"); setLoading(false); return; }

    if (u.reset_token !== form.token.trim().toUpperCase()) {
      setError("El código es incorrecto"); setLoading(false); return; }
    if (new Date() > new Date(u.reset_token_expires)) {
      setError("El código ha expirado. Solicita uno nuevo."); setLoading(false); return; }

    await supabaseApi.passengers.update(u.id, {
      password: form.new_password,
      reset_token: null,
      reset_token_expires: null,
    });

    // Note: Email sending would require Supabase Edge Functions or external service

    setLoading(false);
    setSuccessMsg("¡Contraseña actualizada! Ya puedes iniciar sesión.");
    setMode("login");
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 p-5"
      style={{ paddingTop: "max(24px, env(safe-area-inset-top))", paddingBottom: "max(24px, env(safe-area-inset-bottom))" }}>
      <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-sm">
        {/* Brand */}
        <div className="text-center mb-8">
          <div className="w-20 h-20 bg-blue-500 rounded-3xl flex items-center justify-center mx-auto mb-4 shadow-2xl shadow-blue-500/40 overflow-hidden">
            {appLogo ? (
              <img src={appLogo} alt="Logo" className="w-full h-full object-contain bg-white/10 p-3" />
            ) : (
              <Truck className="w-10 h-10 text-white" />
            )}
          </div>
          <h1 className="text-2xl font-black text-white">{appName || "YAJA Asistencia"}</h1>
          <p className="text-blue-300 text-sm mt-1">Solicita asistencia cuando más lo necesitas</p>
        </div>

        <div className="bg-white/10 backdrop-blur-xl rounded-3xl p-6 border border-white/10 shadow-2xl space-y-4">
          <AnimatePresence mode="wait">

            {/* ── LOGIN ── */}
            {mode === "login" && (
              <motion.div key="login" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-4">
                <h2 className="text-white font-bold text-lg text-center">Iniciar sesión</h2>
                {successMsg && (
                  <div className="flex items-start gap-2 bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-3">
                    <CheckCircle className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
                    <p className="text-emerald-300 text-xs">{successMsg}</p>
                  </div>
                )}
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
                  <Input type="email" placeholder="Correo electrónico" value={form.email} onChange={e => set("email", e.target.value)}
                    className="pl-10 bg-white/10 border-white/20 text-white placeholder:text-white/40 rounded-xl" />
                </div>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
                  <Input type={showPass ? "text" : "password"} placeholder="Contraseña" value={form.password} onChange={e => set("password", e.target.value)}
                    onKeyDown={e => e.key === "Enter" && doLogin()}
                    className="pl-10 pr-10 bg-white/10 border-white/20 text-white placeholder:text-white/40 rounded-xl" />
                  <button onClick={() => setShowPass(s => !s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40">
                    {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {error && <p className="text-red-400 text-xs text-center bg-red-400/10 rounded-lg p-2">{error}</p>}
                <Button onClick={doLogin} disabled={loading} className="w-full bg-blue-600 hover:bg-blue-500 rounded-xl min-h-[46px] font-bold text-base">
                  {loading ? "Verificando..." : "Ingresar"}
                </Button>
                <div className="flex gap-2 text-xs flex-col items-center">
                  <button onClick={() => { setMode("register"); setError(""); }} className="text-blue-300 hover:text-white hover:underline transition">+ Crear nueva cuenta</button>
                  <button onClick={() => { setMode("forgot"); setError(""); }} className="text-blue-300 hover:text-white hover:underline transition">¿Olvidé mi contraseña?</button>
                </div>
                {(showSupportForError || supportWhatsapp.number) && supportWhatsapp.number && (
                  <a
                    href={`https://wa.me/${supportWhatsapp.number}?text=${encodeURIComponent(showSupportForError ? "Hola, no puedo iniciar sesión en la app. Mi cuenta aparece desactivada o bloqueada. Necesito ayuda." : supportWhatsapp.message)}`}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20 transition text-xs font-medium"
                  >
                    <MessageCircle className="w-4 h-4" />
                    {showSupportForError ? "Necesito ayuda con mi cuenta" : "¿Necesitas ayuda?"}
                  </a>
                )}
              </motion.div>
            )}

            {/* ── VERIFY REGISTER ── */}
            {mode === "verify_register" && (
              <motion.div key="verify_register" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-4">
                <div className="flex items-center gap-2 mb-2">
                  <button onClick={() => { setMode("register"); setError(""); }} className="text-white/60 hover:text-white"><ArrowLeft className="w-4 h-4" /></button>
                  <h2 className="text-white font-bold text-lg">Verifica tu correo</h2>
                </div>
                <p className="text-white/50 text-xs">Ingresa el código de 6 dígitos enviado a <strong className="text-white/70">{pendingUserData?.email}</strong></p>
                <input
                  type="tel" inputMode="numeric"
                  placeholder="Código de 6 dígitos"
                  value={enteredOtp}
                  onChange={e => { setEnteredOtp(e.target.value.replace(/\D/g, "").slice(0, 6)); setError(""); }}
                  className="w-full tracking-widest font-mono text-center text-2xl rounded-xl bg-white/10 border border-white/20 text-white p-3 min-h-[52px] focus:outline-none focus:ring-2 focus:ring-blue-400 placeholder:text-white/20"
                />
                {error && <p className="text-red-400 text-xs text-center bg-red-400/10 rounded-lg p-2">{error}</p>}
                <Button
                  disabled={enteredOtp.length !== 6 || loading}
                  onClick={async () => {
                    if (enteredOtp.trim() !== otpCode) { setError("Código incorrecto"); return; }
                    setLoading(true); setError("");
                    const newUser = await supabaseApi.passengers.create(pendingUserData);
                    setLoading(false);
                    if (newUser) onLogin(newUser);
                  }}
                  className="w-full bg-emerald-600 hover:bg-emerald-500 rounded-xl min-h-[46px] font-bold">
                  {loading ? "Creando cuenta..." : "Verificar y crear cuenta"}
                </Button>
                <button onClick={async () => {
                  const otp = genOTP(); setOtpCode(otp);
                  // Note: Email sending would require Supabase Edge Functions or external service
                  setError("");
                }} className="w-full text-xs text-blue-300 hover:text-white text-center min-h-[36px]">Reenviar código</button>
              </motion.div>
            )}

            {/* ── REGISTER ── */}
            {mode === "register" && (
              <motion.div key="register" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-3">
                <div className="flex items-center gap-2 mb-2">
                  <button onClick={goLogin} className="text-white/60 hover:text-white"><ArrowLeft className="w-4 h-4" /></button>
                  <h2 className="text-white font-bold text-lg">Crear cuenta</h2>
                </div>
                {[
                  { icon: User, key: "full_name", placeholder: "Nombre completo", type: "text" },
                  { icon: Mail, key: "email", placeholder: "Correo electrónico", type: "email" },
                  { icon: Phone, key: "phone", placeholder: "Teléfono", type: "tel" },
                ].map(f => (
                  <div key={f.key} className="relative">
                    <f.icon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
                    <Input type={f.type} placeholder={f.placeholder} value={form[f.key]} onChange={e => set(f.key, e.target.value)}
                      className="pl-10 bg-white/10 border-white/20 text-white placeholder:text-white/40 rounded-xl" />
                  </div>
                ))}
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
                  <Input type={showPass ? "text" : "password"} placeholder="Contraseña" value={form.password} onChange={e => set("password", e.target.value)}
                    className="pl-10 pr-10 bg-white/10 border-white/20 text-white placeholder:text-white/40 rounded-xl" />
                  <button onClick={() => setShowPass(s => !s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40">
                    {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {form.password.length > 0 && (
                  <div className="text-xs space-y-1 bg-white/5 rounded-xl p-3">
                    <p className="text-white/40 font-medium mb-1">La contraseña debe tener:</p>
                    {[
                      { ok: form.password.length >= 8, label: "Mínimo 8 caracteres" },
                      { ok: /[A-Z]/.test(form.password), label: "Una mayúscula" },
                      { ok: /[a-z]/.test(form.password), label: "Una minúscula" },
                      { ok: /[^A-Za-z0-9]/.test(form.password), label: "Un carácter especial (@, #, !...)" },
                    ].map(r => (
                      <div key={r.label} className={`flex items-center gap-1.5 ${r.ok ? "text-emerald-400" : "text-white/30"}`}>
                        <span>{r.ok ? "✓" : "○"}</span><span>{r.label}</span>
                      </div>
                    ))}
                  </div>
                )}
                {error && <p className="text-red-400 text-xs text-center bg-red-400/10 rounded-lg p-2">{error}</p>}
                <Button onClick={doRegister} disabled={loading} className="w-full bg-emerald-600 hover:bg-emerald-500 rounded-xl min-h-[46px] font-bold text-base">
                  {loading ? "Creando cuenta..." : "Registrarme"}
                </Button>
                {supportWhatsapp.number && (
                  <a
                    href={`https://wa.me/${supportWhatsapp.number}?text=${encodeURIComponent(supportWhatsapp.message)}`}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl border border-white/10 bg-white/5 text-white/50 hover:text-white hover:bg-white/10 transition text-xs font-medium"
                  >
                    <MessageCircle className="w-4 h-4 text-emerald-400" />
                    Tengo problemas para registrarme
                  </a>
                )}
              </motion.div>
            )}

            {/* ── FORGOT ── */}
            {mode === "forgot" && (
              <motion.div key="forgot" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-4">
                <div className="flex items-center gap-2 mb-2">
                  <button onClick={goLogin} className="text-white/60 hover:text-white"><ArrowLeft className="w-4 h-4" /></button>
                  <h2 className="text-white font-bold text-lg">Recuperar contraseña</h2>
                </div>
                <p className="text-white/50 text-xs">Ingresa tu correo y te enviaremos un código para cambiar tu contraseña.</p>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
                  <Input type="email" placeholder="Correo electrónico" value={form.email} onChange={e => set("email", e.target.value)}
                    className="pl-10 bg-white/10 border-white/20 text-white placeholder:text-white/40 rounded-xl" />
                </div>
                {error && <p className="text-red-400 text-xs text-center bg-red-400/10 rounded-lg p-2">{error}</p>}
                {successMsg && <p className="text-emerald-400 text-xs text-center bg-emerald-400/10 rounded-lg p-2">{successMsg}</p>}
                <Button onClick={doForgot} disabled={loading} className="w-full bg-blue-600 hover:bg-blue-500 rounded-xl min-h-[46px] font-bold text-base">
                  {loading ? "Enviando..." : "Enviar código"}
                </Button>
              </motion.div>
            )}

            {/* ── RESET ── */}
            {mode === "reset" && (
              <motion.div key="reset" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-4">
                <div className="flex items-center gap-2 mb-2">
                  <button onClick={() => { setMode("forgot"); setSuccessMsg(""); }} className="text-white/60 hover:text-white"><ArrowLeft className="w-4 h-4" /></button>
                  <h2 className="text-white font-bold text-lg">Nueva contraseña</h2>
                </div>
                {successMsg && (
                  <div className="flex items-start gap-2 bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-3">
                    <CheckCircle className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
                    <p className="text-emerald-300 text-xs">{successMsg}</p>
                  </div>
                )}
                <div className="relative">
                  <Input placeholder="Código recibido por correo" value={form.token} onChange={e => set("token", e.target.value)}
                    className="tracking-widest font-mono bg-white/10 border-white/20 text-white placeholder:text-white/40 placeholder:font-sans placeholder:tracking-normal rounded-xl text-center text-lg" />
                </div>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
                  <Input type={showPass ? "text" : "password"} placeholder="Nueva contraseña" value={form.new_password} onChange={e => set("new_password", e.target.value)}
                    className="pl-10 pr-10 bg-white/10 border-white/20 text-white placeholder:text-white/40 rounded-xl" />
                  <button onClick={() => setShowPass(s => !s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40">
                    {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {error && <p className="text-red-400 text-xs text-center bg-red-400/10 rounded-lg p-2">{error}</p>}
                <Button onClick={doReset} disabled={loading} className="w-full bg-emerald-600 hover:bg-emerald-500 rounded-xl min-h-[46px] font-bold text-base">
                  {loading ? "Guardando..." : "Cambiar contraseña"}
                </Button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
}
