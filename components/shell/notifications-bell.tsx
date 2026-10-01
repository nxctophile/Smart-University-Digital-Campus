"use client";

import { useEffect, useState } from "react";
import { Bell } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { apiGet } from "@/lib/client/api";
import { ScrollArea } from "@/components/ui/scroll-area";

type Notification = { id: number; title: string; message: string; category: string; createdAt: string };

function formatWhen(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

export function NotificationsBell() {
  const [items, setItems] = useState<Notification[] | null>(null);

  useEffect(() => {
    apiGet<{ notifications: Notification[] }>("/api/notifications")
      .then((d) => setItems(d.notifications))
      .catch(() => setItems([]));
  }, []);

  return (
    <Popover>
      <PopoverTrigger className="relative flex size-8 items-center justify-center rounded-full hover:bg-secondary">
        <Bell className="size-4" />
        {items && items.length > 0 && <span className="absolute right-1.5 top-1.5 size-1.5 rounded-full bg-accent" />}
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="border-b border-border px-4 py-3">
          <p className="text-sm font-medium">Notifications</p>
        </div>
        <ScrollArea className="max-h-80 min-h-0">
          <div className="divide-y divide-border">
            {items === null && <div className="px-4 py-6 text-center text-sm text-muted-foreground">Loading...</div>}
            {items?.length === 0 && <div className="px-4 py-6 text-center text-sm text-muted-foreground">No notifications</div>}
            {items?.map((n) => (
              <div key={n.id} className="px-4 py-3">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-medium leading-snug">{n.title}</p>
                  <span className="shrink-0 text-[11px] text-muted-foreground">{formatWhen(n.createdAt)}</span>
                </div>
                <p className="mt-0.5 text-xs text-muted-foreground leading-snug">{n.message}</p>
              </div>
            ))}
          </div>
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
