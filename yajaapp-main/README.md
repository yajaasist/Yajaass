# 🚗 YAJA - Plataforma de Asistencia Vial

Sistema completo de gestión de asistencia vial con aplicaciones PWA para conductores y pasajeros.

## 📋 Estado del Proyecto

✅ **PWA Funcional**: Aplicaciones instalables sin zoom, con permisos completos
✅ **Backend Migrado**: Todas las funciones movidas a Supabase Edge Functions
✅ **Despliegue Automático**: Vercel + GitHub para actualizaciones continuas

## 🚀 Inicio Rápido

### Para Usuarios No Técnicos
Si solo quieres usar la plataforma sin programar:

1. **Lee la guía completa**: [MIGRACION_BACKEND_GUIA_COMPLETA.md](MIGRACION_BACKEND_GUIA_COMPLETA.md)
2. **Sigue los 15 pasos** para configurar Supabase y Vercel
3. **Las apps estarán listas** en tu dominio personalizado

### Para Desarrolladores
```bash
# Instalar dependencias
npm install

# Configurar variables de entorno
cp .env.example .env.local

# Ejecutar en desarrollo
npm run dev
```

## 📱 Aplicaciones PWA

### Conductor App
- **URL**: `https://tu-dominio.com/driver-app`
- **Instalación**: Botón "Instalar App" en Chrome/Safari
- **Características**: GPS en tiempo real, notificaciones push, gestión de viajes

### Pasajero App
- **URL**: `https://tu-dominio.com/road-assist-app`
- **Instalación**: Botón "Instalar App" en Chrome/Safari
- **Características**: Solicitud de asistencia, seguimiento en tiempo real, pagos

## 🛠️ Arquitectura Técnica

### Frontend
- **Framework**: Next.js 14 con App Router
- **UI**: Tailwind CSS + shadcn/ui
- **PWA**: Manifests configurados para instalación nativa
- **Estado**: React Query para gestión de datos

### Backend
- **Base de Datos**: Supabase (PostgreSQL)
- **Autenticación**: Supabase Auth
- **APIs**: Supabase Edge Functions (Deno)
- **Tiempo Real**: Supabase Realtime
- **Almacenamiento**: Supabase Storage

### Despliegue
- **Hosting**: Vercel
- **CI/CD**: GitHub Actions
- **Dominio**: Configurable en Vercel

## 📁 Estructura del Proyecto

```
├── app/                    # Páginas Next.js
│   ├── driver-app/        # App del conductor
│   ├── road-assist-app/   # App del pasajero
│   └── admin/             # Panel administrativo
├── components/            # Componentes React
│   ├── shared/           # Componentes compartidos
│   ├── driver/           # Componentes del conductor
│   └── ui/               # Componentes de UI
├── lib/                   # Utilidades y configuración
│   ├── supabase.ts       # Cliente Supabase
│   └── nativeMobile.ts   # APIs nativas
├── public/               # Archivos estáticos
│   ├── driver-app-manifest.json
│   └── road-assist-app-manifest.json
└── supabase/             # Configuración de Supabase
    └── migrations/       # Migraciones de BD
```

## 🔧 Configuración de Edge Functions

Todas las funciones del backend están implementadas como Edge Functions. Consulta:

**[SUPABASE_EDGE_FUNCTIONS_IMPLEMENTATION.md](SUPABASE_EDGE_FUNCTIONS_IMPLEMENTATION.md)**

Funciones principales:
- `assign-driver`: Asignación automática de conductores
- `calculate-fare`: Cálculo de tarifas
- `send-push-notification`: Notificaciones push
- `process-payment`: Procesamiento de pagos
- `backend-status`: Control maestro del backend

## 📋 Guía de Migración Completa

Para migrar todo el sistema a la nube sin usar tu computadora local:

**[MIGRACION_BACKEND_GUIA_COMPLETA.md](MIGRACION_BACKEND_GUIA_COMPLETA.md)**

Esta guía incluye:
- Configuración de Supabase desde cero
- Despliegue en Vercel
- Configuración de dominios
- Variables de entorno
- Pruebas del sistema

## 🔐 Variables de Entorno

Crear archivo `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=https://tu-proyecto.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=tu_anon_key
SUPABASE_SERVICE_ROLE_KEY=tu_service_role_key

NEXT_PUBLIC_APP_URL=https://tu-dominio.com
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=tu_google_maps_key

STRIPE_PUBLISHABLE_KEY=pk_live_...
STRIPE_SECRET_KEY=sk_live_...

FCM_SERVER_KEY=tu_firebase_key
RESEND_API_KEY=re_...
```

## 🚀 Despliegue

### Automático (Recomendado)
1. Conecta tu repositorio a Vercel
2. Configura las variables de entorno en Vercel
3. Cada push a `main` se despliega automáticamente

### Manual
```bash
# Construir
npm run build

# Desplegar
npm run start
```

## 📊 Características

### Para Conductores
- ✅ GPS en tiempo real
- ✅ Notificaciones push
- ✅ Gestión de viajes
- ✅ Cálculo automático de ganancias
- ✅ Chat con pasajeros

### Para Pasajeros
- ✅ Solicitud de asistencia vial
- ✅ Seguimiento del conductor
- ✅ Pagos seguros con Stripe
- ✅ Calificaciones y reseñas
- ✅ Historial de viajes

### Administrador
- ✅ Panel de control completo
- ✅ Gestión de usuarios
- ✅ Análisis y reportes
- ✅ Configuración de tarifas
- ✅ Gestión de cupones

## 🧪 Testing

```bash
# Ejecutar tests
npm test

# Verificar PWA
npm run build
npx serve@latest out

# Abrir en navegador y verificar instalación
```

## 📞 Soporte

Para soporte técnico:
1. Revisa las guías en este repositorio
2. Verifica la configuración en Supabase/Vercel
3. Revisa los logs en Vercel Dashboard

## 📝 Licencia

Este proyecto es privado y propiedad de YAJA Asistencia Vial.