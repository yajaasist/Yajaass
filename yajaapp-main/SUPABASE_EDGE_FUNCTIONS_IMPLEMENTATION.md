# Supabase Edge Functions - Implementación Completa

## 📁 Estructura de Funciones a Crear

Crea estas funciones en Supabase → Edge Functions:

### 1. `assign-driver`
**Propósito:** Asignación automática de conductores
```typescript
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

serve(async (req) => {
  const { rideId } = await req.json()

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  // Buscar conductores disponibles
  const { data: drivers } = await supabase
    .from('drivers')
    .select('*')
    .eq('status', 'available')
    .order('last_location_update', { ascending: false })

  if (drivers && drivers.length > 0) {
    const assignedDriver = drivers[0]

    // Actualizar ride
    await supabase
      .from('rides')
      .update({
        driver_id: assignedDriver.id,
        status: 'assigned',
        assigned_at: new Date().toISOString()
      })
      .eq('id', rideId)

    // Notificar al conductor
    await supabase.functions.invoke('send-push-notification', {
      body: {
        userId: assignedDriver.id,
        title: 'Nuevo viaje asignado',
        body: 'Tienes un nuevo viaje disponible',
        rideId
      }
    })

    return new Response(JSON.stringify({
      success: true,
      driverId: assignedDriver.id
    }))
  }

  return new Response(JSON.stringify({
    success: false,
    message: 'No drivers available'
  }))
})
```

### 2. `calculate-fare`
**Propósito:** Cálculo automático de tarifas
```typescript
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

serve(async (req) => {
  const { distanceKm, durationMinutes, settings } = await req.json()

  const baseFare = settings.base_fare || 30
  const pricePerKm = settings.price_per_km || 8
  const pricePerMinute = settings.price_per_minute || 1.5

  const distanceCost = distanceKm * pricePerKm
  const timeCost = durationMinutes * pricePerMinute
  const subtotal = baseFare + distanceCost + timeCost

  const commission = subtotal * (settings.platform_commission_pct / 100)
  const totalFare = subtotal
  const driverEarnings = totalFare - commission

  return new Response(JSON.stringify({
    totalFare: Math.round(totalFare * 100) / 100,
    driverEarnings: Math.round(driverEarnings * 100) / 100,
    commission: Math.round(commission * 100) / 100,
    breakdown: {
      baseFare,
      distanceCost: Math.round(distanceCost * 100) / 100,
      timeCost: Math.round(timeCost * 100) / 100
    }
  }))
})
```

### 3. `send-push-notification`
**Propósito:** Envío de notificaciones push
```typescript
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

serve(async (req) => {
  const { userId, title, body, rideId, userType = 'driver' } = await req.json()

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  // Obtener token FCM del usuario
  const table = userType === 'driver' ? 'drivers' : 'road_assist_users'
  const { data: user } = await supabase
    .from(table)
    .select('push_subscription')
    .eq('id', userId)
    .single()

  if (user?.push_subscription?.token) {
    const fcmResponse = await fetch('https://fcm.googleapis.com/fcm/send', {
      method: 'POST',
      headers: {
        'Authorization': `key=${Deno.env.get('FCM_SERVER_KEY')}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        to: user.push_subscription.token,
        notification: { title, body },
        data: { rideId, userType }
      })
    })

    const result = await fcmResponse.json()

    return new Response(JSON.stringify({
      success: result.success === 1,
      messageId: result.results?.[0]?.message_id
    }))
  }

  return new Response(JSON.stringify({
    success: false,
    error: 'No push token found'
  }))
})
```

### 4. `process-payment`
**Propósito:** Procesamiento de pagos con Stripe
```typescript
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import Stripe from 'https://esm.sh/stripe@12.0.0'

serve(async (req) => {
  const { rideId, amount, currency = 'mxn', paymentMethodId } = await req.json()

  const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, {
    apiVersion: '2023-10-16'
  })

  try {
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount * 100), // Convertir a centavos
      currency,
      payment_method: paymentMethodId,
      confirm: true,
      automatic_payment_methods: {
        enabled: true,
      }
    })

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // Actualizar estado del pago en la base de datos
    await supabase
      .from('rides')
      .update({
        payment_status: paymentIntent.status === 'succeeded' ? 'paid' : 'pending',
        stripe_payment_id: paymentIntent.id
      })
      .eq('id', rideId)

    return new Response(JSON.stringify({
      success: true,
      paymentId: paymentIntent.id,
      status: paymentIntent.status,
      clientSecret: paymentIntent.client_secret
    }))

  } catch (error) {
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), { status: 400 })
  }
})
```

### 5. `send-email`
**Propósito:** Envío de emails
```typescript
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

