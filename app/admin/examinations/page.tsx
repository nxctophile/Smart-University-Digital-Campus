"use client";

import { useState } from "react";
import { Briefcase, Loader2, ShieldAlert } from "lucide-react";
import { PageHeader } from "@/components/common/page-header";
import { LoadingBlock, ErrorBlock, EmptyState } from "@/components/common/state-blocks";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useApiGet } from "@/lib/client/use-api";
import { apiMutate } from "@/lib/client/api";
import { toast } from "sonner";
import type { listExamsForPublishing } from "@/lib/services/exams";

type ExamRow = Awaited<ReturnType<typeof listExamsForPublishing>>[number];

export default function ExaminationsPage() {
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
    <div className="space-y-8">
      <div>
        <PageHeader
          title="Examinations"
          description="Examination Department - exam results are treated as highly sensitive and only visible to students once published here."
        />
        {loading && <LoadingBlock rows={3} />}
        {error && <ErrorBlock message={error} onRetry={reload} />}
      </div>

      <section>
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
                  <tr key={e.id} className="border-t border-border transition-colors hover:bg-muted/30">
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
      </section>
    </div>
  );
}
