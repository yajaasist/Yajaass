# Sistema de Prioridades de Tarifa en Zonas Geográficas

## Descripción General

El sistema de zonas tarifarias ha sido mejorado con dos nuevas opciones de prioridad configurables. Esto permite un control granular sobre qué tarifa se aplica en cada situación: servicios normales o servicios corporativos.

## Nuevas Características

### 1. **Prioridad de Tarifa por Servicio** (`service_tariff_priority`)

Controla qué tarifa tiene prioridad para **servicios normales** (no corporativos) que caen dentro de una zona.

**Valores posibles:**
- `"zone"` (por defecto): Usa la tarifa de la zona
- `"service"`: Usa la tarifa general configurada del servicio

**Ejemplo:**
- Zona: Centro Histórico con tarifa base $50 + $2/km
- Servicio: Taxi con tarifa base $30 + $1.50/km

Si `service_tariff_priority = "zone"`: se aplica la tarifa del Centro Histórico ($50 + $2/km)
Si `service_tariff_priority = "service"`: se aplica la tarifa general del Taxi ($30 + $1.50/km)

---

### 2. **Prioridad de Tarifa en Caso de Empresa** (`company_tariff_priority`)

Controla qué tarifa tiene prioridad para **servicios corporativos** (viajes de empresas) que caen dentro de una zona.

**Valores posibles:**
- `"zone"` (por defecto): Respeta la tarifa de la zona
- `"company"`: Respeta la tarifa negociada de la empresa

**Ejemplo:**
- Zona: Centro Histórico con tarifa base $50 + $2/km
- Empresa: ACME Corporation con tarifa negociada $45 para esa zona
- Servicio: Taxi

Si `company_tariff_priority = "zone"`: se aplica la tarifa de la zona ($50 + $2/km) aunque ACME tenga tarifa negociada
Si `company_tariff_priority = "company"`: se aplica la tarifa de ACME ($45)

---

## Lógica de Aplicación

### Orden de Decisión

1. **Determinar la zona correcta** (si hay superposición):
   - Se respeta el **nivel de prioridad entre zonas** (existente)
   - La zona con mayor prioridad gana
   
2. **Una vez determinada la zona**:
   - **Para servicios normales**: Se evalúa `service_tariff_priority` para decidir entre tarifa de zona vs. servicio
   - **Para servicios corporativos**: Se evalúa `company_tariff_priority` para decidir entre tarifa de zona vs. empresa

3. **Aplicar la tarifa seleccionada**

---

## Flujo en CreateRideDialog

Cuando se crea un viaje desde el panel de administración:

```
┌─ Detectar Zona ──┐
│                 │
├─ ¿Es Corporativo? ──→ SÍ ──┐
│                              │
└─ NO ────────────┐            │
                  │            │
                  ▼            ▼
            Evaluar        Evaluar
        service_tariff_  company_tariff_
         priority         priority
                  │            │
                  └──┬─────────┘
                     ▼
              Calcular Precio
```

---

## Cómo Configurar

### Interfaz de Administración

**Ubicación:** Panel de Admin → **Zonas tarifarias** (`/geo-zones`)

Para configurar las prioridades de tarifa:

1. **Ve a Zonas tarifarias** en el menú lateral del panel de administración
2. **Edita una zona existente** o **crea una nueva zona**
3. **Busca la sección "Prioridades de Tarifa"** (con fondo gris claro)
4. **Configura las dos opciones:**

#### Servicios normales
- **Tarifa de zona**: Los viajes normales usan la tarifa configurada en esta zona
- **Tarifa general del servicio**: Los viajes normales usan la tarifa base del tipo de servicio

#### Servicios corporativos
- **Tarifa de zona**: Los viajes de empresas respetan la tarifa de esta zona
- **Tarifa negociada de empresa**: Los viajes de empresas usan la tarifa especial negociada con la empresa

### Valores por Defecto

Todas las zonas nuevas tendrán:
- **Servicios normales**: Tarifa de zona
- **Servicios corporativos**: Tarifa de zona

Esto mantiene el comportamiento actual del sistema.

### Visualización

