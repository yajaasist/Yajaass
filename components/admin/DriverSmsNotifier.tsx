import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MessageSquare, X, Send, Phone } from "lucide-react";
import { Button } from "@/components/ui/button";

const TEMPLATES = [
  {
    id: "approved",
    label: "✅ Cuenta habilitada",
    color: "emerald",
    getMessage: (name) =>
      `Hola ${name}, tu cuenta ha sido APROBADA. Ya puedes ingresar a la app y comenzar a recibir servicios. ¡Bienvenido!`,
  },
  {
    id: "rejected",
    label: "❌ Cuenta rechazada",
    color: "red",
    getMessage: (name) =>
      `Hola ${name}, lamentablemente tu solicitud de registro fue rechazada. Por favor comunícate con el administrador para más información.`,
  },
  {
    id: "missing_docs",
    label: "📄 Faltan documentos",
    color: "amber",
    getMessage: (name) =>
      `Hola ${name}, para activar tu cuenta necesitamos que subas los documentos pendientes en la app. Por favor revisa tu perfil e ingresa los documentos faltantes.`,
  },
  {
    id: "expired_docs",
    label: "⚠️ Documentos vencidos",
    color: "orange",
    getMessage: (name) =>
      `Hola ${name}, uno o más documentos de tu vehículo han vencido. Tu cuenta ha sido desactivada temporalmente. Por favor actualiza tus documentos para volver a operar.`,
  },
  {
    id: "expiry_warning",
    label: "🔔 Documentos por vencer",
    color: "yellow",
    getMessage: (name) =>
      `Hola ${name}, recuerda que tienes documentos próximos a vencer. Renuévalos antes de que caduquen para evitar interrupciones en tu servicio.`,
  },
  {
    id: "custom",
    label: "✏️ Mensaje personalizado",
    color: "slate",
    getMessage: () => "",
  },
];

const COLOR_CLASSES = {
  emerald: "bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100",
  red: "bg-red-50 border-red-200 text-red-700 hover:bg-red-100",
  amber: "bg-amber-50 border-amber-200 text-amber-700 hover:bg-amber-100",
  orange: "bg-orange-50 border-orange-200 text-orange-700 hover:bg-orange-100",
  yellow: "bg-yellow-50 border-yellow-200 text-yellow-700 hover:bg-yellow-100",
  slate: "bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100",
};

export default function DriverSmsNotifier({ driver }) {
  const [open, setOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [message, setMessage] = useState("");

  const phone = driver?.phone?.replace(/\D/g, "");
  const phoneWithCountry = phone ? (phone.startsWith("52") ? phone : `52${phone}`) : null;

  const handleSelect = (tpl) => {
    setSelectedTemplate(tpl.id);
    setMessage(tpl.getMessage(driver?.full_name?.split(" ")[0] || "conductor"));
  };

  const sendSMS = () => {
    if (!phone || !message) return;
    window.open(`sms:+${phoneWithCountry}?body=${encodeURIComponent(message)}`, "_blank");
  };

  const sendWhatsApp = () => {
    if (!phone || !message) return;
    window.open(`https://wa.me/${phoneWithCountry}?text=${encodeURIComponent(message)}`, "_blank");
  };

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 text-xs rounded-lg border-blue-200 text-blue-700 hover:bg-blue-50"
      >
        <MessageSquare className="w-3.5 h-3.5" />
        Notificar por SMS
      </Button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] bg-black/50 flex items-end sm:items-center justify-center p-4"
            onClick={() => setOpen(false)}
          >
            <motion.div
              initial={{ y: 40, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 40, opacity: 0 }}
              transition={{ type: "spring", damping: 28, stiffness: 300 }}
              className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden"
              onClick={e => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-center justify-between px-5 py-4 border-b">
                <div className="flex items-center gap-2">
                  <MessageSquare className="w-4 h-4 text-blue-600" />
                  <p className="font-semibold text-slate-900">Notificación SMS</p>
                </div>
                <div className="flex items-center gap-2">
                  {driver?.phone && (
                    <span className="text-xs text-slate-400 flex items-center gap-1">
                      <Phone className="w-3 h-3" /> {driver.phone}
                    </span>
                  )}
                  <button onClick={() => setOpen(false)} className="p-1 rounded-lg hover:bg-slate-100">
                    <X className="w-4 h-4 text-slate-400" />
                  </button>
                </div>
              </div>

              <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
                {/* Template selector */}
                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Selecciona un tipo de alerta</p>
                  <div className="grid grid-cols-2 gap-2">
                    {TEMPLATES.map(tpl => (
                      <button
                        key={tpl.id}
                        onClick={() => handleSelect(tpl)}
                        className={`text-left px-3 py-2.5 rounded-xl border text-xs font-medium transition-all ${
                          selectedTemplate === tpl.id
                            ? `ring-2 ring-blue-400 ${COLOR_CLASSES[tpl.color]}`
                            : "bg-white border-slate-200 text-slate-600 hover:border-slate-300"
                        }`}>
                        {tpl.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Message editor */}
                {selectedTemplate && (
                  <div>
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Mensaje</p>
                    <textarea
                      value={message}
                      onChange={e => setMessage(e.target.value)}
                      rows={5}
                      className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-300 resize-none"
                      placeholder="Escribe o edita el mensaje..."
                    />
                    <p className="text-[10px] text-slate-400 mt-1">{message.length} caracteres</p>
                  </div>
                )}

                {/* No phone warning */}
                {!driver?.phone && (
                  <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-xs text-red-600">
                    ⚠️ Este conductor no tiene número de teléfono registrado.
                  </div>
                )}

                {/* Send buttons */}
                {selectedTemplate && message && (
                  <div className="grid grid-cols-2 gap-3 pt-1">
                    <Button
                      onClick={sendSMS}
                      disabled={!phone}
                      className="bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-sm flex items-center gap-1.5"
                    >
                      <Send className="w-3.5 h-3.5" /> Enviar SMS
                    </Button>
                    <Button
                      onClick={sendWhatsApp}
                      disabled={!phone}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm flex items-center gap-1.5"
                    >
                      <MessageSquare className="w-3.5 h-3.5" /> WhatsApp
                    </Button>
                  </div>
                )}
                <p className="text-[10px] text-slate-400 text-center">
                  Se abrirá tu app de SMS o WhatsApp con el mensaje listo para enviar.
                </p>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
