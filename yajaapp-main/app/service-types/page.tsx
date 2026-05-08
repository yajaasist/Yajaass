"use client";

import React, { useState, useMemo } from "react";
import { supabaseApi } from "@/lib/supabaseApi";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import Layout from "@/components/admin/Layout";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import {
  Plus, Pencil, Trash2, Car, Crown, Truck, Ambulance, Wrench,
  ShieldAlert, Zap, Bike, Star, Navigation,
  AlertTriangle, Cog, FolderOpen,
  ChevronDown, ChevronRight, Fuel, CircleDot, Battery, X, Upload
} from "lucide-react";
import { toast } from "sonner";

const iconMap = {
	car: Car, crown: Crown, truck: Truck, ambulance: Ambulance, wrench: Wrench,
	shield: ShieldAlert, zap: Zap, bike: Bike, star: Star,
	navigation: Navigation, alert: AlertTriangle, cog: Cog,
	fuel: Fuel, tire: CircleDot, battery: Battery,
};

const iconOptions = [
	{ value: "car", label: "🚗 Taxi / Auto" },
	{ value: "crown", label: "👑 Premium / VIP" },
	{ value: "truck", label: "🚛 Grúa / Remolque" },
	{ value: "alert", label: "⚠️ Grúa de emergencia" },
	{ value: "bike", label: "🏍️ Moto" },
	{ value: "fuel", label: "⛽ Gasolina" },
	{ value: "tire", label: "🔵 Cambio de llanta" },
	{ value: "battery", label: "🔋 Paso de corriente" },
	{ value: "wrench", label: "🔧 Asistencia vial" },
	{ value: "cog", label: "⚙️ Mecánico en ruta" },
	{ value: "zap", label: "⚡ Servicio eléctrico" },
	{ value: "ambulance", label: "🚑 Ambulancia" },
	{ value: "shield", label: "🛡️ Seguridad vial" },
	{ value: "navigation", label: "🧭 Transporte especial" },
	{ value: "star", label: "⭐ Ejecutivo" },
];

const emptyService = {
	name: "", category: "", description: "", icon: "car", icon_url: "", base_price: "", price_per_km: "",
	price_per_minute: "", minimum_fare: "", surge_multiplier: 1, max_passengers: 4,
	is_active: true, pay_full_to_driver: false, color: "#3B82F6", custom_fields: [], service_extras: [],
};

const emptyField = { key: "", label: "", type: "text", options: [], required: false, placeholder: "" };

