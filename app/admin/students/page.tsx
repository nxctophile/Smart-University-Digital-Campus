"use client";

import { useEffect, useMemo, useState } from "react";
import { Search, Send, Download, Loader2 } from "lucide-react";
import { PageHeader } from "@/components/common/page-header";
import { LoadingBlock, ErrorBlock, EmptyState } from "@/components/common/state-blocks";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { apiGet, apiPost } from "@/lib/client/api";
import { toast } from "sonner";
import { Users } from "lucide-react";
import type { StudentRisk } from "@/lib/services/risk";

const RISK_VARIANT: Record<string, "default" | "secondary" | "destructive"> = {
  high: "destructive",
  medium: "default",
  low: "secondary",
};

const DEPARTMENTS = [
  { code: "all", label: "All departments" },
  { code: "CSE", label: "Computer Science" },
  { code: "ECE", label: "Electronics" },
  { code: "ME", label: "Mechanical" },
  { code: "CE", label: "Civil" },
  { code: "MGMT", label: "Management" },
];

export default function AdminStudentsPage() {
  const [query, setQuery] = useState("");
  const [department, setDepartment] = useState("all");
  const [maxAttendance, setMaxAttendance] = useState("100");
  const [riskLevel, setRiskLevel] = useState("all");
  const [examWithinDays, setExamWithinDays] = useState("any");
  const [rows, setRows] = useState<StudentRisk[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [notifying, setNotifying] = useState(false);

  const queryString = useMemo(() => {
    const params = new URLSearchParams();
    if (query) params.set("query", query);
    if (department !== "all") params.set("department", department);
    if (maxAttendance !== "100") params.set("maxAttendance", maxAttendance);
    if (riskLevel !== "all") params.set("riskLevel", riskLevel);
    if (examWithinDays !== "any") params.set("examWithinDays", examWithinDays);
    params.set("limit", "200");
    return params.toString();
  }, [query, department, maxAttendance, riskLevel, examWithinDays]);

  useEffect(() => {
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- standard fetch-on-filter-change pattern, guarded by `cancelled`
    setLoading(true);
    setError(null);
    apiGet<{ students: StudentRisk[] }>(`/api/admin/at-risk?${queryString}`)
      .then((d) => {
        if (!cancelled) setRows(d.students);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [queryString]);

  function toggleAll() {
    if (!rows) return;
    setSelected((prev) => (prev.size === rows.length ? new Set() : new Set(rows.map((r) => r.studentId))));
  }

  function toggleOne(id: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function notify(channel: "student" | "parent") {
    if (selected.size === 0) return;
    setNotifying(true);
    try {
      await apiPost("/api/admin/notify", {
        studentIds: Array.from(selected),
        channel,
        message: "Academic attention needed - please review attendance/performance.",
      });
      toast.success(`Notified ${selected.size} ${channel === "parent" ? "parent(s)" : "student(s)"}.`);
      setSelected(new Set());
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to notify");
    } finally {
      setNotifying(false);
    }
  }

  function exportCsv() {
    if (!rows) return;
    const header = "Roll Number,Name,Department,Semester,Attendance %,Recent Test Avg,Fee Status,Risk\n";
    const lines = rows
      .map((r) => [r.rollNumber, r.name, r.department, r.semester, r.attendancePercentage, r.recentTestAverage, r.feeStatus, r.riskLevel].join(","))
      .join("\n");
    const blob = new Blob([header + lines], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "students-export.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div>
      <PageHeader title="Students" description="Search and filter the student directory. Identify at-risk students and take action." />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-2.5 size-3.5 text-muted-foreground" />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search name or roll no." className="w-56 pl-8" />
        </div>
        <Select
          items={Object.fromEntries(DEPARTMENTS.map((d) => [d.code, d.label]))}
          value={department}
          onValueChange={(v) => setDepartment(v ?? "all")}
        >
          <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            {DEPARTMENTS.map((d) => (
              <SelectItem key={d.code} value={d.code}>{d.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          items={{ "100": "Any attendance", "75": "Below 75%", "60": "Below 60%" }}
          value={maxAttendance}
          onValueChange={(v) => setMaxAttendance(v ?? "100")}
        >
          <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="100">Any attendance</SelectItem>
            <SelectItem value="75">Below 75%</SelectItem>
            <SelectItem value="60">Below 60%</SelectItem>
          </SelectContent>
        </Select>
        <Select
          items={{ all: "Any risk", high: "High risk", medium: "Medium risk", low: "Low risk" }}
          value={riskLevel}
          onValueChange={(v) => setRiskLevel(v ?? "all")}
        >
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Any risk</SelectItem>
            <SelectItem value="high">High risk</SelectItem>
            <SelectItem value="medium">Medium risk</SelectItem>
            <SelectItem value="low">Low risk</SelectItem>
          </SelectContent>
        </Select>
        <Select
          items={{ any: "Any exam timing", "7": "Exams within 7 days", "14": "Exams within 14 days" }}
          value={examWithinDays}
          onValueChange={(v) => setExamWithinDays(v ?? "any")}
        >
          <SelectTrigger className="w-52"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="any">Any exam timing</SelectItem>
            <SelectItem value="7">Exams within 7 days</SelectItem>
            <SelectItem value="14">Exams within 14 days</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {selected.size > 0 && (
        <div className="mb-3 flex items-center gap-2 rounded-lg border border-accent/30 bg-accent/5 px-3 py-2">
          <p className="text-sm">{selected.size} selected</p>
          <Button size="sm" variant="outline" className="gap-1.5" onClick={() => notify("student")} disabled={notifying}>
            {notifying ? <Loader2 className="size-3.5 animate-spin" /> : <Send className="size-3.5" />} Notify Students
          </Button>
          <Button size="sm" variant="outline" className="gap-1.5" onClick={() => notify("parent")} disabled={notifying}>
            {notifying ? <Loader2 className="size-3.5 animate-spin" /> : <Send className="size-3.5" />} Notify Parents
          </Button>
        </div>
      )}

      {loading && <LoadingBlock rows={6} />}
      {error && <ErrorBlock message={error} onRetry={() => setError(null)} />}
      {rows && rows.length === 0 && <EmptyState icon={Users} title="No students match these filters" />}

      {rows && rows.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">{rows.length} students found</p>
            <Button size="sm" variant="outline" className="gap-1.5" onClick={exportCsv}>
              <Download className="size-3.5" /> Export
            </Button>
          </div>
          <div className="overflow-hidden card-surface">
            <table className="w-full text-left text-sm">
              <thead className="bg-muted/50 text-xs font-medium text-muted-foreground">
                <tr>
                  <th className="w-10 px-4 py-2">
                    <Checkbox checked={rows.length > 0 && selected.size === rows.length} onCheckedChange={toggleAll} />
                  </th>
                  <th className="px-4 py-2 font-medium">Roll No.</th>
                  <th className="px-4 py-2 font-medium">Name</th>
                  <th className="px-4 py-2 font-medium">Department</th>
                  <th className="px-4 py-2 font-medium">Sem</th>
                  <th className="px-4 py-2 font-medium">Attendance</th>
                  <th className="px-4 py-2 font-medium">Test avg</th>
                  <th className="px-4 py-2 font-medium">Fees</th>
                  <th className="px-4 py-2 font-medium">Risk</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.studentId} className="border-t border-border transition-colors hover:bg-muted/30">
                    <td className="px-4 py-2">
                      <Checkbox checked={selected.has(r.studentId)} onCheckedChange={() => toggleOne(r.studentId)} />
                    </td>
                    <td className="px-4 py-2.5 font-mono text-xs">{r.rollNumber}</td>
                    <td className="px-4 py-2.5">{r.name}</td>
                    <td className="px-4 py-2.5 text-muted-foreground">{r.departmentCode}</td>
                    <td className="px-4 py-2.5">{r.semester}</td>
                    <td className="px-4 py-2.5">
                      <span className={r.attendancePercentage < 75 ? "font-medium text-destructive" : ""}>{r.attendancePercentage}%</span>
                    </td>
                    <td className="px-4 py-2.5">{r.recentTestAverage}%</td>
                    <td className="px-4 py-2.5 capitalize text-muted-foreground">{r.feeStatus}</td>
                    <td className="px-4 py-2.5">
                      <Badge variant={RISK_VARIANT[r.riskLevel]} className="capitalize">
                        {r.riskLevel}
                      </Badge>
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
