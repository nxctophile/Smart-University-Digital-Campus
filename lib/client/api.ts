import { getNetworkMode } from "./network-store";
import { getCurrentUserId } from "./session-store";
import { offlineDB } from "@/lib/offline/db";

function delay(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

/** Namespaces a cache/outbox key by the logged-in user, so switching demo
 * identities on this device can never read back a previous user's cached
 * data while offline (RBAC applies to the offline cache too). */
function scopedKey(path: string): string {
  return `u${getCurrentUserId() ?? "anon"}:${path}`;
}

export class OfflineUnavailableError extends Error {
  constructor(path: string) {
    super("This data hasn't been cached for offline use yet. Reconnect to load it.");
    this.name = "OfflineUnavailableError";
    void path;
  }
}

/** GET wrapper: transparently caches successful responses into IndexedDB and
 * serves from that cache when the network simulator is set to Offline. */
export async function apiGet<T>(path: string): Promise<T> {
  const mode = getNetworkMode();
  const key = scopedKey(path);

  if (mode === "offline") {
    const cached = await offlineDB?.cache.get(key);
    if (cached) return cached.data as T;
    throw new OfflineUnavailableError(path);
  }

  if (mode === "slow") await delay(1400 + Math.random() * 1400);

  const res = await fetch(path);
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(body.error ?? "Request failed");
  }
  const data = (await res.json()) as T;
  if (offlineDB) await offlineDB.cache.put({ key, data, cachedAt: new Date().toISOString() });
  return data;
}

/** POST wrapper for actions that always require live connectivity (AI
 * chat, admin notify) - never queued, simply unavailable offline. */
export async function apiPost<T>(path: string, body: unknown): Promise<T> {
  const mode = getNetworkMode();
  if (mode === "offline") throw new Error("This needs an internet connection - it isn't available offline.");
  if (mode === "slow") await delay(900 + Math.random() * 900);

  const res = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const responseBody = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(responseBody.error ?? "Request failed");
  }
  return res.json();
}

export type MutateOptions = {
  method?: "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  /** Whether this write can be queued locally while offline (helpdesk
   * tickets, certificate/document requests). Payments and other
   * connectivity-required actions should leave this false. */
  offlineCapable?: boolean;
  queueLabel?: string;
};

export async function apiMutate<T>(path: string, opts: MutateOptions = {}): Promise<T & { queued?: boolean }> {
  const mode = getNetworkMode();
  const method = opts.method ?? "POST";

  if (mode === "offline") {
    if (!opts.offlineCapable) {
      throw new Error("This action needs an internet connection. It isn't available offline.");
    }
    // Tag the queued action with who queued it and under what permission
    // context - when connectivity returns, the server re-authorizes the
    // request fresh (see useSyncStatus.syncNow); the queue only ever
    // replays actions under the identity that created them.
    await offlineDB?.outbox.add({
      method,
      url: path,
      body: opts.body,
      label: opts.queueLabel ?? path,
      createdAt: new Date().toISOString(),
      status: "pending",
      queuedByUserId: getCurrentUserId(),
    });
    return { queued: true } as T & { queued?: boolean };
  }

  if (mode === "slow") await delay(1200 + Math.random() * 1200);

  const res = await fetch(path, {
    method,
    headers: { "Content-Type": "application/json" },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(body.error ?? "Request failed");
  }
  return res.json();
}
