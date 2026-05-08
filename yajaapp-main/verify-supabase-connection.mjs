import { createClient } from '@supabase/supabase-js'
import * as fs from 'fs'
import * as path from 'path'

const envPath = path.join(process.cwd(), '.env.local')

// Load environment variables
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf-8')
  envContent.split('\n').forEach(line => {
    const parts = line.split('=')
    if (parts.length === 2) {
      const key = parts[0].trim()
      const value = parts[1].trim()
      if (key && value) {
        process.env[key] = value
      }
    }
  })
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

const checks = []

console.log('\n🔍 VERIFICADOR DE CONEXIÓN SUPABASE')
console.log('='.repeat(50))

// Check 1: Variables exist
console.log('\n✓ Verificando variables de entorno...')

if (!supabaseUrl) {
  checks.push({ name: 'NEXT_PUBLIC_SUPABASE_URL', status: 'fail', message: 'No configurada' })
} else {
  checks.push({ name: 'NEXT_PUBLIC_SUPABASE_URL', status: 'pass', message: 'Configurada ✓' })
}

if (!supabaseAnonKey) {
  checks.push({ name: 'NEXT_PUBLIC_SUPABASE_ANON_KEY', status: 'fail', message: 'No configurada' })
} else {
  checks.push({ name: 'NEXT_PUBLIC_SUPABASE_ANON_KEY', status: 'pass', message: 'Configurada ✓' })
}

if (!supabaseServiceKey) {
  checks.push({ name: 'SUPABASE_SERVICE_ROLE_KEY', status: 'fail', message: 'No configurada' })
} else {
  checks.push({ name: 'SUPABASE_SERVICE_ROLE_KEY', status: 'pass', message: 'Configurada ✓' })
}

// Check 2: URL format
if (supabaseUrl) {
  if (supabaseUrl.includes('supabase.co')) {
    checks.push({ name: 'Formato URL', status: 'pass', message: 'URL válida de Supabase ✓' })
  } else {
    checks.push({ name: 'Formato URL', status: 'warn', message: 'URL no parece ser de Supabase' })
  }
}

// Check 3: Try to create client
console.log('\n✓ Inicializando cliente Supabase...')
try {
  if (supabaseUrl && supabaseAnonKey) {
    const supabase = createClient(supabaseUrl, supabaseAnonKey)
    checks.push({ name: 'Cliente Supabase', status: 'pass', message: 'Inicializado correctamente ✓' })
  }
} catch (error) {
  checks.push({ name: 'Cliente Supabase', status: 'fail', message: `Error: ${error?.message}` })
}

// Check 4: Try to connect
console.log('\n✓ Probando conexión a la base de datos...')
if (supabaseUrl && supabaseAnonKey) {
  const supabase = createClient(supabaseUrl, supabaseAnonKey)
  
  supabase
    .from('app_settings')
    .select('*')
    .limit(1)
    .then(() => {
      checks.push({ name: 'Conexión HTTP', status: 'pass', message: 'Conectado a Supabase ✓' })
      showResults()
    })
    .catch((error) => {
      const msg = error?.message || ''
      if (msg.includes('401')) {
        checks.push({ name: 'Conexión HTTP', status: 'fail', message: 'Credenciales inválidas (401)' })
      } else if (msg.includes('404')) {
        checks.push({ name: 'Conexión HTTP', status: 'warn', message: 'Tabla "app_settings" no existe (404)' })
      } else {
        checks.push({ name: 'Conexión HTTP', status: 'fail', message: `Error: ${msg}` })
      }
      showResults()
    })
} else {
  showResults()
}

function showResults() {
  console.log('\n' + '='.repeat(50))
  console.log('📊 RESULTADOS')
  console.log('='.repeat(50))

  checks.forEach(check => {
    const icon = check.status === 'pass' ? '✅' : check.status === 'fail' ? '❌' : '⚠️'
    console.log(`${icon} ${check.name.padEnd(30)} ${check.message}`)
  })

  const failures = checks.filter(c => c.status === 'fail')
  const warnings = checks.filter(c => c.status === 'warn')

  console.log('\n' + '='.repeat(50))
  if (failures.length === 0 && warnings.length === 0) {
    console.log('✅ Todo está correctamente configurado para Supabase')
  } else if (failures.length > 0) {
    console.log(`❌ ${failures.length} problemas detectados. Ver arriba.`)
  } else {
    console.log(`⚠️ ${warnings.length} advertencias. Verifica la configuración de Supabase.`)
  }

  console.log('\n📚 Para desplegar a producción:')
  console.log('1. Verifica que todas las variables están en Vercel')
  console.log('2. Ejecuta: npm run build')
  console.log('3. Vercel desplegará automáticamente')
  console.log('\n')
}
