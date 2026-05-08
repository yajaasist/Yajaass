#!/usr/bin/env node
/**
 * Inspecciona estructura real de Supabase
 * Uso: node scripts/inspect-supabase.js
 */

const https = require('https');

const SUPABASE_URL = 'https://dsruuvvbeudbkdpevgwd.supabase.co';
const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRzcnV1dnZiZXVkYmtkcGV2Z3dkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU3NTMwODAsImV4cCI6MjA5MTMyOTA4MH0.b9pMUsCW8RN6RDLCEPmIJba2CO03BUYJi8UOvfwibCg';

function makeRequest(method, path, body = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(SUPABASE_URL + path);
    const options = {
      hostname: url.hostname,
      port: 443,
      path: url.pathname + url.search,
      method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${ANON_KEY}`,
        'apikey': ANON_KEY,
      },
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          resolve(data);
        }
      });
    });

    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function inspectTable(tableName) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`📋 TABLE: ${tableName}`);
  console.log('='.repeat(60));

  try {
    // Get one row
    const result = await makeRequest('GET', `/rest/v1/${tableName}?limit=1`);
    
    if (Array.isArray(result) && result.length > 0) {
      const row = result[0];
      console.log('\n✅ CAMPOS ENCONTRADOS:');
      Object.keys(row).forEach((key, i) => {
        const value = row[key];
        const type = typeof value;
        const valueDesc = JSON.stringify(value).substring(0, 40);
        console.log(`  ${i + 1}. ${key.padEnd(30)} | Tipo: ${type.padEnd(10)} | Ejemplo: ${valueDesc}`);
      });
    } else if (Array.isArray(result)) {
      console.log('⚠️  Tabla vacía - No hay datos para inspeccionar');
    } else {
      console.log('❌ Error:', result);
    }
  } catch (err) {
    console.log('❌ Error al inspeccionar:', err.message);
  }
}

async function main() {
  console.log('🔍 INSPECCIONA ESTRUCTURA REAL DE SUPABASE');
  console.log(`🌐 URL: ${SUPABASE_URL}`);

  // Tablas críticas a inspeccionar
  const tables = ['AppSettings', 'RideRequest', 'Driver', 'City'];

  for (const table of tables) {
    await inspectTable(table);
  }

  console.log('\n' + '='.repeat(60));
  console.log('📊 INSPECCIÓN COMPLETADA');
  console.log('='.repeat(60));
}

main().catch(console.error);
