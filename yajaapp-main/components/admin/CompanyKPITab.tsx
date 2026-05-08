import React, { useState, useMemo, useRef } from "react";
import { supabaseApi } from "@/lib/supabaseApi";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Download, Car, Star, AlertTriangle, FileText } from "lucide-react";
import moment from "moment";
import { formatCDMX, formatStoredLocal } from "@/components/shared/dateUtils";
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from "recharts";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";

const CHART_COLORS = ["#3B82F6", "#10B981", "#F59E0B", "#EF4444", "#8B5CF6"];

function diffMin(from, to) {
  if (!from || !to) return null;
  const d = (new Date(to).getTime() - new Date(from).getTime()) / 60000;
  return d >= 0 ? d.toFixed(1) : null;
}

function avgOf(arr) {
  const valid = arr.filter(v => v !== null && v !== undefined);
  if (!valid.length) return null;
  return (valid.reduce((s, v) => s + parseFloat(v), 0) / valid.length).toFixed(1);
}

export default function CompanyKPITab({ company, rides = [] }) {
  const [dateFrom, setDateFrom] = useState(moment().startOf("month").format("YYYY-MM-DD"));
  const [dateTo, setDateTo] = useState(moment().format("YYYY-MM-DD"));
  const [umbralAsignacion, setUmbralAsignacion] = useState(15);
  const [umbralLlegada, setUmbralLlegada] = useState(20);
  const [exportingPDF, setExportingPDF] = useState(false);
  const chartsRef = useRef(null);

  const { data: surveyResponses = [] } = useQuery({
    queryKey: ["surveyResponses", company.id],
    queryFn: async () => {
      const all = await supabaseApi.surveyResponses.list();
      return all.filter((sr: any) => sr.company_id === company.id);
    },
  });

  const filtered = useMemo(() => rides.filter(r => {
    const d = moment(r.requested_at || r.created_date);
    return d.isSameOrAfter(dateFrom, "day") && d.isSameOrBefore(dateTo, "day");
  }), [rides, dateFrom, dateTo]);

  const filteredSurveys = useMemo(() => surveyResponses.filter(sr => {
    const d = moment(sr.completed_at || sr.created_date);
    return d.isSameOrAfter(dateFrom, "day") && d.isSameOrBefore(dateTo, "day");
  }), [surveyResponses, dateFrom, dateTo]);

  const completed = filtered.filter(r => r.status === "completed");
  const cancelled = filtered.filter(r => r.status === "cancelled");

  const avgCost = completed.length > 0
    ? completed.reduce((s, r) => s + (r.company_price || r.final_price || r.estimated_price || 0), 0) / completed.length
    : 0;

  const tableRows = useMemo(() => filtered.map(r => {
    const requestedAtCorrected = r.requested_at || r.created_date;
    return {
      ...r,
      tAsignacion: diffMin(requestedAtCorrected, r.en_route_at),
      tLlegada: diffMin(r.en_route_at, r.arrived_at),
      tServicio: diffMin(r.in_progress_at, r.completed_at),
      costo: r.company_price || r.final_price || r.estimated_price || 0,
    };
  }), [filtered]);

  const avgAsignacion = avgOf(tableRows.map(r => r.tAsignacion));
  const avgLlegada = avgOf(tableRows.map(r => r.tLlegada));
  const avgServicio = avgOf(tableRows.map(r => r.tServicio));

  const questionAverages = useMemo(() => {
    const map: Record<string, number[]> = {};
    filteredSurveys.forEach(sr => {
      (sr.answers || []).forEach(a => {
        const n = parseFloat(a.answer);
        if (!isNaN(n) && n >= 1 && n <= 5) {
          if (!map[a.question]) map[a.question] = [];
          map[a.question].push(n);
        }
      });
    });
    return Object.entries(map).map(([q, vals]) => ({
      question: q,
      avg: (vals.reduce((s, n) => s + n, 0) / vals.length).toFixed(2),
      count: vals.length,
    }));
  }, [filteredSurveys]);

  const avgSurveyRating = useMemo(() => {
    const all = filteredSurveys.flatMap(sr =>
      (sr.answers || []).filter(a => { const n = parseFloat(a.answer); return !isNaN(n) && n >= 1 && n <= 5; }).map(a => parseFloat(a.answer))
    );
    return all.length > 0 ? (all.reduce((s, n) => s + n, 0) / all.length).toFixed(2) : null;
  }, [filteredSurveys]);

  const exportViajes = () => {
    const headers = [
      "Fecha Solicitud","Folio","Pasajero","Telefono","Conductor","Origen","Destino",
      "Servicio","Ciudad","Pago","Costo Empresa","Ganancias Conductor",
      "Hora Solicitud","Hora En Camino","Min. Asignacion",
      "Hora Llegada","Min. Llegada (en camino→llegada)",
      "Hora Inicio Servicio","Hora Fin Servicio","Min. Duracion Servicio",
      "Distancia km","Estado"
    ];
    const rows = tableRows.map(r => [
      formatStoredLocal(r.requested_at || r.created_date, "date"),
      r.service_id || "",
      r.passenger_name || "",
      r.passenger_phone || "",
      r.driver_name || "",
      r.pickup_address || "",
      r.dropoff_address || "",
      r.service_type_name || "",
      r.city_name || "",
      r.payment_method || "",
      r.costo.toFixed(2),
      (r.driver_earnings || 0).toFixed(2),
      r.requested_at ? formatStoredLocal(r.requested_at, "time") : "",
      r.en_route_at ? formatCDMX(r.en_route_at, "time") : "",
      r.tAsignacion ?? "",
      r.arrived_at ? formatCDMX(r.arrived_at, "time") : "",
      r.tLlegada ?? "",
      r.in_progress_at ? formatCDMX(r.in_progress_at, "time") : "",
      r.completed_at ? formatCDMX(r.completed_at, "time") : "",
      r.tServicio ?? "",
      r.distance_km || "",
      r.status || "",
    ]);
    downloadCSV([headers, ...rows], `kpi_viajes_${company.razon_social}_${dateFrom}_${dateTo}.csv`);
  };

  const exportEncuestas = () => {
    if (filteredSurveys.length === 0) return;
    const allQuestions: string[] = [...new Set(filteredSurveys.flatMap(sr => (sr.answers || []).map((a: any) => a.question)))];
    const headers = ["Fecha","Folio","Pasajero","Conductor","Empresa","Encuesta", ...allQuestions, "Firmado por"];
    const rows = filteredSurveys.map(sr => {
      const answerMap: Record<string, any> = {};
      (sr.answers || []).forEach((a: any) => { answerMap[a.question] = a.answer; });
      return [
        formatCDMX(sr.completed_at || sr.created_date, "shortdatetime"),
        sr.service_id || "",
        sr.passenger_name || "",
        sr.driver_name || "",
        sr.company_name || "",
        sr.survey_title || "",
        ...allQuestions.map(q => answerMap[q] ?? ""),
        sr.signature_name || "",
      ];
    });
    downloadCSV([headers, ...rows], `encuestas_${company.razon_social}_${dateFrom}_${dateTo}.csv`);
  };

  const exportPDF = async () => {
    setExportingPDF(true);
    try {
      const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      const pageW = 210;
      const pageH = 297;
      const margin = 14;
      let y = margin;

      pdf.setFillColor(15, 23, 42);
      pdf.rect(0, 0, pageW, 28, "F");
      pdf.setTextColor(255, 255, 255);
      pdf.setFontSize(16);
      pdf.setFont("helvetica", "bold");
      pdf.text(company.razon_social || "Empresa", margin, 12);
      pdf.setFontSize(9);
      pdf.setFont("helvetica", "normal");
      pdf.text(`Reporte KPI de Servicios · ${dateFrom} al ${dateTo}`, margin, 20);
      pdf.text(`Generado: ${moment().format("DD/MM/YYYY HH:mm")}`, pageW - margin, 20, { align: "right" });
      y = 36;

      const kpiData = [
        { label: "Total solicitados", value: String(filtered.length), color: [59, 130, 246] as [number, number, number] },
        { label: "Completados", value: String(completed.length), color: [16, 185, 129] as [number, number, number] },
        { label: "Cancelados", value: String(cancelled.length), color: [239, 68, 68] as [number, number, number] },
        { label: "Costo promedio", value: `$${avgCost.toFixed(0)}`, color: [139, 92, 246] as [number, number, number] },
        { label: "T. prom. asignación", value: avgAsignacion ? `${avgAsignacion} min` : "N/D", color: [245, 158, 11] as [number, number, number] },
        { label: "T. prom. llegada", value: avgLlegada ? `${avgLlegada} min` : "N/D", color: [249, 115, 22] as [number, number, number] },
        { label: "T. prom. servicio", value: avgServicio ? `${avgServicio} min` : "N/D", color: [100, 116, 139] as [number, number, number] },
        { label: "Cal. prom. encuesta", value: avgSurveyRating ? `★ ${avgSurveyRating}` : "N/D", color: [234, 179, 8] as [number, number, number] },
      ];
      const boxW = (pageW - margin * 2 - 6 * 3) / 4;
      const boxH = 16;
      kpiData.forEach((k, idx) => {
        const col = idx % 4;
        const row = Math.floor(idx / 4);
        const bx = margin + col * (boxW + 6);
        const by = y + row * (boxH + 4);
        pdf.setFillColor(k.color[0], k.color[1], k.color[2]);
        pdf.roundedRect(bx, by, boxW, boxH, 2, 2, "F");
        pdf.setTextColor(255, 255, 255);
        pdf.setFontSize(11);
        pdf.setFont("helvetica", "bold");
        pdf.text(k.value, bx + boxW / 2, by + 7, { align: "center" });
        pdf.setFontSize(6.5);
        pdf.setFont("helvetica", "normal");
        pdf.text(k.label, bx + boxW / 2, by + 13, { align: "center" });
      });
      y += (Math.ceil(kpiData.length / 4)) * (boxH + 4) + 8;

      if (chartsRef.current) {
        const canvas = await html2canvas(chartsRef.current, { scale: 1.5, backgroundColor: "#ffffff", useCORS: true });
        const imgData = canvas.toDataURL("image/png");
        const imgH = (canvas.height / canvas.width) * (pageW - margin * 2);

        if (y + imgH > pageH - margin) {
          pdf.addPage();
          y = margin;
        }
        pdf.addImage(imgData, "PNG", margin, y, pageW - margin * 2, imgH);
        y += imgH + 8;
      }

      pdf.addPage();
      y = margin;
      pdf.setFillColor(15, 23, 42);
      pdf.rect(0, 0, pageW, 10, "F");
      pdf.setTextColor(255, 255, 255);
      pdf.setFontSize(9);
      pdf.setFont("helvetica", "bold");
      pdf.text("Detalle de Viajes", margin, 7);
      y = 16;

      const cols = ["Fecha", "Folio", "Pasajero", "Conductor", "Min.Asig", "Min.Llegada", "Min.Svc", "Costo", "Estado"];
      const colW = [20, 16, 32, 32, 16, 18, 14, 16, 18];
      const rowH = 6;

      pdf.setFillColor(241, 245, 249);
      pdf.rect(margin, y, pageW - margin * 2, rowH, "F");
      pdf.setTextColor(71, 85, 105);
      pdf.setFontSize(6.5);
      pdf.setFont("helvetica", "bold");
      let cx = margin + 1;
      cols.forEach((c, ci) => { pdf.text(c, cx, y + 4); cx += colW[ci]; });
      y += rowH;

      pdf.setFont("helvetica", "normal");
      tableRows.forEach((r, ri) => {
        if (y + rowH > pageH - margin) {
          pdf.addPage();
          y = margin;
          pdf.setFillColor(241, 245, 249);
          pdf.rect(margin, y, pageW - margin * 2, rowH, "F");
          pdf.setTextColor(71, 85, 105);
          pdf.setFont("helvetica", "bold");
          cx = margin + 1;
          cols.forEach((c, ci) => { pdf.text(c, cx, y + 4); cx += colW[ci]; });
          y += rowH;
          pdf.setFont("helvetica", "normal");
        }
        const asigAlert = r.tAsignacion !== null && parseFloat(r.tAsignacion) > umbralAsignacion;
        const llegadaAlert = r.tLlegada !== null && parseFloat(r.tLlegada) > umbralLlegada;
        if (asigAlert || llegadaAlert) {
          pdf.setFillColor(254, 226, 226);
          pdf.rect(margin, y, pageW - margin * 2, rowH, "F");
        } else if (ri % 2 === 1) {
          pdf.setFillColor(248, 250, 252);
          pdf.rect(margin, y, pageW - margin * 2, rowH, "F");
        }
        pdf.setTextColor(30, 41, 59);
        const row = [
          formatStoredLocal(r.requested_at, "short") || "",
          r.service_id || "",
          (r.passenger_name || "").slice(0, 18),
          (r.driver_name || "").slice(0, 18),
          r.tAsignacion !== null ? `${r.tAsignacion}'` : "—",
          r.tLlegada !== null ? `${r.tLlegada}'` : "—",
          r.tServicio !== null ? `${r.tServicio}'` : "—",
          `$${r.costo.toFixed(0)}`,
          r.status || "",
        ];
        cx = margin + 1;
        row.forEach((val, ci) => {
          if ((ci === 4 && asigAlert) || (ci === 5 && llegadaAlert)) pdf.setTextColor(185, 28, 28);
          else pdf.setTextColor(30, 41, 59);
          pdf.text(String(val), cx, y + 4);
          cx += colW[ci];
        });
        y += rowH;
      });

      const totalPages = (pdf as any).internal.getNumberOfPages();
      for (let p = 1; p <= totalPages; p++) {
        pdf.setPage(p);
        pdf.setFontSize(7);
        pdf.setTextColor(148, 163, 184);
        pdf.text(`Página ${p} de ${totalPages}`, pageW / 2, pageH - 6, { align: "center" });
        pdf.text(company.razon_social || "", margin, pageH - 6);
      }

      pdf.save(`KPI_${company.razon_social}_${dateFrom}_${dateTo}.pdf`);
    } finally {
      setExportingPDF(false);
    }
  };

  const downloadCSV = (data, filename) => {
    const csv = data.map(row => row.map(v => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url;
    a.download = filename;
    a.click(); URL.revokeObjectURL(url);
  };

  const kpiCards = [
    { label: "Total solicitados", value: filtered.length, bg: "bg-blue-50", text: "text-blue-700" },
    { label: "Completados", value: completed.length, bg: "bg-emerald-50", text: "text-emerald-700" },
    { label: "Cancelados", value: cancelled.length, bg: "bg-red-50", text: "text-red-700" },
    { label: "Costo prom.", value: `$${avgCost.toFixed(0)}`, bg: "bg-purple-50", text: "text-purple-700" },
    { label: "T. prom. asignación", value: avgAsignacion ? `${avgAsignacion} min` : "N/D", bg: "bg-amber-50", text: "text-amber-700" },
    { label: "T. prom. llegada", value: avgLlegada ? `${avgLlegada} min` : "N/D", bg: "bg-orange-50", text: "text-orange-700" },
    { label: "T. prom. servicio", value: avgServicio ? `${avgServicio} min` : "N/D", bg: "bg-slate-100", text: "text-slate-700" },
    { label: "Cal. prom. encuesta", value: avgSurveyRating ? `★ ${avgSurveyRating}` : "N/D", bg: "bg-yellow-50", text: "text-yellow-700" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <Label className="text-xs">Desde</Label>
          <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="w-36 mt-1 text-sm" />
        </div>
        <div>
          <Label className="text-xs">Hasta</Label>
          <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="w-36 mt-1 text-sm" />
        </div>
        <div className="h-px w-px bg-transparent mx-1" />
        <div>
          <Label className="text-xs flex items-center gap-1 text-amber-600"><AlertTriangle className="w-3 h-3" /> Umbral Asig. (min)</Label>
          <Input type="number" min={1} value={umbralAsignacion} onChange={e => setUmbralAsignacion(Number(e.target.value))} className="w-24 mt-1 text-sm" />
        </div>
        <div>
          <Label className="text-xs flex items-center gap-1 text-orange-600"><AlertTriangle className="w-3 h-3" /> Umbral Llegada (min)</Label>
          <Input type="number" min={1} value={umbralLlegada} onChange={e => setUmbralLlegada(Number(e.target.value))} className="w-24 mt-1 text-sm" />
        </div>
        <div className="h-px w-px bg-transparent mx-1" />
        <Button variant="outline" size="sm" className="rounded-xl" onClick={exportViajes}>
          <Download className="w-3.5 h-3.5 mr-1.5" /> Exportar Viajes
        </Button>
        <Button variant="outline" size="sm" className="rounded-xl" onClick={exportEncuestas} disabled={filteredSurveys.length === 0}>
          <Download className="w-3.5 h-3.5 mr-1.5" /> Exportar Encuestas
        </Button>
        <Button size="sm" className="rounded-xl bg-slate-900 hover:bg-slate-800 text-white" onClick={exportPDF} disabled={exportingPDF}>
          <FileText className="w-3.5 h-3.5 mr-1.5" /> {exportingPDF ? "Generando PDF..." : "Exportar PDF"}
        </Button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {kpiCards.map(k => (
          <div key={k.label} className={`rounded-xl p-3 text-center ${k.bg}`}>
            <p className={`text-lg font-bold ${k.text}`}>{k.value}</p>
            <p className={`text-xs ${k.text} opacity-70 leading-tight mt-0.5`}>{k.label}</p>
          </div>
        ))}
      </div>

      <div>
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-2">
          <Car className="w-3.5 h-3.5" /> Tabla de viajes ({filtered.length})
        </p>
        <div className="overflow-x-auto lg:overflow-visible rounded-xl border border-slate-200 -mx-1 px-1">
          <table className="w-full text-xs table-fixed">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="px-2 py-2 text-left font-semibold text-slate-500 whitespace-nowrap">Fecha</th>
                <th className="px-2 py-2 text-left font-semibold text-slate-500 whitespace-nowrap">Folio</th>
                <th className="px-2 py-2 text-left font-semibold text-slate-500 whitespace-nowrap">Pasajero</th>
                <th className="px-2 py-2 text-left font-semibold text-slate-500 whitespace-nowrap">Conductor</th>
                <th className="px-2 py-2 text-center font-semibold text-slate-500 text-[10px] whitespace-normal">H. Solicitud</th>
                <th className="px-2 py-2 text-center font-semibold text-amber-600 text-[10px] whitespace-normal">H. En Camino</th>
                <th className="px-2 py-2 text-center font-semibold text-amber-600 text-[10px] whitespace-normal">Min. Asig.</th>
                <th className="px-2 py-2 text-center font-semibold text-orange-600 text-[10px] whitespace-normal">H. Llegada</th>
                <th className="px-2 py-2 text-center font-semibold text-orange-600 text-[10px] whitespace-normal">Min. Llegada</th>
                <th className="px-2 py-2 text-center font-semibold text-blue-600 text-[10px] whitespace-normal">H. Inicio</th>
                <th className="px-2 py-2 text-center font-semibold text-blue-600 text-[10px] whitespace-normal">H. Fin</th>
                <th className="px-2 py-2 text-center font-semibold text-blue-600 text-[10px] whitespace-normal">Min. Svc</th>
                <th className="px-2 py-2 text-right font-semibold text-slate-500 whitespace-nowrap">Costo</th>
                <th className="px-2 py-2 text-center font-semibold text-slate-500 whitespace-nowrap">Estado</th>
              </tr>
            </thead>
            <tbody>
              {tableRows.length === 0 && (
                <tr>
                  <td colSpan={14} className="px-4 py-8 text-center text-slate-400">Sin viajes en el período</td>
                </tr>
              )}
              {tableRows.map((r, i) => {
                const asigAlert = r.tAsignacion !== null && parseFloat(r.tAsignacion) > umbralAsignacion;
                const llegadaAlert = r.tLlegada !== null && parseFloat(r.tLlegada) > umbralLlegada;
                const hasAlert = asigAlert || llegadaAlert;
                return (
                <tr key={r.id} className={`border-b transition-colors ${
                  hasAlert
                    ? "bg-red-50 border-red-200 hover:bg-red-100"
                    : `border-slate-100 hover:bg-slate-50 ${i % 2 === 0 ? "" : "bg-slate-50/40"}`
                }`}>
                  <td className="px-2 py-2 text-slate-600 whitespace-nowrap text-[11px]">
                    {hasAlert && <AlertTriangle className="w-2.5 h-2.5 text-red-500 inline mr-0.5 mb-0.5" />}
                    {formatStoredLocal(r.requested_at, "short")}
                  </td>
                  <td className="px-2 py-2 font-mono text-slate-500 whitespace-nowrap text-[10px]">{r.service_id || "—"}</td>
                  <td className="px-2 py-2 text-slate-800 truncate text-[11px]">{r.passenger_name || "—"}</td>
                  <td className="px-2 py-2 text-slate-600 truncate text-[11px]">{r.driver_name || "—"}</td>
                  <td className="px-2 py-2 text-center text-slate-500 whitespace-nowrap text-[10px]">{r.requested_at ? formatStoredLocal(r.requested_at, "time") : "—"}</td>
                  <td className="px-2 py-2 text-center text-amber-600 whitespace-nowrap text-[10px]">{r.en_route_at ? formatCDMX(r.en_route_at, "time") : "—"}</td>
                  <td className={`px-2 py-2 text-center font-bold whitespace-nowrap text-[11px] ${asigAlert ? "text-red-600 bg-red-100" : "text-amber-700"}`}>
                    {r.tAsignacion !== null ? `${r.tAsignacion}'` : "—"}
                    {asigAlert && <AlertTriangle className="w-2.5 h-2.5 inline ml-0.5 mb-0.5 text-red-500" />}
                  </td>
                  <td className="px-2 py-2 text-center text-orange-600 whitespace-nowrap text-[10px]">{r.arrived_at ? formatCDMX(r.arrived_at, "time") : "—"}</td>
                  <td className={`px-2 py-2 text-center font-bold whitespace-nowrap text-[11px] ${llegadaAlert ? "text-red-600 bg-red-100" : "text-orange-700"}`}>
                    {r.tLlegada !== null ? `${r.tLlegada}'` : "—"}
                    {llegadaAlert && <AlertTriangle className="w-2.5 h-2.5 inline ml-0.5 mb-0.5 text-red-500" />}
                  </td>
                  <td className="px-2 py-2 text-center text-blue-600 whitespace-nowrap text-[10px]">{r.in_progress_at ? formatCDMX(r.in_progress_at, "time") : "—"}</td>
                  <td className="px-2 py-2 text-center text-blue-600 whitespace-nowrap text-[10px]">{r.completed_at ? formatCDMX(r.completed_at, "time") : "—"}</td>
                  <td className="px-2 py-2 text-center font-bold text-blue-700 whitespace-nowrap text-[11px]">{r.tServicio !== null ? `${r.tServicio}'` : "—"}</td>
                  <td className="px-2 py-2 text-right text-slate-700 whitespace-nowrap text-[11px]">${r.costo.toFixed(2)}</td>
                  <td className="px-2 py-2 text-center whitespace-nowrap">
                    <span className={`px-1 py-0.5 rounded-full text-[9px] font-medium ${
                      r.status === "completed" ? "bg-emerald-100 text-emerald-700" :
                      r.status === "cancelled" ? "bg-red-100 text-red-700" :
                      "bg-blue-100 text-blue-700"
                    }`}>{r.status}</span>
                  </td>
                </tr>
                );
              })}
            </tbody>
            {tableRows.length > 0 && (
              <tfoot>
                <tr className="bg-slate-100 border-t-2 border-slate-200 font-bold">
                  <td colSpan={6} className="px-2 py-2 text-slate-600 text-[10px]">Promedios</td>
                  <td className="px-2 py-2 text-center text-amber-700 text-[10px]">{avgAsignacion ? `${avgAsignacion}'` : "—"}</td>
                  <td className="px-2 py-2"></td>
                  <td className="px-2 py-2 text-center text-orange-700 text-[10px]">{avgLlegada ? `${avgLlegada}'` : "—"}</td>
                  <td className="px-2 py-2"></td>
                  <td className="px-2 py-2"></td>
                  <td className="px-2 py-2 text-center text-blue-700 text-[10px]">{avgServicio ? `${avgServicio}'` : "—"}</td>
                  <td className="px-2 py-2 text-right text-slate-700 text-[10px]">${avgCost.toFixed(2)}</td>
                  <td className="px-2 py-2"></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {questionAverages.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-2">
            <Star className="w-3.5 h-3.5 text-amber-500" /> Calificaciones por pregunta ({filteredSurveys.length} encuestas)
          </p>
          <div className="overflow-x-auto lg:overflow-visible rounded-xl border border-slate-200 -mx-1 px-1">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="px-2 py-2 text-left font-semibold text-slate-500">Pregunta</th>
                    <th className="px-2 py-2 text-center font-semibold text-slate-500 whitespace-nowrap">Respuestas</th>
                    <th className="px-2 py-2 text-center font-semibold text-amber-600 whitespace-nowrap">Promedio</th>
                    <th className="px-2 py-2 text-left font-semibold text-slate-400">Barra</th>
                  </tr>
                </thead>
                <tbody>
                  {questionAverages.map((q, i) => (
                    <tr key={i} className="border-b border-slate-100 hover:bg-slate-50">
                      <td className="px-2 py-2 text-slate-700 text-[11px]">{q.question.slice(0, 40)}</td>
                      <td className="px-2 py-2 text-center text-slate-500 text-[11px]">{q.count}</td>
                      <td className="px-2 py-2 text-center font-bold text-amber-600 text-[11px] whitespace-nowrap">★ {q.avg}</td>
                      <td className="px-2 py-2">
                        <div className="w-16 bg-slate-200 rounded-full h-1.5">
                          <div className="bg-amber-400 h-1.5 rounded-full" style={{ width: `${(parseFloat(q.avg) / 5) * 100}%` }} />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
        </div>
      )}

      {filtered.length > 0 && (
        <div ref={chartsRef} className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {(() => {
            const dailyMap: Record<string, { day: string; total: number; completados: number }> = {};
            filtered.forEach(r => {
              const day = moment(r.requested_at || r.created_date).format("DD/MM");
              if (!dailyMap[day]) dailyMap[day] = { day, total: 0, completados: 0 };
              dailyMap[day].total++;
              if (r.status === "completed") dailyMap[day].completados++;
            });
            const data = Object.values(dailyMap);
            return (
              <div className="bg-white rounded-xl border border-slate-200 p-4">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Servicios por día</p>
                <ResponsiveContainer width="100%" height={180}>
                  <BarChart data={data}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="day" tick={{ fontSize: 10, fill: "#94a3b8" }} />
                    <YAxis tick={{ fontSize: 10, fill: "#94a3b8" }} allowDecimals={false} />
                    <Tooltip contentStyle={{ borderRadius: 10, border: "none", boxShadow: "0 4px 20px rgba(0,0,0,.08)", fontSize: 12 }} />
                    <Bar dataKey="total" fill="#3B82F6" name="Total" radius={[4,4,0,0]} />
                    <Bar dataKey="completados" fill="#10B981" name="Completados" radius={[4,4,0,0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            );
          })()}

          {(() => {
            const svcMap: Record<string, { name: string; total: number; count: number }> = {};
            completed.forEach(r => {
              const svc = r.service_type_name || "Sin servicio";
              if (!svcMap[svc]) svcMap[svc] = { name: svc, total: 0, count: 0 };
              svcMap[svc].total += r.company_price || r.final_price || r.estimated_price || 0;
              svcMap[svc].count++;
            });
            const data = Object.values(svcMap);
            if (data.length === 0) return null;
            return (
              <div className="bg-white rounded-xl border border-slate-200 p-4">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Gasto por tipo de servicio</p>
                <ResponsiveContainer width="100%" height={180}>
                  <PieChart>
                    <Pie data={data} dataKey="total" nameKey="name" cx="50%" cy="50%" outerRadius={65}
                      label={({ name, percent }) => `${name} ${(percent*100).toFixed(0)}%`} labelLine={false}>
                      {data.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                    </Pie>
                    <Tooltip formatter={(v) => [`$${v.toFixed(0)}`, ""]} contentStyle={{ borderRadius: 10, border: "none", fontSize: 12 }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            );
          })()}

          {(avgAsignacion || avgLlegada || avgServicio) && (
            <div className="bg-white rounded-xl border border-slate-200 p-4">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Tiempos promedio (minutos)</p>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart layout="vertical" data={[
                  { name: "Asignación", min: Number(avgAsignacion || 0) },
                  { name: "Llegada", min: Number(avgLlegada || 0) },
                  { name: "Servicio", min: Number(avgServicio || 0) },
                ]}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 10, fill: "#94a3b8" }} unit="'" />
                  <YAxis dataKey="name" type="category" tick={{ fontSize: 11, fill: "#475569" }} width={70} />
                  <Tooltip formatter={(v) => [`${v} min`, ""]} contentStyle={{ borderRadius: 10, border: "none", fontSize: 12 }} />
                  <Bar dataKey="min" fill="#F59E0B" radius={[0,4,4,0]} label={{ position: "right", fontSize: 11, fill: "#92400e" }} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {questionAverages.length > 0 && (
            <div className="bg-white rounded-xl border border-slate-200 p-4">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Calificación por pregunta ★</p>
              <ResponsiveContainer width="100%" height={Math.max(120, questionAverages.length * 36)}>
                <BarChart layout="vertical" data={questionAverages.map(q => ({ name: q.question.slice(0, 28) + (q.question.length > 28 ? "…" : ""), avg: parseFloat(q.avg) }))}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                  <XAxis type="number" domain={[0, 5]} tick={{ fontSize: 10, fill: "#94a3b8" }} />
                  <YAxis dataKey="name" type="category" tick={{ fontSize: 10, fill: "#475569" }} width={120} />
                  <Tooltip formatter={(v) => [`★ ${v}`, ""]} contentStyle={{ borderRadius: 10, border: "none", fontSize: 12 }} />
                  <Bar dataKey="avg" fill="#F59E0B" radius={[0,4,4,0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {(() => {
            const driverMap: Record<string, { name: string; completados: number; cancelados: number; ingresos: number }> = {};
            filtered.forEach(r => {
              if (!r.driver_name) return;
              if (!driverMap[r.driver_name]) driverMap[r.driver_name] = { name: r.driver_name, completados: 0, cancelados: 0, ingresos: 0 };
              if (r.status === "completed") { driverMap[r.driver_name].completados++; driverMap[r.driver_name].ingresos += r.driver_earnings || 0; }
              if (r.status === "cancelled") driverMap[r.driver_name].cancelados++;
            });
            const data = Object.values(driverMap).sort((a, b) => b.completados - a.completados).slice(0, 10);
            if (data.length === 0) return null;
            return (
              <div className="bg-white rounded-xl border border-slate-200 p-4 lg:col-span-2">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                  <Car className="w-3.5 h-3.5" /> Rendimiento de conductores (Top 10)
                </p>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={data} margin={{ left: 0, right: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="name" tick={{ fontSize: 9, fill: "#94a3b8" }} interval={0} angle={-20} textAnchor="end" height={40} />
                    <YAxis yAxisId="left" allowDecimals={false} tick={{ fontSize: 10, fill: "#94a3b8" }} />
                    <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10, fill: "#94a3b8" }} tickFormatter={v => `$${v.toFixed(0)}`} />
                    <Tooltip contentStyle={{ borderRadius: 10, border: "none", fontSize: 12 }} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Bar yAxisId="left" dataKey="completados" name="Completados" fill="#10B981" radius={[4,4,0,0]} />
                    <Bar yAxisId="left" dataKey="cancelados" name="Cancelados" fill="#EF4444" radius={[4,4,0,0]} />
                    <Bar yAxisId="right" dataKey="ingresos" name="Ingresos ($)" fill="#8B5CF6" radius={[4,4,0,0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            );
          })()}

          {(() => {
            const svcMap: Record<string, { name: string; total: number; completados: number; ingresos: number }> = {};
            filtered.forEach(r => {
              const svc = r.service_type_name || "Sin tipo";
              if (!svcMap[svc]) svcMap[svc] = { name: svc, total: 0, completados: 0, ingresos: 0 };
              svcMap[svc].total++;
              if (r.status === "completed") { svcMap[svc].completados++; svcMap[svc].ingresos += r.company_price || r.final_price || r.estimated_price || 0; }
            });
            const data = Object.values(svcMap).sort((a, b) => b.total - a.total);
            if (data.length === 0) return null;
            return (
              <div className="bg-white rounded-xl border border-slate-200 p-4">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Volumen por tipo de servicio</p>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={data}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="name" tick={{ fontSize: 9, fill: "#94a3b8" }} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: "#94a3b8" }} />
                    <Tooltip contentStyle={{ borderRadius: 10, border: "none", fontSize: 12 }} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Bar dataKey="total" name="Total" fill="#3B82F6" radius={[4,4,0,0]} />
                    <Bar dataKey="completados" name="Completados" fill="#10B981" radius={[4,4,0,0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            );
          })()}

          {(() => {
            const pmMap: Record<string, { name: string; value: number }> = {};
            completed.forEach(r => {
              const pm = r.payment_method || "otro";
              if (!pmMap[pm]) pmMap[pm] = { name: pm, value: 0 };
              pmMap[pm].value++;
            });
            const data = Object.values(pmMap);
            if (data.length === 0) return null;
            const PM_LABELS = { cash: "Efectivo", card: "Tarjeta", transfer: "Transferencia" };
            return (
              <div className="bg-white rounded-xl border border-slate-200 p-4">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Método de pago (completados)</p>
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie data={data.map((d: any) => ({ ...d, name: PM_LABELS[d.name as keyof typeof PM_LABELS] || d.name }))} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={75}
                      label={({ name, percent }) => `${name} ${(percent*100).toFixed(0)}%`} labelLine={false}>
                      {data.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                    </Pie>
                    <Tooltip contentStyle={{ borderRadius: 10, border: "none", fontSize: 12 }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            );
          })()}

          {(() => {
            const dailyMap: Record<string, { day: string; total: number; cancelados: number }> = {};
            filtered.forEach(r => {
              const day = moment(r.requested_at || r.created_date).format("DD/MM");
              if (!dailyMap[day]) dailyMap[day] = { day, total: 0, cancelados: 0 };
              dailyMap[day].total++;
              if (r.status === "cancelled") dailyMap[day].cancelados++;
            });
            const data = Object.values(dailyMap).map(d => ({ ...d, tasa: d.total > 0 ? parseFloat(((d.cancelados / d.total) * 100).toFixed(1)) : 0 }));
            if (data.length < 2) return null;
            return (
              <div className="bg-white rounded-xl border border-slate-200 p-4">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Tasa de cancelación diaria (%)</p>
                <ResponsiveContainer width="100%" height={180}>
                  <LineChart data={data}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="day" tick={{ fontSize: 10, fill: "#94a3b8" }} />
                    <YAxis unit="%" tick={{ fontSize: 10, fill: "#94a3b8" }} domain={[0, 100]} />
                    <Tooltip formatter={v => [`${v}%`, "Tasa cancelación"]} contentStyle={{ borderRadius: 10, border: "none", fontSize: 12 }} />
                    <Line type="monotone" dataKey="tasa" stroke="#EF4444" strokeWidth={2} dot={{ r: 3 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            );
          })()}
        </div>
      )}

      {filteredSurveys.length === 0 && filtered.length > 0 && (
        <p className="text-xs text-slate-400 text-center py-2">Sin encuestas en el período seleccionado</p>
      )}
    </div>
  );
}
