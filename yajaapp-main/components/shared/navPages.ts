import {
  LayoutDashboard, Users, Car, ShieldAlert, Settings, TrendingUp, CreditCard,
  MapPin, MessageCircle, Siren, Scissors, UserCog, Layers, Building2,
  MessageSquare, Wifi, UserCheck, ClipboardList, FileText, BellRing, Trophy,
  BarChart3, Megaphone, Globe
} from "lucide-react";

export const ALL_PAGES = [
  { name: "Inicio (Landing)", page: "Landing", icon: Globe },
  { name: "Panel de control", page: "Dashboard", icon: LayoutDashboard },
  { name: "Analíticas", page: "Analytics", icon: BarChart3 },
  { name: "EN VIVO", page: "LiveDrivers", icon: Wifi, live: true },
  { name: "Conductores", page: "Drivers", icon: Users },
  { name: "Clientes / Pasajeros", page: "Passengers", icon: UserCheck },
  { name: "Chats", page: "Chats", icon: MessageCircle },
  { name: "Alertas SOS", page: "SOSAlerts", icon: Siren, alert: true },
  { name: "Tickets de soporte", page: "SupportTickets", icon: MessageSquare },
  { name: "Conciliación offline", page: "OfflineReconciliation", icon: ClipboardList },
  { name: "Notificaciones", page: "Notificaciones", icon: BellRing },
  { name: "Anuncios", page: "Anuncios", icon: Megaphone },
  { name: "Ganancias conductores", page: "DriverEarnings", icon: TrendingUp },
  { name: "Ganancias plataforma", page: "Earnings", icon: TrendingUp },
  { name: "Corte de caja", page: "CashCutoff", icon: Scissors },
  { name: "Liquidaciones", page: "Liquidaciones", icon: FileText },
  { name: "Facturación", page: "Invoices", icon: FileText },
  { name: "Bonos por desempeño", page: "Bonos", icon: Trophy },
  { name: "Ciudades", page: "Cities", icon: MapPin },
  { name: "Tipos de servicio", page: "ServiceTypes", icon: Car },
  { name: "Cancelaciones", page: "CancellationPolicies", icon: ShieldAlert },
  { name: "Métodos de pago", page: "PaymentMethods", icon: CreditCard },
  { name: "Zonas tarifarias", page: "GeoZones", icon: Layers },
  { name: "Zonas rojas", page: "RedZones", icon: ShieldAlert },
  { name: "Empresas (B2B)", page: "Companies", icon: Building2 },
  { name: "Encuestas", page: "Surveys", icon: ClipboardList },
  { name: "Usuarios admin", page: "AdminUsers", icon: UserCog },
  { name: "Configuración", page: "Settings", icon: Settings },
];

export const DEFAULT_NAV_CONFIG = [
  {
    label: "Operaciones",
    pages: ["Landing", "Dashboard", "Analytics", "LiveDrivers", "Drivers", "Passengers", "Chats", "SOSAlerts", "SupportTickets", "OfflineReconciliation", "Notificaciones", "Anuncios"],
  },
  {
    label: "Finanzas",
    pages: ["DriverEarnings", "Earnings", "CashCutoff", "Liquidaciones", "Invoices", "Bonos"],
  },
  {
    label: "Configuración",
    pages: ["Cities", "ServiceTypes", "CancellationPolicies", "PaymentMethods", "GeoZones", "RedZones", "Companies", "Surveys", "AdminUsers", "Settings"],
  },
];