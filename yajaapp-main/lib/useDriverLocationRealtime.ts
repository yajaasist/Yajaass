import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useQueryClient } from '@tanstack/react-query';

export interface DriverLocation {
  id: string;
  latitude: number;
  longitude: number;
  last_seen_at: string;
  status?: string;
  full_name?: string;
}

export interface UseDriverLocationOptions {
  driverId?: string | null;
  enabled?: boolean;
  onLocationUpdate?: (location: DriverLocation) => void;
}

export interface UseDriverLocationReturn {
  location: DriverLocation | null;
  isLoading: boolean;
  error: string | null;
  lastUpdate: Date | null;
}

/**
 * Hook global para obtener ubicación de conductor en tiempo real
 * Usa Supabase realtime para actualizaciones instantáneas
 */
export function useDriverLocation({
  driverId,
  enabled = true,
  onLocationUpdate,
}: UseDriverLocationOptions): UseDriverLocationReturn {
  const [location, setLocation] = useState<DriverLocation | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  const queryClient = useQueryClient();
  const channelRef = useRef<any>(null);
  const mountedRef = useRef(true);

  // Limpiar estado al desmontar
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // Función para actualizar ubicación local
  const updateLocation = useCallback((newLocation: DriverLocation) => {
    if (!mountedRef.current) return;

    setLocation(newLocation);
    setLastUpdate(new Date());
    setError(null);

    // Notificar callback si existe
    onLocationUpdate?.(newLocation);
  }, [onLocationUpdate]);

  // Suscribirse a cambios en tiempo real
  useEffect(() => {
    if (!enabled || !driverId) {
      // Limpiar suscripción anterior
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
      setLocation(null);
      setLastUpdate(null);
      return;
    }

    setIsLoading(true);
    setError(null);

    // Crear canal único para este driver
    const channelName = `driver_location:${driverId}:${Date.now()}`;
    const channel = supabase.channel(channelName);

    channel
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'Driver',
          filter: `id=eq.${driverId}`,
        },
        (payload: any) => {
          if (!mountedRef.current) return;

          const updatedDriver = payload.new;
          if (!updatedDriver?.latitude || !updatedDriver?.longitude) return;

          const newLocation: DriverLocation = {
            id: updatedDriver.id,
            latitude: updatedDriver.latitude,
            longitude: updatedDriver.longitude,
            last_seen_at: updatedDriver.last_seen_at || new Date().toISOString(),
            status: updatedDriver.status,
            full_name: updatedDriver.full_name,
          };

          updateLocation(newLocation);
        }
      )
      .subscribe((status) => {
        if (!mountedRef.current) return;

        if (status === 'SUBSCRIBED') {
          setIsLoading(false);
          setError(null);
        } else if (status === 'CHANNEL_ERROR') {
          setError('Error de conexión en tiempo real');
          setIsLoading(false);
        } else if (status === 'TIMED_OUT') {
          setError('Tiempo de espera agotado');
          setIsLoading(false);
        } else if (status === 'CLOSED') {
          setError('Conexión cerrada');
          setIsLoading(false);
        }
      });

    channelRef.current = channel;

    // Cleanup
    return () => {
      if (channel) {
        try {
          supabase.removeChannel(channel);
        } catch (err) {
          console.warn('Error unsubscribing from driver location channel:', err);
        }
      }
      channelRef.current = null;
    };
  }, [driverId, enabled, updateLocation]);

  // Intentar obtener ubicación inicial si no tenemos datos
  useEffect(() => {
    if (!enabled || !driverId || location) return;

    const fetchInitialLocation = async () => {
      try {
        setIsLoading(true);
        const { data: driver, error } = await supabase
          .from('Driver')
          .select('id, latitude, longitude, last_seen_at, status, full_name')
          .eq('id', driverId)
          .single();

        if (error) throw error;

        if (driver?.latitude && driver?.longitude) {
          const initialLocation: DriverLocation = {
            id: driver.id,
            latitude: driver.latitude,
            longitude: driver.longitude,
            last_seen_at: driver.last_seen_at || new Date().toISOString(),
            status: driver.status,
            full_name: driver.full_name,
          };

          updateLocation(initialLocation);
        }
      } catch (err) {
        console.warn('Error fetching initial driver location:', err);
        setError('Error al obtener ubicación inicial');
      } finally {
        if (mountedRef.current) {
          setIsLoading(false);
        }
      }
    };

    // Pequeño delay para evitar llamadas innecesarias durante el mounting
    const timeoutId = setTimeout(fetchInitialLocation, 100);

    return () => clearTimeout(timeoutId);
  }, [driverId, enabled, location, updateLocation]);

  return {
    location,
    isLoading,
    error,
    lastUpdate,
  };
}

