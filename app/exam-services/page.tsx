"use client";

import { useState } from "react";
import { FileCheck2, Printer, Loader2, AlertTriangle, CheckCircle2 } from "lucide-react";
import { PageHeader } from "@/components/common/page-header";
import { LoadingBlock, ErrorBlock, EmptyState } from "@/components/common/state-blocks";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useApiGet } from "@/lib/client/use-api";
import { apiMutate } from "@/lib/client/api";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { ExamFormData, ExamReviewData, ExamReviewKind, BacklogCourse } from "@/lib/api-types";

type Tab = "form" | "review" | "backlogs";
const TABS: { key: Tab; label: string }[] = [
  { key: "form", label: "Exam Form" },
  { key: "review", label: "Revaluation / Retotal / Challenge" },
  { key: "backlogs", label: "Backlogs" },
];

export default function ExamServicesPage() {
  const [tab, setTab] = useState<Tab>("form");

  return (
    <div className="space-y-6">
      <PageHeader title="Exam Services" description="Exam form, revaluation/retotal/challenge applications, and backlog status." />
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
      {tab === "form" && <ExamFormTab />}
      {tab === "review" && <ExamReviewTab />}
      {tab === "backlogs" && <BacklogsTab />}
    </div>
  );
}

function ExamFormTab() {
  const { data, loading, error, reload } = useApiGet<ExamFormData>("/api/exam-form");
  const [selected, setSelected] = useState<number[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const active = data?.submission ? data.submission.courseIds : selected;

  async function submit() {
    if (!data?.window) return;
    setSubmitting(true);
    try {
      await apiMutate("/api/exam-form/submit", { body: { windowId: data.window.id, courseIds: selected } });
      toast.success("Exam form submitted.");
      reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to submit");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <LoadingBlock rows={4} />;
  if (error) return <ErrorBlock message={error} onRetry={reload} />;
  if (!data) return null;

  if (!data.window) {
    return <EmptyState icon={FileCheck2} title="No exam form window is currently published" description="Check back once the Examination Department opens the window for your semester." />;
  }

  return (
    <div className="max-w-2xl space-y-4">
      <div className="card-surface p-4">
        <p className="text-sm font-medium">{data.window.name}</p>
        <p className="text-xs text-muted-foreground">
          {data.student.programme} · Semester {data.student.semester} · Window open {data.window.opensAt} to {data.window.closesAt}
        </p>
      </div>

      <div className="card-surface p-4">
        <p className="mb-3 text-sm font-medium">Confirm courses</p>
        <div className="space-y-2">
          {data.courses.map((c) => (
            <label key={c.id} className="flex items-center gap-2.5 rounded-md border border-border/70 px-3 py-2 text-sm">
              <Checkbox
                checked={active.includes(c.id)}
                disabled={!!data.submission}
                onCheckedChange={(checked) => setSelected((prev) => (checked ? [...prev, c.id] : prev.filter((id) => id !== c.id)))}
              />
              <span className="font-medium">{c.code}</span>
              <span className="text-muted-foreground">{c.name}</span>
              <span className="ml-auto text-xs text-muted-foreground">{c.credits} cr</span>
            </label>
          ))}
        </div>
      </div>

      {data.submission ? (
        <div className="flex items-center gap-2 rounded-lg border border-success/40 bg-success/10 p-3 text-sm text-success">
          <CheckCircle2 className="size-4" /> Submitted {new Date(data.submission.submittedAt).toLocaleString("en-IN")}
        </div>
      ) : (
        <Button onClick={submit} disabled={submitting || selected.length === 0} className="gap-1.5">
          {submitting && <Loader2 className="size-3.5 animate-spin" />}
          Submit exam form
        </Button>
      )}

      {data.submission && (
        <Button variant="outline" onClick={() => window.print()} className="gap-1.5 print:hidden">
          <Printer className="size-3.5" /> Print exam form
        </Button>
      )}
    </div>
  );
}

const KIND_LABEL: Record<ExamReviewKind, string> = { revaluation: "Revaluation", retotal: "Retotal", challenge: "Challenge" };
const STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive"> = {
  submitted: "default",
  under_review: "default",
  approved: "secondary",
  completed: "secondary",
  rejected: "destructive",
};

function ExamReviewTab() {
  const { data, loading, error, reload } = useApiGet<ExamReviewData>("/api/exam-review");
  const [examId, setExamId] = useState<string>("");
  const [kind, setKind] = useState<ExamReviewKind>("revaluation");
  const [applying, setApplying] = useState(false);

  async function apply() {
    if (!data || !examId) return;
    const result = data.eligibleResults.find((r) => `${r.examId}:${r.courseId}` === examId);
    if (!result) return;

    let parentApplicationId: number | undefined;
    if (kind === "challenge") {
      const parent = data.applications.find((a) => a.courseId === result.courseId && a.kind === "revaluation" && a.status === "completed");
      if (!parent) {
        toast.error("A challenge requires a completed revaluation for this subject first.");
        return;
      }
      parentApplicationId = parent.id;
    }

    setApplying(true);
    try {
      await apiMutate("/api/exam-review/apply", { body: { examId: result.examId, courseId: result.courseId, kind, parentApplicationId } });
      toast.success("Application submitted.");
      reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to apply");
    } finally {
      setApplying(false);
    }
  }

  if (loading) return <LoadingBlock rows={3} />;
  if (error) return <ErrorBlock message={error} onRetry={reload} />;
  if (!data) return null;

  return (
    <div className="max-w-2xl space-y-6">
      <div className="card-surface space-y-3 p-4">
        <p className="text-sm font-medium">Apply</p>
        <div className="grid gap-3 sm:grid-cols-[1fr_180px_auto]">
          <Select
            items={Object.fromEntries(data.eligibleResults.map((r) => [`${r.examId}:${r.courseId}`, `${r.courseCode} · ${r.examName} (${r.marksObtained}/${r.maxMarks})`]))}
            value={examId}
            onValueChange={(v) => v && setExamId(v)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select a subject" />
            </SelectTrigger>
            <SelectContent>
              {data.eligibleResults.map((r) => (
                <SelectItem key={`${r.examId}:${r.courseId}`} value={`${r.examId}:${r.courseId}`}>
                  {r.courseCode} · {r.examName} ({r.marksObtained}/{r.maxMarks})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select items={KIND_LABEL} value={kind} onValueChange={(v) => v && setKind(v as ExamReviewKind)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(KIND_LABEL).map(([key, label]) => (
                <SelectItem key={key} value={key}>
                  {label} (₹{data.fees[key as ExamReviewKind]})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button onClick={apply} disabled={applying || !examId} className="gap-1.5">
            {applying && <Loader2 className="size-3.5 animate-spin" />}
            Apply
          </Button>
        </div>
        {kind === "challenge" && (
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <AlertTriangle className="size-3.5" /> Challenge is only available after a completed revaluation for the same subject.
          </p>
        )}
      </div>

      <div className="space-y-2">
        <p className="text-sm font-medium">My applications</p>
        {data.applications.length === 0 && <EmptyState icon={FileCheck2} title="No applications yet" />}
        {data.applications.map((a) => (
          <div key={a.id} className="card-surface flex items-center justify-between gap-3 p-3.5 text-sm">
            <div>
              <p className="font-medium">
                {KIND_LABEL[a.kind]} · {a.courseCode} - {a.examName}
              </p>
              <p className="text-xs text-muted-foreground">
                Applied {new Date(a.appliedAt).toLocaleDateString("en-IN")} · Fee ₹{a.feeAmount}
                {a.remarks ? ` · ${a.remarks}` : ""}
              </p>
            </div>
            <Badge variant={STATUS_VARIANT[a.status]} className="shrink-0 capitalize">
              {a.status.replace("_", " ")}
            </Badge>
          </div>
        ))}
      </div>
    </div>
  );
}

function BacklogsTab() {
  const { data, loading, error, reload } = useApiGet<{ courses: BacklogCourse[]; pendingCount: number }>("/api/backlogs");

  if (loading) return <LoadingBlock rows={3} />;
  if (error) return <ErrorBlock message={error} onRetry={reload} />;
  if (!data) return null;

  if (data.courses.length === 0) {
    return <EmptyState icon={CheckCircle2} title="No results on file yet" />;
  }

  return (
    <div className="space-y-3">
      {data.pendingCount === 0 ? (
        <div className="flex items-center gap-2 rounded-lg border border-success/40 bg-success/10 p-3 text-sm text-success">
          <CheckCircle2 className="size-4" /> No active backlogs - you&apos;re clear on every course attempted so far.
        </div>
      ) : (
        <div className="flex items-center gap-2 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          <AlertTriangle className="size-4" /> {data.pendingCount} course(s) currently below the pass mark on the latest attempt.
        </div>
      )}
      <div className="overflow-hidden card-surface">
        <table className="w-full text-left text-sm">
          <thead className="bg-muted/50 text-xs font-medium text-muted-foreground">
            <tr>
              <th className="px-4 py-2 font-medium">Course</th>
              <th className="px-4 py-2 font-medium">Semester</th>
              <th className="px-4 py-2 font-medium">Latest attempt</th>
              <th className="px-4 py-2 font-medium">Marks</th>
              <th className="px-4 py-2 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {data.courses.map((c) => (
              <tr key={c.courseId} className="border-t border-border">
                <td className="px-4 py-2.5">
                  <p className="font-medium">{c.courseCode}</p>
                  <p className="text-xs text-muted-foreground">{c.courseName}</p>
                </td>
                <td className="px-4 py-2.5">{c.semester}</td>
                <td className="px-4 py-2.5">{c.examName}</td>
                <td className="px-4 py-2.5">
                  {c.marksObtained}/{c.maxMarks} ({c.percentage}%)
                </td>
                <td className="px-4 py-2.5">
                  <Badge variant={c.status === "pending" ? "destructive" : "secondary"} className="capitalize">
                    {c.status}
                  </Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
