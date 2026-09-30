"use client";

import { useState } from "react";
import { History, CalendarCheck, GraduationCap, Wallet, ClipboardList } from "lucide-react";
import { PageHeader } from "@/components/common/page-header";
import { LoadingBlock, ErrorBlock, EmptyState } from "@/components/common/state-blocks";
import { Badge } from "@/components/ui/badge";
import { useApiGet } from "@/lib/client/use-api";
import { cn } from "@/lib/utils";
import type { AttendanceHistoryRecord, ResultRow, PaymentReceipt, LeaveApplication, HelpdeskTicket } from "@/lib/api-types";

type Tab = "attendance" | "marks" | "fees" | "applications";
const TABS: { key: Tab; label: string }[] = [
  { key: "attendance", label: "Attendance History" },
  { key: "marks", label: "Marks History" },
  { key: "fees", label: "Fee History" },
  { key: "applications", label: "Applications" },
];

export default function ReportsPage() {
  const [tab, setTab] = useState<Tab>("attendance");

  return (
    <div className="space-y-6">
      <PageHeader title="My Records" description="Complete history across attendance, marks, fees, and submitted applications." />
      <div className="flex gap-1 overflow-x-auto rounded-lg bg-muted p-0.5 text-xs">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={cn(
              "flex shrink-0 items-center gap-1.5 rounded-md px-3 py-1.5 font-medium transition-colors",
              tab === t.key ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>
      {tab === "attendance" && <AttendanceHistoryTab />}
      {tab === "marks" && <MarksHistoryTab />}
      {tab === "fees" && <FeeHistoryTab />}
      {tab === "applications" && <ApplicationsTab />}
    </div>
  );
}

const ATT_VARIANT: Record<string, "default" | "secondary" | "destructive"> = {
  present: "secondary",
  excused: "secondary",
  late: "default",
  absent: "destructive",
};

function AttendanceHistoryTab() {
  const { data, loading, error, reload } = useApiGet<{ records: AttendanceHistoryRecord[] }>("/api/attendance/history");
  if (loading) return <LoadingBlock rows={4} />;
  if (error) return <ErrorBlock message={error} onRetry={reload} />;
  if (!data || data.records.length === 0) return <EmptyState icon={CalendarCheck} title="No attendance recorded yet" />;

  return (
    <div className="overflow-hidden card-surface">
      <table className="w-full text-left text-sm">
        <thead className="bg-muted/50 text-xs font-medium text-muted-foreground">
          <tr>
            <th className="px-4 py-2 font-medium">Date</th>
            <th className="px-4 py-2 font-medium">Course</th>
            <th className="px-4 py-2 font-medium">Status</th>
          </tr>
        </thead>
        <tbody>
          {data.records.map((r, i) => (
            <tr key={i} className="border-t border-border">
              <td className="px-4 py-2">{r.date}</td>
              <td className="px-4 py-2">
                {r.courseCode} <span className="text-xs text-muted-foreground">{r.courseName}</span>
              </td>
              <td className="px-4 py-2">
                <Badge variant={ATT_VARIANT[r.status] ?? "default"} className="capitalize">
                  {r.status}
                </Badge>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function MarksHistoryTab() {
  const { data, loading, error, reload } = useApiGet<{ results: ResultRow[] }>("/api/exams/results");
  if (loading) return <LoadingBlock rows={4} />;
  if (error) return <ErrorBlock message={error} onRetry={reload} />;
  if (!data || data.results.length === 0) return <EmptyState icon={GraduationCap} title="No published results yet" />;

  return (
    <div className="overflow-hidden card-surface">
      <table className="w-full text-left text-sm">
        <thead className="bg-muted/50 text-xs font-medium text-muted-foreground">
          <tr>
            <th className="px-4 py-2 font-medium">Exam</th>
            <th className="px-4 py-2 font-medium">Course</th>
            <th className="px-4 py-2 font-medium">Date</th>
            <th className="px-4 py-2 font-medium">Marks</th>
          </tr>
        </thead>
        <tbody>
          {data.results.map((r, i) => (
            <tr key={i} className="border-t border-border">
              <td className="px-4 py-2">{r.examName}</td>
              <td className="px-4 py-2">
                {r.courseCode} <span className="text-xs text-muted-foreground">{r.courseName}</span>
              </td>
              <td className="px-4 py-2">{r.date}</td>
              <td className="px-4 py-2">
                {r.marksObtained}/{r.maxMarks} ({r.percentage}%)
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function FeeHistoryTab() {
  const { data, loading, error, reload } = useApiGet<{ payments: PaymentReceipt[] }>("/api/payments/history");
  if (loading) return <LoadingBlock rows={4} />;
  if (error) return <ErrorBlock message={error} onRetry={reload} />;
  if (!data || data.payments.length === 0) return <EmptyState icon={Wallet} title="No payments on file yet" />;

  return (
    <div className="space-y-2">
      {data.payments.map((p) => (
        <div key={p.id} className="card-surface flex items-center justify-between p-3.5 text-sm">
          <div>
            <p className="font-medium capitalize">{p.feeType} fee</p>
            <p className="text-xs text-muted-foreground">{new Date(p.paidAt).toLocaleDateString("en-IN")} · {p.method}</p>
          </div>
          <span className="font-medium">₹{p.amount.toLocaleString("en-IN")}</span>
        </div>
      ))}
    </div>
  );
}

type TimelineEntry = { date: string; label: string; detail: string; status: string };

function ApplicationsTab() {
  const leave = useApiGet<{ applications: LeaveApplication[] }>("/api/leave");
  const tickets = useApiGet<{ tickets: HelpdeskTicket[] }>("/api/helpdesk/tickets");

  const loading = leave.loading || tickets.loading;
  const error = leave.error ?? tickets.error;

  if (loading) return <LoadingBlock rows={4} />;
  if (error) return <ErrorBlock message={error} onRetry={() => { leave.reload(); tickets.reload(); }} />;

  const entries: TimelineEntry[] = [
    ...(leave.data?.applications ?? []).map((a) => ({ date: a.appliedAt, label: "Leave application", detail: `${a.leaveType} · ${a.fromDate} to ${a.toDate}`, status: a.status })),
    ...(tickets.data?.tickets ?? []).map((t) => ({ date: t.createdAt, label: "Helpdesk ticket", detail: `${t.subject} (${t.category})`, status: t.status })),
  ].sort((a, b) => b.date.localeCompare(a.date));

  if (entries.length === 0) return <EmptyState icon={ClipboardList} title="No applications submitted yet" />;

  return (
    <div className="space-y-2">
      {entries.map((e, i) => (
        <div key={i} className="card-surface flex items-center justify-between gap-3 p-3.5 text-sm">
          <div className="flex items-center gap-2.5">
            <History className="size-4 shrink-0 text-muted-foreground" />
            <div>
              <p className="font-medium">{e.label}</p>
              <p className="text-xs text-muted-foreground">{e.detail}</p>
            </div>
          </div>
          <div className="text-right">
            <Badge variant="secondary" className="capitalize">
              {e.status.replace("_", " ")}
            </Badge>
            <p className="mt-1 text-[11px] text-muted-foreground">{new Date(e.date).toLocaleDateString("en-IN")}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
