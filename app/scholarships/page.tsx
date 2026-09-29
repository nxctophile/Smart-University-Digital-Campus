"use client";

import { useState } from "react";
import { Award, Loader2, CalendarClock } from "lucide-react";
import { PageHeader } from "@/components/common/page-header";
import { LoadingBlock, ErrorBlock, EmptyState } from "@/components/common/state-blocks";
import { StatusTimeline } from "@/components/common/status-timeline";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useApiGet } from "@/lib/client/use-api";
import { apiMutate } from "@/lib/client/api";
import { toast } from "sonner";
import type { getStudentScholarshipView } from "@/lib/services/scholarships";

type ViewData = Awaited<ReturnType<typeof getStudentScholarshipView>>;

const STEPS = ["submitted", "under_review", "approved", "disbursed"] as const;

export default function ScholarshipsPage() {
  const { data, loading, error, reload } = useApiGet<ViewData>("/api/scholarships");
  const [applyingId, setApplyingId] = useState<number | null>(null);

  async function apply(scholarshipId: number) {
    setApplyingId(scholarshipId);
    try {
      const result = await apiMutate<{ success: boolean; reason: string | null }>("/api/scholarships/apply", {
        method: "POST",
        body: { scholarshipId },
      });
      if (result.success) {
        toast.success("Application submitted.");
      } else if (result.reason === "not_eligible") {
        toast.error("You don't meet the eligibility criteria for this scholarship yet.");
      } else if (result.reason === "already_applied") {
        toast.error("You've already applied for this scholarship.");
      } else {
        toast.error("Application deadline has passed.");
      }
      reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to apply");
    } finally {
      setApplyingId(null);
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <PageHeader title="Scholarships" description="Track applications in progress and browse what you're eligible for." />

        {loading && <LoadingBlock rows={3} />}
        {error && <ErrorBlock message={error} onRetry={reload} />}

        {data && data.applications.length > 0 && (
          <div className="space-y-3">
            {data.applications.map((a) => (
              <div key={a.id} className="card-surface p-4">
                <div className="mb-4 flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium">{a.scholarshipName}</p>
                    <p className="text-xs text-muted-foreground">
                      Applied {a.appliedAt} · ₹{a.amount?.toLocaleString("en-IN")}
                    </p>
                  </div>
                  <Badge variant={a.status === "rejected" ? "destructive" : a.status === "disbursed" || a.status === "approved" ? "secondary" : "default"} className="capitalize shrink-0">
                    {a.status.replace("_", " ")}
                  </Badge>
                </div>
                <StatusTimeline steps={STEPS} current={a.status} rejected={a.status === "rejected"} />
                {a.remarks && <p className="mt-3 text-xs text-muted-foreground">{a.remarks}</p>}
              </div>
            ))}
          </div>
        )}
      </div>

      {data && (
        <section>
          <h2 className="mb-3 text-sm font-medium text-muted-foreground">Available scholarships</h2>
          {data.scholarships.length === 0 ? (
            <EmptyState icon={Award} title="No scholarships listed" />
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {data.scholarships.map((s) => (
                <div key={s.id} className="card-surface p-4">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-medium leading-snug">{s.name}</p>
                    <span className="shrink-0 text-sm font-semibold text-accent">₹{s.amount.toLocaleString("en-IN")}</span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">{s.provider}</p>
                  <p className="mt-2 text-xs text-muted-foreground">{s.eligibility}</p>
                  <div className="mt-3 flex items-center justify-between">
                    <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                      <CalendarClock className="size-3" /> Deadline {s.deadline}
                    </span>
                    <Button
                      size="sm"
                      variant={s.alreadyApplied ? "secondary" : "outline"}
                      disabled={s.alreadyApplied || s.deadlinePassed || !s.eligible || applyingId === s.id}
                      onClick={() => apply(s.id)}
                    >
                      {applyingId === s.id && <Loader2 className="mr-1.5 size-3.5 animate-spin" />}
                      {s.alreadyApplied ? "Applied" : s.deadlinePassed ? "Closed" : !s.eligible ? "Not eligible" : "Apply"}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
