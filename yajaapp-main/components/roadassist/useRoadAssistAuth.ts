"use client";

import { useCallback, useEffect, useState } from "react";
import { supabaseApi } from "@/lib/supabaseApi";

const SESSION_KEY = "ra_user_session";

export interface RoadAssistUser {
  id: string;
  email?: string;
  full_name?: string;
  phone?: string;
  [key: string]: any;
}

export function useRoadAssistAuth() {
  const [user, setUser] = useState<RoadAssistUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadUser = async () => {
      try {
        const savedId = localStorage.getItem(SESSION_KEY);
        if (!savedId) {
          setLoading(false);
          return;
        }

        const result = await supabaseApi.passengers.get(savedId);
        if (result) {
          setUser(result);
        } else {
          localStorage.removeItem(SESSION_KEY);
        }
      } catch (err) {
        console.error("Auth error:", err);
        localStorage.removeItem(SESSION_KEY);
      } finally {
        setLoading(false);
      }
    };

    loadUser();
  }, []);

  const login = useCallback((nextUser: RoadAssistUser) => {
    localStorage.setItem(SESSION_KEY, nextUser.id);
    setUser(nextUser);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(SESSION_KEY);
    setUser(null);
  }, []);

  const refreshUser = useCallback(async () => {
    if (!user?.id) return;
    try {
      const result = await supabaseApi.passengers.get(user.id);
      if (result) setUser(result);
    } catch (err) {
      console.error("Refresh user error:", err);
    }
  }, [user?.id]);

  return { user, setUser, login, logout, loading, refreshUser };
}