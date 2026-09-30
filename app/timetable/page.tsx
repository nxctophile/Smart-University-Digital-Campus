"use client";

import { useApiGet } from "@/lib/client/use-api";
import { PageHeader } from "@/components/common/page-header";
import { LoadingBlock, ErrorBlock, EmptyState } from "@/components/common/state-blocks";
import { CalendarDays } from "lucide-react";
import { DAY_NAMES } from "@/lib/types";
import { cn } from "@/lib/utils";
import type { TimetableSlot as Slot } from "@/lib/api-types";

const GRID_START_MIN = 8 * 60;
const GRID_END_MIN = 17 * 60;
const SLOT_MIN = 30;
const TOTAL_ROWS = (GRID_END_MIN - GRID_START_MIN) / SLOT_MIN;

const COURSE_COLORS = [
  "border-accent/30 bg-accent/12 text-accent",
  "border-success/30 bg-success/12 text-success",
  "border-warning/30 bg-warning/12 text-warning",
  "border-destructive/25 bg-destructive/10 text-destructive",
  "border-primary/25 bg-primary/10 text-primary",
];

function toMinutes(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

function formatHour(mins: number): string {
  const h = Math.floor(mins / 60);
  const suffix = h < 12 ? "AM" : "PM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12} ${suffix}`;
}

function colorForCourse(code: string): string {
  let hash = 0;
  for (let i = 0; i < code.length; i++) hash = (hash * 31 + code.charCodeAt(i)) % COURSE_COLORS.length;
  return COURSE_COLORS[hash];
}

export default function TimetablePage() {
  const { data, loading, error, reload } = useApiGet<{ timetable: Slot[] }>("/api/timetable");
  const timetable = data?.timetable ?? [];
  const uniqueCourses = Array.from(new Map(timetable.map((s) => [s.courseCode, s.courseName])).entries());

  return (
    <div>
      <PageHeader title="Timetable" description="Your weekly class schedule for this semester." />

      {loading && <LoadingBlock rows={5} />}
      {error && <ErrorBlock message={error} onRetry={reload} />}
      {data && timetable.length === 0 && <EmptyState icon={CalendarDays} title="No classes scheduled" />}

      {data && timetable.length > 0 && (
        <div className="space-y-4">
          <div className="overflow-x-auto card-surface p-3">
            <div className="min-w-[760px]">
              <div
                className="grid"
                style={{ gridTemplateColumns: `3.5rem repeat(5, 1fr)`, gridTemplateRows: `1.75rem repeat(${TOTAL_ROWS}, 2.1rem)` }}
              >
                <div style={{ gridRow: 1, gridColumn: 1 }} />
                {DAY_NAMES.map((d, i) => (
                  <div
                    key={d}
                    className="flex items-center justify-center border-b border-border pb-1 text-xs font-semibold text-muted-foreground"
                    style={{ gridRow: 1, gridColumn: i + 2 }}
                  >
                    {d.slice(0, 3)}
                  </div>
                ))}

                {Array.from({ length: TOTAL_ROWS }).map((_, rowIdx) =>
                  DAY_NAMES.map((_, colIdx) => (
                    <div
                      key={`bg-${rowIdx}-${colIdx}`}
                      className={cn("border-t border-border/50", colIdx < 4 && "border-r border-border/50")}
                      style={{ gridRow: rowIdx + 2, gridColumn: colIdx + 2 }}
                    />
                  )),
                )}

                {Array.from({ length: TOTAL_ROWS / 2 }).map((_, i) => (
                  <div
                    key={`label-${i}`}
                    className="relative text-[10px] text-muted-foreground"
                    style={{ gridRow: i * 2 + 2, gridColumn: 1 }}
                  >
                    <span className="absolute -top-1.5 right-1.5">{formatHour(GRID_START_MIN + i * 60)}</span>
                  </div>
                ))}

                {timetable.map((slot) => {
                  const startRow = Math.round((toMinutes(slot.startTime) - GRID_START_MIN) / SLOT_MIN) + 2;
                  const endRow = Math.round((toMinutes(slot.endTime) - GRID_START_MIN) / SLOT_MIN) + 2;
                  return (
                    <div
                      key={slot.id}
                      className={cn("m-0.5 overflow-hidden rounded-md border px-1.5 py-1 text-[11px] leading-tight", colorForCourse(slot.courseCode))}
                      style={{ gridRow: `${startRow} / ${endRow}`, gridColumn: slot.dayOfWeek + 2 }}
                      title={`${slot.courseName} · ${slot.startTime}-${slot.endTime} · Room ${slot.room}`}
                    >
                      <p className="truncate font-medium">{slot.courseCode}</p>
                      <p className="truncate opacity-75">{slot.room}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            {uniqueCourses.map(([code, name]) => (
              <div key={code} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <span className={cn("size-2.5 rounded-full border", colorForCourse(code))} />
                <span className="font-medium text-foreground">{code}</span> — {name}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