serve(async (req) => {
  const { to, subject, html, from = 'noreply@yajaasistencia.com' } = await req.json()

  const emailData = {
    from,
    to,
    subject,
    html
  }

  // Usar Resend, SendGrid, o similar
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${Deno.env.get('RESEND_API_KEY')}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(emailData)
  })

  const result = await response.json()

  return new Response(JSON.stringify({
    success: response.ok,
    emailId: result.id
  }))
})
```

### 6. `apply-coupon`
**Propósito:** Aplicar cupones de descuento
```typescript
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

serve(async (req) => {
  const { code, rideId, userId } = await req.json()

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  // Buscar cupón válido
  const { data: coupon } = await supabase
    .from('coupons')
    .select('*')
    .eq('code', code.toUpperCase())
    .eq('is_active', true)
    .gt('expires_at', new Date().toISOString())
    .single()

  if (!coupon) {
    return new Response(JSON.stringify({
      success: false,
      error: 'Cupón inválido o expirado'
    }))
  }

  // Verificar uso del cupón
  const { data: usage } = await supabase
    .from('coupon_usage')
    .select('*')
    .eq('coupon_id', coupon.id)
    .eq('user_id', userId)
    .single()

  if (usage && coupon.usage_limit && usage.usage_count >= coupon.usage_limit) {
    return new Response(JSON.stringify({
      success: false,
      error: 'Cupón ya utilizado'
    }))
  }

  // Aplicar descuento
  const discount = coupon.discount_type === 'percentage'
    ? (coupon.discount_value / 100)
    : coupon.discount_value

  // Registrar uso
  await supabase
    .from('coupon_usage')
    .upsert({
      coupon_id: coupon.id,
      user_id: userId,
      usage_count: (usage?.usage_count || 0) + 1,
      last_used_at: new Date().toISOString()
    })

  return new Response(JSON.stringify({
    success: true,
    discount,
    discountType: coupon.discount_type,
    couponId: coupon.id
  }))
})
```

### 7. `calculate-eta`
**Propósito:** Calcular tiempo estimado de llegada
```typescript
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

serve(async (req) => {
  const { originLat, originLon, destLat, destLon, speedKmh = 30 } = await req.json()

  // Calcular distancia usando fórmula de Haversine
  const R = 6371 // Radio de la Tierra en km
  const dLat = (destLat - originLat) * Math.PI / 180
  const dLon = (destLon - originLon) * Math.PI / 180

  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(originLat * Math.PI / 180) * Math.cos(destLat * Math.PI / 180) *
    Math.sin(dLon/2) * Math.sin(dLon/2)

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))
  const distance = R * c

  // Calcular tiempo estimado
  const timeHours = distance / speedKmh
  const timeMinutes = Math.round(timeHours * 60)

  return new Response(JSON.stringify({
    distanceKm: Math.round(distance * 100) / 100,
    etaMinutes: timeMinutes,
    etaText: `${timeMinutes} minutos`
  }))
})
```

### 8. `backend-status`
**Propósito:** Control maestro del backend
```typescript
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

serve(async (req) => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  const { data: settings } = await supabase
    .from('app_settings')
    .select(`
      backend_enabled,
      auto_assignment_enabled,
      push_notifications_enabled,
      payment_processing_enabled,
      email_service_enabled,
      auction_mode_enabled
    `)
    .single()

  return new Response(JSON.stringify(settings || {
    backend_enabled: false,
    auto_assignment_enabled: false,
    push_notifications_enabled: false,
    payment_processing_enabled: false,
    email_service_enabled: false,
    auction_mode_enabled: false
  }))
})
```

## 🔧 Variables de Entorno Requeridas

En Supabase → Settings → Environment Variables:

```
SUPABASE_URL=https://tu-proyecto.supabase.co
SUPABASE_SERVICE_ROLE_KEY=tu_service_role_key
FCM_SERVER_KEY=tu_firebase_cloud_messaging_key
STRIPE_SECRET_KEY=sk_live_...
RESEND_API_KEY=re_...
```

## 🧪 Cómo Probar las Funciones

Para cada función en Supabase → Edge Functions:

1. Ve a la función
2. Haz clic en "Test Function"
3. Pega un JSON de ejemplo en el body
4. Ejecuta y verifica la respuesta

Ejemplo para `calculate-fare`:
```json
{
  "distanceKm": 10,
  "durationMinutes": 20,
  "settings": {
    "base_fare": 30,
    "price_per_km": 8,
    "price_per_minute": 1.5,
    "platform_commission_pct": 20
  }
}
```