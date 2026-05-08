import React, { useState } from "react";
import { supabase } from "@/lib/supabase";
import { sanitizeFileName } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, Image, Type, Star, MousePointer, Link as LinkIcon, List, Eye, ExternalLink } from "lucide-react";

const DEFAULT_LANDING = {
  brand_name: "YAJA",
  brand_logo_url: "",
  hero_badge: "Servicio 24/7 en toda la zona",
  hero_title: "Asistencia vial",
  hero_title_highlight: "rápida y confiable",
  hero_subtitle: "Paso de corriente, cambio de llanta, grúa y más. Llegamos a donde estás, cuando más lo necesitas.",
  hero_badge1: "Respuesta en minutos",
  hero_badge2: "Cobertura por zonas",
  hero_badge3: "Operadores certificados",
  hero_cta_primary_label: "Ver servicios",
  hero_cta_primary_url: "#servicios",
  hero_cta_secondary_label: "Acceso conductores",
  hero_cta_secondary_url: "/lp",
  services_title: "Todo lo que necesitas,",
  services_subtitle: "en un solo lugar",
  services_description: "Asistencia vial completa para conductores y empresas. Sin esperas interminables.",
  services: [
    { title: "Paso de corriente", desc: "Batería descargada en cualquier lugar. Nuestros técnicos llegan equipados para reactivar tu vehículo de inmediato." },
    { title: "Cambio de llanta", desc: "Ponchadura o llanta baja sin problema. Cambiamos tu llanta con agilidad y seguridad donde te encuentres." },
    { title: "Envío de grúa", desc: "Vehículo varado, accidentado o inmovilizado. Grúas disponibles en tu zona para traslado al taller o destino." },
    { title: "Combustible de emergencia", desc: "Se te acabó la gasolina. Te llevamos los litros necesarios para que llegues a la estación más cercana." },
    { title: "Asistencia remota", desc: "Orientación en tiempo real con nuestros despachadores. Te guiamos paso a paso si el problema puede resolverse sin visita." },
    { title: "Asistencia en accidente", desc: "Coordinamos la llegada de grúa, apoyo vial y orientación básica en situaciones de emergencia en carretera." },
  ],
  benefits_label: "Por qué elegirnos",
  benefits_title: "Asistencia que",
  benefits_title_highlight: "realmente funciona",
  benefits_description: "No somos un call center genérico. Somos un equipo especializado en asistencia vial con tecnología de despacho, operadores de campo y cobertura zonal real.",
  stat1_val: "24/7", stat1_label: "Disponibilidad",
  stat2_val: "+500", stat2_label: "Servicios/mes",
  stat3_val: "<15min", stat3_label: "Tiempo respuesta",
  benefits: [
    { title: "Tiempos de respuesta óptimos", desc: "Operadores distribuidos estratégicamente en zonas para garantizar llegadas rápidas." },
    { title: "Personal certificado", desc: "Todos nuestros técnicos pasan por procesos de selección y capacitación continua." },
    { title: "Cobertura por zonas", desc: "Mapeamos nuestras zonas de operación para asegurar disponibilidad real donde la necesitas." },
    { title: "Despacho 24/7", desc: "Centro de operaciones activo todos los días del año, incluyendo festivos." },
    { title: "Calidad documentada", desc: "Cada servicio queda registrado. Seguimiento, calificación y mejora continua." },
    { title: "Proceso transparente", desc: "Sabes quién viene, cuándo llega y qué se va a hacer. Sin sorpresas." },
  ],
  cta_title: "¿Eres parte del",
  cta_title_highlight: "equipo operativo?",
  cta_subtitle: "La plataforma de conductores está disponible para dispositivos móviles. Accede desde tu smartphone para gestionar servicios en campo.",
  cta_button_label: "Acceso para conductores",
  cta_button_url: "/lp",
  cta_note: "Requiere dispositivo móvil • Solo personal autorizado",
  extra_buttons: [],
  footer_links: [
    { label: "Servicios", url: "#servicios" },
    { label: "Cómo funciona", url: "#como-funciona" },
    { label: "Beneficios", url: "#beneficios" },
    { label: "Privacidad", url: "#" },
  ],
};

