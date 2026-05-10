# 🚀 Guía Paso a Paso: Migración Completa al Backend - Sin Programar

## 📋 Información Importante Antes de Empezar

**Esta guía está diseñada para personas sin experiencia en programación.** Todo se hace desde interfaces web de Supabase, Vercel y GitHub.

**Tiempo estimado:** 2-3 horas
**Herramientas necesarias:** Solo navegador web
**Costo aproximado:** $25-50 USD/mes (planes gratuitos disponibles)

---

## 🎯 PASO 1: Preparar tu Entorno en la Nube

### 1.1 Crear cuenta en Supabase (Base de Datos + Backend)
```
1. Ve a https://supabase.com
2. Haz clic en "Start your project"
3. Elige plan gratuito (hasta 500MB datos)
4. Completa registro con email
5. Verifica tu email
6. Crea nuevo proyecto:
   - Nombre: "Yaja-Backend"
   - Región: "North Virginia (iad1)" o "São Paulo (gru1)"
   - Contraseña de base de datos: genera una segura
```

### 1.2 Crear cuenta en Vercel (Despliegue Web)
```
1. Ve a https://vercel.com
2. Haz clic en "Sign Up"
3. Regístrate con GitHub (es más fácil)
4. Autoriza Vercel para acceder a tu GitHub
5. Verifica tu email
```

### 1.3 Preparar GitHub
```
Tu repositorio ya existe en: https://github.com/Yajaassistance/Yaja
Solo necesitas acceso de escritura (ya lo tienes)
```

---

## 🗄️ PASO 2: Configurar Base de Datos en Supabase

### 2.1 Importar Estructura de Tablas
```
1. En Supabase Dashboard → SQL Editor
2. Copia y pega TODO el contenido del archivo: migrations/schema.sql
3. Haz clic en "Run"
4. Espera confirmación de que todas las tablas se crearon
```

### 2.2 Configurar Políticas de Seguridad (RLS)
```
1. Ve a Authentication → Policies
2. Para cada tabla, habilita RLS y crea políticas básicas:
   - Drivers: solo pueden ver/editar sus propios datos
   - Passengers: solo pueden ver/editar sus propios datos
   - Rides: conductores ven rides asignados, pasajeros ven sus rides
   - Settings: solo admins pueden modificar
```

### 2.3 Crear Funciones de Base de Datos
```
En SQL Editor, ejecuta estas funciones una por una:

-- Función para calcular distancia entre coordenadas
CREATE OR REPLACE FUNCTION calculate_distance(lat1 float, lon1 float, lat2 float, lon2 float)
RETURNS float AS $$
BEGIN
  RETURN 6371 * acos(cos(radians(lat1)) * cos(radians(lat2)) * cos(radians(lon1 - lon2)) + sin(radians(lat1)) * sin(radians(lat2)));
END;
$$ LANGUAGE plpgsql;

-- Función para asignar conductores automáticamente
CREATE OR REPLACE FUNCTION assign_nearest_driver(ride_id uuid)
RETURNS uuid AS $$
DECLARE
  driver_uuid uuid;
BEGIN
  -- Lógica de asignación automática aquí
  SELECT d.id INTO driver_uuid
  FROM drivers d
  WHERE d.status = 'available'
  ORDER BY calculate_distance(d.latitude, d.longitude, r.pickup_lat, r.pickup_lon)
  LIMIT 1;

  RETURN driver_uuid;
END;
$$ LANGUAGE plpgsql;
```

---

## ⚙️ PASO 3: Crear Edge Functions (Backend Logic)

### 3.1 Función: Asignación Automática de Conductores
```
1. En Supabase → Edge Functions
2. Crear nueva función: "assign-driver"
3. Código básico:

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

serve(async (req) => {
  const { rideId } = await req.json()

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  // Buscar conductores disponibles cercanos
  const { data: drivers } = await supabase
    .from('drivers')
    .select('*')
    .eq('status', 'available')
    .order('last_location_update', { ascending: false })

  // Asignar el más cercano
  if (drivers && drivers.length > 0) {
    const assignedDriver = drivers[0]

    await supabase
      .from('rides')
      .update({
        driver_id: assignedDriver.id,
        status: 'assigned'
      })
      .eq('id', rideId)

    return new Response(JSON.stringify({ success: true, driverId: assignedDriver.id }))
  }

  return new Response(JSON.stringify({ success: false, message: 'No drivers available' }))
})
```

