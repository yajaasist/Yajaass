"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { supabaseApi } from "@/lib/supabaseApi";
import { supabase } from "@/lib/supabase";

/**
 * Returns live badge counts for admin nav items.
 * Fetches sequentially to avoid rate limit errors.
 */
export default function useAdminBadges() {
  const [badges, setBadges] = useState({
    pendingRides: 0,
    openTickets: 0,
    activeAlerts: 0,
    unreadChats: 0,
  });

  const timerRef = useRef(null);
  const isMounted = useRef(true);

  const fetchBadges = useCallback(async () => {
    try {
      const rides = await supabaseApi.rideRequests.list();
      await new Promise(r => setTimeout(r, 150));
      const tickets = await supabaseApi.supportTickets.list();
      await new Promise(r => setTimeout(r, 150));
      const alerts = await supabaseApi.sosAlerts.list();
      await new Promise(r => setTimeout(r, 150));
      const chats = await supabaseApi.chats.list();

      if (!isMounted.current) return;

      const activeRideIds = new Set(
        rides.filter(r => !["completed","cancelled"].includes(r.status)).map(r => r.id)
      );
      setBadges({
        pendingRides: rides.filter(r => ["pending", "auction"].includes(r.status)).length,
        openTickets: tickets.filter(t => t.status === "open").length,
        activeAlerts: alerts.filter(a => a.status === "active").length,
        unreadChats: chats.filter(c =>
          !c.read_by_admin &&
          (c.sender_role === "driver" || c.sender_role === "passenger") &&
          activeRideIds.has(c.ride_id)
        ).length,
      });
    } catch (e: any) {
      console.warn("useAdminBadges fetch error:", e?.message);
    }
  }, []);

  const refresh = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      fetchBadges();
    }, 5000);
  }, [fetchBadges]);

  useEffect(() => {
    isMounted.current = true;

    const initTimer = setTimeout(() => {
      fetchBadges();
    }, 1000);

    const rideChannel = supabase
      .channel("admin_badges_ride_requests")
      .on("postgres_changes", { event: "*", schema: "public", table: "ride_requests" }, refresh)
      .subscribe();
    const ticketChannel = supabase
      .channel("admin_badges_support_tickets")
      .on("postgres_changes", { event: "*", schema: "public", table: "support_tickets" }, refresh)
      .subscribe();
    const alertChannel = supabase
      .channel("admin_badges_sos_alerts")
      .on("postgres_changes", { event: "*", schema: "public", table: "sos_alerts" }, refresh)
      .subscribe();
    const chatChannel = supabase
      .channel("admin_badges_chat_messages")
      .on("postgres_changes", { event: "*", schema: "public", table: "chat_messages" }, refresh)
      .subscribe();

    return () => {
      isMounted.current = false;
      clearTimeout(initTimer);
      supabase.removeChannel(rideChannel);
      supabase.removeChannel(ticketChannel);
      supabase.removeChannel(alertChannel);
      supabase.removeChannel(chatChannel);
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [refresh, fetchBadges]);

  return badges;
}