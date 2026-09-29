"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { getNetworkMode, setNetworkMode, subscribeNetworkMode, hydrateNetworkModeFromStorage } from "./network-store";
import { getCurrentUserId } from "./session-store";
import { offlineDB } from "@/lib/offline/db";
import type { NetworkMode } from "@/lib/types";

export function useNetworkMode(): [NetworkMode, (m: NetworkMode) => void] {
  const mode = useSyncExternalStore(subscribeNetworkMode, getNetworkMode, () => "online" as NetworkMode);
  useEffect(() => {
    hydrateNetworkModeFromStorage();
  }, []);
  return [mode, setNetworkMode];
}

export function useSyncStatus() {
  const [mode] = useNetworkMode();
  const [pending, setPending] = useState(0);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);

  const refreshPending = useCallback(async () => {
    if (!offlineDB) return;
    const currentUserId = getCurrentUserId();
    const count = await offlineDB.outbox.filter((item) => item.queuedByUserId === currentUserId).count();
    setPending(count);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- polls IndexedDB outbox size, not derived from render state
    refreshPending();
    const id = setInterval(refreshPending, 1500);
    return () => clearInterval(id);
  }, [refreshPending]);

  const syncNow = useCallback(async () => {
    if (!offlineDB || mode === "offline") return;
    const allItems = await offlineDB.outbox.toArray();
    // Only replay actions queued by whoever is logged in right now - an
    // action queued as one demo user must never fire under a different
    // identity just because the device switched login in between.
    const currentUserId = getCurrentUserId();
    const items = allItems.filter((item) => item.queuedByUserId === currentUserId);
    if (!items.length) {
      setLastSyncedAt(new Date().toISOString());
      return;
    }
    setSyncing(true);
    const start = Date.now();
    for (const item of items) {
      try {
        const res = await fetch(item.url, {
          method: item.method,
          headers: { "Content-Type": "application/json" },
          body: item.body ? JSON.stringify(item.body) : undefined,
        });
        // The server re-authorizes this request from scratch via the
        // current session cookie - it never trusts that the action was
        // "already allowed" when it was queued.
        if (res.ok) await offlineDB.outbox.delete(item.id!);
      } catch {
        // stays queued; will retry on next sync
      }
    }
    const elapsed = Date.now() - start;
    if (elapsed < 700) await new Promise((r) => setTimeout(r, 700 - elapsed));
    setSyncing(false);
    setLastSyncedAt(new Date().toISOString());
    refreshPending();
  }, [mode, refreshPending]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- auto-sync the outbox whenever the demo network mode leaves "offline"
    if (mode !== "offline") syncNow();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  return { pending, lastSyncedAt, syncing, syncNow, mode };
}
