import React, { useState, useRef } from "react";
import { supabaseApi } from "@/lib/supabaseApi";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { motion } from "framer-motion";
import { CheckCircle2, Star, ClipboardList, PenLine, X } from "lucide-react";
import { nowCDMX } from "@/components/shared/dateUtils";

function SignaturePad({ onCapture }) {
  const canvasRef = useRef(null);
  const isDrawingRef = useRef(false);
  const [hasDrawn, setHasDrawn] = useState(false);

  const getPos = (e, canvas) => {
    const rect = canvas.getBoundingClientRect();
    const touch = e.touches?.[0];
    const clientX = touch ? touch.clientX : e.clientX;
    const clientY = touch ? touch.clientY : e.clientY;
    return { x: clientX - rect.left, y: clientY - rect.top };
  };

  const startDraw = (e) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    const pos = getPos(e, canvas);
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
    isDrawingRef.current = true;
  };

  const draw = (e) => {
    e.preventDefault();
    if (!isDrawingRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    const pos = getPos(e, canvas);
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.strokeStyle = "#1e293b";
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
    setHasDrawn(true);
  };

  const stopDraw = (e) => {
    e.preventDefault();
    isDrawingRef.current = false;
    if (hasDrawn || canvasRef.current) {
      onCapture(canvasRef.current.toDataURL("image/png"));
    }
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasDrawn(false);
    onCapture(null);
  };

  return (
    <div className="space-y-2">
      <div className="relative border-2 border-dashed border-slate-300 rounded-xl overflow-hidden bg-white">
        <canvas
          ref={canvasRef}
          width={320}
          height={150}
          className="w-full touch-none"
          onMouseDown={startDraw}
          onMouseMove={draw}
          onMouseUp={stopDraw}
          onMouseLeave={stopDraw}
          onTouchStart={startDraw}
          onTouchMove={draw}
          onTouchEnd={stopDraw}
        />
        {!hasDrawn && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <p className="text-xs text-slate-300 flex items-center gap-1.5">
              <PenLine className="w-3.5 h-3.5" /> Firmar aquí
            </p>
          </div>
        )}
      </div>
      {hasDrawn && (
        <button onClick={clearCanvas} className="text-xs text-red-400 hover:text-red-600 flex items-center gap-1">
          <X className="w-3 h-3" /> Borrar firma
        </button>
      )}
    </div>
  );
}

