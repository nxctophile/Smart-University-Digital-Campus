"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { apiGet, apiMutate } from "@/lib/client/api";
import { cn } from "@/lib/utils";

type RosterStudent = { id: number; rollNumber: string; firstName: string; lastName: string };
type Status = "present" | "absent" | "late" | "excused";
const STATUSES: { value: Status; label: string }[] = [
  { value: "present", label: "Present" },
  { value: "absent", label: "Absent" },
  { value: "late", label: "Late" },
  { value: "excused", label: "Excused" },
];

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export function MarkAttendancePanel({ courseId }: { courseId: number }) {
  const [roster, setRoster] = useState<RosterStudent[] | null>(null);
  const [date, setDate] = useState(today());
  const [statuses, setStatuses] = useState<Record<number, Status>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    apiGet<{ students: RosterStudent[] }>(`/api/faculty/students?courseId=${courseId}`).then((d) => {
      if (cancelled) return;
      setRoster(d.students);
      setStatuses((prev) => {
        const next = { ...prev };
        for (const s of d.students) if (!next[s.id]) next[s.id] = "present";
        return next;
      });
    });
    return () => {
      cancelled = true;
    };
  }, [courseId]);

  async function save() {
    if (!roster) return;
    setSaving(true);
    try {
      await apiMutate(`/api/faculty/attendance`, {
        method: "POST",
        body: { courseId, date, records: roster.map((s) => ({ studentId: s.id, status: statuses[s.id] ?? "present" })) },
      });
      toast.success(`Attendance saved for ${date}.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save attendance");
    } finally {
      setSaving(false);
    }
  }

  if (!roster) return <p className="px-1 py-3 text-sm text-muted-foreground">Loading roster...</p>;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <label className="text-xs font-medium text-muted-foreground" htmlFor={`att-date-${courseId}`}>
          Session date
        </label>
        <input
          id={`att-date-${courseId}`}
          type="date"
          value={date}
          max={today()}
          onChange={(e) => setDate(e.target.value)}
          className="rounded-md border border-input bg-background px-2 py-1 text-sm"
        />
      </div>
      <div className="overflow-hidden card-surface">
        <table className="w-full text-left text-sm">
          <thead className="bg-muted/50 text-xs font-medium text-muted-foreground">
            <tr>
              <th className="px-4 py-2 font-medium">Roll No.</th>
              <th className="px-4 py-2 font-medium">Name</th>
              <th className="px-4 py-2 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {roster.map((s) => (
              <tr key={s.id} className="border-t border-border">
                <td className="px-4 py-2 font-mono text-xs">{s.rollNumber}</td>
                <td className="px-4 py-2">
                  {s.firstName} {s.lastName}
                </td>
                <td className="px-4 py-2">
                  <div className="flex gap-1">
                    {STATUSES.map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setStatuses((prev) => ({ ...prev, [s.id]: opt.value }))}
                        className={cn(
                          "rounded-full border px-2 py-0.5 text-xs transition-colors",
                          statuses[s.id] === opt.value
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-input text-muted-foreground hover:bg-secondary",
                        )}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Button size="sm" onClick={save} disabled={saving} className="gap-1.5">
        {saving && <Loader2 className="size-3.5 animate-spin" />}
        Save attendance
      </Button>
    </div>
  );
}
