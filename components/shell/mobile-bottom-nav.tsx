"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "@/lib/client/session";
import { getNavGroups } from "./nav-config";
import { cn } from "@/lib/utils";
import { Sparkles } from "lucide-react";

export function MobileBottomNav() {
  const { ctx } = useSession();
  const pathname = usePathname();
  const groups = getNavGroups(ctx);
  const home = groups[0]?.items[0] ?? { label: "Home", href: "/", icon: Sparkles };
  const primary = (groups[0]?.items ?? []).filter((i) => i.href !== home.href).slice(0, 3);
  const items = [home, ...primary, { label: "AI", href: "/ai", icon: Sparkles }];

  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 flex h-14 items-stretch border-t border-border bg-background/95 backdrop-blur lg:hidden">
      {items.map((item) => {
        const Icon = item.icon;
        const active = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href));
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex flex-1 flex-col items-center justify-center gap-0.5 text-[10px]",
              active ? "text-primary font-medium" : "text-muted-foreground",
            )}
          >
            <Icon className="size-4.5" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