En la lista de zonas, verás badges que indican la configuración actual:
- **Servicios normales**: "Zona" o "Servicio"
- **Servicios corporativos**: "Zona" o "Empresa"

---

## Completamente Automático (por defecto)

Las nuevas opciones vienen con valores por defecto que **preservan el comportamiento actual**. **No requiere cambios inmediatos**.

### Configuración Manual (opcional)

Para cambiar las prioridades, edita cualquier zona en `/geo-zones` y modifica las opciones en la sección "Prioridades de Tarifa".

```sql
UPDATE geo_zones
SET 
  service_tariff_priority = 'service',
  company_tariff_priority = 'company'
WHERE id = 'zona-id-aqui';
```

### Por Interfaz (Próxima versión)

Se planea agregar controles en la interfaz de admin para:
- Editar zonas tarifarias
- Seleccionar prioridades de tarifa
- Visualizar previsualizaciones de precios

---

## Migración a Base de Datos

Se ha creado una migración automática que agrega los dos nuevos campos a la tabla `geo_zones`:

**Archivo:** `migrations/geo_zones_tariff_priority.sql`

**Campos agregados:**
```sql
ALTER TABLE public.geo_zones 
ADD COLUMN service_tariff_priority TEXT DEFAULT 'zone' 
CHECK (service_tariff_priority IN ('zone', 'service'));

ALTER TABLE public.geo_zones 
ADD COLUMN company_tariff_priority TEXT DEFAULT 'zone' 
CHECK (company_tariff_priority IN ('zone', 'company'));
```

---

## Ejemplos de Uso

### Caso 1: Zona Centro Histórico
- Quieres que los turistas normales paguen tarifa de zona (más cara)
- Pero las empresas contratadas paguen su tarifa negociada

```sql
UPDATE geo_zones
SET 
  service_tariff_priority = 'zone',
  company_tariff_priority = 'company'
WHERE name = 'Centro Histórico';
```

### Caso 2: Zona Suburbios
- Quieres que los servicios normales paguen tarifa general del servicio
- Y las empresas también paguen tarifa general (ignorando zona)

```sql
UPDATE geo_zones
SET 
  service_tariff_priority = 'service',
  company_tariff_priority = 'company'
WHERE name = 'Suburbios';
```

### Caso 3: Zona Premium
- Todo mundo paga tarifa de zona (muy restrictivo)

```sql
UPDATE geo_zones
SET 
  service_tariff_priority = 'zone',
  company_tariff_priority = 'zone'
WHERE name = 'Zona Premium';
```

---

## Impacto en Funciones Existentes

Las nuevas funciones en `components/shared/geozone.tsx`:

### `calcPriceForNormalService(zone, serviceType, distanceKm)`
- Calcula precio para servicios NO corporativos
- Considera `service_tariff_priority`
- Parámetros:
  - `zone`: Objeto de zona con tarifa y prioridades
  - `serviceType`: Configuración del servicio
  - `distanceKm`: Distancia en km

### `calcPriceForCorporateService(zone, companyTariff, distanceKm)`
- Calcula precio para servicios corporativos  
- Considera `company_tariff_priority`
- Parámetros:
  - `zone`: Objeto de zona
  - `companyTariff`: Tarifa negociada de la empresa (o null)
  - `distanceKm`: Distancia en km

**Nota:** `calcZonePrice()` sigue existiendo para compatibilidad.

---

## Estados Iniciales

Después de la migración:

```
Todas las zonas existentes tendrán:
- service_tariff_priority = 'zone'
- company_tariff_priority = 'zone'

Esto preserva el comportamiento actual.
```

---

## Próximos Pasos

1. ✅ Migración BD enviada
2. ✅ Lógica actualizada en CreateRideDialog
3. ✅ **Interfaz de configuración agregada**
4. ⏳ Pruebas en staging
5. ⏳ Documentación para usuarios finales

---

## Soporte

Para preguntas sobre este sistema, consulta:
- `components/shared/geozone.tsx` - Funciones de cálculo
- `components/admin/CreateRideDialog.tsx` - Implementación
- `migrations/geo_zones_tariff_priority.sql` - Schema BD
