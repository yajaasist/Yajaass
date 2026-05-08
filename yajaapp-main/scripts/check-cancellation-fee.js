const https = require('https');

const supabaseUrl = 'https://dsruuvvbeudbkdpevgwd.supabase.co';
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

console.log('📋 Verificando si cancellation_fee existe en RideRequest...\n');

const options = {
  hostname: 'dsruuvvbeudbkdpevgwd.supabase.co',
  port: 443,
  path: '/rest/v1/RideRequest?limit=1&select=*',
  method: 'GET',
  headers: {
    'Authorization': `Bearer ${anonKey}`,
    'apikey': anonKey,
    'Content-Type': 'application/json'
  }
};

const req = https.request(options, (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    if (res.statusCode === 200) {
      try {
        const records = JSON.parse(data);
        if (records.length > 0) {
          const record = records[0];
          const allKeys = Object.keys(record).sort();
          
          console.log('✅ TODOS LOS CAMPOS EN RideRequest:');
          allKeys.forEach((key, idx) => {
            const value = record[key];
            const type = value === null ? 'null' : typeof value;
            const example = String(value).substring(0, 30);
            console.log(`  ${(idx+1).toString().padStart(2)}. ${key.padEnd(30)} | Tipo: ${type.padEnd(8)} | Val: ${example}`);
          });
          
          console.log('\n📍 BÚSQUEDA DE CANCELLATION_FEE:');
          const hasCancellationFee = 'cancellation_fee' in record;
          if (hasCancellationFee) {
            console.log(`✅ EXISTE: cancellation_fee = ${record.cancellation_fee}`);
          } else {
            console.log(`❌ NO EXISTE: cancellation_fee`);
            console.log('\n⚠️ CAMPOS SIMILARES:');
            allKeys.filter(k => k.includes('cancel')).forEach(k => {
              console.log(`   - ${k}: ${record[k]}`);
            });
          }
        }
      } catch (e) {
        console.error('Error parsing response:', e.message);
      }
    } else {
      console.error(`Error: ${res.statusCode}`);
      console.log(data);
    }
  });
});

req.on('error', e => console.error('Request error:', e.message));
req.end();
