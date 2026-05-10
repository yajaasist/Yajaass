/**
 * Hook para realizar fetch con Authorization JWT automáticamente
 * Recupera el token de localStorage y lo agrega a todos los requests
 */

"use client";

import { useAdminSession } from '@/components/shared/useAdminSession';

export function useFetchWithAuth() {
  const { session } = useAdminSession();

  /**
   * Wrapper de fetch que automáticamente agrega Authorization header
   */
  const fetchWithAuth = async (url: string, options?: RequestInit) => {
    const headers = new Headers(options?.headers || {});

    if (session?.token) {
      headers.set('Authorization', `Bearer ${session.token}`);
    }

    return fetch(url, {
      ...options,
      headers,
    });
  };

  return { fetchWithAuth, token: session?.token };
}
