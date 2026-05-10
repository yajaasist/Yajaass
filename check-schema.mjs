import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://dsruuvvbeudbkdpevgwd.supabase.co'
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
if (!supabaseKey) {
  console.error('❌ NEXT_PUBLIC_SUPABASE_ANON_KEY no configurada')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

try {
  const { data, error } = await supabase
    .from('RideRequest')
    .select('*')
    .limit(1)

  if (error) {
    console.error('❌ Error:', error.message)
  } else if (data && data.length > 0) {
    const record = data[0]
    const keys = Object.keys(record).sort()
    
    console.log('✅ CAMPOS EN RideRequest:')
    keys.forEach((k, i) => {
      const v = record[k]
      const type = v === null ? 'null' : typeof v
      console.log((i+1).toString().padStart(3) + '. ' + k.padEnd(35) + '| ' + type)
    })
    
    console.log('\n📍 BÚSQUEDA CRÍTICA:')
    console.log('cancellation_fee:', 'cancellation_fee' in record ? '✅ EXISTE' : '❌ FALTA')
    
    const cancelFields = keys.filter(k => k.includes('cancel'))
    if (cancelFields.length > 0) {
      console.log('\n⚠️ Campos relacionados con "cancel":')
      cancelFields.forEach(f => console.log('  - ' + f))
    }
  }
} catch (err) {
  console.error('Error:', err.message)
}
