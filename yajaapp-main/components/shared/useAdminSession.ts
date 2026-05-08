"use client";

import { useState, useEffect, useCallback } from "react";
import { createPageUrl } from "@/utils";
import { supabaseApi } from "@/lib/supabaseApi";

export const ADMIN_SESSION_KEY = "admin_session_id";
export const PUBLIC_PAGES = ["AdminLogin", "DriverApp", "RoadAssistApp"];
export const ADMIN_ROLE = "admin";

export function getStoredSession() {
  try {
    const raw = localStorage.getItem(ADMIN_SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function clearSession() {
  localStorage.removeItem(ADMIN_SESSION_KEY);
}

export function useAdminSession() {
  const [session, setSession] = useState(getStoredSession);
  const [validated, setValidated] = useState(false);

  useEffect(() => {
    const stored = getStoredSession();
    if (!stored) { setValidated(true); return; }

    supabaseApi.adminUsers.list()
      .then(results => {
        const user = results?.find((u: any) => u.email === stored.email);
        if (!user || user.is_active === false) {
          clearSession();
          setSession(null);
          window.location.href = createPageUrl("AdminLogin");
          return;
        }
        const fresh = {
          id: user.id,
          email: user.email,
          full_name: user.full_name,
          role: user.role,
          allowed_pages: user.allowed_pages || [],
          is_active: user.is_active,
        };
        localStorage.setItem(ADMIN_SESSION_KEY, JSON.stringify(fresh));
        setSession(fresh);
        setValidated(true);
      })
      .catch(() => setValidated(true));
  }, []);

  const isAllowed = useCallback((page: string) => {
    if (PUBLIC_PAGES.includes(page)) return true;
    if (!session) return false;
    if (session.role === ADMIN_ROLE) return true;
    return (session.allowed_pages || []).includes(page);
  }, [session]);

  const logout = useCallback(() => {
    clearSession();
    window.location.href = createPageUrl("AdminLogin");
  }, []);

  return { session, validated, isAllowed, logout };
}

// Helper function to get JWT token from session
export function getStoredToken(): string | null {
  const session = getStoredSession();
  const token = session?.token;
  
  // Explicitly handle empty strings and undefined
  if (!token || token === '' || typeof token !== 'string') {
    return null;
  }
  
  return token;
}