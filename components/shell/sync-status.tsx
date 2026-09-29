"use client";

import { CheckCircle2, RefreshCw, CloudOff } from "lucide-react";
import { useSyncStatus } from "@/lib/client/network";
import { cn } from "@/lib/utils";

function timeAgo(iso: string | null): string {
  if (!iso) return "";
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins === 1) return "1 minute ago";
  return `${mins} minutes ago`;
}

export function SyncStatus() {
  const { mode, pending, syncing, lastSyncedAt } = useSyncStatus();

  if (mode === "offline") {
    return (
      <div className="flex items-center gap-1.5 rounded-full bg-warning/15 px-2.5 py-1 text-xs font-medium text-warning">
        <CloudOff className="size-3.5" />
        <span>Offline{pending > 0 ? ` — ${pending} action${pending === 1 ? "" : "s"} waiting to sync` : ""}</span>
      </div>
    );
  }

  if (syncing) {
    return (
      <div className="flex items-center gap-1.5 rounded-full bg-accent/15 px-2.5 py-1 text-xs font-medium text-accent">
        <RefreshCw className="size-3.5 animate-spin" />
        <span>Syncing...</span>
      </div>
    );
  }

  return (
    <div className={cn("flex items-center gap-1.5 rounded-full bg-success/15 px-2.5 py-1 text-xs font-medium text-success")}>
      <CheckCircle2 className="size-3.5" />
      <span>{lastSyncedAt ? `Synced ${timeAgo(lastSyncedAt)}` : "Synced"}</span>
    </div>
  );
}
