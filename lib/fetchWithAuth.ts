"use client";

import { getStoredToken } from '@/components/shared/useAdminSession';

/**
 * Fetch wrapper que automáticamente agrega el JWT token en Authorization header
 * Uso: const res = await fetchWithAuth('/api/drivers', { method: 'PATCH', body: ... })
 */
export async function fetchWithAuth(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  const token = getStoredToken();
  
  const headers = new Headers(options.headers || {});
  
  // Agregar Authorization header si tenemos token
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
    console.log('[fetchWithAuth] ✅ Token found, length:', token.length);
  } else {
    const session = localStorage.getItem('admin_session_id');
    const parsed = session ? JSON.parse(session) : null;
    console.warn('[fetchWithAuth] ⚠️ No token found', {
      sessionExists: !!session,
      tokenInSession: !!parsed?.token,
      sessionKeys: parsed ? Object.keys(parsed) : [],
    });
  }
  
  // Mergear headers del usuario
  if (options.headers) {
    if (options.headers instanceof Headers) {
      options.headers.forEach((value, key) => {
        if (key.toLowerCase() !== 'authorization') {
          headers.set(key, value);
        }
      });
    } else if (typeof options.headers === 'object') {
      Object.entries(options.headers).forEach(([key, value]) => {
        if (key.toLowerCase() !== 'authorization') {
          headers.set(key, String(value));
        }
      });
    }
  }
  
  const finalOptions = {
    ...options,
    headers,
  };
  
  console.log(`[fetchWithAuth] ${options.method || 'GET'} ${url} with token`);
  
  try {
    const response = await fetch(url, finalOptions);
    
    // Log respuesta
    if (!response.ok) {
      console.warn(`[fetchWithAuth] ⚠️ Response ${response.status}:`, response.statusText);
    } else {
      console.log(`[fetchWithAuth] ✅ ${response.status} ${response.statusText}`);
    }
    
    return response;
  } catch (error) {
    console.error('[fetchWithAuth] ❌ Fetch failed:', error);
    throw error;
  }
}

/**
 * Hook para usar fetchWithAuth en componentes
 * Desestructura el token y lo pasa al fetch
 */
export function useFetchWithAuth() {
  return async (
    url: string,
    options?: RequestInit
  ): Promise<Response> => {
    return fetchWithAuth(url, options);
  };
}
