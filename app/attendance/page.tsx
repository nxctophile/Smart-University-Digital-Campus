"use client";

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { useApiGet } from "@/lib/client/use-api";
import { PageHeader } from "@/components/common/page-header";
import { LoadingBlock, ErrorBlock, EmptyState } from "@/components/common/state-blocks";
import { CalendarCheck } from "lucide-react";
import type { getAttendanceSummary } from "@/lib/services/attendance";

type Summary = Awaited<ReturnType<typeof getAttendanceSummary>>;

function barColor(pct: number) {
  if (pct < 75) return "var(--color-destructive)";
  if (pct < 85) return "var(--color-warning)";
  return "var(--color-success)";
}

export default function AttendancePage() {
  const { data, loading, error, reload } = useApiGet<Summary>("/api/attendance");

  return (
    <div>
      <PageHeader title="Attendance" description="Attendance is tracked per course. 75% is the minimum requirement." />

      {loading && <LoadingBlock rows={5} />}
      {error && <ErrorBlock message={error} onRetry={reload} />}

      {data && data.courses.length === 0 && (
        <EmptyState icon={CalendarCheck} title="No attendance records yet" />
      )}

      {data && data.courses.length > 0 && (
        <div className="space-y-6">
          <div className="card-surface p-4">
            <div className="mb-1 flex items-baseline justify-between">
              <p className="text-sm font-medium">Overall attendance</p>
              <p className="text-2xl font-semibold tracking-tight">{data.overallPercentage}%</p>
            </div>
            <p className="text-xs text-muted-foreground">{data.totalSessions} sessions recorded across {data.courses.length} courses</p>
          </div>

          <div className="card-surface p-4">
            <p className="mb-3 text-sm font-medium">By course</p>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.courses} margin={{ left: 0, right: 8, top: 4, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-border)" />
                  <XAxis dataKey="courseCode" tick={{ fontSize: 11 }} stroke="var(--color-muted-foreground)" />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} stroke="var(--color-muted-foreground)" />
                  <Tooltip
                    cursor={{ fill: "var(--color-muted)" }}
                    contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid var(--color-border)" }}
                    formatter={(value) => [`${value}%`, "Attendance"]}
                  />
                  <Bar dataKey="percentage" radius={[4, 4, 0, 0]} isAnimationActive={false}>
                    {data.courses.map((c) => (
                      <Cell key={c.courseId} fill={barColor(c.percentage)} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="overflow-hidden card-surface">
            <table className="w-full text-left text-sm">
              <thead className="bg-muted/50 text-xs font-medium text-muted-foreground">
                <tr>
                  <th className="px-4 py-2 font-medium">Course</th>
                  <th className="px-4 py-2 font-medium">Present</th>
                  <th className="px-4 py-2 font-medium">Absent</th>
                  <th className="px-4 py-2 font-medium">Total</th>
                  <th className="px-4 py-2 font-medium">Attendance</th>
                </tr>
              </thead>
              <tbody>
                {data.courses.map((c) => (
                  <tr key={c.courseId} className="border-t border-border transition-colors hover:bg-muted/30">
                    <td className="px-4 py-2.5">
                      <p className="font-medium">{c.courseCode}</p>
                      <p className="text-xs text-muted-foreground">{c.courseName}</p>
                    </td>
                    <td className="px-4 py-2.5">{c.present + c.excused}</td>
                    <td className="px-4 py-2.5">{c.absent}</td>
                    <td className="px-4 py-2.5">{c.total}</td>
                    <td className="px-4 py-2.5">
                      <span className={c.percentage < 75 ? "font-medium text-destructive" : "font-medium"}>{c.percentage}%</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
