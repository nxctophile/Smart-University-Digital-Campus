"use client";

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";

type Row = { code: string; avgAttendance: number };

function barColor(pct: number) {
  if (pct < 75) return "var(--color-destructive)";
  if (pct < 85) return "var(--color-warning)";
  return "var(--color-success)";
}

export function DepartmentAttendanceChart({ data }: { data: Row[] }) {
  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ left: 0, right: 8, top: 4, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-border)" />
          <XAxis dataKey="code" tick={{ fontSize: 11 }} stroke="var(--color-muted-foreground)" />
          <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} stroke="var(--color-muted-foreground)" />
          <Tooltip
            cursor={{ fill: "var(--color-muted)" }}
            contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid var(--color-border)" }}
            formatter={(value) => [`${value}%`, "Avg. attendance"]}
          />
          <Bar dataKey="avgAttendance" radius={[4, 4, 0, 0]} isAnimationActive={false}>
            {data.map((d) => (
              <Cell key={d.code} fill={barColor(d.avgAttendance)} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
