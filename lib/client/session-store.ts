/** Tiny module-level mirror of the logged-in user id, so lib/client/api.ts
 * (which has no React context) can namespace offline cache/outbox entries
 * per user without every page threading userId through useApiGet calls. */
let currentUserId: number | null = null;

export function setCurrentUserId(id: number | null): void {
  currentUserId = id;
}

export function getCurrentUserId(): number | null {
  return currentUserId;
}
