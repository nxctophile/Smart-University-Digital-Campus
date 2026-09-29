import type { ClientContext } from "@/lib/types";
import type { Grant } from "./grants";

/** Server-only authorization context: everything in ClientContext (safe to
 * send to the browser) plus the caller's resolved permission grants and a
 * per-request memoization cache for dynamic scope lookups (e.g. "which
 * course ids does this faculty member teach"). Never serialize this whole
 * object back to the client - use the ClientContext subset instead. */
export type AccessContext = ClientContext & {
  grants: Grant[];
  _cache: Map<string, unknown>;
};

export type { Scope, ResourceNeed } from "./scope";
export type { Grant } from "./grants";
