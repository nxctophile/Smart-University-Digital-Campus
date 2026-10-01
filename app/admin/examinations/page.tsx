"use client";

import { useState } from "react";
import { Briefcase, Loader2, ShieldAlert, Plus, Check, X } from "lucide-react";
import { PageHeader } from "@/components/common/page-header";
import { LoadingBlock, ErrorBlock, EmptyState } from "@/components/common/state-blocks";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useApiGet } from "@/lib/client/use-api";
import { apiMutate } from "@/lib/client/api";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { usePermissions } from "@/lib/client/use-permissions";
import type { ExamPendingRow as ExamRow, ExamFormWindow, ExamReviewQueueItem, ExamReviewKind } from "@/lib/api-types";

type Tab = "publish" | "windows" | "review";

export default function ExaminationsPage() {
  const { permissions } = usePermissions();
  const [tab, setTab] = useState<Tab>("publish");

  const tabs: { key: Tab; label: string; show: boolean }[] = [
    { key: "publish", label: "Publish Results", show: true },
    { key: "windows", label: "Exam Form Windows", show: permissions.includes("exam.form.manage") },
    { key: "review", label: "Reval / Retotal / Challenge", show: permissions.includes("exam.review.manage") },
  ];
  const visibleTabs = tabs.filter((t) => t.show);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Examinations"
        description="Examination Department - exam results are treated as highly sensitive and only visible to students once published here."
      />

      {visibleTabs.length > 1 && (
        <div className="flex gap-1 overflow-x-auto rounded-lg bg-muted p-0.5 text-xs">
          {visibleTabs.map((t) => (
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
      )}

      {tab === "publish" && <PublishResultsTab />}
      {tab === "windows" && <ExamFormWindowsTab />}
      {tab === "review" && <ReviewQueueTab />}
    </div>
  );
}

function PublishResultsTab() {
  const { data, loading, error, reload } = useApiGet<{ exams: ExamRow[] }>("/api/admin/exams/pending");
  const [publishingId, setPublishingId] = useState<number | null>(null);
  const exams = data?.exams ?? [];

  async function publish(examId: number) {
    setPublishingId(examId);
    try {
      const result = await apiMutate<{ published: number }>("/api/admin/exams/publish", { method: "POST", body: { examId } });
      toast.success(`Published ${result.published} result(s).`);
      reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to publish results");
    } finally {
      setPublishingId(null);
    }
  }

  return (
    <div>
      {loading && <LoadingBlock rows={3} />}
      {error && <ErrorBlock message={error} onRetry={reload} />}
      {data && exams.length === 0 && <EmptyState icon={Briefcase} title="No exams awaiting publication" />}
      {exams.length > 0 && (
        <div className="overflow-hidden card-surface">
          <table className="w-full text-left text-sm">
            <thead className="bg-muted/50 text-xs font-medium text-muted-foreground">
              <tr>
                <th className="px-4 py-2 font-medium">Exam</th>
                <th className="px-4 py-2 font-medium">Course</th>
                <th className="px-4 py-2 font-medium">Date</th>
                <th className="px-4 py-2 font-medium">Marks entered</th>
                <th className="px-4 py-2 font-medium">Status</th>
                <th className="px-4 py-2 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {exams.map((e) => (
                <tr key={e.id} className="border-t border-border transition-colors hover:bg-brand-tint">
                  <td className="px-4 py-2.5">{e.name}</td>
                  <td className="px-4 py-2.5">
                    {e.courseCode} <span className="text-xs text-muted-foreground">{e.courseName}</span>
                  </td>
                  <td className="px-4 py-2.5">{e.date}</td>
                  <td className="px-4 py-2.5">{e.totalEntered}</td>
                  <td className="px-4 py-2.5">
                    {e.pendingPublish > 0 ? (
                      <Badge variant="default" className="gap-1">
                        <ShieldAlert className="size-3" /> {e.pendingPublish} pending
                      </Badge>
                    ) : e.totalEntered > 0 ? (
                      <Badge variant="secondary">Published</Badge>
                    ) : (
                      <span className="text-xs text-muted-foreground">No marks yet</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={publishingId === e.id || e.pendingPublish === 0}
                      onClick={() => publish(e.id)}
                      className="gap-1.5"
                    >
                      {publishingId === e.id && <Loader2 className="size-3.5 animate-spin" />}
                      Publish results
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function ExamFormWindowsTab() {
  const { data, loading, error, reload } = useApiGet<{ windows: ExamFormWindow[] }>("/api/admin/exam-form/windows");
  const [form, setForm] = useState({ name: "", semester: "1", opensAt: "", closesAt: "" });
  const [creating, setCreating] = useState(false);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    try {
      await apiMutate("/api/admin/exam-form/windows", {
        method: "POST",
        body: { name: form.name, semester: Number(form.semester), opensAt: form.opensAt, closesAt: form.closesAt },
      });
      toast.success("Exam form window published.");
      setForm({ name: "", semester: "1", opensAt: "", closesAt: "" });
      reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to publish window");
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="space-y-6">
      <form onSubmit={create} className="card-surface grid grid-cols-1 gap-3 p-4 sm:grid-cols-2 lg:grid-cols-5 lg:items-end">
        <div className="space-y-1.5">
          <Label>Name</Label>
          <Input required value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="End Semester 2026-27" />
        </div>
        <div className="space-y-1.5">
          <Label>Semester</Label>
          <Input required type="number" min={1} max={8} value={form.semester} onChange={(e) => setForm((f) => ({ ...f, semester: e.target.value }))} />
        </div>
        <div className="space-y-1.5">
          <Label>Opens</Label>
          <Input required type="date" value={form.opensAt} onChange={(e) => setForm((f) => ({ ...f, opensAt: e.target.value }))} />
        </div>
        <div className="space-y-1.5">
          <Label>Closes</Label>
          <Input required type="date" value={form.closesAt} onChange={(e) => setForm((f) => ({ ...f, closesAt: e.target.value }))} />
        </div>
        <Button type="submit" disabled={creating} className="gap-1.5">
          {creating ? <Loader2 className="size-3.5 animate-spin" /> : <Plus className="size-3.5" />}
          Publish window
        </Button>
      </form>

      {loading && <LoadingBlock rows={2} />}
      {error && <ErrorBlock message={error} onRetry={reload} />}
      {data && data.windows.length === 0 && <EmptyState icon={Briefcase} title="No exam form windows published yet" />}
      {data && data.windows.length > 0 && (
        <div className="space-y-2">
          {data.windows.map((w) => (
            <div key={w.id} className="card-surface flex items-center justify-between p-3.5 text-sm">
              <div>
                <p className="font-medium">{w.name}</p>
                <p className="text-xs text-muted-foreground">
                  Semester {w.semester} · {w.opensAt} to {w.closesAt}
                </p>
              </div>
              <Badge variant="secondary">Published</Badge>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const KIND_LABEL: Record<ExamReviewKind, string> = { revaluation: "Revaluation", retotal: "Retotal", challenge: "Challenge" };

function ReviewQueueTab() {
  const { data, loading, error, reload } = useApiGet<{ applications: ExamReviewQueueItem[] }>("/api/admin/exam-review");
  const [decidingId, setDecidingId] = useState<number | null>(null);

  async function decide(id: number, status: string) {
    setDecidingId(id);
    try {
      await apiMutate("/api/admin/exam-review/decide", { body: { applicationId: id, status } });
      toast.success(`Application marked ${status.replace("_", " ")}.`);
      reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update");
    } finally {
      setDecidingId(null);
    }
  }

  const pending = data?.applications.filter((a) => a.status === "submitted" || a.status === "under_review") ?? [];

  return (
    <div>
      {loading && <LoadingBlock rows={3} />}
      {error && <ErrorBlock message={error} onRetry={reload} />}
      {data && pending.length === 0 && <EmptyState icon={Briefcase} title="No applications awaiting review" />}
      {pending.length > 0 && (
        <div className="space-y-2">
          {pending.map((a) => (
            <div key={a.id} className="card-surface flex items-center justify-between gap-3 p-3.5 text-sm">
              <div>
                <p className="font-medium">
                  {a.firstName} {a.lastName} <span className="font-normal text-muted-foreground">({a.rollNumber})</span>
                </p>
                <p className="text-xs text-muted-foreground">
                  {KIND_LABEL[a.kind]} · {a.courseCode} - {a.examName} · Fee ₹{a.feeAmount}
                </p>
              </div>
              <div className="flex shrink-0 gap-2">
                <Button size="sm" variant="outline" disabled={decidingId === a.id} onClick={() => decide(a.id, "under_review")} className="gap-1.5">
                  Mark under review
                </Button>
                <Button size="sm" variant="outline" disabled={decidingId === a.id} onClick={() => decide(a.id, "completed")} className="gap-1.5 text-success hover:text-success">
                  <Check className="size-3.5" /> Complete
                </Button>
                <Button size="sm" variant="outline" disabled={decidingId === a.id} onClick={() => decide(a.id, "rejected")} className="gap-1.5 text-destructive hover:text-destructive">
                  <X className="size-3.5" /> Reject
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
