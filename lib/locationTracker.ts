import { Geolocation } from '@capacitor/geolocation';
import { supabase } from '@/lib/supabase';

class LocationTracker {
  private watchId: string | null = null;
  private driverId: string | null = null;
  private isActive: boolean = false;
  private lastUpdateTime: number = 0;
  private updateInterval: number = 10000; // 10 seconds default (available)
  private currentRideId: string | null = null;

  async start(driverId: string) {
    if (this.watchId) return;

    this.driverId = driverId;
    this.isActive = true;

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

        const now = Date.now();

        // Always update if we have an active ride, or if enough time has passed
        if (this.currentRideId || (now - this.lastUpdateTime) >= this.updateInterval) {
          try {
            await supabase
              .from('Driver')
              .update({
                latitude: position.coords.latitude,
                longitude: position.coords.longitude,
                last_seen_at: new Date().toISOString(),
              })
              .eq('id', this.driverId);

            this.lastUpdateTime = now;
          } catch (error) {
            console.error('Error updating driver location:', error);
          }
        }
      }
    );
  }

  setRideStatus(hasActiveRide: boolean, rideId?: string | null) {
    this.currentRideId = hasActiveRide ? (rideId || 'active') : null;
    // Adjust update frequency based on ride status
    this.updateInterval = hasActiveRide ? 3000 : 10000; // 3s with ride, 10s available
  }

  async stop() {
    this.isActive = false;
    if (this.watchId) {
      await Geolocation.clearWatch({ id: this.watchId });
      this.watchId = null;
      this.driverId = null;
      this.currentRideId = null;
      this.lastUpdateTime = 0;
    }
  }

  // Force immediate location update
  async forceUpdate() {
    if (!this.driverId || !this.isActive) return;

    try {
      const position = await Geolocation.getCurrentPosition({
        enableHighAccuracy: true,
        timeout: 10000,
      });

      if (position?.coords) {
        await supabase
          .from('Driver')
          .update({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            last_seen_at: new Date().toISOString(),
          })
          .eq('id', this.driverId);
      }
    } catch (error) {
      console.error('Error forcing location update:', error);
    }
  }
}

export const locationTracker = new LocationTracker();