export default function LandingEditor({ value, onChange }) {
  const [uploading, setUploading] = useState(false);
  const lc = { ...DEFAULT_LANDING, ...value };

  const update = (field, val) => onChange({ ...lc, [field]: val });

  const updateService = (i, field, val) => {
    const arr = [...(lc.services || [])];
    arr[i] = { ...arr[i], [field]: val };
    update("services", arr);
  };
  const addService = () => update("services", [...(lc.services || []), { title: "Nuevo servicio", desc: "Descripción del servicio" }]);
  const removeService = (i) => update("services", (lc.services || []).filter((_, idx) => idx !== i));

  const updateBenefit = (i, field, val) => {
    const arr = [...(lc.benefits || [])];
    arr[i] = { ...arr[i], [field]: val };
    update("benefits", arr);
  };
  const addBenefit = () => update("benefits", [...(lc.benefits || []), { title: "Nuevo beneficio", desc: "Descripción del beneficio" }]);
  const removeBenefit = (i) => update("benefits", (lc.benefits || []).filter((_, idx) => idx !== i));

  const updateExtraButton = (i, field, val) => {
    const arr = [...(lc.extra_buttons || [])];
    arr[i] = { ...arr[i], [field]: val };
    update("extra_buttons", arr);
  };
  const addExtraButton = () => update("extra_buttons", [...(lc.extra_buttons || []), { label: "Botón nuevo", url: "/", style: "secondary" }]);
  const removeExtraButton = (i) => update("extra_buttons", (lc.extra_buttons || []).filter((_, idx) => idx !== i));

  const updateFooterLink = (i, field, val) => {
    const arr = [...(lc.footer_links || [])];
    arr[i] = { ...arr[i], [field]: val };
    update("footer_links", arr);
  };
  const addFooterLink = () => update("footer_links", [...(lc.footer_links || []), { label: "Enlace", url: "#" }]);
  const removeFooterLink = (i) => update("footer_links", (lc.footer_links || []).filter((_, idx) => idx !== i));

  const handleLogoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const timestamp = Date.now();
      const sanitizedName = sanitizeFileName(file.name);
      const ext = file.name.split('.').pop() || 'png';
      const fileName = `landing-logo-${timestamp}-${sanitizedName}.${ext}`;
      const { data, error } = await supabase.storage
        .from("logos")
        .upload(fileName, file);
      
      if (error) throw error;
      
      const { data: publicUrlData } = supabase.storage
        .from("logos")
        .getPublicUrl(fileName);
      
      update("brand_logo_url", publicUrlData.publicUrl);
    } catch (err) {
      console.error("Error uploading logo:", err);
    }
    setUploading(false);
  };

  const previewUrl = (() => {
    try { return window.top.location.origin; } catch { return window.location.origin; }
  })() + "/";

  return (
    <div className="space-y-4">
      {/* Preview button */}
      <div className="flex justify-end">
        <a href={previewUrl} target="_blank" rel="noreferrer"
          className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-700 font-medium">
          <Eye className="w-4 h-4" /> Ver landing en vivo
          <ExternalLink className="w-3 h-3" />
        </a>
      </div>

      <Tabs defaultValue="marca">
        <TabsList className="flex flex-wrap w-full h-auto gap-1">
          <TabsTrigger value="marca"><Image className="w-3.5 h-3.5 mr-1" />Marca</TabsTrigger>
          <TabsTrigger value="hero"><Type className="w-3.5 h-3.5 mr-1" />Hero</TabsTrigger>
          <TabsTrigger value="servicios"><List className="w-3.5 h-3.5 mr-1" />Servicios</TabsTrigger>
          <TabsTrigger value="beneficios"><Star className="w-3.5 h-3.5 mr-1" />Beneficios</TabsTrigger>
          <TabsTrigger value="cta"><MousePointer className="w-3.5 h-3.5 mr-1" />CTA / Botones</TabsTrigger>
          <TabsTrigger value="footer"><LinkIcon className="w-3.5 h-3.5 mr-1" />Footer</TabsTrigger>
        </TabsList>

        {/* ── MARCA ── */}
        <TabsContent value="marca" className="mt-4 space-y-4">
          <Card className="p-5 border-0 shadow-sm space-y-4">
            <h3 className="font-semibold text-slate-800 text-sm">Identidad de marca en la landing</h3>
            <div>
              <Label>Nombre de la marca (navbar)</Label>
              <Input value={lc.brand_name} onChange={e => update("brand_name", e.target.value)} placeholder="YAJA" className="mt-1" />
            </div>
            <div>
              <Label>Logo de la landing</Label>
              <div className="flex items-center gap-4 mt-1">
                {lc.brand_logo_url && <img src={lc.brand_logo_url} alt="Logo" className="w-16 h-16 rounded-xl object-contain bg-slate-100 border p-1" />}
                <div className="space-y-1">
                  <Input type="file" accept="image/*" onChange={handleLogoUpload} disabled={uploading} className="max-w-xs text-sm" />
                  {uploading && <p className="text-xs text-slate-400">Subiendo imagen...</p>}
                </div>
              </div>
              <p className="text-xs text-slate-400 mt-1">Si no hay logo, se muestra un ícono ⚡ con el nombre de marca.</p>
            </div>
          </Card>
        </TabsContent>

        {/* ── HERO ── */}
        <TabsContent value="hero" className="mt-4 space-y-4">
          <Card className="p-5 border-0 shadow-sm space-y-4">
            <h3 className="font-semibold text-slate-800 text-sm">Sección principal (Hero)</h3>
            <div>
              <Label>Badge superior</Label>
              <Input value={lc.hero_badge} onChange={e => update("hero_badge", e.target.value)} className="mt-1" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Título principal</Label>
                <Input value={lc.hero_title} onChange={e => update("hero_title", e.target.value)} className="mt-1" />
              </div>
              <div>
                <Label>Texto resaltado (gradiente)</Label>
                <Input value={lc.hero_title_highlight} onChange={e => update("hero_title_highlight", e.target.value)} className="mt-1" />
              </div>
            </div>
            <div>
              <Label>Subtítulo / descripción</Label>
              <Textarea value={lc.hero_subtitle} onChange={e => update("hero_subtitle", e.target.value)} rows={3} className="mt-1" />
            </div>
            <div className="grid grid-cols-3 gap-3">
              {["hero_badge1", "hero_badge2", "hero_badge3"].map((k, i) => (
                <div key={k}>
                  <Label>Insignia {i + 1}</Label>
                  <Input value={lc[k]} onChange={e => update(k, e.target.value)} className="mt-1 text-sm" />
                </div>
              ))}
            </div>
            <div className="border-t pt-4">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Botones del Hero</p>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Botón primario - Texto</Label>
                  <Input value={lc.hero_cta_primary_label} onChange={e => update("hero_cta_primary_label", e.target.value)} />
                  <Label>Botón primario - URL</Label>
                  <Input value={lc.hero_cta_primary_url} onChange={e => update("hero_cta_primary_url", e.target.value)} placeholder="#servicios" />
                </div>
                <div className="space-y-2">
                  <Label>Botón secundario - Texto</Label>
                  <Input value={lc.hero_cta_secondary_label} onChange={e => update("hero_cta_secondary_label", e.target.value)} />
                  <Label>Botón secundario - URL</Label>
                  <Input value={lc.hero_cta_secondary_url} onChange={e => update("hero_cta_secondary_url", e.target.value)} placeholder="/lp" />
                </div>
              </div>
            </div>
          </Card>
        </TabsContent>

        {/* ── SERVICIOS ── */}
        <TabsContent value="servicios" className="mt-4 space-y-4">
          <Card className="p-5 border-0 shadow-sm space-y-4">
            <h3 className="font-semibold text-slate-800 text-sm">Encabezado de sección Servicios</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Título</Label>
                <Input value={lc.services_title} onChange={e => update("services_title", e.target.value)} className="mt-1" />
              </div>
              <div>
                <Label>Texto resaltado</Label>
                <Input value={lc.services_subtitle} onChange={e => update("services_subtitle", e.target.value)} className="mt-1" />
              </div>
            </div>
            <div>
              <Label>Descripción de la sección</Label>
              <Textarea value={lc.services_description} onChange={e => update("services_description", e.target.value)} rows={2} className="mt-1" />
            </div>
          </Card>

          <Card className="p-5 border-0 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-slate-800 text-sm">Tarjetas de servicios ({(lc.services || []).length})</h3>
              <Button size="sm" variant="outline" onClick={addService} className="rounded-lg">
                <Plus className="w-4 h-4 mr-1" /> Agregar
              </Button>
            </div>
            <div className="space-y-3">
              {(lc.services || []).map((s, i) => (
                <div key={i} className="border border-slate-200 rounded-xl p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-400 font-mono">Servicio #{i + 1}</span>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-red-400 hover:bg-red-50" onClick={() => removeService(i)}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                  <div>
                    <Label className="text-xs">Título</Label>
                    <Input value={s.title} onChange={e => updateService(i, "title", e.target.value)} className="mt-1" />
                  </div>
                  <div>
                    <Label className="text-xs">Descripción</Label>
                    <Textarea value={s.desc} onChange={e => updateService(i, "desc", e.target.value)} rows={2} className="mt-1 text-sm" />
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </TabsContent>

        {/* ── BENEFICIOS ── */}
        <TabsContent value="beneficios" className="mt-4 space-y-4">
          <Card className="p-5 border-0 shadow-sm space-y-4">
            <h3 className="font-semibold text-slate-800 text-sm">Sección Beneficios / Por qué elegirnos</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Etiqueta superior</Label>
                <Input value={lc.benefits_label} onChange={e => update("benefits_label", e.target.value)} className="mt-1" />
              </div>
              <div>
                <Label>Título</Label>
                <Input value={lc.benefits_title} onChange={e => update("benefits_title", e.target.value)} className="mt-1" />
              </div>
              <div>
                <Label>Texto resaltado</Label>
                <Input value={lc.benefits_title_highlight} onChange={e => update("benefits_title_highlight", e.target.value)} className="mt-1" />
              </div>
            </div>
            <div>
              <Label>Descripción</Label>
              <Textarea value={lc.benefits_description} onChange={e => update("benefits_description", e.target.value)} rows={2} className="mt-1" />
            </div>
            <div className="border-t pt-4">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Estadísticas destacadas</p>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { vk: "stat1_val", lk: "stat1_label", label: "Estadística 1" },
                  { vk: "stat2_val", lk: "stat2_label", label: "Estadística 2" },
                  { vk: "stat3_val", lk: "stat3_label", label: "Estadística 3" },
                ].map(s => (
                  <div key={s.vk} className="border border-slate-200 rounded-xl p-3 space-y-2">
                    <p className="text-xs text-slate-400">{s.label}</p>
                    <Input value={lc[s.vk]} onChange={e => update(s.vk, e.target.value)} placeholder="Valor" className="text-sm" />
                    <Input value={lc[s.lk]} onChange={e => update(s.lk, e.target.value)} placeholder="Etiqueta" className="text-sm" />
                  </div>
                ))}
              </div>
            </div>
          </Card>

          <Card className="p-5 border-0 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-slate-800 text-sm">Tarjetas de beneficios ({(lc.benefits || []).length})</h3>
              <Button size="sm" variant="outline" onClick={addBenefit} className="rounded-lg">
                <Plus className="w-4 h-4 mr-1" /> Agregar
              </Button>
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
              {(lc.benefits || []).map((b, i) => (
                <div key={i} className="border border-slate-200 rounded-xl p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-400 font-mono">#{i + 1}</span>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-red-400 hover:bg-red-50" onClick={() => removeBenefit(i)}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                  <Input value={b.title} onChange={e => updateBenefit(i, "title", e.target.value)} placeholder="Título" className="text-sm" />
                  <Textarea value={b.desc} onChange={e => updateBenefit(i, "desc", e.target.value)} rows={2} placeholder="Descripción" className="text-sm" />
                </div>
              ))}
            </div>
          </Card>
        </TabsContent>

        {/* ── CTA / BOTONES ── */}
        <TabsContent value="cta" className="mt-4 space-y-4">
          <Card className="p-5 border-0 shadow-sm space-y-4">
            <h3 className="font-semibold text-slate-800 text-sm">Sección CTA (llamada a la acción)</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Título</Label>
                <Input value={lc.cta_title} onChange={e => update("cta_title", e.target.value)} className="mt-1" />
              </div>
              <div>
                <Label>Texto resaltado</Label>
                <Input value={lc.cta_title_highlight} onChange={e => update("cta_title_highlight", e.target.value)} className="mt-1" />
              </div>
            </div>
            <div>
              <Label>Subtítulo</Label>
              <Textarea value={lc.cta_subtitle} onChange={e => update("cta_subtitle", e.target.value)} rows={2} className="mt-1" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Botón principal - Texto</Label>
                <Input value={lc.cta_button_label} onChange={e => update("cta_button_label", e.target.value)} className="mt-1" />
              </div>
              <div>
                <Label>Botón principal - URL</Label>
                <Input value={lc.cta_button_url} onChange={e => update("cta_button_url", e.target.value)} placeholder="/lp" className="mt-1" />
              </div>
            </div>
            <div>
              <Label>Nota pequeña bajo el botón</Label>
              <Input value={lc.cta_note} onChange={e => update("cta_note", e.target.value)} className="mt-1" />
            </div>
          </Card>

          <Card className="p-5 border-0 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-semibold text-slate-800 text-sm">Botones adicionales</h3>
                <p className="text-xs text-slate-400 mt-0.5">Agrega más botones debajo del botón principal en la sección CTA</p>
              </div>
              <Button size="sm" variant="outline" onClick={addExtraButton} className="rounded-lg">
                <Plus className="w-4 h-4 mr-1" /> Agregar botón
              </Button>
            </div>
            {(lc.extra_buttons || []).length === 0 && (
              <p className="text-sm text-slate-400 text-center py-4">Sin botones adicionales. Agrega botones con links personalizados.</p>
            )}
            <div className="space-y-3">
              {(lc.extra_buttons || []).map((btn, i) => (
                <div key={i} className="border border-slate-200 rounded-xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-400">Botón #{i + 1}</span>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-red-400 hover:bg-red-50" onClick={() => removeExtraButton(i)}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="col-span-1">
                      <Label className="text-xs">Texto</Label>
                      <Input value={btn.label} onChange={e => updateExtraButton(i, "label", e.target.value)} className="mt-1 text-sm" />
                    </div>
                    <div className="col-span-1">
                      <Label className="text-xs">URL / Link</Label>
                      <Input value={btn.url} onChange={e => updateExtraButton(i, "url", e.target.value)} placeholder="https://... o /ruta" className="mt-1 text-sm" />
                    </div>
                    <div className="col-span-1">
                      <Label className="text-xs">Estilo</Label>
                      <Select value={btn.style || "secondary"} onValueChange={v => updateExtraButton(i, "style", v)}>
                        <SelectTrigger className="mt-1 text-sm">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="primary">Primario (gradiente)</SelectItem>
                          <SelectItem value="secondary">Secundario (borde)</SelectItem>
                          <SelectItem value="outline">Outline (transparente)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </TabsContent>

        {/* ── FOOTER ── */}
        <TabsContent value="footer" className="mt-4 space-y-4">
          <Card className="p-5 border-0 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-semibold text-slate-800 text-sm">Links del footer</h3>
                <p className="text-xs text-slate-400 mt-0.5">Estos links aparecen en la barra de navegación y en el pie de página</p>
              </div>
              <Button size="sm" variant="outline" onClick={addFooterLink} className="rounded-lg">
                <Plus className="w-4 h-4 mr-1" /> Agregar
              </Button>
            </div>
            <div className="space-y-3">
              {(lc.footer_links || []).map((link, i) => (
                <div key={i} className="flex items-center gap-3 border border-slate-200 rounded-xl p-3">
                  <div className="flex-1 grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs">Texto del link</Label>
                      <Input value={link.label} onChange={e => updateFooterLink(i, "label", e.target.value)} className="mt-1 text-sm" />
                    </div>
                    <div>
                      <Label className="text-xs">URL</Label>
                      <Input value={link.url} onChange={e => updateFooterLink(i, "url", e.target.value)} placeholder="#seccion o /pagina" className="mt-1 text-sm" />
                    </div>
                  </div>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-red-400 hover:bg-red-50 flex-shrink-0" onClick={() => removeFooterLink(i)}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