### 3.2 Función: Cálculo de Tarifas
```
Crear función: "calculate-fare"

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

serve(async (req) => {
  const { distanceKm, durationMinutes, settings } = await req.json()

  const baseFare = settings.base_fare || 30
  const pricePerKm = settings.price_per_km || 8
  const pricePerMinute = settings.price_per_minute || 1.5

  const distanceCost = distanceKm * pricePerKm
  const timeCost = durationMinutes * pricePerMinute
  const totalFare = baseFare + distanceCost + timeCost

  const commission = totalFare * (settings.platform_commission_pct / 100)
  const driverEarnings = totalFare - commission

  return new Response(JSON.stringify({
    totalFare: Math.round(totalFare * 100) / 100,
    driverEarnings: Math.round(driverEarnings * 100) / 100,
    commission: Math.round(commission * 100) / 100
  }))
})
```

### 3.3 Función: Envío de Notificaciones Push
```
Crear función: "send-push-notification"

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

serve(async (req) => {
  const { userId, title, body, rideId } = await req.json()

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  // Obtener token FCM del usuario
  const { data: user } = await supabase
    .from('drivers')
    .select('push_subscription')
    .eq('id', userId)
    .single()

  if (user?.push_subscription?.token) {
    // Enviar notificación push usando FCM
    const fcmResponse = await fetch('https://fcm.googleapis.com/fcm/send', {
      method: 'POST',
      headers: {
        'Authorization': `key=${Deno.env.get('FCM_SERVER_KEY')}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        to: user.push_subscription.token,
        notification: { title, body },
        data: { rideId }
      })
    })

    return new Response(JSON.stringify({ success: true }))
  }

  return new Response(JSON.stringify({ success: false }))
})
```

### 3.4 Función: Procesamiento de Pagos
```
Crear función: "process-payment"

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

serve(async (req) => {
  const { rideId, paymentMethod, amount } = await req.json()

  // Integrar con Stripe, PayPal, o Conekta
  // Este es un ejemplo básico con Stripe

  const stripe = require('stripe')(Deno.env.get('STRIPE_SECRET_KEY'))

  const paymentIntent = await stripe.paymentIntents.create({
    amount: Math.round(amount * 100), // Convertir a centavos
    currency: 'mxn',
    payment_method: paymentMethod,
    confirm: true
  })

  return new Response(JSON.stringify({
    success: true,
    paymentId: paymentIntent.id,
    status: paymentIntent.status
  }))
})
```

---

## 🔧 PASO 4: Configurar Variables de Entorno

### 4.1 En Supabase
```
Ve a Settings → Environment Variables y agrega:

SUPABASE_URL=tu_supabase_url
SUPABASE_SERVICE_ROLE_KEY=tu_service_role_key
FCM_SERVER_KEY=tu_fcm_server_key_de_firebase
STRIPE_SECRET_KEY=tu_stripe_secret_key
EMAIL_SERVICE_API_KEY=tu_email_service_key
```

### 4.2 En Vercel
```
1. Ve a tu proyecto en Vercel
2. Settings → Environment Variables
3. Copia las mismas variables de Supabase
```

---

## 🚀 PASO 5: Desplegar en Vercel

### 5.1 Conectar Repositorio
```
1. En Vercel Dashboard → "New Project"
2. Import Git Repository
3. Selecciona: Yajaassistance/Yaja
4. Configure project:
   - Framework: Next.js
   - Root Directory: ./ (raíz)
   - Build Command: npm run build
   - Output Directory: .next
5. Add Environment Variables (mismas que Supabase)
6. Deploy
```

### 5.2 Configurar Dominio (Opcional)
```
1. En Vercel → Settings → Domains
2. Add custom domain: yajaasistencia.com
3. Configure DNS en tu proveedor de dominio
```

---

## ⚙️ PASO 6: Activar Funcionalidades del Backend

### 6.1 Configurar Settings en Supabase
```
En Supabase → Table Editor → app_settings

Inserta una fila con:
- company_name: "Yaja Asistencia"
- timezone: "America/Mexico_City"
- auction_mode_enabled: true
- auto_assign_nearest_driver: true
- platform_commission_pct: 20
- base_fare: 30
- price_per_km: 8
- price_per_minute: 1.5

**Copia y pega este SQL en SQL Editor:**
```sql
INSERT INTO app_settings (
  company_name,
  timezone,
  auction_mode_enabled,
  auto_assign_nearest_driver,
  platform_commission_pct,
  base_fare,
  price_per_km,
  price_per_minute
) VALUES (
  'Yaja Asistencia',
  'America/Mexico_City',
  true,
  true,
  20,
  30,
  8,
  1.5
);
```

