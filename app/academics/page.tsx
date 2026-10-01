"use client";

import { GraduationCap } from "lucide-react";
import { useApiGet } from "@/lib/client/use-api";
import { PageHeader } from "@/components/common/page-header";
import { LoadingBlock, ErrorBlock, EmptyState } from "@/components/common/state-blocks";
import { AiCardView } from "@/components/ai/ai-card";
import { Badge } from "@/components/ui/badge";
import type { Exam, ResultRow, StudentRisk } from "@/lib/api-types";

export default function AcademicsPage() {
  const { data: examData, loading: examLoading, error: examError, reload } = useApiGet<{ exams: Exam[] }>("/api/exams");
  const { data: perf } = useApiGet<{ risk: StudentRisk | null }>("/api/academics/performance");
  const { data: resultsData } = useApiGet<{ results: ResultRow[] }>("/api/exams/results");
  const results = resultsData?.results ?? [];

  const exams = examData?.exams ?? [];
  const today = new Date().toDateString();
  const upcoming = exams.filter((e) => new Date(e.date) >= new Date(today));
  const past = exams.filter((e) => new Date(e.date) < new Date(today));

  return (
    <div className="space-y-8">
      <div>
        <PageHeader title="Academics" description="Exam schedule and academic performance." />

        {examLoading && <LoadingBlock rows={4} />}
        {examError && <ErrorBlock message={examError} onRetry={reload} />}

        {examData && exams.length === 0 && <EmptyState icon={GraduationCap} title="No exams scheduled" />}

        {upcoming.length > 0 && (
          <div className="mb-6">
            <h2 className="mb-3 text-sm font-medium text-muted-foreground">Upcoming exams</h2>
            <div className="overflow-hidden card-surface">
              <table className="w-full text-left text-sm">
                <thead className="bg-muted/50 text-xs font-medium text-muted-foreground">
                  <tr>
                    <th className="px-4 py-2 font-medium">Course</th>
                    <th className="px-4 py-2 font-medium">Type</th>
                    <th className="px-4 py-2 font-medium">Date</th>
                    <th className="px-4 py-2 font-medium">Max marks</th>
                  </tr>
                </thead>
                <tbody>
                  {upcoming.map((e) => (
                    <tr key={e.id} className="border-t border-border transition-colors hover:bg-brand-tint">
                      <td className="px-4 py-2.5">
                        <p className="font-medium">{e.courseCode}</p>
                        <p className="text-xs text-muted-foreground">{e.courseName}</p>
                      </td>
                      <td className="px-4 py-2.5 capitalize">{e.examType}</td>
                      <td className="px-4 py-2.5">{e.date}</td>
                      <td className="px-4 py-2.5">{e.maxMarks}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {past.length > 0 && (
          <div>
            <h2 className="mb-3 text-sm font-medium text-muted-foreground">Past exams</h2>
            <div className="overflow-hidden card-surface">
              <table className="w-full text-left text-sm">
                <tbody>
                  {past.map((e) => (
                    <tr key={e.id} className="border-t border-border transition-colors first:border-t-0 hover:bg-brand-tint">
                      <td className="px-4 py-2.5 text-muted-foreground">{e.courseCode}</td>
                      <td className="px-4 py-2.5">{e.name}</td>
                      <td className="px-4 py-2.5 text-muted-foreground">{e.date}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {results.length > 0 && (
        <div>
          <h2 className="mb-3 text-sm font-medium text-muted-foreground">My results</h2>
          <div className="overflow-hidden card-surface">
            <table className="w-full text-left text-sm">
              <thead className="bg-muted/50 text-xs font-medium text-muted-foreground">
                <tr>
                  <th className="px-4 py-2 font-medium">Course</th>
                  <th className="px-4 py-2 font-medium">Exam</th>
                  <th className="px-4 py-2 font-medium">Marks</th>
                  <th className="px-4 py-2 font-medium">%</th>
                </tr>
              </thead>
              <tbody>
                {results.map((r) => (
                  <tr key={r.examId} className="border-t border-border transition-colors hover:bg-brand-tint">
                    <td className="px-4 py-2.5">
                      <p className="font-medium">{r.courseCode}</p>
                      <p className="text-xs text-muted-foreground">{r.courseName}</p>
                    </td>
                    <td className="px-4 py-2.5">{r.examName}</td>
                    <td className="px-4 py-2.5">
                      {r.marksObtained} / {r.maxMarks}
                    </td>
                    <td className="px-4 py-2.5">
                      <Badge variant={r.percentage < 40 ? "destructive" : "secondary"}>{r.percentage}%</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {perf?.risk && (
        <div>
          <h2 className="mb-3 text-sm font-medium text-muted-foreground">Performance signal</h2>
          <AiCardView
            card={{
              type: "risk",
              title: perf.risk.riskLevel === "low" ? "On track" : "Academic attention needed",
              factors: perf.risk.factors.length
                ? perf.risk.factors
                : [{ label: "Overall", detail: "No risk factors detected", severity: "low" }],
            }}
          />
        </div>
      )}
    </div>
  );
}