export default function ServiceTypes() {
	const [editService, setEditService] = useState(null);
	const [showDialog, setShowDialog] = useState(false);
	const [saving, setSaving] = useState(false);
	const [iconUploading, setIconUploading] = useState(false);
	const [collapsedCategories, setCollapsedCategories] = useState({});
	const [editingCat, setEditingCat] = useState(null); // { oldName, newName }
	const [catSaving, setCatSaving] = useState(false);
	const [searchTerm, setSearchTerm] = useState("");
	const queryClient = useQueryClient();

	const { data: services = [] } = useQuery({
		queryKey: ["serviceTypes"],
		queryFn: () => supabaseApi.serviceTypes.list(),
		staleTime: 5 * 60 * 1000,
		gcTime: 10 * 60 * 1000,
	});

	const grouped = useMemo(() => {
		const map = {};
		services.forEach(s => {
			const cat = s.category?.trim() || "Sin categoría";
			if (!map[cat]) map[cat] = [];
			map[cat].push(s);
		});
		return map;
	}, [services]);

	const categories = Object.keys(grouped);

	const handleIconUpload = async (file) => {
		if (!file) return;
		setIconUploading(true);
		try {
			const { file_url } = await supabaseApi.uploads.uploadFile({ file });
			update("icon_url", file_url);
			toast.success("Imagen subida");
		} catch (err) {
			toast.error("Error al subir imagen");
		}
		setIconUploading(false);
	};

	const handleSave = async () => {
		setSaving(true);
		try {
			const data = {
				...editService,
				base_price: parseFloat(editService.base_price) || 0,
				price_per_km: parseFloat(editService.price_per_km) || 0,
				price_per_minute: parseFloat(editService.price_per_minute) || 0,
				minimum_fare: parseFloat(editService.minimum_fare) || 0,
				surge_multiplier: parseFloat(editService.surge_multiplier) || 1,
				max_passengers: parseInt(editService.max_passengers) || 4,
			};
			if (editService.id) {
				await supabaseApi.serviceTypes.update(editService.id, data);
			} else {
				await supabaseApi.serviceTypes.create(data);
			}
			queryClient.invalidateQueries({ queryKey: ["serviceTypes"] });
			setSaving(false);
			setShowDialog(false);
			setEditService(null);
			toast.success("Servicio guardado");
		} catch (err) {
			toast.error("Error al guardar");
			setSaving(false);
		}
	};

	const handleRenameCategory = async () => {
		if (!editingCat?.newName?.trim()) return;
		setCatSaving(true);
		try {
			const toRename = services.filter(s => (s.category?.trim() || "Sin categoría") === editingCat?.oldName);
			await Promise.all(toRename.map(s => supabaseApi.serviceTypes.update(s.id, { category: editingCat?.newName?.trim() })));
			queryClient.invalidateQueries({ queryKey: ["serviceTypes"] });
			setCatSaving(false);
			setEditingCat(null);
			toast.success("Categoría renombrada");
		} catch (err) {
			toast.error("Error al renombrar");
			setCatSaving(false);
		}
	};

	const handleDelete = async (s) => {
		if (!confirm(`¿Eliminar "${s.name}"?`)) return;
		try {
			await supabaseApi.serviceTypes.delete(s.id);
			queryClient.invalidateQueries({ queryKey: ["serviceTypes"] });
			toast.success("Servicio eliminado");
		} catch (err) {
			toast.error("Error al eliminar");
		}
	};

	const update = (field, value) => setEditService(prev => ({ ...prev, [field]: value }));
	const toggleCategory = (cat) => setCollapsedCategories(p => ({ ...p, [cat]: !p[cat] }));

	const openNew = (cat = "") => {
		setEditService({ ...emptyService, category: cat });
		setShowDialog(true);
	};

	return (
		<Layout currentPageName="ServiceTypes">
			<div className="space-y-6">
				<div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
					<div>
						<h1 className="text-2xl font-bold text-slate-900">Tipos de servicio</h1>
						<p className="text-sm text-slate-400 mt-0.5">
							Las <strong>categorías</strong> agrupan servicios. Las <strong>subcategorías</strong> son los servicios reales asignables a conductores.
						</p>
					</div>
					<Button onClick={() => openNew()} className="bg-slate-900 hover:bg-slate-800 rounded-xl">
						<Plus className="w-4 h-4 mr-2" /> Nuevo servicio
					</Button>
				</div>

				{categories.length === 0 && (
					<div className="text-center py-16 text-slate-400">
						<Wrench className="w-10 h-10 mx-auto mb-3 opacity-30" />
						<p className="font-medium">Sin servicios todavía</p>
						<Button onClick={() => openNew()} className="mt-4 rounded-xl bg-slate-900">
							<Plus className="w-4 h-4 mr-2" /> Crear primer servicio
						</Button>
					</div>
				)}

				{categories.map(cat => {
					const isCollapsed = collapsedCategories[cat];
					return (
						<div key={cat} className="space-y-3">
							<div className="flex items-center justify-between">
								<button onClick={() => toggleCategory(cat)} className="flex items-center gap-2 group">
									<div className="w-7 h-7 bg-slate-100 rounded-lg flex items-center justify-center group-hover:bg-slate-200 transition-colors">
										{isCollapsed ? <ChevronRight className="w-4 h-4 text-slate-600" /> : <ChevronDown className="w-4 h-4 text-slate-600" />}
									</div>
									<FolderOpen className="w-4 h-4 text-amber-500" />
									<span className="font-bold text-slate-800 text-base">{cat}</span>
									<Badge variant="secondary" className="text-xs">{grouped[cat].length} subcategoría(s)</Badge>
								</button>
								<div className="flex items-center gap-2">
									<Button size="sm" variant="outline" onClick={() => setEditingCat({ oldName: cat, newName: cat })} className="rounded-xl text-xs h-8">
										<Pencil className="w-3.5 h-3.5 mr-1" /> Renombrar
									</Button>
									<Button size="sm" variant="outline" onClick={() => openNew(cat)} className="rounded-xl text-xs h-8">
										<Plus className="w-3.5 h-3.5 mr-1" /> Agregar subcategoría
									</Button>
								</div>
							</div>

							{!isCollapsed && (
								<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pl-4 border-l-2 border-slate-100">
									{grouped[cat].map(service => {
										const Icon = iconMap[service.icon] || Car;
										return (
											<Card key={service.id} className="p-5 border-0 shadow-sm hover:shadow-md transition-all relative overflow-hidden">
												<div className="absolute top-0 right-0 w-20 h-20 rounded-full opacity-10 -translate-y-6 translate-x-6" style={{ backgroundColor: service.color }} />
												<div className="flex items-start justify-between mb-3">
													<div className="flex items-center gap-3">
														<div className="p-2 rounded-xl flex-shrink-0 overflow-hidden" style={{ backgroundColor: service.color + "20", color: service.color }}>
															{service.icon_url
																? <img src={service.icon_url} alt={service.name} className="w-5 h-5 object-cover rounded" />
																: <Icon className="w-5 h-5" />}
														</div>
														<div>
															<h3 className="font-semibold text-slate-900 text-sm">{service.name}</h3>
															{service.description && <p className="text-xs text-slate-400 mt-0.5 line-clamp-1">{service.description}</p>}
														</div>
													</div>
													<div className={`w-2 h-2 rounded-full mt-1 flex-shrink-0 ${service.is_active ? "bg-emerald-400" : "bg-slate-300"}`} />
												</div>

												<div className="grid grid-cols-2 gap-2 mb-3">
													{[
														{ label: "Base", val: service.base_price },
														{ label: "Por km", val: service.price_per_km },
														{ label: "Por min", val: service.price_per_minute || 0 },
														{ label: "Mínimo", val: service.minimum_fare || 0 },
													].map(item => (
														<div key={item.label} className="bg-slate-50 rounded-lg p-2.5">
															<p className="text-[10px] text-slate-400">{item.label}</p>
															<p className="font-bold text-slate-900 text-sm">${item.val}</p>
														</div>
													))}
												</div>

												<div className="flex items-center gap-2 text-xs text-slate-400 mb-3 flex-wrap">
													<span>Máx {service.max_passengers} pasajeros</span>
													<span>·</span>
													<span>×{service.surge_multiplier}</span>
													{service.require_proof_photo && (
														<span className="bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded text-[10px] font-medium">📷 Foto</span>
													)}
												</div>

												<div className="flex items-center gap-2 pt-3 border-t border-slate-100">
													<Button variant="ghost" size="sm" className="flex-1 text-xs"
														onClick={() => { setEditService({ ...service }); setShowDialog(true); }}>
														<Pencil className="w-3.5 h-3.5 mr-1" /> Editar
													</Button>
													<Button variant="ghost" size="sm" className="text-xs text-red-500 hover:text-red-600"
														onClick={() => handleDelete(service)}>
														<Trash2 className="w-3.5 h-3.5" />
													</Button>
												</div>
											</Card>
										);
									})}
								</div>
							)}
						</div>
					);
				})}

		{/* Rename category dialog */}
		<Dialog open={!!editingCat} onOpenChange={open => { if (!open) setEditingCat(null); }}>
			<DialogContent className="dialog-size-lg max-h-[90vh] overflow-y-auto p-4">
				<DialogHeader><DialogTitle>Renombrar categoría</DialogTitle></DialogHeader>
				<div className="py-2 space-y-2">
					<label className="text-sm text-slate-500">Nuevo nombre de la categoría</label>
					<Input
						value={editingCat?.newName || ""}
						onChange={e => setEditingCat(prev => ({ ...prev, newName: e.target.value }))}
						placeholder="Nombre de categoría..."
					/>
					<p className="text-xs text-slate-400">Se actualizará en todos los servicios de esta categoría.</p>
				</div>
				<DialogFooter>
					<Button variant="outline" onClick={() => setEditingCat(null)}>Cancelar</Button>
					<Button onClick={handleRenameCategory} disabled={catSaving || !editingCat?.newName?.trim()}>
						{catSaving ? "Guardando..." : "Guardar"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>

		{/* Main edit dialog */}
		<Dialog open={showDialog} onOpenChange={v => { setShowDialog(v); if (!v) setEditService(null); }}>
			<DialogContent className="dialog-size-2xl max-h-[90vh] overflow-y-auto p-4">
				<DialogHeader>
					<DialogTitle>{editService?.id ? "Editar subcategoría" : "Nueva subcategoría"}</DialogTitle>
				</DialogHeader>
				{editService && (
					<div className="space-y-4 py-2">
						{/* Category selector */}
						<div>
							<Label>Categoría *</Label>
							<p className="text-xs text-slate-400 mb-2">Selecciona una existente o escribe una nueva</p>
							<div className="flex gap-1.5 flex-wrap mb-2">
								{categories.map(c => (
									<button key={c} onClick={() => update("category", c)}
										className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${editService.category === c ? "bg-slate-900 text-white border-slate-900" : "border-slate-200 text-slate-600 hover:bg-slate-50"}`}>
										{c}
									</button>
								))}
							</div>
							<Input
								placeholder="Nombre de categoría..."
								value={editService.category}
								onChange={e => update("category", e.target.value)}
							/>
						</div>

						<hr />

						<div className="grid grid-cols-2 gap-4">
							<div><Label>Nombre *</Label><Input value={editService.name} onChange={e => update("name", e.target.value)} /></div>
							<div>
								<Label>Icono base</Label>
								<select className="w-full border rounded-md p-2 text-sm mt-1" value={editService.icon} onChange={e => update("icon", e.target.value)}>
									{iconOptions.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
								</select>
							</div>
						</div>

						{/* Icono personalizado (imagen) */}
						<div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
							<Label className="text-slate-700">Imagen personalizada del icono</Label>
							<p className="text-xs text-slate-400">Sube una imagen para reemplazar el icono SVG (png/jpg/webp)</p>
							<div className="flex items-center gap-3">
								{editService.icon_url && (
									<div className="relative">
										<img src={editService.icon_url} alt="icon" className="w-14 h-14 rounded-xl object-cover border border-slate-200" />
										<button onClick={() => update("icon_url", "")} className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center">
											<X className="w-3 h-3 text-white" />
										</button>
									</div>
								)}
								<label className={`flex items-center gap-2 px-3 py-2 rounded-xl border cursor-pointer transition-colors ${iconUploading ? "opacity-50 cursor-not-allowed" : "border-slate-300 hover:bg-slate-100"}`}>
									{iconUploading ? <span className="text-xs text-slate-500">Subiendo...</span> : <><Upload className="w-4 h-4 text-slate-500" /><span className="text-xs text-slate-600">{editService.icon_url ? "Cambiar imagen" : "Subir imagen"}</span></>}
									<input type="file" accept="image/*" className="hidden" disabled={iconUploading}
										onChange={e => e.target.files?.[0] && handleIconUpload(e.target.files[0])} />
								</label>
							</div>
						</div>

						<div><Label>Descripción</Label><Input value={editService.description} onChange={e => update("description", e.target.value)} /></div>

						<div className="grid grid-cols-2 gap-4">
							<div><Label>Tarifa base *</Label><Input type="number" value={editService.base_price} onChange={e => update("base_price", e.target.value)} /></div>
							<div><Label>Precio/km *</Label><Input type="number" value={editService.price_per_km} onChange={e => update("price_per_km", e.target.value)} /></div>
						</div>

						<div className="grid grid-cols-2 gap-4">
							<div><Label>Precio/min</Label><Input type="number" value={editService.price_per_minute} onChange={e => update("price_per_minute", e.target.value)} /></div>
							<div><Label>Tarifa mínima</Label><Input type="number" value={editService.minimum_fare} onChange={e => update("minimum_fare", e.target.value)} /></div>
						</div>

						<div className="grid grid-cols-3 gap-4">
							<div><Label>Multiplicador</Label><Input type="number" step="0.1" value={editService.surge_multiplier} onChange={e => update("surge_multiplier", e.target.value)} /></div>
							<div><Label>Máx pasajeros</Label><Input type="number" value={editService.max_passengers} onChange={e => update("max_passengers", e.target.value)} /></div>
							<div><Label>Color</Label><Input type="color" value={editService.color} onChange={e => update("color", e.target.value)} className="h-10" /></div>
						</div>

						<div className="flex items-center gap-3">
							<Switch checked={editService.is_active} onCheckedChange={v => update("is_active", v)} />
							<Label>Subcategoría activa</Label>
						</div>

						<div className="flex items-center gap-3 p-3 bg-emerald-50 rounded-xl border border-emerald-100">
							<Switch checked={!!editService.pay_full_to_driver} onCheckedChange={v => update("pay_full_to_driver", v)} />
							<div>
								<Label className="text-emerald-800">Pago completo al conductor</Label>
								<p className="text-xs text-slate-400 mt-0.5">Si está activo, el conductor recibe el 100% sin descuento de comisión de plataforma</p>
							</div>
						</div>

						<div>
							<Label>Anticipación para citas (minutos)</Label>
							<div className="flex items-center gap-2 mt-1">
								<Input type="number" min={1} max={240}
									value={editService.advance_assignment_minutes ?? 15}
									onChange={e => update("advance_assignment_minutes", parseInt(e.target.value) || 15)}
									className="max-w-[100px]" />
								<span className="text-sm text-slate-500">minutos antes</span>
							</div>
						</div>

						{/* Extras del servicio */}
						<div className="space-y-3">
							<div className="flex items-center justify-between">
								<div>
									<Label>Extras opcionales del servicio</Label>
									<p className="text-xs text-slate-400 mt-0.5">El pasajero puede seleccionarlos al solicitar. Se suman al costo</p>
								</div>
								<Button size="sm" variant="outline" className="rounded-xl text-xs h-8"
									onClick={() => update("service_extras", [...(editService.service_extras || []), { name: "", price: 0, is_active: true }])}>
									<Plus className="w-3.5 h-3.5 mr-1" /> Agregar extra
								</Button>
							</div>
							{(editService.service_extras || []).length === 0 && (
								<p className="text-xs text-slate-400 italic bg-slate-50 rounded-lg px-3 py-2">Sin extras. Haz clic en "+ Agregar extra" para añadir uno.</p>
							)}
							{(editService.service_extras || []).map((extra, idx) => (
								<div key={idx} className="border border-slate-200 rounded-xl p-3 bg-slate-50 flex items-center gap-2">
									<Input
										value={extra.name}
										onChange={e => {
											const updated = [...(editService.service_extras || [])];
											updated[idx] = { ...updated[idx], name: e.target.value };
											update("service_extras", updated);
										}}
										placeholder="Nombre del extra (ej: Silla de bebé)"
										className="flex-1 text-xs h-8"
									/>
									<Input
										type="number" min={0}
										value={extra.price}
										onChange={e => {
											const updated = [...(editService.service_extras || [])];
											updated[idx] = { ...updated[idx], price: parseFloat(e.target.value) || 0 };
											update("service_extras", updated);
										}}
										placeholder="$0"
										className="w-20 text-xs h-8"
									/>
									<div className="flex flex-col items-center gap-0.5">
										<Switch
											checked={extra.generates_commission !== false}
											onCheckedChange={v => {
												const updated = [...(editService.service_extras || [])];
												updated[idx] = { ...updated[idx], generates_commission: v };
												update("service_extras", updated);
											}}
										/>
										<span className="text-[9px] text-slate-400 text-center leading-tight">Comisión</span>
									</div>
									<Switch
										checked={extra.is_active !== false}
										onCheckedChange={v => {
											const updated = [...(editService.service_extras || [])];
											updated[idx] = { ...updated[idx], is_active: v };
											update("service_extras", updated);
										}}
									/>
									<button onClick={() => {
										const updated = [...(editService.service_extras || [])];
										updated.splice(idx, 1);
										update("service_extras", updated);
									}} className="w-6 h-6 rounded-full bg-red-100 flex items-center justify-center hover:bg-red-200">
										<X className="w-3.5 h-3.5 text-red-500" />
									</button>
								</div>
							))}
						</div>

						<div className="p-3 bg-blue-50 rounded-xl border border-blue-100">
							<Label className="text-blue-800">% pago al conductor en viajes de empresa</Label>
							<p className="text-xs text-slate-400 mb-2">Del costo que paga la empresa, este % va al conductor. El conductor NO ve el costo empresa.</p>
							<div className="flex items-center gap-2">
								<Input type="number" min={0} max={100} step={1}
									value={editService.corporate_driver_pct ?? 80}
									onChange={e => update("corporate_driver_pct", parseFloat(e.target.value) || 80)}
									className="max-w-[100px] border-blue-300" />
								<span className="text-sm text-blue-700 font-medium">%</span>
								{editService.corporate_driver_pct && (
									<span className="text-xs text-blue-500">Si empresa paga $100 → conductor recibe ${((editService.corporate_driver_pct ?? 80)).toFixed(0)}</span>
								)}
							</div>
						</div>

						{/* Campos personalizados */}
						<div className="space-y-3">
							<div className="flex items-center justify-between">
								<div>
									<Label>Campos personalizados del servicio</Label>
									<p className="text-xs text-slate-400 mt-0.5">Se pedirán al crear el servicio y se mostrarán al conductor</p>
								</div>
								<Button size="sm" variant="outline" className="rounded-xl text-xs h-8"
									onClick={() => update("custom_fields", [...(editService.custom_fields || []), { ...emptyField, key: `campo_${Date.now()}` }])}>
									<Plus className="w-3.5 h-3.5 mr-1" /> Agregar campo
								</Button>
							</div>
							{(editService.custom_fields || []).length === 0 && (
								<p className="text-xs text-slate-400 italic bg-slate-50 rounded-lg px-3 py-2">Sin campos personalizados. Haz clic en "+ Agregar campo" para añadir uno.</p>
							)}
							{(editService.custom_fields || []).map((field, idx) => (
								<div key={idx} className="border border-slate-200 rounded-xl p-3 space-y-2 bg-slate-50">
									<div className="flex items-center justify-between">
										<span className="text-xs font-medium text-slate-600">Campo #{idx + 1}</span>
										<button onClick={() => {
											const updated = [...(editService.custom_fields || [])];
											updated.splice(idx, 1);
											update("custom_fields", updated);
										}} className="w-6 h-6 rounded-full bg-red-100 flex items-center justify-center hover:bg-red-200 transition-colors">
											<X className="w-3.5 h-3.5 text-red-500" />
										</button>
									</div>
									<div className="grid grid-cols-2 gap-2">
										<div>
											<Label className="text-xs">Etiqueta *</Label>
											<Input
												value={field.label}
												onChange={e => {
													const updated = [...(editService.custom_fields || [])];
													updated[idx] = { ...updated[idx], label: e.target.value, key: e.target.value.toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "") || updated[idx].key };
													update("custom_fields", updated);
												}}
												placeholder="Ej: Número de serie"
												className="text-xs h-8 mt-0.5"
											/>
										</div>
										<div>
											<Label className="text-xs">Tipo</Label>
											<select
												className="w-full border rounded-md p-1.5 text-xs mt-0.5"
												value={field.type}
												onChange={e => {
													const updated = [...(editService.custom_fields || [])];
													updated[idx] = { ...updated[idx], type: e.target.value };
													update("custom_fields", updated);
												}}
											>
												<option value="text">Texto libre</option>
												<option value="number">Número</option>
												<option value="select">Lista de opciones</option>
											</select>
										</div>
									</div>
									<div className="grid grid-cols-2 gap-2">
										<div>
											<Label className="text-xs">Placeholder (opcional)</Label>
											<Input
												value={field.placeholder || ""}
												onChange={e => {
													const updated = [...(editService.custom_fields || [])];
													updated[idx] = { ...updated[idx], placeholder: e.target.value };
													update("custom_fields", updated);
												}}
												placeholder="Ej: Ingresa el número..."
												className="text-xs h-8 mt-0.5"
											/>
										</div>
										<div className="flex items-end pb-1 gap-2">
											<Switch
												checked={field.required}
												onCheckedChange={v => {
													const updated = [...(editService.custom_fields || [])];
													updated[idx] = { ...updated[idx], required: v };
													update("custom_fields", updated);
												}}
											/>
											<Label className="text-xs">Obligatorio</Label>
										</div>
									</div>
									{field.type === "select" && (
										<div>
											<Label className="text-xs">Opciones (una por línea)</Label>
											<textarea
												className="w-full border rounded-md p-2 text-xs mt-0.5 resize-none"
												rows={3}
												value={(field.options || []).join("\n")}
												onChange={e => {
													const updated = [...(editService.custom_fields || [])];
													updated[idx] = { ...updated[idx], options: e.target.value.split("\n").filter(o => o.trim()) };
													update("custom_fields", updated);
												}}
												placeholder="Opción 1&#10;Opción 2&#10;Opción 3"
											/>
										</div>
									)}
								</div>
							))}
						</div>
					</div>
				)}
				<DialogFooter>
					<Button variant="outline" onClick={() => { setShowDialog(false); setEditService(null); }}>Cancelar</Button>
					<Button onClick={handleSave} disabled={saving || !editService?.name || !editService?.category}>
						{saving ? "Guardando..." : "Guardar"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	</div>
	</Layout>
);
}