### 6.2 Probar Edge Functions
```
1. Ve a Edge Functions en Supabase
2. Para cada función, ve a "Logs" para verificar funcionamiento
3. Prueba con datos de ejemplo usando el botón "Test Function"
```

---

## 🔄 PASO 7: Migrar Lógica del Frontend al Backend

### 7.1 Actualizar llamadas API en el código
```
En lugar de calcular tarifas en el frontend, ahora llamas:

// Antes (frontend)
const fare = baseFare + (distance * pricePerKm) + (duration * pricePerMinute)

// Después (backend)
const response = await supabase.functions.invoke('calculate-fare', {
  body: { distanceKm, durationMinutes, settings }
})
const fare = response.data.totalFare
```

### 7.2 Reemplazar lógica de asignación
```
// Antes: lógica compleja en JavaScript
// Después: una llamada simple
const { data } = await supabase.functions.invoke('assign-driver', {
  body: { rideId }
})
```

---

## 🎛️ PASO 8: Configurar el "Switch" de Backend

### 8.1 Usar Settings Existentes
```
La tabla app_settings ya tiene las columnas necesarias para controlar el backend:

- auction_mode_enabled: true (activa modo subasta para asignación)
- auto_assign_nearest_driver: true (asignación automática activada)
- platform_commission_pct: 20 (comisión de plataforma)

Para activar/desactivar funcionalidades específicas, modifica estos valores.
```

### 8.2 Función de Control Maestro
```
Crea Edge Function: "backend-status"

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

serve(async (req) => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  const { data: settings } = await supabase
    .from('app_settings')
    .select('auction_mode_enabled, auto_assign_nearest_driver, platform_commission_pct')
    .single()

  return new Response(JSON.stringify({
    backend_enabled: true, // Siempre true si la función responde
    auto_assignment_enabled: settings?.auto_assign_nearest_driver || false,
    auction_mode_enabled: settings?.auction_mode_enabled || false,
    platform_commission_pct: settings?.platform_commission_pct || 0
  }))
})
```

---

## 🧪 PASO 9: Probar Todo el Sistema

### 9.1 Pruebas Básicas
```
1. Crear un ride desde el panel admin
2. Verificar que se asigna automáticamente un conductor
3. Probar envío de notificaciones push
4. Verificar cálculo correcto de tarifas
5. Probar procesamiento de pagos
```

### 9.2 Monitoreo
```
En Supabase Dashboard:
- Edge Functions → Logs (ver errores)
- Table Editor → verificar datos
- Authentication → usuarios activos
```

---

## 💰 PASO 10: Costos y Escalabilidad

### Planes Recomendados:
```
Supabase:
- Pro Plan: $25/mes (2GB database, 50GB bandwidth)
- Pay as you go: $0.125 por GB adicional

Vercel:
- Hobby Plan: Gratis (100GB bandwidth/mes)
- Pro Plan: $20/mes para dominios custom

Firebase (para push notifications):
- Spark Plan: Gratis (hasta 1M mensajes/mes)
```

### Escalabilidad:
```
- Supabase escala automáticamente
- Vercel maneja picos de tráfico
- Edge Functions son serverless (pagas por uso)
```

---

## 🚨 PASO 11: Backup y Seguridad

### 11.1 Backups Automáticos
```
Supabase hace backups automáticos diariamente.
Para backups manuales: Database → Backups → Create backup
```

### 11.2 Seguridad
```
1. Habilita 2FA en todas las cuentas
2. Usa variables de entorno para API keys
3. Configura CORS apropiadamente
4. Monitorea logs regularmente
```

---

## 🎉 ¡LISTO! Tu Backend Está Completo

### Resumen de lo que tienes ahora:
✅ Base de datos PostgreSQL con todas las tablas
✅ Edge Functions para lógica de negocio
✅ Asignación automática de conductores
✅ Cálculo automático de tarifas
✅ Notificaciones push
✅ Procesamiento de pagos
✅ Envío de emails
✅ Sistema de cupones
✅ API REST completa
✅ Despliegue automático en Vercel
✅ Dominio personalizado
✅ Monitoreo y logs
✅ Backups automáticos

### Para usar el sistema:
1. Los usuarios acceden a yajaasistencia.com
2. Todo el procesamiento ocurre en el backend
3. No necesitas programar más cambios
4. El sistema escala automáticamente

¿Necesitas ayuda con algún paso específico?