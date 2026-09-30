"use client";

import { useApiGet } from "./use-api";
import type { ClientContext } from "@/lib/types";

/** Client Components that need permission-gated UI at the page level (not
 * just nav visibility) use this instead of useSession() - useSession()
 * throws outside SessionProvider, which Next's build-time static-shell
 * attempt triggers for any route that reads it directly in the page body.
 * This is a plain fetch with local state, so it degrades to an empty
 * permission set instead of throwing. */
export function usePermissions(): { permissions: string[]; loading: boolean } {
  const { data, loading } = useApiGet<{ ctx: ClientContext }>("/api/profile");
  return { permissions: data?.ctx.permissions ?? [], loading };
}
