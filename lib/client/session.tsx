"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { ClientContext } from "@/lib/types";
import { setCurrentUserId } from "./session-store";
import { offlineDB } from "@/lib/offline/db";

type SessionContextValue = {
  ctx: ClientContext;
  loggingOut: boolean;
  logout: () => Promise<void>;
};

const SessionContext = createContext<SessionContextValue | null>(null);

export function SessionProvider({ initialCtx, children }: { initialCtx: ClientContext; children: React.ReactNode }) {
  const [ctx] = useState(initialCtx);
  const [loggingOut, setLoggingOut] = useState(false);
  const router = useRouter();

  useEffect(() => {
    setCurrentUserId(ctx.userId);
  }, [ctx.userId]);

  async function logout() {
    setLoggingOut(true);
    try {
      await fetch("/api/demo/session", { method: "DELETE" });
      // Logging out on a shared/demo device shouldn't leave the previous
      // person's cached reads sitting in IndexedDB for whoever logs in next.
      await offlineDB?.cache.clear();
      setCurrentUserId(null);
      router.push("/login");
      router.refresh();
    } finally {
      setLoggingOut(false);
    }
  }

  return <SessionContext.Provider value={{ ctx, loggingOut, logout }}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const value = useContext(SessionContext);
  if (!value) throw new Error("useSession must be used within SessionProvider");
  return value;
}
