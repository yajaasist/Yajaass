#!/bin/bash
# Script de despliegue a producción for YAJA App

set -e

echo "🚀 YAJA App - Production Deployment Checklist"
echo "================================================"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "\n${YELLOW}📋 PASO 1: Verificar Variables de Entorno${NC}"
echo "Necesarias las siguientes variables en .env.local:"
echo "  ✓ NEXT_PUBLIC_SUPABASE_URL"
echo "  ✓ NEXT_PUBLIC_SUPABASE_ANON_KEY"
echo "  ✓ SUPABASE_SERVICE_ROLE_KEY"
echo "  ✓ NEXT_PUBLIC_APP_URL"

# Check if .env.local exists
if [ ! -f .env.local ]; then
    echo -e "${RED}❌ Archivo .env.local no encontrado${NC}"
    exit 1
fi

# Check required variables
for var in NEXT_PUBLIC_SUPABASE_URL NEXT_PUBLIC_SUPABASE_ANON_KEY SUPABASE_SERVICE_ROLE_KEY NEXT_PUBLIC_APP_URL; do
    if ! grep -q "^${var}=" .env.local; then
        echo -e "${RED}❌ Variable $var no configurada en .env.local${NC}"
    else
        echo -e "${GREEN}✓ $var configurada${NC}"
    fi
done

echo -e "\n${YELLOW}📦 PASO 2: Instalar Dependencias${NC}"
npm install

echo -e "\n${YELLOW}🔨 PASO 3: Compilar para Producción${NC}"
npm run build

echo -e "\n${YELLOW}✅ PASO 4: Verificación Final${NC}"
if [ -d .next ]; then
    echo -e "${GREEN}✓ Build exitoso - directorio .next creado${NC}"
    BUILD_SIZE=$(du -sh .next | cut -f1)
    echo "  Tamaño del build: $BUILD_SIZE"
else
    echo -e "${RED}❌ Error en la compilación${NC}"
    exit 1
fi

echo -e "\n${YELLOW}🌐 PASO 5: Configuración de Vercel${NC}"
echo "Para desplegar en Vercel:"
echo "1. Ve a https://vercel.com"
echo "2. Conecta tu repositorio GitHub"
echo "3. Importa este proyecto"
echo "4. En Settings → Environment Variables, agrega:"
echo ""
echo "NEXT_PUBLIC_SUPABASE_URL=<tu-url>"
echo "NEXT_PUBLIC_SUPABASE_ANON_KEY=<tu-key>"
echo "SUPABASE_SERVICE_ROLE_KEY=<tu-service-key>"
echo "NEXT_PUBLIC_APP_URL=<tu-dominio-produccion>"
echo ""
echo "5. Haz deploy"

echo -e "\n${YELLOW}📊 PASO 6: Verificar Supabase${NC}"
echo "Checklist de Supabase:"
echo "  [ ] Proyecto creado en supabase.com"
echo "  [ ] Schema importado (migrations/schema.sql)"
echo "  [ ] RLS habilitado en tablas críticas"
echo "  [ ] Edge Functions creadas (assign-driver, calculate-fare)"
echo ""
echo "Ubicación de credenciales:"
echo "  URL: Supabase Dashboard → Settings → API → Project URL"
echo "  Anon Key: Supabase Dashboard → Settings → API → anon public"
echo "  Service Key: Supabase Dashboard → Settings → API → service_role"

echo -e "\n${GREEN}✨ Proyecto listo para producción!${NC}"
echo "====================================================================================="
echo ""
echo "Próximas acciones:"
echo "1. Actualizar NEXT_PUBLIC_APP_URL con tu dominio de producción"
echo "2. Configurar Supabase con tu base de datos real"
echo "3. Desplegar en Vercel"
echo ""
echo "Para iniciar desarrollo local:"
echo "  npm run dev     # http://localhost:3001 (puerto por defecto)"
echo ""
echo "Para iniciar en producción local:"
echo "  npm run build && npm start"
echo ""
