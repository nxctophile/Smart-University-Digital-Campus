"use client";

import { useEffect, useMemo, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { useApiGet } from "@/lib/client/use-api";
import { LoadingBlock } from "@/components/common/state-blocks";
import { cn } from "@/lib/utils";
import type { Notice } from "@/lib/api-types";

const WEEKDAY_LABELS = ["S", "M", "T", "W", "T", "F", "S"];
const IMPORTANT_CATEGORIES = new Set(["fees", "academic"]);

function sameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function dayKey(d: Date): string {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

export function EventsCalendar() {
  const { data, loading } = useApiGet<{ notifications: Notice[] }>("/api/notifications");
  const notices = useMemo(() => data?.notifications ?? [], [data]);

  const [view, setView] = useState<{ viewDate: Date; selected: Date | null; settled: boolean }>(() => ({
    viewDate: new Date(),
    selected: null,
    settled: false,
  }));
  const { viewDate, selected } = view;

  useEffect(() => {
    if (view.settled || notices.length === 0) return;
    const today = new Date();
    const hasEventThisMonth = notices.some((n) => {
      const d = new Date(n.createdAt);
      return d.getFullYear() === today.getFullYear() && d.getMonth() === today.getMonth();
    });
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time initial focus once notices load, not re-run after (guarded by `settled`)
    setView(() => {
      if (hasEventThisMonth) return { viewDate: today, selected: today, settled: true };
      const latest = notices.reduce((a, b) => (new Date(a.createdAt) > new Date(b.createdAt) ? a : b));
      const latestDate = new Date(latest.createdAt);
      return { viewDate: new Date(latestDate.getFullYear(), latestDate.getMonth(), 1), selected: latestDate, settled: true };
    });
  }, [notices, view.settled]);

  function setViewDate(d: Date) {
    setView((v) => ({ ...v, viewDate: d }));
  }
  function setSelected(d: Date) {
    setView((v) => ({ ...v, selected: d }));
  }

  const byDay = useMemo(() => {
    const map = new Map<string, Notice[]>();
    for (const n of notices) {
      const key = dayKey(new Date(n.createdAt));
      map.set(key, [...(map.get(key) ?? []), n]);
    }
    return map;
  }, [notices]);

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const firstOfMonth = new Date(year, month, 1);
  const startWeekday = firstOfMonth.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = new Date();

  const cells: (Date | null)[] = [
    ...Array.from({ length: startWeekday }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => new Date(year, month, i + 1)),
  ];

  const selectedNotices = selected ? byDay.get(dayKey(selected)) ?? [] : [];

  return (
    <section className="card-surface p-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <CalendarDays className="size-4 text-accent" />
          <h2 className="text-sm font-medium">Calendar</h2>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setViewDate(new Date(year, month - 1, 1))}
            className="flex size-6 items-center justify-center rounded-md text-muted-foreground hover:bg-secondary hover:text-foreground"
          >
            <ChevronLeft className="size-3.5" />
          </button>
          <span className="w-24 text-center text-xs font-medium">
            {viewDate.toLocaleDateString("en-IN", { month: "long", year: "numeric" })}
          </span>
          <button
            type="button"
            onClick={() => setViewDate(new Date(year, month + 1, 1))}
            className="flex size-6 items-center justify-center rounded-md text-muted-foreground hover:bg-secondary hover:text-foreground"
          >
            <ChevronRight className="size-3.5" />
          </button>
        </div>
      </div>

      {loading && <LoadingBlock rows={3} />}

      {!loading && (
        <>
          <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-medium uppercase text-muted-foreground/60">
            {WEEKDAY_LABELS.map((d, i) => (
              <span key={i}>{d}</span>
            ))}
          </div>
          <div className="mt-1 grid grid-cols-7 gap-1">
            {cells.map((date, i) => {
              if (!date) return <div key={i} />;
              const dayNotices = byDay.get(dayKey(date)) ?? [];
              const hasImportant = dayNotices.some((n) => IMPORTANT_CATEGORIES.has(n.category));
              const isToday = sameDay(date, today);
              const isSelected = selected ? sameDay(date, selected) : false;
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => setSelected(date)}
                  title={dayNotices.length ? dayNotices.map((n) => n.title).join(" · ") : undefined}
                  className={cn(
                    "relative flex aspect-square flex-col items-center justify-center rounded-md text-xs transition-colors",
                    isSelected
                      ? "bg-primary font-medium text-primary-foreground"
                      : isToday
                        ? "bg-brand-tint font-medium text-foreground"
                        : "text-foreground hover:bg-secondary",
                  )}
                >
                  {date.getDate()}
                  {dayNotices.length > 0 && (
                    <span
                      className={cn(
                        "absolute bottom-1 size-1 rounded-full",
                        isSelected ? "bg-primary-foreground" : hasImportant ? "bg-brand" : "bg-muted-foreground/50",
                      )}
                    />
                  )}
                </button>
              );
            })}
          </div>

          <div className="mt-3 border-t border-border pt-3">
            {selectedNotices.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                {selected ? "No notices or events on this date." : "Select a highlighted date to see details."}
              </p>
            ) : (
              <ul className="space-y-2">
                {selectedNotices.map((n) => (
                  <li key={n.id} className="text-sm">
                    <p className="font-medium leading-snug">{n.title}</p>
                    <p className="text-xs leading-snug text-muted-foreground">{n.message}</p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </section>
  );
}
