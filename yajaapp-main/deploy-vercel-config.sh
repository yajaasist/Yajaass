#!/bin/bash
# Script de Configuración y Despliegue a Vercel para YAJA

set -e

echo "🚀 YAJA App - Vercel Deployment Configuration"
echo "=============================================="
echo ""

# Colores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Variables de Vercel
VERCEL_TOKEN="${VERCEL_TOKEN:-}"
VERCEL_ORG_ID="${VERCEL_ORG_ID:-}"
VERCEL_PROJECT_ID="${VERCEL_PROJECT_ID:-}"

# Variables de Supabase (ya configuradas en .env.local)
SUPABASE_URL="${NEXT_PUBLIC_SUPABASE_URL:-}"
SUPABASE_ANON_KEY="${NEXT_PUBLIC_SUPABASE_ANON_KEY:-}"
SUPABASE_SERVICE_ROLE_KEY="${SUPABASE_SERVICE_ROLE_KEY:-}"
APP_URL="${NEXT_PUBLIC_APP_URL:-https://yajaassistance.vercel.app}"

echo -e "${BLUE}📋 PASO 1: Verificar Requisitos${NC}"
echo "=================================="

# Verificar que Vercel CLI está instalado
if ! command -v vercel &> /dev/null; then
    echo -e "${RED}❌ Vercel CLI no está instalado${NC}"
    echo "Instala con: npm install -g vercel"
    exit 1
fi
echo -e "${GREEN}✓ Vercel CLI instalado${NC}"

# Verificar Node.js
if ! command -v node &> /dev/null; then
    echo -e "${RED}❌ Node.js no está instalado${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Node.js: $(node --version)${NC}"

# Verificar Git
if ! command -v git &> /dev/null; then
    echo -e "${RED}❌ Git no está instalado${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Git instalado${NC}"

echo ""
echo -e "${BLUE}🔐 PASO 2: Variables de Entorno${NC}"
echo "================================="

# Cargar .env.local
if [ -f .env.local ]; then
    echo -e "${GREEN}✓ Archivo .env.local encontrado${NC}"
    source .env.local
else
    echo -e "${RED}❌ Archivo .env.local no encontrado${NC}"
    echo "Crea un archivo .env.local con tus credenciales de Supabase"
    exit 1
fi

# Mostrar variables configuradas (sin mostrar valores)
if [ -z "$NEXT_PUBLIC_SUPABASE_URL" ]; then
    echo -e "${RED}❌ NEXT_PUBLIC_SUPABASE_URL no configurada${NC}"
else
    echo -e "${GREEN}✓ NEXT_PUBLIC_SUPABASE_URL configurada${NC}"
fi

if [ -z "$NEXT_PUBLIC_SUPABASE_ANON_KEY" ]; then
    echo -e "${RED}❌ NEXT_PUBLIC_SUPABASE_ANON_KEY no configurada${NC}"
else
    echo -e "${GREEN}✓ NEXT_PUBLIC_SUPABASE_ANON_KEY configurada${NC}"
fi

if [ -z "$SUPABASE_SERVICE_ROLE_KEY" ]; then
    echo -e "${RED}❌ SUPABASE_SERVICE_ROLE_KEY no configurada${NC}"
else
    echo -e "${GREEN}✓ SUPABASE_SERVICE_ROLE_KEY configurada${NC}"
fi

echo ""
echo -e "${BLUE}📦 PASO 3: Compilar Proyecto${NC}"
echo "============================="

echo -e "${YELLOW}Compilando...${NC}"
npm run build

echo -e "${GREEN}✓ Compilación exitosa${NC}"

echo ""
echo -e "${BLUE}🌐 PASO 4: Información de Despliegue en Vercel${NC}"
echo "=============================================="

echo ""
echo -e "${YELLOW}OPCIÓN A: Despliegue Automático (Recomendado)${NC}"
echo "1. Ve a: https://vercel.com/dashboard"
echo "2. Haz clic en 'Add New...' → 'Project'"
echo "3. Importa el repositorio: https://github.com/yajaasist/Yajaass"
echo "4. Vercel detectará Next.js automáticamente"
echo "5. Haz clic en 'Deploy'"
echo "6. Una vez desplegado, ve a 'Settings' → 'Environment Variables'"
echo "7. Agrega estas variables:"
echo ""
echo "   NEXT_PUBLIC_SUPABASE_URL=${NEXT_PUBLIC_SUPABASE_URL}"
echo "   NEXT_PUBLIC_SUPABASE_ANON_KEY=<tu anon key>"
echo "   SUPABASE_SERVICE_ROLE_KEY=<tu service role key>"
echo "   NEXT_PUBLIC_APP_URL=<tu dominio de Vercel>"
echo ""

echo -e "${YELLOW}OPCIÓN B: Despliegue con Vercel CLI${NC}"
echo "1. Autentica: vercel login"
echo "2. Deploy: vercel"
echo "3. Selecciona tu proyecto"
echo "4. Sigue las instrucciones"
echo ""

echo -e "${YELLOW}Las siguientes variables se configurarán automáticamente en Vercel:${NC}"
echo "- Build: npm run build"
echo "- Start: npm start"
echo "- Framework: Next.js"
echo ""

echo ""
echo -e "${GREEN}✨ Proyecto listo para despliegue en Vercel${NC}"
echo "============================================"
echo ""
echo -e "${BLUE}Próximos pasos:${NC}"
echo "1. Abre: https://vercel.com"
echo "2. Importa tu repositorio GitHub"
echo "3. Agrega los Environment Variables"
echo "4. Haz deploy"
echo ""
echo -e "${YELLOW}Tiempo estimado: 10-15 minutos${NC}"
echo ""