/**
 * Hook para múltiples conductores (útil para mapas de overview)
 */
export function useMultipleDriverLocations({
  driverIds,
  enabled = true,
}: {
  driverIds: string[];
  enabled?: boolean;
}) {
  const [locations, setLocations] = useState<Record<string, DriverLocation>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const queryClient = useQueryClient();
  const channelRef = useRef<any>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!enabled || !driverIds.length) {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
      setLocations({});
      return;
    }

    setIsLoading(true);
    setError(null);

    // Crear canal para múltiples drivers
    const channelName = `drivers_locations:${Date.now()}`;
    const channel = supabase.channel(channelName);

    channel
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'Driver',
          filter: `id=in.(${driverIds.join(',')})`,
        },
        (payload: any) => {
          if (!mountedRef.current) return;

          const updatedDriver = payload.new;
          if (!updatedDriver?.latitude || !updatedDriver?.longitude) return;

          const newLocation: DriverLocation = {
            id: updatedDriver.id,
            latitude: updatedDriver.latitude,
            longitude: updatedDriver.longitude,
            last_seen_at: updatedDriver.last_seen_at || new Date().toISOString(),
            status: updatedDriver.status,
            full_name: updatedDriver.full_name,
          };

          setLocations(prev => ({
            ...prev,
            [updatedDriver.id]: newLocation,
          }));
        }
      )
      .subscribe((status) => {
        if (!mountedRef.current) return;

        if (status === 'SUBSCRIBED') {
          setIsLoading(false);
          setError(null);
        } else if (status === 'CHANNEL_ERROR') {
          setError('Error de conexión en tiempo real');
          setIsLoading(false);
        }
      });

    channelRef.current = channel;

    // Obtener ubicaciones iniciales
    const fetchInitialLocations = async () => {
      try {
        const { data: drivers, error } = await supabase
          .from('Driver')
          .select('id, latitude, longitude, last_seen_at, status, full_name')
          .in('id', driverIds);

        if (error) throw error;

        const locationsMap: Record<string, DriverLocation> = {};
        drivers?.forEach(driver => {
          if (driver.latitude && driver.longitude) {
            locationsMap[driver.id] = {
              id: driver.id,
              latitude: driver.latitude,
              longitude: driver.longitude,
              last_seen_at: driver.last_seen_at || new Date().toISOString(),
              status: driver.status,
              full_name: driver.full_name,
            };
          }
        });

        if (mountedRef.current) {
          setLocations(locationsMap);
        }
      } catch (err) {
        console.warn('Error fetching initial driver locations:', err);
        if (mountedRef.current) {
          setError('Error al obtener ubicaciones iniciales');
        }
      }
    };

    fetchInitialLocations();

    return () => {
      if (channel) {
        try {
          supabase.removeChannel(channel);
        } catch (err) {
          console.warn('Error unsubscribing from drivers locations channel:', err);
        }
      }
      channelRef.current = null;
    };
  }, [driverIds, enabled]);

  return {
    locations,
    isLoading,
    error,
  };
}