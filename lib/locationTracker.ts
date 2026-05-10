import { Capacitor } from '@capacitor/core';
import { Geolocation } from '@capacitor/geolocation';
import { supabase } from '@/lib/supabase';

class LocationTracker {
  private watchId: string | number | null = null;
  private driverId: string | null = null;
  private isActive: boolean = false;
  private lastUpdateTime: number = 0;
  private updateInterval: number = 10000; // 10 seconds default (available)
  private currentRideId: string | null = null;
  private isNative: boolean = false;
  private fallbackTimerId: NodeJS.Timeout | null = null; // Fallback timer para PWA

  async start(driverId: string) {
    if (this.watchId) return;

    this.driverId = driverId;
    this.isActive = true;
    this.isNative = Capacitor.isNativePlatform();

    // Función para actualizar ubicación en BD
    const updateLocationInDB = async (coords: { latitude: number; longitude: number }) => {
      const now = Date.now();
      // Always update if we have an active ride, or if enough time has passed
      if (!this.currentRideId && (now - this.lastUpdateTime) < this.updateInterval) {
        return;
      }

      try {
        await supabase
          .from('Driver')
          .update({
            latitude: coords.latitude,
            longitude: coords.longitude,
            last_seen_at: new Date().toISOString(),
          })
          .eq('id', this.driverId);

        this.lastUpdateTime = now;
      } catch (error) {
        console.error('Error updating driver location:', error);
      }
    };

    if (this.isNative) {
      // Native platforms: use Capacitor Geolocation
      const perm = await Geolocation.checkPermissions();
      if (perm.location !== 'granted') {
        await Geolocation.requestPermissions();
      }

      this.watchId = await Geolocation.watchPosition(
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0,
          allowBackgroundLocationUpdates: true,
          distanceFilter: 5,
        },
        async (position) => {
          if (!position?.coords || !this.driverId || !this.isActive) return;
          await updateLocationInDB(position.coords);
        }
      );
    } else {
      // PWA: use navigator.geolocation
      if (!navigator.geolocation) {
        console.warn('Geolocation not available in this browser');
        return;
      }

      this.watchId = navigator.geolocation.watchPosition(
        async (position) => {
          if (!position?.coords || !this.driverId || !this.isActive) return;
          await updateLocationInDB(position.coords);
        },
        (error) => {
          console.warn('GPS error:', error.message);
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0,
        }
      );

      // Start fallback timer for PWA (in case watchPosition doesn't fire frequently)
      // Force update every 15 seconds to ensure real-time movement
      this.fallbackTimerId = setInterval(async () => {
        if (!this.driverId || !this.isActive) return;
        try {
          await this.forceUpdate();
        } catch (error) {
          console.warn('Fallback location update failed:', error);
        }
      }, 15000); // 15 seconds
    }
  }

  setRideStatus(hasActiveRide: boolean, rideId?: string | null) {
    this.currentRideId = hasActiveRide ? (rideId || 'active') : null;
    // Adjust update frequency based on ride status
    this.updateInterval = hasActiveRide ? 3000 : 10000; // 3s with ride, 10s available
  }

  async stop() {
    this.isActive = false;

    // Clear fallback timer
    if (this.fallbackTimerId) {
      clearInterval(this.fallbackTimerId);
      this.fallbackTimerId = null;
    }

    if (!this.watchId) return;

    try {
      if (this.isNative) {
        await Geolocation.clearWatch({ id: String(this.watchId) });
      } else {
        navigator.geolocation?.clearWatch(this.watchId as number);
      }
    } catch (error) {
      console.warn('Error stopping location tracker:', error);
    }

    this.watchId = null;
    this.driverId = null;
    this.currentRideId = null;
    this.lastUpdateTime = 0;
  }

  // Force immediate location update
  async forceUpdate() {
    if (!this.driverId || !this.isActive) return;

    try {
      let coords: { latitude: number; longitude: number } | null = null;

      if (this.isNative) {
        const position = await Geolocation.getCurrentPosition({
          enableHighAccuracy: true,
          timeout: 10000,
        });
        coords = position?.coords || null;
      } else {
        // PWA: use navigator.geolocation
        coords = await new Promise((resolve) => {
          if (!navigator.geolocation) {
            resolve(null);
            return;
          }
          navigator.geolocation.getCurrentPosition(
            (position) => resolve(position?.coords || null),
            () => resolve(null),
            { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
          );
        });
      }

      if (!coords) return;

      await supabase
        .from('Driver')
        .update({
          latitude: coords.latitude,
          longitude: coords.longitude,
          last_seen_at: new Date().toISOString(),
        })
        .eq('id', this.driverId);
    } catch (error) {
      console.error('Error forcing location update:', error);
    }
  }
}

export const locationTracker = new LocationTracker();