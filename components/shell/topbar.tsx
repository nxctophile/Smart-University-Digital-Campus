"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Sidebar } from "./sidebar";
import { NetworkSwitcher } from "./network-switcher";
import { SyncStatus } from "./sync-status";
import { NotificationsBell } from "./notifications-bell";
import { ProfileMenu } from "./profile-menu";

const SEGMENT_OVERRIDES: Record<string, string> = { ai: "AI" };

function titleFromPath(pathname: string): string {
  if (pathname === "/") return "Home";
  const segments = pathname.split("/").filter(Boolean);
  return segments
    .map((s) => s.replace(/-/g, " "))
    .map((s) => SEGMENT_OVERRIDES[s.toLowerCase()] ?? s.charAt(0).toUpperCase() + s.slice(1))
    .join(" / ");
}

export function Topbar() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-border/70 bg-background/95 px-4 shadow-xs backdrop-blur supports-backdrop-filter:bg-background/80 sm:px-6">
      <button
        type="button"
        onClick={() => setMobileOpen(true)}
        className="flex size-8 items-center justify-center rounded-md hover:bg-secondary lg:hidden"
      >
        <Menu className="size-4.5" />
      </button>

      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="w-60 p-0">
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          <Sidebar onNavigate={() => setMobileOpen(false)} />
        </SheetContent>
      </Sheet>

      <h1 className="text-sm font-semibold tracking-tight text-foreground/90">{titleFromPath(pathname)}</h1>

      <div className="ml-auto flex items-center gap-2 sm:gap-3">
        <div className="hidden md:block">
          <NetworkSwitcher />
        </div>
        <div className="hidden sm:block">
          <SyncStatus />
        </div>
        <NotificationsBell />
        <ProfileMenu />
      </div>
    </header>
  );
}
