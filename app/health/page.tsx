"use client";

import { useEffect, useState } from 'react';
import { RefreshCw, CheckCircle2, XCircle, AlertCircle, Server } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

export default function HealthCheck() {
  const [status, setStatus] = useState<'loading' | 'ok' | 'error'>('loading');
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string>('');
  const [lastCheck, setLastCheck] = useState<string>('');

  const checkHealth = async () => {
    setStatus('loading');
    setError('');
    
    try {
      const response = await fetch('/api/health');
      const result = await response.json();
      
      if (response.ok) {
        setStatus(result.data?.appSettings?.rows > 0 ? 'ok' : 'error');
        setData(result);
        setLastCheck(new Date().toLocaleTimeString());
      } else {
        setStatus('error');
        setError(result.message || 'Error desconocido');
        setData(result);
      }
    } catch (err: any) {
      setStatus('error');
      setError(err.message || 'Error de conexión');
    }
  };

  useEffect(() => {
    checkHealth();
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 p-6">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white flex items-center gap-3">
            <Server className="w-8 h-8" />
            Diagnóstico de Supabase
          </h1>
          <p className="text-slate-400 mt-2">Verifica que la conexión a Supabase está funcionando correctamente</p>
        </div>

        {/* Status Badge */}
        <Card className="mb-6 p-6 bg-slate-800 border-slate-700">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              {status === 'loading' && (
                <>
                  <RefreshCw className="w-8 h-8 text-blue-400 animate-spin" />
                  <div>
                    <p className="text-white font-semibold">Verificando...</p>
                    <p className="text-sm text-slate-400">Conectando a Supabase</p>
                  </div>
                </>
              )}
              {status === 'ok' && (
                <>
                  <CheckCircle2 className="w-8 h-8 text-emerald-400" />
                  <div>
                    <p className="text-white font-semibold">✅ Supabase Conectado</p>
                    <p className="text-sm text-slate-400">Todas las tablas están respondiendo</p>
                  </div>
                </>
              )}
              {status === 'error' && (
                <>
                  <XCircle className="w-8 h-8 text-red-400" />
                  <div>
                    <p className="text-white font-semibold">❌ Error de Conexión</p>
                    <p className="text-sm text-red-400">{error || 'No se puede conectar a Supabase'}</p>
                  </div>
                </>
              )}
            </div>
            <Button onClick={checkHealth} variant="outline" size="sm" className="text-white border-slate-600 hover:bg-slate-700">
              <RefreshCw className="w-4 h-4 mr-2" />
              Reintentar
            </Button>
          </div>
          {lastCheck && (
            <p className="text-xs text-slate-500 mt-4">Última verificación: {lastCheck}</p>
          )}
        </Card>

        {/* Detailed Results */}
        {data && (
          <div className="space-y-4">
            {/* Environment Variables */}
            <Card className="p-6 bg-slate-800 border-slate-700">
              <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-blue-400" />
                Variables de Entorno
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div className="bg-slate-900 p-3 rounded">
                  <p className="text-slate-400">NEXT_PUBLIC_SUPABASE_URL</p>
                  <p className={data.data ? 'text-emerald-400' : 'text-red-400'}>
                    {data.data ? '✅ Configurada' : '❌ No configurada'}
                  </p>
                </div>
                <div className="bg-slate-900 p-3 rounded">
                  <p className="text-slate-400">NEXT_PUBLIC_SUPABASE_ANON_KEY</p>
                  <p className={data.data ? 'text-emerald-400' : 'text-red-400'}>
                    {data.data ? '✅ Configurada' : '❌ No configurada'}
                  </p>
                </div>
              </div>
            </Card>

            {/* AppSettings */}
            {data.data?.appSettings && (
              <Card className="p-6 bg-slate-800 border-slate-700">
                <h3 className="text-white font-semibold mb-4">AppSettings</h3>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-slate-400">Estado:</p>
                    <span className={data.data.appSettings.status === 'ok' ? 'text-emerald-400' : 'text-red-400'}>
                      {data.data.appSettings.status === 'ok' ? '✅ OK' : '❌ Error'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <p className="text-slate-400">Filas encontradas:</p>
                    <span className="text-white font-mono">{data.data.appSettings.rows}</span>
                  </div>
                  {data.data.appSettings.data && (
                    <div className="mt-4 bg-slate-900 p-3 rounded text-xs">
                      <p className="text-slate-400 mb-2">Datos:</p>
                      <div className="space-y-1">
                        <p className="text-slate-300">
                          ID: <span className="text-cyan-400">{data.data.appSettings.data.id}</span>
                        </p>
                        <p className="text-slate-300">
                          Nombre: <span className="text-cyan-400">{data.data.appSettings.data.company_name}</span>
                        </p>
                        <p className="text-slate-300">
                          Creado: <span className="text-cyan-400">{data.data.appSettings.data.created_at}</span>
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </Card>
            )}

            {/* Drivers */}
            {data.data?.drivers && (
              <Card className="p-6 bg-slate-800 border-slate-700">
                <h3 className="text-white font-semibold mb-4">Drivers</h3>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-slate-400">Estado:</p>
                    <span className={data.data.drivers.status === 'ok' ? 'text-emerald-400' : 'text-red-400'}>
                      {data.data.drivers.status === 'ok' ? '✅ OK' : '❌ Error'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <p className="text-slate-400">Filas encontradas:</p>
                    <span className="text-white font-mono">{data.data.drivers.rows}</span>
                  </div>
                  {data.data.drivers.error && (
                    <div className="mt-2 bg-red-900/20 p-3 rounded text-xs text-red-400">
                      {data.data.drivers.error}
                    </div>
                  )}
                </div>
              </Card>
            )}

            {/* Cities */}
            {data.data?.cities && (
              <Card className="p-6 bg-slate-800 border-slate-700">
                <h3 className="text-white font-semibold mb-4">Cities</h3>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-slate-400">Estado:</p>
                    <span className={data.data.cities.status === 'ok' ? 'text-emerald-400' : 'text-red-400'}>
                      {data.data.cities.status === 'ok' ? '✅ OK' : '❌ Error'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <p className="text-slate-400">Filas encontradas:</p>
                    <span className="text-white font-mono">{data.data.cities.rows}</span>
                  </div>
                  {data.data.cities.error && (
                    <div className="mt-2 bg-red-900/20 p-3 rounded text-xs text-red-400">
                      {data.data.cities.error}
                    </div>
                  )}
                </div>
              </Card>
            )}

            {/* Raw Response */}
            <Card className="p-6 bg-slate-800 border-slate-700">
              <h3 className="text-white font-semibold mb-4">Respuesta Completa</h3>
              <pre className="bg-slate-900 p-4 rounded text-xs text-slate-300 overflow-x-auto max-h-64 overflow-y-auto">
                {JSON.stringify(data, null, 2)}
              </pre>
            </Card>
          </div>
        )}

        {/* Troubleshooting */}
        <Card className="mt-8 p-6 bg-slate-800 border-slate-700">
          <h3 className="text-white font-semibold mb-4">🔧 Solución de Problemas</h3>
          <div className="space-y-3 text-sm text-slate-300">
            <p>✅ Si todo muestra "OK", Supabase está funcionando correctamente.</p>
            <p>❌ Si hay errores, verifica:</p>
            <ul className="list-disc list-inside space-y-2 ml-4">
              <li>Que las variables de entorno en .env.local son correctas</li>
              <li>Que Supabase Dashboard muestra el proyecto como "Online"</li>
              <li>Que tu conexión a internet es estable</li>
              <li>Los permisos RLS de las tablas en Supabase</li>
            </ul>
          </div>
        </Card>
      </div>
    </div>
  );
}
