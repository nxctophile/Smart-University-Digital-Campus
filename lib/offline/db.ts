import Dexie, { type EntityTable } from "dexie";

export type CachedEntry = { key: string; data: unknown; cachedAt: string };

export type OutboxAction = {
  id?: number;
  method: string;
  url: string;
  body: unknown;
  label: string;
  createdAt: string;
  status: "pending" | "failed";
  /** Which logged-in user queued this action - replayed only under that
   * same identity, and always re-authorized server-side on replay. */
  queuedByUserId: number | null;
};

class CampusOfflineDB extends Dexie {
  cache!: EntityTable<CachedEntry, "key">;
  outbox!: EntityTable<OutboxAction, "id">;

  constructor() {
    super("campus-offline");
    this.version(1).stores({
      cache: "key",
      outbox: "++id, status, createdAt",
    });
  }
}

export const offlineDB = typeof window !== "undefined" ? new CampusOfflineDB() : (null as unknown as CampusOfflineDB);
