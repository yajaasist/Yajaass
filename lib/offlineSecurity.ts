import { nowCDMX } from "@/components/shared/dateUtils";

const OUTBOX_KEY = "offline_outbox_v1";
const PROCESSED_KEY = "offline_outbox_processed_v1";

type OfflineRole = "driver" | "passenger";

type OfflineActionType = "ride_update";

export type OfflineEvidence = {
  captured_at: string;
  online: boolean;
  user_agent?: string;
  latitude?: number;
  longitude?: number;
  accuracy?: number;
  source: "offline_guard";
};

export type OfflineOutboxAction = {
  id: string;
  actionType: OfflineActionType;
  role: OfflineRole;
  rideId: string;
  updates: Record<string, any>;
  createdAt: string;
  evidence: OfflineEvidence;
};

function readJson<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function writeJson<T>(key: string, value: T) {
  if (typeof window === "undefined") return;
  localStorage.setItem(key, JSON.stringify(value));
}

function makeId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `offline_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function getOutbox(): OfflineOutboxAction[] {
  return readJson<OfflineOutboxAction[]>(OUTBOX_KEY, []);
}

function setOutbox(actions: OfflineOutboxAction[]) {
  writeJson(OUTBOX_KEY, actions);
}

function getProcessedIds(): string[] {
  return readJson<string[]>(PROCESSED_KEY, []);
}

function setProcessedIds(ids: string[]) {
  writeJson(PROCESSED_KEY, ids);
}

export function isOnlineNow() {
  if (typeof navigator === "undefined") return true;
  return navigator.onLine;
}

export async function collectOfflineEvidence(): Promise<OfflineEvidence> {
  const evidence: OfflineEvidence = {
    captured_at: nowCDMX(),
    online: isOnlineNow(),
    user_agent: typeof navigator !== "undefined" ? navigator.userAgent : "",
    source: "offline_guard",
  };

  if (typeof navigator === "undefined" || !navigator.geolocation) {
    return evidence;
  }

  try {
    const position = await new Promise<GeolocationPosition>((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(resolve, reject, {
        enableHighAccuracy: true,
        timeout: 3000,
        maximumAge: 10000,
      });
    });
    evidence.latitude = position.coords.latitude;
    evidence.longitude = position.coords.longitude;
    evidence.accuracy = position.coords.accuracy;
  } catch {
    // Best effort evidence.
  }

  return evidence;
}

export async function enqueueRideUpdateOffline(params: {
  role: OfflineRole;
  rideId: string;
  updates: Record<string, any>;
}) {
  const action: OfflineOutboxAction = {
    id: makeId(),
    actionType: "ride_update",
    role: params.role,
    rideId: params.rideId,
    updates: params.updates,
    createdAt: nowCDMX(),
    evidence: await collectOfflineEvidence(),
  };
  const outbox = getOutbox();
  outbox.push(action);
  setOutbox(outbox);
  return action;
}

export async function flushOfflineOutbox(
  processor: (action: OfflineOutboxAction) => Promise<boolean>
) {
  const outbox = getOutbox();
  const processedIds = new Set(getProcessedIds());
  const keep: OfflineOutboxAction[] = [];

  for (const action of outbox) {
    if (processedIds.has(action.id)) continue;
    try {
      const ok = await processor(action);
      if (ok) {
        processedIds.add(action.id);
      } else {
        keep.push(action);
      }
    } catch {
      keep.push(action);
    }
  }

  setOutbox(keep);
  setProcessedIds(Array.from(processedIds).slice(-500));
}

export function buildReconciliationExtra(existingExtra: any, action: OfflineOutboxAction) {
  const base = (existingExtra && typeof existingExtra === "object") ? existingExtra : {};
  const offlineSecurity = (base.offline_security && typeof base.offline_security === "object")
    ? base.offline_security
    : {};
  const events = Array.isArray(offlineSecurity.events) ? offlineSecurity.events : [];

  return {
    ...base,
    offline_security: {
      ...offlineSecurity,
      reconciliation_required: true,
      last_action_at: nowCDMX(),
      events: [
        ...events,
        {
          id: action.id,
          action_type: action.actionType,
          role: action.role,
          created_at: action.createdAt,
          evidence: action.evidence,
          updates: action.updates,
        },
      ].slice(-50),
    },
  };
}
