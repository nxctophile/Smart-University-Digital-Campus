"use client";

import { Wifi, CloudDrizzle, WifiOff } from "lucide-react";
import { useNetworkMode } from "@/lib/client/network";
import { cn } from "@/lib/utils";
import type { NetworkMode } from "@/lib/types";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

const OPTIONS: { mode: NetworkMode; label: string; icon: typeof Wifi }[] = [
  { mode: "online", label: "Online", icon: Wifi },
  { mode: "slow", label: "Slow network", icon: CloudDrizzle },
  { mode: "offline", label: "Offline", icon: WifiOff },
];

export function NetworkSwitcher() {
  const [mode, setMode] = useNetworkMode();

  return (
    <div className="flex items-center gap-0.5 rounded-full border border-border bg-secondary/60 p-0.5">
      {OPTIONS.map((opt) => {
        const Icon = opt.icon;
        const active = mode === opt.mode;
        return (
          <Tooltip key={opt.mode}>
            <TooltipTrigger
              onClick={() => setMode(opt.mode)}
              aria-pressed={active}
              className={cn(
                "flex h-7 w-7 items-center justify-center rounded-full transition-colors",
                active ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Icon className="size-3.5" />
            </TooltipTrigger>
            <TooltipContent side="bottom">{opt.label} (demo network simulator)</TooltipContent>
          </Tooltip>
        );
      })}
    </div>
  );
}
