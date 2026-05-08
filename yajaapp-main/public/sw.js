self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

// ─── Push notification handler ────────────────────────────────────────────────
self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (e) {
    data = { title: "Nuevo aviso", body: event.data ? event.data.text() : "" };
  }

  const title = data.title || "YAJA";
  const options = {
    body: data.body || "",
    icon: "/android-chrome-192x192.png",
    badge: "/android-chrome-192x192.png",
    tag: data.tag || "yaja-notification",
    data: { url: data.url || "/" },
    requireInteraction: !!data.requireInteraction,
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

// ─── Notification click handler ───────────────────────────────────────────────
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/driver-app";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      const existing = clients.find((c) => c.url.includes(url));
      if (existing) return existing.focus();
      return self.clients.openWindow(url);
    })
  );
});

// ─── Message handler (timers from app) ───────────────────────────────────────
const rideTimers = {};
let inactivityTimer = null;

async function broadcastToClients(message) {
  const clients = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
  clients.forEach((client) => client.postMessage(message));
}

self.addEventListener("message", (event) => {
  const { type, rideId, timeoutMs, passengerName, pickupAddress } = event.data || {};

  if (type === "SHOW_NOTIFICATION") {
    const data = event.data || {};
    self.registration.showNotification(data.title || "YAJA", {
      body: data.body || "",
      icon: "/next.svg",
      badge: "/next.svg",
      tag: data.tag || `notif-${Date.now()}`,
      requireInteraction: true,
      data: { url: data.url || "/driver-app", ride: data.ride || null },
    });
    return;
  }

  if (type === "DISMISS") {
    const tag = event.data?.tag;
    if (!tag) return;
    self.registration.getNotifications({ tag }).then((notifs) => {
      notifs.forEach((n) => n.close());
    });
    return;
  }

  if (type === "START_RIDE_TIMER" && rideId) {
    if (rideTimers[rideId]) clearTimeout(rideTimers[rideId]);
    rideTimers[rideId] = setTimeout(() => {
      broadcastToClients({ type: "RIDE_TIMEOUT", rideId });
      self.registration.showNotification("⏱️ Tiempo de espera", {
        body: `No se acepto a tiempo: ${passengerName || "Pasajero"}${pickupAddress ? ` · ${pickupAddress}` : ""}`,
        tag: `ride-timer-${rideId}`,
        icon: "/next.svg",
        data: { url: "/driver-app" },
      });
      delete rideTimers[rideId];
    }, timeoutMs || 30000);
  }

  if (type === "CANCEL_RIDE_TIMER" && rideId) {
    if (rideTimers[rideId]) {
      clearTimeout(rideTimers[rideId]);
      delete rideTimers[rideId];
    }
  }

  if (type === "DRIVER_HEARTBEAT") {
    if (inactivityTimer) clearTimeout(inactivityTimer);
    inactivityTimer = setTimeout(() => {
      broadcastToClients({ type: "INACTIVITY_TIMEOUT" });
      self.registration.showNotification("⚠️ Desconexion por inactividad", {
        body: "No detectamos actividad del conductor. Se desconectara automaticamente.",
        tag: "driver-inactivity-timeout",
        icon: "/next.svg",
        data: { url: "/driver-app" },
      });
      inactivityTimer = null;
    }, timeoutMs || 30 * 60 * 1000);
  }

  if (type === "STOP_HEARTBEAT") {
    if (inactivityTimer) {
      clearTimeout(inactivityTimer);
      inactivityTimer = null;
    }
  }
});

