"use client";
export const dynamic = 'force-dynamic';

import React, { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabaseApi } from "@/lib/supabaseApi";
import Layout from "@/components/admin/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import {
  Plus, Pencil, Trash2, ClipboardList, Search, CheckCircle2,
  PenLine, Building2, FileText, ChevronDown, Download
} from "lucide-react";
import { toast } from "sonner";
import { formatCDMX } from "@/components/shared/dateUtils";

const QUESTION_TYPES = [
  { value: "text", label: "Texto libre" },
  { value: "rating", label: "Calificación (1-5 estrellas)" },
  { value: "select", label: "Opción múltiple" },
  { value: "yesno", label: "Sí / No" },
];

const emptyQuestion = () => ({ id: String(Date.now()), question: "", type: "text", options: [], required: true });
const emptySurvey = { title: "", description: "", company_ids: [], company_names: [], questions: [], require_signature: false, is_active: true };

function QuestionEditor({ question, index, onChange, onDelete }: any) {
  const addOption = () => onChange({ ...question, options: [...(question.options || []), ""] });
  const updateOption = (i: number, val: string) => {
    const opts = [...(question.options || [])];
    opts[i] = val;
    onChange({ ...question, options: opts });
  };
  const removeOption = (i: number) => onChange({ ...question, options: (question.options || []).filter((_: any, idx: number) => idx !== i) });

  return (
    <div className="border border-slate-200 rounded-xl p-4 space-y-3 bg-slate-50">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-bold text-slate-400 uppercase">Pregunta {index + 1}</span>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-1.5 text-xs text-slate-500 cursor-pointer">
            <Switch checked={!!question.required} onCheckedChange={v => onChange({ ...question, required: v })} />
            Obligatoria
          </label>
          <button onClick={onDelete} className="text-red-400 hover:text-red-600 p-1">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      <Input
        value={question.question}
        onChange={e => onChange({ ...question, question: e.target.value })}
        placeholder="Escribe la pregunta..."
        className="text-sm"
      />

      <Select value={question.type} onValueChange={v => onChange({ ...question, type: v })}>
        <SelectTrigger className="text-xs">
          <SelectValue placeholder="Tipo de pregunta" />
        </SelectTrigger>
        <SelectContent>
          {QUESTION_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
        </SelectContent>
      </Select>

      {question.type === "select" && (
        <div className="space-y-2">
          <p className="text-xs text-slate-500">Opciones:</p>
          {(question.options || []).map((opt: string, i: number) => (
            <div key={i} className="flex gap-2">
              <Input
                value={opt}
                onChange={e => updateOption(i, e.target.value)}
                placeholder={`Opción ${i + 1}`}
                className="text-xs h-8 flex-1"
              />
              <button onClick={() => removeOption(i)} className="text-red-400 hover:text-red-600">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
          <Button type="button" variant="outline" size="sm" onClick={addOption} className="text-xs rounded-lg">
            <Plus className="w-3 h-3 mr-1" /> Agregar opción
          </Button>
        </div>
      )}
    </div>
  );
}

function SurveyFormDialog({ open, survey, companies, onClose, onSaved }: any) {
  const [form, setForm] = useState(survey ? { ...survey } : { ...emptySurvey });
  const [saving, setSaving] = useState(false);
  const queryClient = useQueryClient();

  const up = (k: string, v: any) => setForm((p: any) => ({ ...p, [k]: v }));

  const addQuestion = () => up("questions", [...(form.questions || []), emptyQuestion()]);
  const updateQuestion = (idx: number, q: any) => {
    const qs = [...(form.questions || [])];
    qs[idx] = q;
    up("questions", qs);
  };
  const deleteQuestion = (idx: number) => up("questions", (form.questions || []).filter((_: any, i: number) => i !== idx));

  const toggleCompany = (company: any) => {
    const ids = form.company_ids || [];
    const names = form.company_names || [];
    if (ids.includes(company.id)) {
      up("company_ids", ids.filter((i: string) => i !== company.id));
      up("company_names", names.filter((n: string) => n !== company.razon_social));
    } else {
      up("company_ids", [...ids, company.id]);
      up("company_names", [...names, company.razon_social]);
    }
  };

  const handleSave = async () => {
    if (!form.title) { toast.error("El título es requerido"); return; }
    setSaving(true);
    try {
      if (form.id) {
        await supabaseApi.surveys.update(form.id, form);
      } else {
        await supabaseApi.surveys.create(form);
      }
      queryClient.invalidateQueries({ queryKey: ["surveys"] });
      queryClient.invalidateQueries({ queryKey: ["companies"] });
      setSaving(false);
      toast.success("Encuesta guardada");
      onSaved();
    } catch (error: any) {
      toast.error(error.message || "Error al guardar encuesta");
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="dialog-size-3xl max-h-[90vh] overflow-y-auto p-4">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ClipboardList className="w-5 h-5 text-blue-600" />
            {form.id ? "Editar encuesta" : "Nueva encuesta"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5 py-2">
          <div>
            <Label>Título de la encuesta *</Label>
            <Input value={form.title} onChange={e => up("title", e.target.value)} className="mt-1" placeholder="Encuesta de satisfacción..." />
          </div>
          <div>
            <Label>Descripción / instrucciones</Label>
            <Textarea value={form.description || ""} onChange={e => up("description", e.target.value)} rows={2} className="mt-1" placeholder="Instrucciones para el conductor o pasajero..." />
          </div>

          <div className="flex items-center justify-between p-3 bg-indigo-50 rounded-xl">
            <div>
              <p className="text-sm font-medium text-slate-800">Requiere firma del pasajero</p>
              <p className="text-xs text-slate-500">El pasajero debe firmar antes de finalizar el servicio</p>
            </div>
            <Switch checked={!!form.require_signature} onCheckedChange={v => up("require_signature", v)} />
          </div>

          {/* Empresas */}
          <div>
            <Label className="flex items-center gap-2 mb-2">
              <Building2 className="w-4 h-4" /> Asignar a empresas
            </Label>
            <p className="text-xs text-slate-400 mb-2">Selecciona las empresas donde se aplicará esta encuesta en cada viaje corporativo.</p>
            <div className="space-y-2 max-h-40 overflow-y-auto border border-slate-200 rounded-xl p-2">
              {companies.length === 0 && <p className="text-xs text-slate-400 text-center py-2">No hay empresas registradas</p>}
              {companies.map((c: any) => {
                const selected = (form.company_ids || []).includes(c.id);
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => toggleCompany(c)}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-lg border transition-all text-sm ${selected ? "border-blue-500 bg-blue-50 text-blue-700" : "border-slate-200 text-slate-700 hover:border-slate-300"}`}
                  >
                    <span>{c.razon_social}</span>
                    {selected && <CheckCircle2 className="w-4 h-4 text-blue-500 flex-shrink-0" />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Questions */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <Label>Preguntas ({(form.questions || []).length})</Label>
              <Button type="button" size="sm" variant="outline" onClick={addQuestion} className="rounded-lg text-xs">
                <Plus className="w-3.5 h-3.5 mr-1" /> Agregar pregunta
              </Button>
            </div>
            {(form.questions || []).length === 0 && (
              <p className="text-xs text-slate-400 text-center py-4 border-2 border-dashed border-slate-200 rounded-xl">
                Sin preguntas. Agrega al menos una para poder guardar.
              </p>
            )}
            <div className="space-y-3">
              {(form.questions || []).map((q: any, idx: number) => (
                <QuestionEditor
                  key={q.id || idx}
                  question={q}
                  index={idx}
                  onChange={(nq: any) => updateQuestion(idx, nq)}
                  onDelete={() => deleteQuestion(idx)}
                />
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl">
            <p className="text-sm font-medium text-slate-800">Encuesta activa</p>
            <Switch checked={!!form.is_active} onCheckedChange={v => up("is_active", v)} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving || !form.title} className="bg-blue-600 hover:bg-blue-700">
            {saving ? "Guardando..." : "Guardar encuesta"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ResponsesPanel({ responses, companies }: any) {
  const [searchTicket, setSearchTicket] = useState("");
  const [filterCompany, setFilterCompany] = useState("all");
  const [filterSurvey, setFilterSurvey] = useState("all");
  const [expanded, setExpanded] = useState({});

  const { data: surveys = [] } = useQuery({
    queryKey: ["surveys"],
    queryFn: () => supabaseApi.surveys.list(),
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });

  const filtered = responses.filter((r: any) => {
    const matchTicket = !searchTicket || (r.service_id || "").toLowerCase().includes(searchTicket.toLowerCase()) || (r.passenger_name || "").toLowerCase().includes(searchTicket.toLowerCase());
    const matchCompany = filterCompany === "all" || r.company_id === filterCompany;
    const matchSurvey = filterSurvey === "all" || r.survey_id === filterSurvey;
    return matchTicket && matchCompany && matchSurvey;
  });

  const exportFiltered = () => {
    if (filtered.length === 0) return;
    const allQuestions = [...new Set(filtered.flatMap((sr: any) => (sr.answers || []).map((a: any) => a.question)))];
    const headers = ["Fecha", "Folio", "Pasajero", "Conductor", "Empresa", "Encuesta", ...allQuestions, "Firmado por"];
    const rows = filtered.map((sr: any) => {
      const answerMap: any = {};
      (sr.answers || []).forEach((a: any) => { answerMap[a.question] = a.answer; });
      return [
        formatCDMX(sr.completed_at, "shortdatetime"),
        sr.service_id || "",
        sr.passenger_name || "",
        sr.driver_name || "",
        sr.company_name || "",
        sr.survey_title || "",
        ...allQuestions.map((q: string) => answerMap[q] ?? ""),
        sr.signature_name || "",
      ];
    });
    const csv = [headers, ...rows].map((row: any) => row.map((v: any) => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url;
    const label = filterCompany !== "all" ? (companies.find((c: any) => c.id === filterCompany)?.razon_social || "empresa") : "todas";
    a.download = `encuestas_${label}.csv`;
    a.click(); URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input
            value={searchTicket}
            onChange={e => setSearchTicket(e.target.value)}
            placeholder="Buscar por ticket o pasajero..."
            className="pl-10 rounded-xl"
          />
        </div>
        <Select value={filterCompany} onValueChange={setFilterCompany}>
          <SelectTrigger className="w-48 rounded-xl">
            <Building2 className="w-3.5 h-3.5 mr-2 text-slate-400" />
            <SelectValue placeholder="Empresa" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas las empresas</SelectItem>
            {companies.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.razon_social}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterSurvey} onValueChange={setFilterSurvey}>
          <SelectTrigger className="w-48 rounded-xl">
            <ClipboardList className="w-3.5 h-3.5 mr-2 text-slate-400" />
            <SelectValue placeholder="Encuesta" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas las encuestas</SelectItem>
            {surveys.map((s: any) => <SelectItem key={s.id} value={s.id}>{s.title}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="flex items-center justify-between">
        <p className="text-xs text-slate-400">{filtered.length} respuesta(s)</p>
        <Button variant="outline" size="sm" className="rounded-xl" onClick={exportFiltered} disabled={filtered.length === 0}>
          <Download className="w-3.5 h-3.5 mr-1.5" /> Exportar CSV
        </Button>
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-16 text-slate-400">
          <ClipboardList className="w-10 h-10 mx-auto mb-2 opacity-40" />
          <p className="text-sm">No se encontraron respuestas</p>
        </div>
      )}

      <div className="space-y-3">
        {filtered.map((r: any) => {
          const isOpen = expanded[r.id];
          return (
            <Card key={r.id} className="p-4 border-0 shadow-sm overflow-hidden">
              <button
                className="w-full flex items-start justify-between gap-3"
                onClick={() => setExpanded((p: any) => ({ ...p, [r.id]: !isOpen }))}
              >
                <div className="text-left">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-slate-900 text-sm">{r.passenger_name || "—"}</span>
                    {r.service_id && <span className="font-mono text-xs text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">{r.service_id}</span>}
                    {r.company_name && <Badge className="bg-blue-100 text-blue-700 text-xs border-0">{r.company_name}</Badge>}
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">{r.survey_title} · {r.driver_name} · {formatCDMX(r.completed_at, "shortdatetime")}</p>
                </div>
                <ChevronDown className={`w-4 h-4 text-slate-400 flex-shrink-0 mt-1 transition-transform ${isOpen ? "rotate-180" : ""}`} />
              </button>

              {isOpen && (
                <div className="mt-4 pt-4 border-t border-slate-100 space-y-3">
                  {(r.answers || []).map((a: any, i: number) => (
                    <div key={i} className="bg-slate-50 rounded-xl p-3">
                      <p className="text-xs font-semibold text-slate-600">{a.question}</p>
                      <p className="text-sm text-slate-900 mt-1">{a.answer || <span className="italic text-slate-400">Sin respuesta</span>}</p>
                    </div>
                  ))}
                  {r.signature_name && (
                    <div className="flex items-center gap-2 bg-indigo-50 rounded-xl p-3">
                      <PenLine className="w-4 h-4 text-indigo-500 flex-shrink-0" />
                      <div>
                        <p className="text-xs text-slate-500">Firmado por</p>
                        <p className="text-sm font-semibold text-slate-800">{r.signature_name}</p>
                      </div>
                      {r.signature_url && (
                        <a href={r.signature_url} target="_blank" rel="noreferrer" className="ml-auto">
                          <img src={r.signature_url} alt="Firma" className="h-12 border rounded-lg bg-white" />
                        </a>
                      )}
                    </div>
                  )}
                </div>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}

export default function SurveysPage() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);

  const { data: surveys = [] } = useQuery({
    queryKey: ["surveys"],
    queryFn: () => supabaseApi.surveys.list(),
  });

  const { data: companies = [] } = useQuery({
    queryKey: ["companies"],
    queryFn: () => supabaseApi.companies.list(),
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });

  const { data: responses = [] } = useQuery({
    queryKey: ["surveyResponses"],
    queryFn: () => supabaseApi.surveyResponses.list(),
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });

  const handleDelete = async (s: any) => {
    if (!window.confirm(`¿Eliminar encuesta "${s.title}"?`)) return;
    try {
      await supabaseApi.surveys.delete(s.id);
      queryClient.invalidateQueries({ queryKey: ["surveys"] });
      toast.success("Encuesta eliminada");
    } catch (error: any) {
      toast.error(error.message || "Error al eliminar encuesta");
    }
  };

  return (
    <Layout currentPageName="Surveys">
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Encuestas de servicio</h1>
            <p className="text-sm text-slate-400 mt-0.5">Crea encuestas y asígnalas a empresas. El conductor las completará antes de finalizar el viaje.</p>
          </div>
          <Button onClick={() => { setEditing(null); setShowForm(true); }} className="bg-blue-600 hover:bg-blue-700 rounded-xl">
            <Plus className="w-4 h-4 mr-2" /> Nueva encuesta
          </Button>
        </div>

        <Tabs defaultValue="surveys">
          <TabsList>
            <TabsTrigger value="surveys" className="flex items-center gap-1.5">
              <ClipboardList className="w-4 h-4" /> Encuestas ({surveys.length})
            </TabsTrigger>
            <TabsTrigger value="responses" className="flex items-center gap-1.5">
              <FileText className="w-4 h-4" /> Respuestas ({responses.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="surveys" className="mt-5">
            {surveys.length === 0 && (
              <div className="text-center py-16 text-slate-400">
                <ClipboardList className="w-10 h-10 mx-auto mb-2 opacity-40" />
                <p className="text-sm">No hay encuestas configuradas. Crea la primera.</p>
              </div>
            )}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {surveys.map((s: any) => {
                const assignedCompanies = companies.filter((c: any) => (s.company_ids || []).includes(c.id));
                const sResponses = responses.filter((r: any) => r.survey_id === s.id);
                return (
                  <Card key={s.id} className="p-5 border-0 shadow-sm hover:shadow-md transition-shadow">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <div className="w-9 h-9 bg-blue-100 rounded-xl flex items-center justify-center flex-shrink-0">
                          <ClipboardList className="w-4 h-4 text-blue-600" />
                        </div>
                        <div className="min-w-0">
                          <h3 className="font-semibold text-slate-900 text-sm leading-tight truncate">{s.title}</h3>
                          <p className="text-xs text-slate-400">{(s.questions || []).length} preguntas</p>
                        </div>
                      </div>
                      <Badge className={`text-xs flex-shrink-0 ml-2 border-0 ${s.is_active ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
                        {s.is_active ? "Activa" : "Inactiva"}
                      </Badge>
                    </div>

                    {s.description && (
                      <p className="text-xs text-slate-500 mb-3 line-clamp-2">{s.description}</p>
                    )}

                    <div className="flex flex-wrap gap-1 mb-3">
                      {s.require_signature && (
                        <span className="text-[10px] bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full flex items-center gap-1">
                          <PenLine className="w-2.5 h-2.5" /> Firma
                        </span>
                      )}
                      {assignedCompanies.slice(0, 2).map((c: any) => (
                        <span key={c.id} className="text-[10px] bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">{c.razon_social}</span>
                      ))}
                      {assignedCompanies.length > 2 && (
                        <span className="text-[10px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">+{assignedCompanies.length - 2} más</span>
                      )}
                    </div>

                    <p className="text-xs text-slate-400 mb-3">{sResponses.length} respuesta(s)</p>

                    <div className="flex gap-2 pt-3 border-t border-slate-100">
                      <Button variant="outline" size="sm" className="flex-1 rounded-lg text-xs" onClick={() => { setEditing(s); setShowForm(true); }}>
                        <Pencil className="w-3.5 h-3.5 mr-1.5" /> Editar
                      </Button>
                      <Button variant="ghost" size="sm" className="text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg" onClick={() => handleDelete(s)}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </Card>
                );
              })}
            </div>
          </TabsContent>

          <TabsContent value="responses" className="mt-5">
            <ResponsesPanel responses={responses} companies={companies} />
          </TabsContent>
        </Tabs>

        <SurveyFormDialog
          open={showForm}
          survey={editing}
          companies={companies}
          onClose={() => { setShowForm(false); setEditing(null); }}
          onSaved={() => { setShowForm(false); setEditing(null); queryClient.invalidateQueries({ queryKey: ["surveys"] }); }}
        />
      </div>
    </Layout>
  );
}
