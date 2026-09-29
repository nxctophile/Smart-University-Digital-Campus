"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "@/lib/client/session";
import { getNavGroups } from "./nav-config";
import { cn } from "@/lib/utils";
import { GraduationCap } from "lucide-react";

export function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const { ctx } = useSession();
  const pathname = usePathname();
  const groups = getNavGroups(ctx);

  return (
    <div className="flex h-full w-60 flex-col bg-sidebar text-sidebar-foreground">
      <div className="flex items-center gap-2.5 px-5 py-5">
        <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-sidebar-primary text-sidebar-primary-foreground shadow-sm">
          <GraduationCap className="size-4.5" />
        </div>
        <div className="leading-tight">
          <p className="text-sm font-semibold tracking-tight">Central Institute</p>
          <p className="text-[11px] tracking-wide text-sidebar-foreground/55">of Technology</p>
        </div>
      </div>

      <nav className="flex-1 space-y-5 overflow-y-auto px-3 pb-4">
        {groups.map((group, idx) => (
          <div key={idx} className={cn(group.separatorAfter && "border-b border-sidebar-border pb-5")}>
            {group.label && (
              <p className="mb-1.5 px-3.5 text-[10px] font-semibold uppercase tracking-wider text-sidebar-foreground/40">{group.label}</p>
            )}
            <ul className="space-y-0.5">
              {group.items.map((item) => {
                const Icon = item.icon;
                const active = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href));
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={onNavigate}
                      className={cn(
                        "group relative flex items-center gap-2.5 rounded-md py-2 pl-3.5 pr-3 text-sm transition-colors",
                        active
                          ? "bg-sidebar-primary/15 font-medium text-sidebar-foreground"
                          : "text-sidebar-foreground/65 hover:bg-sidebar-accent/70 hover:text-sidebar-foreground",
                      )}
                    >
                      {active && (
                        <span className="absolute inset-y-1.5 left-0 w-[3px] rounded-full bg-sidebar-primary" />
                      )}
                      <Icon className={cn("size-4 shrink-0", active ? "text-sidebar-primary" : "text-sidebar-foreground/50 group-hover:text-sidebar-foreground/80")} />
                      {item.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>
    </div>
  );
}
