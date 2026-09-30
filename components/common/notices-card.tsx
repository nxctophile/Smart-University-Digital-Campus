"use client";

import { Megaphone } from "lucide-react";
import { useApiGet } from "@/lib/client/use-api";
import { LoadingBlock } from "@/components/common/state-blocks";
import type { Notice } from "@/lib/api-types";

const CATEGORY_TONE: Record<string, string> = {
  academic: "bg-accent/10 text-accent",
  fees: "bg-warning/10 text-warning",
  hostel: "bg-secondary text-foreground/70",
  transport: "bg-secondary text-foreground/70",
  general: "bg-secondary text-foreground/70",
};

export function NoticesCard() {
  const { data, loading } = useApiGet<{ notifications: Notice[] }>("/api/notifications");

  return (
    <section className="card-surface p-4">
      <div className="mb-3 flex items-center gap-2">
        <Megaphone className="size-4 text-accent" />
        <h2 className="text-sm font-medium">Notices & Events</h2>
      </div>
      {loading && <LoadingBlock rows={2} />}
      {data && data.notifications.length === 0 && <p className="text-sm text-muted-foreground">No notices right now.</p>}
      {data && data.notifications.length > 0 && (
        <ul className="space-y-2.5">
          {data.notifications.slice(0, 6).map((n) => (
            <li key={n.id} className="flex items-start gap-2.5 text-sm">
              <span className={`mt-0.5 shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium capitalize ${CATEGORY_TONE[n.category] ?? CATEGORY_TONE.general}`}>
                {n.category}
              </span>
              <div className="min-w-0">
                <p className="font-medium">{n.title}</p>
                <p className="truncate text-xs text-muted-foreground">{n.message}</p>
              </div>
              <span className="ml-auto shrink-0 text-[11px] text-muted-foreground">{new Date(n.createdAt).toLocaleDateString("en-IN")}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
