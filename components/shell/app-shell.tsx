"use client";

import { usePathname } from "next/navigation";
import { Sidebar } from "./sidebar";
import { Topbar } from "./topbar";
import { MobileBottomNav } from "./mobile-bottom-nav";
import { cn } from "@/lib/utils";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  // The AI page manages its own full-height scroll region + fixed composer,
  // so it opts out of the standard padded/scrollable page wrapper.
  const isFullBleed = pathname === "/ai";

  return (
    <div className="flex h-dvh w-full overflow-hidden">
      <div className="hidden lg:block">
        <Sidebar />
      </div>
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar />
        <main className={cn("flex-1 pb-16 lg:pb-0", isFullBleed ? "overflow-hidden" : "overflow-y-auto")}>
          {isFullBleed ? (
            <div className="h-full">{children}</div>
          ) : (
            <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 lg:px-8">{children}</div>
          )}
        </main>
      </div>
      <MobileBottomNav />
    </div>
  );
}