export default function DriverSurveyModal({ survey, ride, driver, onComplete, onClose }) {
  const [answers, setAnswers] = useState({});
  const [signatureName, setSignatureName] = useState("");
  const [signatureDataUrl, setSignatureDataUrl] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  if (!survey) return null;

  const questions = survey.questions || [];

  const setAnswer = (id, val) => setAnswers(prev => ({ ...prev, [id]: val }));

  const handleSubmit = async () => {
    setError("");
    // Validate required
    for (const q of questions) {
      if (q.required && !answers[q.id]?.trim()) {
        setError(`Por favor responde: "${q.question}"`);
        return;
      }
    }
    if (survey.require_signature && !signatureName.trim() && !signatureDataUrl) {
      setError("Se requiere la firma del pasajero");
      return;
    }

    setSubmitting(true);
    let signature_url = null;
    if (signatureDataUrl) {
      // Upload signature image
      const blob = await (await fetch(signatureDataUrl)).blob();
      const file = new File([blob], "firma.png", { type: "image/png" });
      const res = await supabaseApi.uploads.uploadFile({ file });
      signature_url = res.file_url;
    }

    const answersArr = questions.map(q => ({
      question: q.question,
      answer: answers[q.id] || "",
    }));

    await supabaseApi.surveyResponses.create({
      survey_id: survey.id,
      survey_title: survey.title,
      ride_id: ride.id,
      service_id: ride.service_id || "",
      company_id: ride.company_id || "",
      company_name: ride.company_name || "",
      driver_id: driver.id,
      driver_name: driver.full_name,
      passenger_name: ride.passenger_name,
      answers: answersArr,
      signature_name: signatureName,
      signature_url,
      completed_at: nowCDMX(),
    });

    setSubmitting(false);
    onComplete();
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-black/70 flex items-end"
      onClick={onClose}
    >
      <motion.div
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ type: "spring", damping: 30, stiffness: 300 }}
        className="w-full bg-white rounded-t-3xl overflow-hidden max-h-[90vh] flex flex-col"
        onClick={e => e.stopPropagation()}
        style={{ paddingBottom: "max(16px, env(safe-area-inset-bottom))" }}
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-5 pt-5 pb-4 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center flex-shrink-0">
              <ClipboardList className="w-5 h-5 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="font-bold text-white text-base leading-tight">{survey.title}</h2>
              {survey.description && <p className="text-blue-200 text-xs mt-0.5 leading-tight">{survey.description}</p>}
            </div>
          </div>
          <p className="text-blue-200 text-xs mt-3">
            Por favor completa la encuesta antes de finalizar el servicio
          </p>
        </div>

        {/* Questions */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {questions.map((q, idx) => (
            <div key={q.id || idx} className="space-y-2">
              <p className="text-sm font-semibold text-slate-800">
                {idx + 1}. {q.question}
                {q.required && <span className="text-red-500 ml-0.5">*</span>}
              </p>

              {q.type === "text" && (
                <textarea
                  value={answers[q.id] || ""}
                  onChange={e => setAnswer(q.id, e.target.value)}
                  rows={3}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 resize-none"
                  placeholder="Tu respuesta..."
                />
              )}

              {q.type === "yesno" && (
                <div className="flex gap-3">
                  {["Sí", "No"].map(opt => (
                    <button
                      key={opt}
                      onClick={() => setAnswer(q.id, opt)}
                      className={`flex-1 py-3 rounded-xl border-2 text-sm font-semibold transition-all ${
                        answers[q.id] === opt
                          ? "border-blue-500 bg-blue-50 text-blue-700"
                          : "border-slate-200 text-slate-600"
                      }`}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              )}

              {q.type === "rating" && (
                <div className="flex gap-2">
                  {[1, 2, 3, 4, 5].map(n => (
                    <button
                      key={n}
                      onClick={() => setAnswer(q.id, String(n))}
                      className="flex-1"
                    >
                      <Star
                        className={`w-8 h-8 mx-auto transition-colors ${
                          parseInt(answers[q.id] || 0) >= n
                            ? "fill-amber-400 text-amber-400"
                            : "text-slate-200"
                        }`}
                      />
                    </button>
                  ))}
                </div>
              )}

              {q.type === "select" && (q.options || []).length > 0 && (
                <div className="space-y-2">
                  {q.options.map(opt => (
                    <button
                      key={opt}
                      onClick={() => setAnswer(q.id, opt)}
                      className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border-2 text-sm transition-all ${
                        answers[q.id] === opt
                          ? "border-blue-500 bg-blue-50 text-blue-700"
                          : "border-slate-200 text-slate-700"
                      }`}
                    >
                      {opt}
                      {answers[q.id] === opt && <CheckCircle2 className="w-4 h-4 text-blue-500" />}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}

          {/* Signature section */}
          {survey.require_signature && (
            <div className="space-y-3 pt-2 border-t border-slate-100">
              <p className="text-sm font-semibold text-slate-800 flex items-center gap-2">
                <PenLine className="w-4 h-4 text-indigo-500" />
                Firma del pasajero *
              </p>
              <SignaturePad onCapture={setSignatureDataUrl} />
              <div>
                <Input
                  value={signatureName}
                  onChange={e => setSignatureName(e.target.value)}
                  placeholder="Nombre completo del firmante"
                  className="rounded-xl text-sm"
                />
              </div>
            </div>
          )}

          {error && (
            <p className="text-sm text-red-500 bg-red-50 rounded-xl p-3 text-center">{error}</p>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 pt-3 flex-shrink-0 space-y-2 border-t border-slate-100">
          <Button
            onClick={handleSubmit}
            disabled={submitting}
            className="w-full bg-blue-600 hover:bg-blue-700 rounded-xl min-h-[48px] text-base font-bold select-none"
          >
            {submitting ? "Guardando..." : "Guardar encuesta y finalizar"}
          </Button>
          <button
            onClick={onClose}
            className="w-full text-sm text-slate-400 hover:text-slate-600 py-2 min-h-[36px] select-none"
          >
            Cancelar
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
