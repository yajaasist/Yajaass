"use client";
export const dynamic = 'force-dynamic';

import React, { useState, useEffect, useRef } from "react";
import Layout from "@/components/admin/Layout";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { supabaseApi } from "@/lib/supabaseApi";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Search, Filter, AlertTriangle, UserCheck, ChevronRight, Wifi, CalendarClock, Calendar, ArrowUpDown } from "lucide-react";
import Link from "next/link";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import DashboardStats from "@/components/admin/DashboardStats";
import RideTable from "@/components/admin/RideTable";
import AssignDriverDialog from "@/components/admin/AssignDriverDialog";
import CreateRideDialog from "@/components/admin/CreateRideDialog";
import CancelRideDialog from "@/components/admin/CancelRideDialog";
import ETAModal from "@/components/admin/ETAModal";
import { todayCDMX, startOfDayCDMX, endOfDayCDMX, formatCDMX, nowCDMX, futureCDMX } from "@/components/shared/dateUtils";
import { toast } from "sonner";
import { useAdminSession } from "@/components/shared/useAdminSession";

export default function Dashboard() {
  const [search, setSearch] = useState("");
  const { isAllowed } = useAdminSession();
  const [statusFilter, setStatusFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState(todayCDMX());
  const [timeRange, setTimeRange] = useState("today");
  const [sortBy, setSortBy] = useState("date_desc"); // P7: Custom sorting
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false); // P3: Advanced filters panel
  const [advancedFilters, setAdvancedFilters] = useState({ // P3: Advanced filter states
    drivers: [],
    serviceTypes: [],
    cities: [],
    paymentMethods: [],
    priceMin: "",
    priceMax: "",
  });
  const [assignRide, setAssignRide] = useState(null);
  const [cancelRide, setCancelRide] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [manualAssignPrompt, setManualAssignPrompt] = useState(null);
  const [etaModalData, setEtaModalData] = useState(null);
  const queryClient = useQueryClient();

  const { data: sosAlerts = [] } = useQuery({
    queryKey: ["sosAlerts"],
    queryFn: async () => {
      try {
        return await supabaseApi.sosAlerts.list();
      } catch { return []; }
    },
    staleTime: 60 * 1000, // 1 minute - has real-time subscription
    gcTime: 10 * 60 * 1000,
  });

  const { data: rides = [] } = useQuery({
    queryKey: ["rides"],
    queryFn: async () => {
      try {
        return await supabaseApi.rideRequests.list();
      } catch { return []; }
    },
    staleTime: 30 * 1000,
    gcTime: 10 * 60 * 1000,
  });

  const { data: drivers = [] } = useQuery({
    queryKey: ["drivers"],
    queryFn: async () => {
      try {
        return await supabaseApi.drivers.list();
      } catch { return []; }
    },
    staleTime: 30 * 1000, // Increased from 5s to 30s - we have real-time updates via subscription
    gcTime: 10 * 60 * 1000,
    refetchInterval: undefined, // Removed - subscription handles updates
  });

  const { data: cities = [] } = useQuery({
    queryKey: ["cities"],
    queryFn: async () => {
      try {
        return await supabaseApi.cities.list();
      } catch { return []; }
    },
    staleTime: 30 * 60 * 1000, // 30 minutes - rarely changes
    gcTime: 60 * 60 * 1000,
  });

  const { data: geoZones = [] } = useQuery({
    queryKey: ["geoZones"],
    queryFn: async () => {
      try {
        return await supabaseApi.geoZones.list();
      } catch { return []; }
    },
    staleTime: 30 * 60 * 1000, // 30 minutes - rarely changes
    gcTime: 60 * 60 * 1000,
  });

  const { data: serviceTypes = [] } = useQuery({
    queryKey: ["serviceTypes"],
    queryFn: async () => {
      try {
        return await supabaseApi.serviceTypes.list();
      } catch { return []; }
    },
    staleTime: 30 * 60 * 1000, // 30 minutes - rarely changes
    gcTime: 60 * 60 * 1000,
  });

  const { data: policies = [] } = useQuery({
    queryKey: ["policies"],
    queryFn: async () => {
      try {
        return await supabaseApi.cancellationPolicies.list();
      } catch { return []; }
    },
    staleTime: 30 * 60 * 1000, // 30 minutes - rarely changes
    gcTime: 60 * 60 * 1000,
  });

  const { data: settingsList = [] } = useQuery({
    queryKey: ["appSettings"],
    queryFn: async () => {
      try {
        return await supabaseApi.settings.list();
      } catch { return []; }
    },
    staleTime: 30 * 60 * 1000, // 30 minutes - rarely changes
    gcTime: 60 * 60 * 1000,
  });

  const settings = settingsList[0] || {};

  useEffect(() => {
    const channel = supabase.channel("drivers_changes").on(
      "postgres_changes",
      { event: "*", schema: "public", table: "Driver" },
      (payload: any) => {
        queryClient.setQueryData(["drivers"], (old: any = []) => {
          if (payload.eventType === "DELETE") return old.filter((d: any) => d.id !== payload.old.id);
          if (payload.eventType === "INSERT") return [...old, payload.new];
          if (payload.eventType === "UPDATE") return old.map((d: any) => d.id === payload.new.id ? payload.new : d);
          return old;
        });
      }
    ).subscribe();
    return () => { channel.unsubscribe(); };
  }, [queryClient]);

  useEffect(() => {
    const channel = supabase.channel("sos_changes").on(
      "postgres_changes",
      { event: "*", schema: "public", table: "sos_alerts" },
      (payload: any) => {
        queryClient.setQueryData(["sosAlerts"], (old: any = []) => {
          if (payload.eventType === "DELETE") {
            return old.filter((s: any) => s.id !== payload.old.id);
          }
          if (payload.eventType === "UPDATE") {
            // Keep only active alerts
            const updated = old.map((s: any) =>
              s.id === payload.new.id ? payload.new : s
            );
            return updated.filter((s: any) => s.status === "active");
          }
          if (payload.eventType === "INSERT" && payload.new?.status === "active") {
            return [...old, payload.new];
          }
          return old;
        });
      }
    ).subscribe();
    return () => { channel.unsubscribe(); };
  }, [queryClient]);

  const ridesRef = useRef(rides);
  ridesRef.current = rides;
  const driversRef = useRef(drivers);
  driversRef.current = drivers;
  const dismissedEtaRideIdsRef = useRef(new Set<string>());

  const resolveModalDriver = (rideLike: any) => {
    const id = rideLike?.driver_id;
    if (!id) return null;
    const found = driversRef.current.find((dr: any) => dr.id === id);
    if (found) return found;
    return { id, full_name: rideLike?.driver_name || "Conductor" };
  };

  const hasDriverAccepted = (rideLike: any) => {
    if (!rideLike) return false;
    const acceptedByTimestamp = !!(
      rideLike.driver_accepted_at ||
      rideLike.en_route_at ||
      rideLike.arrived_at ||
      rideLike.in_progress_at
    );
    const acceptedByStatus = ["admin_approved", "en_route", "arrived", "in_progress"].includes(rideLike.status || "");
    return acceptedByTimestamp || acceptedByStatus;
  };

  useEffect(() => {
    const unsub = supabase.channel("rides_changes").on(
      "postgres_changes",
      { event: "*", schema: "public", table: "ride_requests" },
      async (payload: any) => {
        if (payload.eventType === "INSERT") {
          const event = payload.new;
          const isPassengerAppRide = !!event.passenger_user_id;
          if (!isPassengerAppRide && event.status === "pending" && event.assignment_mode !== "manual") {
            setEtaModalData({ ride: event, driver: null, phase: "searching" });
          }
          if (!isPassengerAppRide && event.status === "auction") {
            setEtaModalData({ ride: event, driver: null, phase: "searching" });
          }
          if (event.assignment_mode === "manual" && event.status === "pending") {
            setAssignRide(event);
          }
          // Update rides data instead of invalidating
          queryClient.setQueryData(["rides"], (old: any = []) => [...old, event]);
        }
        if (payload.eventType === "UPDATE") {
          const d = payload.new;
          const prevRide = ridesRef.current.find((r: any) => r.id === d?.id);
          const prevStatus = prevRide?.status;
          const isPassengerAppRide = !!d?.passenger_user_id;
          const fullRide = prevRide ? { ...prevRide, ...d } : d;

          // Update rides data first (atomic update)
          queryClient.setQueryData(["rides"], (old: any = []) =>
            old.map((r: any) => r.id === d.id ? { ...r, ...d } : r)
          );

          // Handle ETA modal transitions - simplified logic
          if (["cancelled", "completed"].includes(d?.status)) {
            dismissedEtaRideIdsRef.current.delete(d.id);
            // Terminal states: close modal if this ride
            setEtaModalData((prev: any) => prev?.ride?.id === d.id ? null : prev);
            return;
          }

          if (d?.status === "no_drivers") {
            if (isPassengerAppRide) {
              setEtaModalData((prev: any) => prev?.ride?.id === d.id ? null : prev);
              return;
            }
            setEtaModalData({ ride: fullRide, driver: null, phase: "no_drivers" });
            return;
          }

          if (d?.status === "pending" && d?.assignment_mode === "manual" && d?.manual_assignment_requested_at) {
            const noAcceptanceFallback = /nadie\s+acept[oó]\s+el\s+viaje/i.test(d?.cancellation_reason || "");

            if (noAcceptanceFallback) {
              setEtaModalData({ ride: fullRide, driver: null, phase: "no_acceptance" });
            } else {
              setAssignRide(fullRide);
            }
            return;
          }

          if ((d?.status === "auction" || d?.status === "pending") && !d?.passenger_user_id) {
            if (dismissedEtaRideIdsRef.current.has(d.id)) return;
            setEtaModalData((prev: any) => {
              if (prev?.ride?.id === d.id) {
                return { ...prev, ride: fullRide, phase: "searching" };
              }
              if (!prev && d?.status === "auction") {
                return { ride: fullRide, driver: null, phase: "searching" };
              }
              return prev;
            });
            return;
          }

          const acceptedWithDriver = !isPassengerAppRide && !!d?.driver_id && hasDriverAccepted(fullRide);
          if (acceptedWithDriver) {
            dismissedEtaRideIdsRef.current.delete(d.id);
            const instantDriver = resolveModalDriver(fullRide);
            if (instantDriver) setEtaModalData({ ride: fullRide, driver: instantDriver, phase: "assigned" });

            const fetched = await supabaseApi.drivers.get(d.driver_id).catch(() => null);
            if (fetched) setEtaModalData({ ride: fullRide, driver: fetched, phase: "assigned" });
            return;
          }

          if (d?.status === "assigned" && d?.driver_id && !isPassengerAppRide) {
            const driverAccepted = hasDriverAccepted(fullRide);
            const waitingPhase = d?.assignment_mode === "manual" ? "waiting_acceptance" : "searching";
            
            if (driverAccepted) {
              dismissedEtaRideIdsRef.current.delete(d.id);
              // Mostrar inmediatamente el modal de asignación, incluso si el driver aún no está en caché.
              const instantDriver = resolveModalDriver(fullRide);
              if (instantDriver) setEtaModalData({ ride: fullRide, driver: instantDriver, phase: "assigned" });

              const fetched = await supabaseApi.drivers.get(d.driver_id).catch(() => null);
              if (fetched) setEtaModalData({ ride: fullRide, driver: fetched, phase: "assigned" });
            } else {
              if (waitingPhase === "searching" && dismissedEtaRideIdsRef.current.has(d.id)) return;
              setEtaModalData((prev: any) => {
                if (prev?.ride?.id === d.id) {
                  return { ...prev, ride: fullRide, phase: waitingPhase };
                }
                return { ride: fullRide, driver: null, phase: waitingPhase };
              });
            }
          }
        }
      }
    ).subscribe();
    return () => { unsub.unsubscribe(); };
  }, [queryClient]);

  useEffect(() => {
    // Check for unassigned rides every 15 seconds (less aggressive than 10s)
    const check = () => {
      const now = Date.now();
      const unassigned = rides.find((r: any) =>
        (r.status === "pending" || r.status === "auction") &&
        !r.driver_id &&
        !r.scheduled_time &&
        (now - new Date(r.requested_at).getTime()) > 60000
      );
      
      // Only update if it actually changed to avoid flickering
      if (unassigned) {
        setManualAssignPrompt((prev) => prev?.id === unassigned.id ? prev : unassigned);
      } else {
        setManualAssignPrompt((prev) => prev ? null : prev);
      }
    };
    
    const id = setInterval(check, 15000);
    check(); // Initial check
    return () => clearInterval(id);
  }, [rides]);

  useEffect(() => {
    const currentRideId = etaModalData?.ride?.id;
    if (!currentRideId) return;
    if (!["searching", "waiting_acceptance"].includes(etaModalData?.phase)) return;

    const current = rides.find((r: any) => r.id === currentRideId);
    if (!current) return;

    const driverAccepted = hasDriverAccepted(current);
    if (!current.driver_id || !driverAccepted) return;

    const instantDriver = resolveModalDriver(current);
    if (instantDriver) setEtaModalData({ ride: current, driver: instantDriver, phase: "assigned" });

    supabaseApi.drivers.get(current.driver_id)
      .then((fetched) => {
        if (fetched) setEtaModalData({ ride: current, driver: fetched, phase: "assigned" });
      })
      .catch(() => {});
  }, [etaModalData, rides, drivers]);

  useEffect(() => {
    if (etaModalData) return;

    const active = rides.find((r: any) => {
      if (!r || r.passenger_user_id) return false;
      if (["cancelled", "completed"].includes(r.status)) return false;

      const driverAccepted = !!(r.driver_accepted_at || r.en_route_at || r.arrived_at || r.in_progress_at);
      const searching = (r.status === "pending" || r.status === "auction") && r.assignment_mode !== "manual";
      const assignedWaiting = r.status === "assigned" && r.driver_id && !driverAccepted;

      if (searching && dismissedEtaRideIdsRef.current.has(r.id)) return false;
      if (assignedWaiting && r.assignment_mode !== "manual" && dismissedEtaRideIdsRef.current.has(r.id)) return false;

      return searching || assignedWaiting;
    });

    if (!active) return;

    const driverAccepted = !!(active.driver_accepted_at || active.en_route_at || active.arrived_at || active.in_progress_at);
    if (driverAccepted && active.driver_id) {
      const instantDriver = resolveModalDriver(active);
      if (instantDriver) {
        setEtaModalData({ ride: active, driver: instantDriver, phase: "assigned" });
      }
      return;
    }

    const phase = active.assignment_mode === "manual" ? "waiting_acceptance" : "searching";
    setEtaModalData({ ride: active, driver: null, phase });
  }, [etaModalData, rides, drivers]);

  const handleUpdateStatus = async (ride: any, newStatus: string) => {
    const now = nowCDMX();
    const updates: any = { status: newStatus };
    if (newStatus === "en_route") updates.en_route_at = now;
    if (newStatus === "arrived") updates.arrived_at = now;
    if (newStatus === "admin_approved") updates.in_progress_at = now;
    if (newStatus === "in_progress") updates.in_progress_at = now;
    if (newStatus === "completed") updates.completed_at = now;
    if (newStatus === "completed") {
      const driver = drivers.find((d: any) => d.id === ride.driver_id);
      const commissionRate = ride.commission_rate ?? driver?.commission_rate ?? (settings as any)?.platform_commission_pct ?? 20;
      const basePrice = ride.estimated_price || 0;
      const extras = Array.isArray(ride.extra_charges) ? ride.extra_charges : [];
      const totalExtras = extras.reduce((s: number, c: any) => s + (parseFloat(c.amount) || 0), 0);
      const extrasForDriver = extras.filter((c: any) => c.paid_to_driver).reduce((s: number, c: any) => s + (parseFloat(c.amount) || 0), 0);
      const extrasWithCommission = extras.filter((c: any) => !c.paid_to_driver).reduce((s: number, c: any) => s + (parseFloat(c.amount) || 0), 0);
      const finalPrice = basePrice + totalExtras;
      const commissionableAmount = basePrice + extrasWithCommission;
      const commission = parseFloat((commissionableAmount * commissionRate / 100).toFixed(2));
      const netEarnings = parseFloat((commissionableAmount - commission + extrasForDriver).toFixed(2));
      updates.final_price = finalPrice;
      updates.driver_earnings = netEarnings;
      updates.platform_commission = commission;
      updates.commission_rate = commissionRate;
      const ratingWindowMinutes = (settings as any)?.rating_window_minutes ?? 60;
      updates.rating_window_expires_at = futureCDMX(ratingWindowMinutes * 60 * 1000);
    }
    try {
      await supabaseApi.rideRequests.update(ride.id, updates);
      
      // Update rides cache directly instead of invalidating
      queryClient.setQueryData(["rides"], (old: any = []) =>
        old.map((r: any) => r.id === ride.id ? { ...r, ...updates } : r)
      );

      if ((newStatus === "completed" || newStatus === "cancelled") && ride.driver_id) {
        const driver = drivers.find((d: any) => d.id === ride.driver_id);
        const otherActive = rides.filter((r: any) =>
          r.driver_id === ride.driver_id && r.id !== ride.id && !["completed", "cancelled"].includes(r.status)
        );
        if (otherActive.length === 0) {
          const driverUpdates: any = { status: "available" };
          if (newStatus === "completed") {
            driverUpdates.total_rides = (driver?.total_rides || 0) + 1;
            driverUpdates.total_earnings = (driver?.total_earnings || 0) + (updates.driver_earnings || 0);
          }
          await supabaseApi.drivers.update(ride.driver_id, driverUpdates);
          
          // Update drivers cache directly
          queryClient.setQueryData(["drivers"], (old: any = []) =>
            old.map((d: any) => d.id === ride.driver_id ? { ...d, ...driverUpdates } : d)
          );
        }
      }
    } catch (error) {
      toast.error("Error al actualizar viaje");
    }
  };

  // P4: Calculate date range based on timeRange selector
  const getDateRangeFromSelector = () => {
    const now = new Date();
    let start, end;
    
    switch (timeRange) {
      case "last24h":
        start = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        end = now;
        break;
      case "last7d":
        start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        end = now;
        break;
      case "last30d":
        start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        end = now;
        break;
      case "custom":
        start = startOfDayCDMX(dateFilter);
        end = endOfDayCDMX(dateFilter);
        break;
      default: // today
        start = startOfDayCDMX(todayCDMX());
        end = endOfDayCDMX(todayCDMX());
    }
    
    return { start, end };
  };

  const { start: dayStart, end: dayEnd } = getDateRangeFromSelector();
  const ACTIVE_STATUSES = ["pending", "scheduled", "auction", "no_drivers", "assigned", "admin_approved", "en_route", "arrived", "in_progress"];

  const filtered = rides.filter((r: any) => {
    const matchSearch = !search ||
      (r.passenger_name || "").toLowerCase().includes(search.toLowerCase()) ||
      (String(r.passenger_phone) || "").toLowerCase().includes(search.toLowerCase()) ||
      (r.driver_name || "").toLowerCase().includes(search.toLowerCase()) ||
      (String(r.driver_phone) || "").toLowerCase().includes(search.toLowerCase()) ||
      (r.pickup_address || "").toLowerCase().includes(search.toLowerCase()) ||
      (r.dropoff_address || "").toLowerCase().includes(search.toLowerCase()) ||
      (r.id || "").toLowerCase().includes(search.toLowerCase());

    const matchStatus = statusFilter === "all" || r.status === statusFilter;

    // P3: Advanced filters
    const matchDriver = advancedFilters.drivers.length === 0 || advancedFilters.drivers.includes(r.driver_id);
    const matchServiceType = advancedFilters.serviceTypes.length === 0 || advancedFilters.serviceTypes.includes(r.service_type_name);
    const matchCity = advancedFilters.cities.length === 0 || advancedFilters.cities.includes(r.city_name);
    const matchPaymentMethod = advancedFilters.paymentMethods.length === 0 || advancedFilters.paymentMethods.includes(r.payment_method);
    
    const price = parseFloat(r.final_price || r.estimated_price || 0);
    const minPrice = advancedFilters.priceMin ? parseFloat(advancedFilters.priceMin) : 0;
    const maxPrice = advancedFilters.priceMax ? parseFloat(advancedFilters.priceMax) : Infinity;
    const matchPrice = price >= minPrice && price <= maxPrice;

    // ACTIVE services: Always show, never filter by date (they are happening NOW)
    if (ACTIVE_STATUSES.includes(r.status)) {
      return matchSearch && matchStatus && matchDriver && matchServiceType && matchCity && matchPaymentMethod && matchPrice;
    }

    // HISTORICAL services (completed, cancelled): Filter by date when viewing historical
    const rideDate = new Date(r.requested_at);
    const matchDate = rideDate >= dayStart && rideDate <= dayEnd;

    return matchSearch && matchStatus && matchDate && matchDriver && matchServiceType && matchCity && matchPaymentMethod && matchPrice;
  });

  // P7: Smart sorting based on sortBy
  const getSortedRides = (rides: any[]) => {
    const sortFunc = (a: any, b: any) => {
      switch (sortBy) {
        case "date_asc":
          return new Date(a.requested_at).getTime() - new Date(b.requested_at).getTime();
        case "price_asc":
          return (a.final_price || a.estimated_price || 0) - (b.final_price || b.estimated_price || 0);
        case "price_desc":
          return (b.final_price || b.estimated_price || 0) - (a.final_price || a.estimated_price || 0);
        case "passenger_name":
          return (a.passenger_name || "").localeCompare(b.passenger_name || "");
        case "driver_name":
          return (a.driver_name || "").localeCompare(b.driver_name || "");
        case "date_desc":
        default:
          return new Date(b.completed_at || b.requested_at).getTime() - new Date(a.completed_at || a.requested_at).getTime();
      }
    };

    return [
      ...rides.filter((r: any) => ACTIVE_STATUSES.includes(r.status)).sort(sortFunc),
      ...rides.filter((r: any) => !ACTIVE_STATUSES.includes(r.status)).sort(sortFunc),
    ];
  };

  const sortedFiltered = getSortedRides(filtered);

  // P3: Calculate unique values for advanced filters
  const uniqueCities = [...new Set(rides.map((r: any) => r.city_name).filter(Boolean))].sort();
  const uniqueServiceTypes = [...new Set(rides.map((r: any) => r.service_type_name).filter(Boolean))].sort();
  const uniqueDrivers = [...new Set(rides.map((r: any) => r.driver_id))]
    .filter(Boolean)
    .map((id: string) => {
      const driver = drivers.find((d: any) => d.id === id);
      return { id, name: driver?.full_name || "Driver " + id };
    });


  return (
    <Layout currentPageName="Dashboard">
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Panel de control</h1>
            <p className="text-sm text-slate-400 mt-0.5">
              {rides.filter((r: any) => !["completed", "cancelled"].includes(r.status)).length} viajes activos · {sortedFiltered.length} mostrados · {rides.length} totales
              {sortedFiltered.length !== rides.length && <span className="ml-2 text-blue-600 font-medium">({Math.round(sortedFiltered.length/rides.length*100)}% filtrados)</span>}
            </p>
          </div>
          <div className="flex gap-2">
            <Link href="/live-drivers">
              <Button variant="outline" className="rounded-xl shadow-sm border-emerald-200 text-emerald-700 hover:bg-emerald-50">
                <Wifi className="w-4 h-4 mr-2" /> EN VIVO
              </Button>
            </Link>
            <Button onClick={() => setShowCreate(true)} className="rounded-xl shadow-sm bg-blue-600 hover:bg-blue-700">
              <Plus className="w-4 h-4 mr-2" /> Nuevo viaje
            </Button>
          </div>
        </div>

        {(() => {
          const today = todayCDMX();
          const todayStart = startOfDayCDMX(today);
          const todayEnd = endOfDayCDMX(today);
          const completedToday = rides.filter((r: any) =>
            r.status === "completed" &&
            new Date(r.completed_at || r.requested_at) >= todayStart &&
            new Date(r.completed_at || r.requested_at) < todayEnd
          ).length;
          const pendingScheduled = rides.filter((r: any) =>
            r.scheduled_time &&
            r.status === "scheduled" &&
            !r.driver_id &&
            new Date(r.scheduled_time) >= todayStart &&
            new Date(r.scheduled_time) < todayEnd
          );
          if (pendingScheduled.length === 0) return null;
          return (
            <div className="bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-300 rounded-2xl p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0">
                <CalendarClock className="w-5 h-5 text-emerald-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-emerald-800 text-sm">
                  {pendingScheduled.length} cita{pendingScheduled.length > 1 ? "s" : ""} programada{pendingScheduled.length > 1 ? "s" : ""} hoy pendiente{pendingScheduled.length > 1 ? "s" : ""} de asignar
                  <span className="ml-2 font-normal text-emerald-600">({completedToday} completados hoy · {pendingScheduled.length} sin asignar)</span>
                </p>
                <p className="text-xs text-emerald-600 mt-0.5 truncate">
                  {pendingScheduled.map((r: any) => {
                    const t = new Date(r.scheduled_time);
                    const svc = serviceTypes.find((s: any) => s.name === r.service_type_name);
                    const adv = svc?.advance_assignment_minutes ?? 15;
                    return `${r.passenger_name} · ${formatCDMX(t, "time")} (asigna ${adv}min antes)`;
                  }).join("   |   ")}
                </p>
              </div>
              <Button size="sm" variant="outline" onClick={() => setStatusFilter("scheduled")} className="border-emerald-300 text-emerald-700 hover:bg-emerald-100 rounded-xl text-xs flex-shrink-0">
                Ver
              </Button>
            </div>
          );
        })()}

        {(() => {
          const debtRides = rides.filter((r: any) =>
            (r.payment_status === "debt" || r.payment_reported_unpaid) &&
            !["cancelled"].includes(r.status)
          );
          if (debtRides.length === 0) return null;
          return (
            <Link href="/payment-methods" className="block">
              <div className="bg-gradient-to-r from-orange-500 to-amber-500 rounded-2xl p-4 flex items-center gap-3 hover:opacity-95 transition-opacity shadow-lg shadow-orange-200">
                <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0 animate-pulse">
                  <AlertTriangle className="w-5 h-5 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-white">
                    {debtRides.length} servicio{debtRides.length > 1 ? "s" : ""} con pago pendiente / adeudo
                  </p>
                  <p className="text-sm text-orange-100 truncate">
                    {debtRides.slice(0, 2).map((r: any) => r.passenger_name).join(", ")}
                    {debtRides.length > 2 ? ` y ${debtRides.length - 2} más` : ""}
                    {" "}· Toca para revisar y confirmar
                  </p>
                </div>
                <ChevronRight className="w-5 h-5 text-white/70 flex-shrink-0" />
              </div>
            </Link>
          );
        })()}

        {(() => {
          const reconciliationRides = rides.filter((r: any) => {
            const sec = r?.extra_charges?.offline_security;
            return !!sec?.reconciliation_required;
          });
          if (reconciliationRides.length === 0) return null;
          return (
            <Link href="/offline-reconciliation" className="block">
              <div className="bg-gradient-to-r from-yellow-500 to-amber-500 rounded-2xl p-4 flex items-center gap-3 shadow-lg shadow-amber-200 hover:opacity-95 transition-opacity">
              <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0">
                <AlertTriangle className="w-5 h-5 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-white">
                  {reconciliationRides.length} viaje{reconciliationRides.length > 1 ? "s" : ""} requiere{reconciliationRides.length > 1 ? "n" : ""} conciliación offline
                </p>
                <p className="text-sm text-amber-100 truncate">
                  {reconciliationRides.slice(0, 2).map((r: any) => `${r.passenger_name || "Pasajero"} · #${r.service_id || r.id?.slice(-6)}`).join(", ")}
                  {reconciliationRides.length > 2 ? ` y ${reconciliationRides.length - 2} más` : ""}
                </p>
              </div>
              <Button
                size="sm"
                variant="outline"
                className="border-white/40 text-white hover:bg-white/20 rounded-xl text-xs flex-shrink-0"
              >
                Revisar
              </Button>
              </div>
            </Link>
          );
        })()}

        {sosAlerts.length > 0 && (
          <Link href="/sos-alerts" className="block">
            <div className="bg-gradient-to-r from-red-500 to-rose-600 rounded-2xl p-4 flex items-center gap-3 hover:opacity-95 transition-opacity shadow-lg shadow-red-200">
              <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0">
                <AlertTriangle className="w-5 h-5 text-white" />
              </div>
              <div className="flex-1">
                <p className="font-bold text-white">{sosAlerts.length} Alerta{sosAlerts.length > 1 ? "s" : ""} SOS activa{sosAlerts.length > 1 ? "s" : ""}</p>
                <p className="text-sm text-red-100">Toca para ver y gestionar las alertas</p>
              </div>
              <ChevronRight className="w-5 h-5 text-white/70" />
            </div>
          </Link>
        )}

        {rides.filter((r: any) => r.status === "pending" && r.assignment_mode === "manual" && r.manual_assignment_requested_at && !r.driver_id).map((r: any) => (
          <div key={r.id} className="bg-gradient-to-r from-red-50 to-rose-50 border-2 border-red-400 rounded-2xl p-4 flex items-center gap-3 shadow-md shadow-red-100">
            <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
              <UserCheck className="w-5 h-5 text-red-600" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-red-800 text-sm">⚠️ Pasajero solicita asignación manual</p>
              <p className="text-xs text-red-600 truncate">{r.passenger_name} · {r.pickup_address}</p>
              <p className="text-xs text-red-500 mt-0.5">Sin conductores automáticos disponibles</p>
            </div>
            <Button size="sm" onClick={() => setAssignRide(r)} className="bg-red-600 hover:bg-red-700 rounded-xl text-xs flex-shrink-0">
              Asignar
            </Button>
          </div>
        ))}

        {manualAssignPrompt && !["assigned", "completed", "cancelled"].includes(manualAssignPrompt.status) && (
          <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-2xl p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
              <UserCheck className="w-5 h-5 text-amber-600" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-amber-800 text-sm">Viaje sin asignar por más de 1 minuto</p>
              <p className="text-xs text-amber-600 truncate">{manualAssignPrompt.passenger_name} · {manualAssignPrompt.pickup_address}</p>
            </div>
            <div className="flex gap-2 flex-shrink-0">
              <Button size="sm" onClick={() => { setAssignRide(manualAssignPrompt); setManualAssignPrompt(null); }} className="bg-amber-600 hover:bg-amber-700 rounded-xl text-xs">
                Asignar
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setManualAssignPrompt(null)} className="rounded-xl text-xs text-amber-500">
                Ignorar
              </Button>
            </div>
          </div>
        )}

        <DashboardStats rides={rides} drivers={drivers} selectedDate={dateFilter} />

        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              placeholder="Buscar por pasajero, conductor o dirección..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10 rounded-xl border-slate-200 bg-white"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full sm:w-48 rounded-xl bg-white">
              <Filter className="w-4 h-4 mr-2 text-slate-400" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los estados</SelectItem>
              <SelectItem value="pending">Pendientes</SelectItem>
              <SelectItem value="auction">En subasta</SelectItem>
              <SelectItem value="no_drivers">Sin conductores</SelectItem>
              <SelectItem value="assigned">Asignados</SelectItem>
              <SelectItem value="admin_approved">Esperando inicio</SelectItem>
              <SelectItem value="en_route">En camino</SelectItem>
              <SelectItem value="arrived">Llegó conductor</SelectItem>
              <SelectItem value="in_progress">En curso</SelectItem>
              <SelectItem value="scheduled">Programados</SelectItem>
              <SelectItem value="completed">Completados</SelectItem>
              <SelectItem value="cancelled">Cancelados</SelectItem>
            </SelectContent>
          </Select>
          <Select value={timeRange} onValueChange={setTimeRange}>
            <SelectTrigger className="w-full sm:w-48 rounded-xl bg-white">
              <Calendar className="w-4 h-4 mr-2 text-slate-400" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="today">Hoy</SelectItem>
              <SelectItem value="last24h">Últimas 24h</SelectItem>
              <SelectItem value="last7d">Últimos 7 días</SelectItem>
              <SelectItem value="last30d">Últimos 30 días</SelectItem>
              <SelectItem value="custom">Fecha personalizada</SelectItem>
            </SelectContent>
          </Select>
          {timeRange === "custom" && (
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                type="date"
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                className="pl-9 rounded-xl bg-white w-full sm:w-44"
              />
            </div>
          )}

          {/* P7: Sort selector */}
          <Select value={sortBy} onValueChange={setSortBy}>
            <SelectTrigger className="w-full sm:w-52 rounded-xl bg-white">
              <ArrowUpDown className="w-4 h-4 mr-2 text-slate-400" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="date_desc">Más recientes primero</SelectItem>
              <SelectItem value="date_asc">Más antiguos primero</SelectItem>
              <SelectItem value="price_desc">Mayor precio primero</SelectItem>
              <SelectItem value="price_asc">Menor precio primero</SelectItem>
              <SelectItem value="passenger_name">Nombre pasajero (A-Z)</SelectItem>
              <SelectItem value="driver_name">Nombre conductor (A-Z)</SelectItem>
            </SelectContent>
          </Select>

          {/* P3: Advanced filters toggle */}
          <Button
            variant={showAdvancedFilters ? "default" : "outline"}
            onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
            className="rounded-xl whitespace-nowrap"
          >
            <Filter className="w-4 h-4 mr-2" />
            Filtros avanzados
          </Button>
        </div>

        {/* P3: Advanced filters panel */}
        {showAdvancedFilters && (
          <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* Price range */}
              <div>
                <label className="text-xs font-semibold text-slate-600 block mb-2">Rango de precio</label>
                <div className="flex gap-2">
                  <Input
                    type="number"
                    placeholder="Min"
                    value={advancedFilters.priceMin}
                    onChange={(e) => setAdvancedFilters({ ...advancedFilters, priceMin: e.target.value })}
                    className="flex-1 rounded-lg"
                  />
                  <Input
                    type="number"
                    placeholder="Max"
                    value={advancedFilters.priceMax}
                    onChange={(e) => setAdvancedFilters({ ...advancedFilters, priceMax: e.target.value })}
                    className="flex-1 rounded-lg"
                  />
                </div>
              </div>

              {/* Payment methods */}
              <div>
                <label className="text-xs font-semibold text-slate-600 block mb-2">Métodos de pago</label>
                <div className="flex flex-wrap gap-2">
                  {["cash", "card", "wallet"].map((method) => (
                    <label key={method} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={advancedFilters.paymentMethods.includes(method)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setAdvancedFilters({
                              ...advancedFilters,
                              paymentMethods: [...advancedFilters.paymentMethods, method],
                            });
                          } else {
                            setAdvancedFilters({
                              ...advancedFilters,
                              paymentMethods: advancedFilters.paymentMethods.filter((p) => p !== method),
                            });
                          }
                        }}
                        className="rounded"
                      />
                      <span className="text-sm text-slate-600 capitalize">
                        {method === "cash" ? "Efectivo" : method === "card" ? "Tarjeta" : "Billetera"}
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Cities multi-select */}
              {uniqueCities.length > 0 && (
                <div>
                  <label className="text-xs font-semibold text-slate-600 block mb-2">Ciudades</label>
                  <div className="flex flex-wrap gap-2">
                    {uniqueCities.slice(0, 5).map((city) => (
                      <label key={city} className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={advancedFilters.cities.includes(city)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setAdvancedFilters({
                                ...advancedFilters,
                                cities: [...advancedFilters.cities, city],
                              });
                            } else {
                              setAdvancedFilters({
                                ...advancedFilters,
                                cities: advancedFilters.cities.filter((c) => c !== city),
                              });
                            }
                          }}
                          className="rounded"
                        />
                        <span className="text-sm text-slate-600">{city}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {/* Service types multi-select */}
              {uniqueServiceTypes.length > 0 && (
                <div>
                  <label className="text-xs font-semibold text-slate-600 block mb-2">Tipos de servicio</label>
                  <div className="flex flex-wrap gap-2">
                    {uniqueServiceTypes.slice(0, 5).map((type) => (
                      <label key={type} className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={advancedFilters.serviceTypes.includes(type)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setAdvancedFilters({
                                ...advancedFilters,
                                serviceTypes: [...advancedFilters.serviceTypes, type],
                              });
                            } else {
                              setAdvancedFilters({
                                ...advancedFilters,
                                serviceTypes: advancedFilters.serviceTypes.filter((s) => s !== type),
                              });
                            }
                          }}
                          className="rounded"
                        />
                        <span className="text-sm text-slate-600">{type}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {/* Drivers multi-select */}
              {uniqueDrivers.length > 0 && (
                <div>
                  <label className="text-xs font-semibold text-slate-600 block mb-2">Conductores (Top 5)</label>
                  <div className="flex flex-wrap gap-2">
                    {uniqueDrivers.slice(0, 5).map((driver) => (
                      <label key={driver.id} className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={advancedFilters.drivers.includes(driver.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setAdvancedFilters({
                                ...advancedFilters,
                                drivers: [...advancedFilters.drivers, driver.id],
                              });
                            } else {
                              setAdvancedFilters({
                                ...advancedFilters,
                                drivers: advancedFilters.drivers.filter((d) => d !== driver.id),
                              });
                            }
                          }}
                          className="rounded"
                        />
                        <span className="text-sm text-slate-600">{driver.name}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Clear filters button */}
            {(advancedFilters.drivers.length > 0 ||
              advancedFilters.serviceTypes.length > 0 ||
              advancedFilters.cities.length > 0 ||
              advancedFilters.paymentMethods.length > 0 ||
              advancedFilters.priceMin ||
              advancedFilters.priceMax) && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() =>
                  setAdvancedFilters({
                    drivers: [],
                    serviceTypes: [],
                    cities: [],
                    paymentMethods: [],
                    priceMin: "",
                    priceMax: "",
                  })
                }
                className="text-slate-600"
              >
                Limpiar filtros avanzados
              </Button>
            )}
          </div>
        )}

        <RideTable
          rides={sortedFiltered}
          onAssign={setAssignRide}
          onCancel={setCancelRide}
          onUpdateStatus={handleUpdateStatus}
          onDelete={async (ride: any) => {
            if (!window.confirm(`¿Eliminar el viaje de ${ride.passenger_name}? Esta acción no se puede deshacer.`)) return;
            try {
              await supabaseApi.rideRequests.delete(ride.id);
              // Update cache directly
              queryClient.setQueryData(["rides"], (old: any = []) =>
                old.filter((r: any) => r.id !== ride.id)
              );
            } catch (error) {
              toast.error("Error al eliminar viaje");
            }
          }}
          canEdit={isAllowed('edit_rides')}
          canDelete={isAllowed('delete_rides')}
          drivers={drivers}
          settings={settings}
        />

        <AssignDriverDialog
          ride={assignRide}
          drivers={drivers}
          rides={rides}
          open={!!assignRide}
          onOpenChange={(v) => { if (!v) setAssignRide(null); }}
          onAssigned={(updatedRide: any, driver: any) => {
            setAssignRide(null);
            const driverAccepted = !!(updatedRide?.driver_accepted_at || updatedRide?.en_route_at);
            const waitingPhase = updatedRide?.assignment_mode === "manual" ? "waiting_acceptance" : "searching";
            setEtaModalData({
              ride: updatedRide,
              driver: driverAccepted ? driver : null,
              phase: driverAccepted ? "assigned" : waitingPhase,
            });
          }}
        />

        <ETAModal
          ride={etaModalData?.ride}
          driver={etaModalData?.driver}
          phase={etaModalData?.phase}
          settings={settings}
          open={!!etaModalData}
          onClose={() => {
            const currentRide = etaModalData?.ride;
            const currentPhase = etaModalData?.phase;
            if (currentRide?.id && ["searching", "waiting_acceptance", "no_acceptance"].includes(currentPhase || "")) {
              dismissedEtaRideIdsRef.current.add(currentRide.id);
            }
            setEtaModalData(null);
          }}
          onAssignManual={(ride: any) => { setEtaModalData(null); setAssignRide(ride); }}
        />

        <CancelRideDialog
          ride={cancelRide}
          policies={policies}
          open={!!cancelRide}
          onOpenChange={(open) => !open && setCancelRide(null)}
        />

        <CreateRideDialog
          open={showCreate}
          onOpenChange={setShowCreate}
          serviceTypes={serviceTypes}
          paymentMethods={(settings as any)?.payment_methods}
          onRideCreated={(ride: any) => {
            const isPassengerAppRide = !!ride?.passenger_user_id;
            const isSearchingStatus = ride?.status === "pending" || ride?.status === "auction";
            const isManual = ride?.assignment_mode === "manual";

            if (!isPassengerAppRide && isSearchingStatus && !isManual) {
              setEtaModalData({ ride, driver: null, phase: "searching" });
            }
          }}
        />
      </div>
    </Layout>
  );
}
