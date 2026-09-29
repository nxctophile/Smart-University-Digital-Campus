"use client";

import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import { SessionProvider } from "@/lib/client/session";
import { ServiceWorkerRegister } from "./sw-register";
import { AppShell } from "@/components/shell/app-shell";
import type { ClientContext } from "@/lib/types";

/** initialCtx is null for the logged-out state (the /login page) - in that
 * case we skip SessionProvider/AppShell entirely and just render children
 * bare, since there's no identity yet to drive the sidebar/topbar with.
 * Toaster/tooltips/SW registration stay available either way. */
export function AppProviders({ initialCtx, children }: { initialCtx: ClientContext | null; children: React.ReactNode }) {
  return (
    <TooltipProvider delay={200}>
      <ServiceWorkerRegister />
      {initialCtx ? (
        <SessionProvider initialCtx={initialCtx}>
          <AppShell>{children}</AppShell>
        </SessionProvider>
      ) : (
        children
      )}
      <Toaster position="bottom-right" />
    </TooltipProvider>
  );
}
