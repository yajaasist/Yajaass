import { useEffect, useCallback } from 'react';
import { locationTracker } from '@/lib/locationTracker';

interface UseDriverLocationOptions {
  driverId: string | null;
  hasActiveRide: boolean;
  rideId?: string | null;
  enabled?: boolean;
}

export function useDriverLocation({
  driverId,
  hasActiveRide,
  rideId,
  enabled = true
}: UseDriverLocationOptions) {

  // Start/stop location tracking based on driver connection status
  useEffect(() => {
    if (!enabled || !driverId) {
      locationTracker.stop();
      return;
    }

    locationTracker.start(driverId);
    locationTracker.setRideStatus(hasActiveRide, rideId);

    return () => {
      locationTracker.stop();
    };
  }, [driverId, enabled]);

  // Update ride status when it changes
  useEffect(() => {
    if (enabled && driverId) {
      locationTracker.setRideStatus(hasActiveRide, rideId);
    }
  }, [hasActiveRide, rideId, enabled, driverId]);

  // Force immediate location update
  const forceUpdate = useCallback(async () => {
    await locationTracker.forceUpdate();
  }, []);

  return {
    forceUpdate,
  };
}