import React, { useState } from "react";
import { supabaseApi } from "@/lib/supabaseApi";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Car, Upload, ArrowLeft, Clock, XCircle, CheckCircle2, FileText, MapPin, ChevronRight, User } from "lucide-react";
import { SESSION_KEY, SESSION_TOKEN_KEY } from "@/components/driver/driverUtils";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { CAR_BRANDS, MOTO_BRANDS, VEHICLE_YEARS } from "@/components/shared/vehicleBrands";
function validateCURPFormat(curp) {
  return /^[A-Z]{4}\d{6}[HM][A-Z]{5}[A-Z0-9]\d$/.test(curp);
}

const DEFAULT_VEHICLE_DOCS = [
  { key: "licencia", label: "Licencia de conducir", required: true },
  { key: "seguro", label: "Póliza de seguro", required: true },
  { key: "circulacion", label: "Tarjeta de circulación", required: false },
];

function Field({ label, required, children }) {
  return (
    <div>
      <Label>{label}{required && <span className="text-red-500 ml-0.5">*</span>}</Label>
      <div className="mt-1">{children}</div>
    </div>
  );
}

// Step indicator
function StepIndicator({ current }) {
  const steps = [
    { id: "personal", label: "Datos personales" },
    { id: "vehicle", label: "Mi vehículo" },
  ];
  const currentIndex = steps.findIndex(s => s.id === current);
  return (
    <div className="flex items-center gap-2 mb-6">
      {steps.map((s, i) => (
        <React.Fragment key={s.id}>
          <div className="flex items-center gap-2">
            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
              i < currentIndex ? "bg-emerald-500 text-white" :
              i === currentIndex ? "bg-blue-500 text-white" :
              "bg-slate-700 text-slate-400"
            }`}>
              {i < currentIndex ? "✓" : i + 1}
            </div>
            <span className={`text-xs font-medium hidden sm:block ${i === currentIndex ? "text-white" : "text-slate-400"}`}>{s.label}</span>
          </div>
          {i < steps.length - 1 && <div className={`flex-1 h-0.5 ${i < currentIndex ? "bg-emerald-500" : "bg-slate-700"}`} />}
        </React.Fragment>
      ))}
    </div>
  );
}

function RegisterScreenWrapper({ children }) {
  return (
    <div className="min-h-screen h-screen bg-slate-900 p-5 overflow-y-auto select-none" style={{ paddingTop: "max(24px, env(safe-area-inset-top))", paddingBottom: "max(24px, env(safe-area-inset-bottom))" }}>
      <div className="w-full max-w-sm mx-auto">{children}</div>
    </div>
  );
}

const genOTP = () => String(Math.floor(100000 + Math.random() * 900000));

export default function DriverRegisterScreen({ onBack, prefilledEmail = "", onLogin }) {
  const [step, setStep] = useState("check"); // check | verify_email | personal | vehicle | status
  const [form, setForm] = useState({
    full_name: "", email: prefilledEmail, phone: "", password: "", confirm_password: "", curp: "",
    city_id: "", city_name: "", service_type_ids: [], service_type_names: [], photo_url: "",
  });
  const [vehicle, setVehicle] = useState({ vehicle_type: "car", brand: "", model: "", year: "", color: "", plates: "" });
  const [personalDocUploads, setPersonalDocUploads] = useState({});
  const [vehicleDocUploads, setVehicleDocUploads] = useState({});
  const [existingDriver, setExistingDriver] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [enteredOtp, setEnteredOtp] = useState("");
  const [otpMsg, setOtpMsg] = useState("");
  const [supportWhatsapp, setSupportWhatsapp] = useState({ number: "", message: "Hola, tengo problemas para registrarme como conductor y no me llega el código de verificación." });
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [uploadingPersonalDoc, setUploadingPersonalDoc] = useState({});
  const [uploadingVehicleDoc, setUploadingVehicleDoc] = useState({});
  const [curpStatus, setCurpStatus] = useState(null);


  const { data: settingsList = [] } = useQuery({
    queryKey: ["appSettings"],
    queryFn: () => supabaseApi.settings.list(),
  });
  const settings = settingsList[0];

  // Load WhatsApp support config
  React.useEffect(() => {
    if (settings?.support_whatsapp_number) {
      setSupportWhatsapp({
        number: settings.support_whatsapp_number,
        message: settings.support_whatsapp_message || "Hola, tengo problemas para registrarme como conductor y no me llega el código de verificación.",
      });
    }
  }, [settings]);
  const requiredDocs = settings?.driver_required_docs || [];
  const vehicleDocs = settings?.driver_vehicle_docs?.length > 0 ? settings.driver_vehicle_docs : DEFAULT_VEHICLE_DOCS;

  const { data: cities = [] } = useQuery({
    queryKey: ["cities"],
    queryFn: () => supabaseApi.cities.list(),
  });
  const { data: serviceTypes = [] } = useQuery({
    queryKey: ["serviceTypes"],
    queryFn: () => supabaseApi.serviceTypes.list(),
  });

  const activeCities = cities.filter(c => c.is_active !== false);
  const activeServiceTypes = serviceTypes.filter(s => s.is_active !== false);



  const toggleServiceType = (st) => {
    const ids = form.service_type_ids || [];
    const names = form.service_type_names || [];
    if (ids.includes(st.id)) {
      setForm(p => ({ ...p, service_type_ids: ids.filter(i => i !== st.id), service_type_names: names.filter(n => n !== st.name) }));
    } else {
      setForm(p => ({ ...p, service_type_ids: [...ids, st.id], service_type_names: [...names, st.name] }));
    }
  };

  const update = (k, v) => setForm(p => ({ ...p, [k]: v }));
  const updateUpper = (k, v) => setForm(p => ({ ...p, [k]: v.toUpperCase() }));
  const updateVehicle = (k, v) => setVehicle(p => ({ ...p, [k]: v }));

  const checkCURP = async (curp) => {
    const clean = curp.trim().toUpperCase();
    if (clean.length < 18) { setCurpStatus(null); return; }
    if (!validateCURPFormat(clean)) { setCurpStatus("invalid_format"); return; }
    setCurpStatus("checking");
    const existing = await supabaseApi.drivers.list({ curp: clean });
    setCurpStatus(existing.length > 0 ? "duplicate" : "valid");
  };

  const checkEmail = async () => {
    if (!form.email) return;
    setError("");
    setLoading(true);
    try {
      const drivers = await supabaseApi.drivers.list({ email: form.email.trim().toLowerCase() });
      if (drivers.length > 0) {
        setExistingDriver(drivers[0]);
        setStep("status");
        setLoading(false);
        return;
      }
      // If email verification is disabled in settings, skip OTP
      if (settings?.require_email_verification === false) {
        setStep("personal");
        setLoading(false);
        return;
      }
      // Send OTP to verify email ownership
      const otp = genOTP();
      setOtpCode(otp);
      try {
        // NOTE: SendEmail requires Supabase Edge Function or external service implementation.
      } catch (emailErr) {
        console.error("Email send error:", emailErr);
      }
      setEnteredOtp("");
      setOtpMsg(`Código enviado a ${form.email.trim().toLowerCase()}`);
      setStep("verify_email");
    } catch (err) {
      console.error("checkEmail error:", err);
      setError("Ocurrió un error al verificar el correo. Intenta de nuevo.");
    } finally {
      setLoading(false);
    }
  };

  const handlePhotoUpload = async (file) => {
    setUploadingPhoto(true);
    const { file_url } = await supabaseApi.uploads.uploadFile({ file });
    update("photo_url", file_url);
    setUploadingPhoto(false);
  };

  const handlePersonalDocUpload = async (docKey, file) => {
    setUploadingPersonalDoc(p => ({ ...p, [docKey]: true }));
    const { file_url } = await supabaseApi.uploads.uploadFile({ file });
    setPersonalDocUploads(p => ({ ...p, [docKey]: file_url }));
    setUploadingPersonalDoc(p => ({ ...p, [docKey]: false }));
  };

  const handleVehicleDocUpload = async (docKey, file) => {
    setUploadingVehicleDoc(p => ({ ...p, [docKey]: true }));
    const { file_url } = await supabaseApi.uploads.uploadFile({ file });
    setVehicleDocUploads(p => ({ ...p, [docKey]: file_url }));
    setUploadingVehicleDoc(p => ({ ...p, [docKey]: false }));
  };

  const handlePersonalNext = () => {
    setError("");
    if (!form.full_name?.trim()) return setError("Nombre completo requerido");
    if (!form.photo_url) return setError("La foto de perfil es obligatoria");
    if (!validateCURPFormat(form.curp?.trim().toUpperCase() || "")) return setError("CURP inválido (18 caracteres requeridos)");
    if (curpStatus === "duplicate") return setError("Ya existe una cuenta con este CURP");
    if (!form.city_id) return setError("Selecciona tu ciudad");
    if (!form.service_type_ids?.length) return setError("Selecciona al menos un tipo de servicio");
    const phoneClean = form.phone.replace(/\D/g, "");
    if (phoneClean.length !== 10) return setError("El teléfono debe tener 10 dígitos");
    if (form.password !== form.confirm_password) return setError("Las contraseñas no coinciden");
    if (form.password.length < 6) return setError("La contraseña debe tener al menos 6 caracteres");
    const missingDocs = requiredDocs.filter(d => d.required && !personalDocUploads[d.key]);
    if (missingDocs.length > 0) return setError(`Documentos personales faltantes: ${missingDocs.map(d => d.label).join(", ")}`);
    setStep("vehicle");
  };

  const handleFinalSubmit = async () => {
    setError("");
    if (!vehicle.brand?.trim()) return setError("La marca del vehículo es requerida");
    if (!vehicle.plates?.trim()) return setError("Las placas son requeridas");
    const missingVDocs = vehicleDocs.filter(d => d.required && !vehicleDocUploads[d.key]);
    if (missingVDocs.length > 0) return setError(`Documentos del vehículo faltantes: ${missingVDocs.map(d => d.label).join(", ")}`);

    setLoading(true);
    const curpCheck = await supabaseApi.drivers.list({ curp: form.curp.trim().toUpperCase() });
    if (curpCheck.length > 0) {
      setError("Ya existe una cuenta registrada con ese CURP");
      setLoading(false);
      return;
    }

    // Build vehicle object with docs
    const vehicleDocFields = {};
    Object.entries(vehicleDocUploads).forEach(([k, v]) => {
      vehicleDocFields[`doc_${k}_url`] = v;
    });
    const vehicleObj = {
      id: Date.now().toString(),
      vehicle_type: vehicle.vehicle_type || "car",
      brand: vehicle.brand.toUpperCase(),
      model: vehicle.model.toUpperCase(),
      year: vehicle.year,
      color: vehicle.color.toUpperCase(),
      plates: vehicle.plates.toUpperCase(),
      is_active: true,
      ...vehicleDocFields,
    };

    const { confirm_password, ...data } = form;
    await supabaseApi.drivers.create({
      ...data,
      email: data.email.trim().toLowerCase(),
      curp: data.curp.trim().toUpperCase(),
      full_name: data.full_name.toUpperCase(),
      // Sync active vehicle fields to driver root
      vehicle_brand: vehicleObj.brand,
      vehicle_model: vehicleObj.model,
      vehicle_year: vehicleObj.year,
      vehicle_color: vehicleObj.color,
      license_plate: vehicleObj.plates,
      city_id: data.city_id,
      city_name: data.city_name,
      service_type_ids: data.service_type_ids || [],
      service_type_names: data.service_type_names || [],
      approval_status: "pending",
      status: "offline",
      rating: 5, rating_count: 0, total_rides: 0, total_earnings: 0,
      doc_urls: personalDocUploads,
      approved_docs: [],
      vehicles: [vehicleObj],
    });

    const drivers = await supabaseApi.drivers.list({ email: data.email.trim().toLowerCase() });
    if (drivers.length > 0) {
      const newDriver = drivers[0];
      setExistingDriver(newDriver);
      if (onLogin) {
        // Entra directo a la app — verá ApprovalPendingScreen por tener status pending
        const token = (crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2) + Date.now().toString(36));
        await supabaseApi.drivers.update(newDriver.id, { access_code: token });
        localStorage.setItem(SESSION_KEY, newDriver.id);
        localStorage.setItem(SESSION_TOKEN_KEY, token);
        const { password: _, ...safeDriver } = newDriver;
        setLoading(false);
        onLogin({ ...safeDriver, access_code: token });
        return;
      }
    }
    setStep("status");
    setLoading(false);
  };

  // ── STEP: VERIFY EMAIL ─────────────────────────────────────────────────────
  if (step === "verify_email") {
    return (
      <RegisterScreenWrapper>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-sm">
          <button onClick={() => { setStep("check"); setError(""); }} className="flex items-center gap-2 text-slate-400 hover:text-white mb-6 text-sm select-none min-h-[44px]">
            <ArrowLeft className="w-4 h-4" /> Atrás
          </button>
          <Card className="p-6 border-0 shadow-xl space-y-4">
            <div className="text-center">
              <div className="w-14 h-14 bg-emerald-100 rounded-2xl flex items-center justify-center mx-auto mb-3">
                <CheckCircle2 className="w-7 h-7 text-emerald-600" />
              </div>
              <h3 className="font-bold text-slate-900 text-base">Verifica tu correo</h3>
            </div>
            {otpMsg && <p className="text-emerald-700 text-xs text-center bg-emerald-50 rounded-xl p-2">{otpMsg}</p>}
            <p className="text-slate-500 text-xs text-center">Ingresa el código de 6 dígitos enviado a tu correo para continuar</p>
            <input
              type="tel"
              inputMode="numeric"
              placeholder="Código de 6 dígitos"
              value={enteredOtp}
              onChange={e => { setEnteredOtp(e.target.value.replace(/\D/g, "").slice(0, 6)); setError(""); }}
              className="w-full tracking-widest font-mono text-center text-2xl rounded-xl border border-slate-300 p-3 min-h-[52px] focus:outline-none focus:ring-2 focus:ring-emerald-500"
              onKeyDown={e => e.key === "Enter" && enteredOtp.length === 6 && (() => {
                if (enteredOtp.trim() !== otpCode) { setError("Código incorrecto"); return; }
                setStep("personal");
              })()}
            />
            {error && <p className="text-sm text-red-500 text-center bg-red-50 rounded-xl p-3">{error}</p>}
            <Button
              disabled={enteredOtp.length !== 6}
              onClick={() => {
                if (enteredOtp.trim() !== otpCode) { setError("Código incorrecto"); return; }
                setError("");
                setStep("personal");
              }}
              className="w-full bg-emerald-600 hover:bg-emerald-700 rounded-xl min-h-[44px] font-bold select-none">
              Verificar y continuar
            </Button>
            <button
              onClick={async () => {
                setOtpMsg("Reenviando...");
                const otp = genOTP();
                setOtpCode(otp);
                try {
                  // NOTE: SendEmail requires Supabase Edge Function or external service implementation.
                  setOtpMsg(`Nuevo código enviado a ${form.email.trim().toLowerCase()}`);
                } catch {
                  setOtpMsg("No se pudo reenviar el correo. Usa WhatsApp si el problema persiste.");
                }
              }}
              className="w-full text-xs text-blue-500 hover:text-blue-700 text-center min-h-[36px]"
            >
              Reenviar código
            </button>
            {supportWhatsapp.number && (
              <a
                href={`https://wa.me/${supportWhatsapp.number}?text=${encodeURIComponent(supportWhatsapp.message)}`}
                target="_blank"
                rel="noreferrer"
                className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-slate-600 hover:bg-green-50 hover:border-green-300 hover:text-green-700 transition text-xs font-medium"
              >
                <span className="text-green-600">💬</span>
                No me llega mi código
              </a>
            )}
          </Card>
        </motion.div>
      </RegisterScreenWrapper>
    );
  }

  // ── STEP: CHECK ────────────────────────────────────────────────────────────
  if (step === "check") {
    return (
      <RegisterScreenWrapper>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-sm">
          <button onClick={onBack} className="flex items-center gap-2 text-slate-400 hover:text-white mb-6 text-sm select-none min-h-[44px]">
            <ArrowLeft className="w-4 h-4" /> Volver al inicio de sesión
          </button>
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-emerald-500 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Car className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-white">Regístrate como conductor</h1>
            <p className="text-sm text-slate-400 mt-1">Ingresa tu correo para continuar</p>
          </div>
          <Card className="p-6 border-0 shadow-xl space-y-4">
            <Field label="Correo electrónico" required>
              <Input type="email" value={form.email} onChange={e => update("email", e.target.value)}
                placeholder="tu@correo.com" className="rounded-xl"
                onKeyDown={e => e.key === "Enter" && checkEmail()} />
            </Field>
            <Button onClick={checkEmail} disabled={!form.email || loading} className="w-full bg-emerald-600 hover:bg-emerald-700 rounded-xl min-h-[44px] select-none">
              {loading ? "Verificando..." : "Continuar"}
            </Button>
          </Card>
        </motion.div>
      </RegisterScreenWrapper>
    );
  }

  // ── STEP: STATUS ───────────────────────────────────────────────────────────
  if (step === "status") {
    const d = existingDriver;
    const statusMap = {
      pending: { icon: Clock, color: "text-amber-500", bg: "bg-amber-50 border-amber-200", title: "Solicitud en revisión", msg: "Tu registro está siendo revisado. Te contactaremos pronto." },
      rejected: { icon: XCircle, color: "text-red-500", bg: "bg-red-50 border-red-200", title: "Solicitud rechazada", msg: d?.rejection_reason || "Tu solicitud fue rechazada. Contacta al administrador." },
      approved: { icon: CheckCircle2, color: "text-emerald-500", bg: "bg-emerald-50 border-emerald-200", title: "¡Aprobado!", msg: "Tu cuenta está activa. Puedes iniciar sesión." },
    };
    const s = statusMap[d?.approval_status] || statusMap.pending;
    const Icon = s.icon;
    return (
      <RegisterScreenWrapper>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-sm">
          <Card className={`p-8 border-2 text-center ${s.bg}`}>
            <Icon className={`w-16 h-16 mx-auto mb-4 ${s.color}`} />
            <h2 className="text-xl font-bold text-slate-900 mb-2">{s.title}</h2>
            <p className="text-sm text-slate-600">{s.msg}</p>
            {d?.approval_status === "approved" ? (
              <Button onClick={onBack} className="mt-6 w-full bg-emerald-600 hover:bg-emerald-700 rounded-xl min-h-[44px] select-none">
                Iniciar sesión
              </Button>
            ) : (
              <button onClick={onBack} className="mt-6 text-sm text-slate-500 hover:text-slate-700 min-h-[44px] select-none">
                ← Volver
              </button>
            )}
          </Card>
        </motion.div>
      </RegisterScreenWrapper>
    );
  }

  // ── STEP: PERSONAL ─────────────────────────────────────────────────────────
  if (step === "personal") {
    return (
      <RegisterScreenWrapper>
        <div className="max-w-sm mx-auto">
          <button onClick={() => setStep("check")} className="flex items-center gap-2 text-slate-400 hover:text-white mb-4 text-sm select-none min-h-[44px]">
            <ArrowLeft className="w-4 h-4" /> Atrás
          </button>
          <StepIndicator current="personal" />
          <h1 className="text-xl font-bold text-white mb-1">Datos personales</h1>
          <p className="text-sm text-slate-400 mb-5">Completa tu información personal y documentos</p>

          <Card className="p-6 border-0 shadow-xl space-y-5">
            {/* Photo */}
            <div className="flex flex-col items-center">
              <div className={`w-20 h-20 rounded-full overflow-hidden mb-2 flex items-center justify-center border-2 ${form.photo_url ? "border-emerald-400" : "border-dashed border-slate-300 bg-slate-50"}`}>
                {form.photo_url ? <img src={form.photo_url} alt="Foto" className="w-full h-full object-cover" /> : <User className="w-8 h-8 text-slate-300" />}
              </div>
              <label className="cursor-pointer select-none">
                <input type="file" accept="image/*" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handlePhotoUpload(f); }} />
                <span className="text-xs text-blue-600 hover:text-blue-700 flex items-center gap-1">
                  <Upload className="w-3.5 h-3.5" /> {uploadingPhoto ? "Subiendo..." : form.photo_url ? "Cambiar foto" : "Subir foto *"}
                </span>
              </label>
            </div>

            <div className="space-y-3">
              <p className="text-xs font-semibold text-slate-500 uppercase">Información personal</p>
              <Field label="Nombre completo" required>
                <Input value={form.full_name} onChange={e => updateUpper("full_name", e.target.value)} className="rounded-xl" placeholder="JUAN PÉREZ" />
              </Field>
              <div><Label>Correo (verificado)</Label><Input value={form.email} disabled className="rounded-xl mt-1 bg-slate-50" /></div>
              <Field label="Teléfono (10 dígitos)" required>
                <Input type="tel" value={form.phone} onChange={e => update("phone", e.target.value)} className="rounded-xl" placeholder="55 1234 5678" />
              </Field>
              <Field label="CURP" required>
                <div className="relative">
                  <Input
                    value={form.curp}
                    onChange={e => { const val = e.target.value.toUpperCase(); update("curp", val); checkCURP(val); }}
                    maxLength={18}
                    className={`rounded-xl pr-10 font-mono ${curpStatus === "valid" ? "border-emerald-500" : curpStatus === "duplicate" || curpStatus === "invalid_format" ? "border-red-400" : ""}`}
                    placeholder="CURP de 18 caracteres"
                  />
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 text-xs">
                    {curpStatus === "checking" && <span className="text-slate-400">...</span>}
                    {curpStatus === "valid" && <span className="text-emerald-600 font-bold">✓</span>}
                    {(curpStatus === "duplicate" || curpStatus === "invalid_format") && <span className="text-red-500 font-bold">✗</span>}
                  </div>
                </div>
                {curpStatus === "duplicate" && <p className="text-xs text-red-500 mt-1">Ya existe una cuenta con este CURP</p>}
                {curpStatus === "invalid_format" && <p className="text-xs text-red-500 mt-1">Formato inválido. Ej: PELJ840528HDFRZS09</p>}
                {curpStatus === "valid" && <p className="text-xs text-emerald-600 mt-1">CURP válido ✓</p>}
              </Field>
              <Field label="Contraseña" required>
                <Input type="password" value={form.password} onChange={e => update("password", e.target.value)} className="rounded-xl" placeholder="Mínimo 6 caracteres" />
              </Field>
              <Field label="Confirmar contraseña" required>
                <Input type="password" value={form.confirm_password} onChange={e => update("confirm_password", e.target.value)} className="rounded-xl" />
              </Field>
            </div>

            <div className="space-y-3">
              <p className="text-xs font-semibold text-slate-500 uppercase">Ciudad y servicios</p>
              <Field label="Ciudad" required>
                <Select value={form.city_id} onValueChange={v => {
                  const city = activeCities.find(c => c.id === v);
                  setForm(p => ({ ...p, city_id: v, city_name: city?.name || "" }));
                }}>
                  <SelectTrigger className="mt-1 rounded-xl">
                    <MapPin className="w-3.5 h-3.5 mr-1.5 text-slate-400" />
                    <SelectValue placeholder={activeCities.length === 0 ? "Cargando..." : "Seleccionar ciudad"} />
                  </SelectTrigger>
                  <SelectContent>
                    {activeCities.map(c => <SelectItem key={c.id} value={c.id}>{c.name}{c.state ? `, ${c.state}` : ""}</SelectItem>)}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Tipos de servicio" required>
                <div className="mt-1 space-y-2">
                  {activeServiceTypes.map(st => {
                    const selected = (form.service_type_ids || []).includes(st.id);
                    return (
                      <button key={st.id} type="button" onClick={() => toggleServiceType(st)}
                        className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border-2 transition-all text-left ${selected ? "border-emerald-500 bg-emerald-50" : "border-slate-200 bg-white hover:border-slate-300"}`}>
                        <div className="flex items-center gap-2">
                          <Car className={`w-4 h-4 ${selected ? "text-emerald-600" : "text-slate-400"}`} />
                          <span className={`text-sm font-medium ${selected ? "text-emerald-800" : "text-slate-700"}`}>{st.name}</span>
                          {st.category && <span className="text-xs text-slate-400">· {st.category}</span>}
                        </div>
                        {selected && <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />}
                      </button>
                    );
                  })}
                  {activeServiceTypes.length === 0 && <p className="text-xs text-slate-400">No hay tipos de servicio activos.</p>}
                </div>
              </Field>
            </div>

            {requiredDocs.length > 0 && (
              <div className="space-y-3">
                <p className="text-xs font-semibold text-slate-500 uppercase">Documentos personales</p>
                {requiredDocs.map(doc => (
                  <div key={doc.key} className={`p-3 rounded-xl border-2 ${personalDocUploads[doc.key] ? "border-emerald-400 bg-emerald-50" : doc.required ? "border-red-200 bg-red-50" : "border-slate-200"}`}>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <FileText className={`w-4 h-4 ${personalDocUploads[doc.key] ? "text-emerald-600" : "text-slate-400"}`} />
                        <span className="text-sm font-medium text-slate-700">{doc.label}{doc.required && <span className="text-red-500 ml-0.5">*</span>}</span>
                      </div>
                      {personalDocUploads[doc.key] && (
                        <a href={personalDocUploads[doc.key]} target="_blank" rel="noreferrer" className="text-xs text-emerald-600 underline">Ver</a>
                      )}
                    </div>
                    <label className="cursor-pointer select-none">
                      <input type="file" accept="image/*,application/pdf" className="hidden" onChange={async e => {
                        const f = e.target.files?.[0]; if (f) handlePersonalDocUpload(doc.key, f);
                      }} />
                      <span className={`text-xs flex items-center gap-1 ${personalDocUploads[doc.key] ? "text-emerald-600" : "text-blue-600"}`}>
                        <Upload className="w-3.5 h-3.5" />
                        {uploadingPersonalDoc[doc.key] ? "Subiendo..." : personalDocUploads[doc.key] ? "✓ Subido — toca para cambiar" : "Subir documento"}
                      </span>
                    </label>
                  </div>
                ))}
              </div>
            )}

            {error && <p className="text-sm text-red-500 bg-red-50 rounded-xl p-3 text-center">{error}</p>}

            <Button onClick={handlePersonalNext} className="w-full bg-blue-600 hover:bg-blue-700 rounded-xl min-h-[44px] text-base select-none">
              Siguiente: Mi vehículo <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </Card>
        </div>
      </RegisterScreenWrapper>
    );
  }

  // ── STEP: VEHICLE ──────────────────────────────────────────────────────────
  return (
    <RegisterScreenWrapper>
      <div className="max-w-sm mx-auto">
        <button onClick={() => { setStep("personal"); setError(""); }} className="flex items-center gap-2 text-slate-400 hover:text-white mb-4 text-sm select-none min-h-[44px]">
          <ArrowLeft className="w-4 h-4" /> Atrás
        </button>
        <StepIndicator current="vehicle" />
        <h1 className="text-xl font-bold text-white mb-1">Mi vehículo</h1>
        <p className="text-sm text-slate-400 mb-5">Agrega el vehículo con el que prestarás el servicio</p>

        <Card className="p-6 border-0 shadow-xl space-y-5">
          <div className="space-y-3">
            <p className="text-xs font-semibold text-slate-500 uppercase">Datos del vehículo</p>

            <Field label="Tipo de vehículo" required>
              <div className="grid grid-cols-2 gap-2 mt-1">
                {[{ value: "car", label: "🚗 Carro" }, { value: "moto", label: "🏍️ Moto" }].map(t => (
                  <button key={t.value} type="button"
                    onClick={() => { updateVehicle("vehicle_type", t.value); updateVehicle("brand", ""); }}
                    className={`py-3 rounded-xl border-2 text-sm font-semibold transition-all ${vehicle.vehicle_type === t.value ? "border-emerald-500 bg-emerald-50 text-emerald-700" : "border-slate-200 text-slate-500"}`}>
                    {t.label}
                  </button>
                ))}
              </div>
            </Field>

            <Field label="Marca" required>
              <Select value={vehicle.brand} onValueChange={v => updateVehicle("brand", v)}>
                <SelectTrigger className="mt-1 rounded-xl"><SelectValue placeholder="Seleccionar marca" /></SelectTrigger>
                <SelectContent>
                  {(vehicle.vehicle_type === "moto" ? MOTO_BRANDS : CAR_BRANDS).map(b => <SelectItem key={b} value={b}>{b}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>

            <Field label="Modelo" required>
              <Input value={vehicle.model} onChange={e => updateVehicle("model", e.target.value.toUpperCase())}
                className="rounded-xl mt-1" placeholder="Ej: COROLLA, SENTRA, JETTA..." />
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Año" required={false}>
                <Select value={vehicle.year} onValueChange={v => updateVehicle("year", v)}>
                  <SelectTrigger className="mt-1 rounded-xl"><SelectValue placeholder="Año" /></SelectTrigger>
                  <SelectContent>{VEHICLE_YEARS.map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}</SelectContent>
                </Select>
              </Field>
              <Field label="Color" required={false}>
                <Input value={vehicle.color} onChange={e => updateVehicle("color", e.target.value.toUpperCase())} className="rounded-xl mt-1" placeholder="BLANCO" />
              </Field>
            </div>
            <Field label="Placas" required>
              <Input value={vehicle.plates} onChange={e => updateVehicle("plates", e.target.value.toUpperCase())} className="rounded-xl mt-1 font-mono" placeholder="ABC-123" />
            </Field>
          </div>

          {vehicleDocs.length > 0 && (
            <div className="space-y-3">
              <p className="text-xs font-semibold text-slate-500 uppercase">Documentos del vehículo</p>
              {vehicleDocs.map(doc => (
                <div key={doc.key} className={`p-3 rounded-xl border-2 ${vehicleDocUploads[doc.key] ? "border-emerald-400 bg-emerald-50" : doc.required ? "border-amber-200 bg-amber-50" : "border-slate-200"}`}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <FileText className={`w-4 h-4 ${vehicleDocUploads[doc.key] ? "text-emerald-600" : "text-slate-400"}`} />
                      <span className="text-sm font-medium text-slate-700">{doc.label}{doc.required && <span className="text-red-500 ml-0.5">*</span>}</span>
                    </div>
                    {vehicleDocUploads[doc.key] && (
                      <a href={vehicleDocUploads[doc.key]} target="_blank" rel="noreferrer" className="text-xs text-emerald-600 underline">Ver</a>
                    )}
                  </div>
                  <label className="cursor-pointer select-none">
                    <input type="file" accept="image/*,application/pdf" className="hidden" onChange={async e => {
                      const f = e.target.files?.[0]; if (f) handleVehicleDocUpload(doc.key, f);
                    }} />
                    <span className={`text-xs flex items-center gap-1 ${vehicleDocUploads[doc.key] ? "text-emerald-600" : "text-blue-600"}`}>
                      <Upload className="w-3.5 h-3.5" />
                      {uploadingVehicleDoc[doc.key] ? "Subiendo..." : vehicleDocUploads[doc.key] ? "✓ Subido — toca para cambiar" : "Subir documento"}
                    </span>
                  </label>
                </div>
              ))}
            </div>
          )}

          {error && <p className="text-sm text-red-500 bg-red-50 rounded-xl p-3 text-center">{error}</p>}

          <Button onClick={handleFinalSubmit} disabled={loading || !vehicle.brand || !vehicle.plates} className="w-full bg-emerald-600 hover:bg-emerald-700 rounded-xl min-h-[44px] text-base select-none">
            {loading ? "Enviando solicitud..." : "Enviar solicitud de registro"}
          </Button>
        </Card>
      </div>
    </RegisterScreenWrapper>
  );
}
