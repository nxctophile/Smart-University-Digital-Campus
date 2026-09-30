"use client";

import { useState } from "react";
import { BookOpen, Library, AlertTriangle, IndianRupee, Loader2, Check } from "lucide-react";
import { PageHeader } from "@/components/common/page-header";
import { LoadingBlock, ErrorBlock, EmptyState } from "@/components/common/state-blocks";
import { StatCard } from "@/components/common/stat-card";
import { Button } from "@/components/ui/button";
import { useApiGet } from "@/lib/client/use-api";
import { apiMutate } from "@/lib/client/api";
import { toast } from "sonner";
import type { LibraryOverview as Overview, OverdueLoan } from "@/lib/api-types";

export default function AdminLibraryPage() {
  const { data: overview, loading, error, reload } = useApiGet<Overview>("/api/admin/library/overview");
  const { data: overdueData, reload: reloadOverdue } = useApiGet<{ loans: OverdueLoan[] }>("/api/admin/library/overdue");
  const [returningId, setReturningId] = useState<number | null>(null);

  async function markReturned(loanId: number) {
    setReturningId(loanId);
    try {
      await apiMutate("/api/admin/library/return", { method: "POST", body: { loanId } });
      toast.success("Marked as returned.");
      reload();
      reloadOverdue();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update");
    } finally {
      setReturningId(null);
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <PageHeader title="Library" description="Catalog health, active loans, and overdue recovery." />

        {loading && <LoadingBlock rows={3} />}
        {error && <ErrorBlock message={error} onRetry={reload} />}

        {overview && (
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
            <StatCard icon={Library} label="Titles" value={overview.titles.toLocaleString("en-IN")} />
            <StatCard icon={BookOpen} label="Copies in circulation" value={overview.borrowedCopies.toLocaleString("en-IN")} />
            <StatCard icon={BookOpen} label="Available copies" value={overview.availableCopies.toLocaleString("en-IN")} tone="success" />
            <StatCard icon={AlertTriangle} label="Overdue loans" value={String(overview.overdueLoans)} tone="destructive" />
            <StatCard icon={IndianRupee} label="Outstanding fines" value={`₹${overview.outstandingFines.toLocaleString("en-IN")}`} tone="warning" />
          </div>
        )}
      </div>

      <section>
        <h2 className="mb-3 text-sm font-medium text-muted-foreground">Overdue books</h2>
        {!overdueData && <LoadingBlock rows={3} />}
        {overdueData && overdueData.loans.length === 0 && <EmptyState icon={Check} title="No overdue books" />}
        {overdueData && overdueData.loans.length > 0 && (
          <div className="overflow-hidden card-surface">
            <table className="w-full text-left text-sm">
              <thead className="bg-muted/50 text-xs font-medium text-muted-foreground">
                <tr>
                  <th className="px-4 py-2 font-medium">Book</th>
                  <th className="px-4 py-2 font-medium">Student</th>
                  <th className="px-4 py-2 font-medium">Due</th>
                  <th className="px-4 py-2 font-medium">Fine</th>
                  <th className="px-4 py-2 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {overdueData.loans.map((l) => (
                  <tr key={l.id} className="border-t border-border transition-colors hover:bg-muted/30">
                    <td className="px-4 py-2.5">{l.title}</td>
                    <td className="px-4 py-2.5">
                      {l.firstName} {l.lastName} <span className="font-mono text-xs text-muted-foreground">({l.rollNumber})</span>
                    </td>
                    <td className="px-4 py-2.5 text-destructive">{l.dueAt}</td>
                    <td className="px-4 py-2.5">₹{l.fineAmount}</td>
                    <td className="px-4 py-2.5 text-right">
                      <Button size="sm" variant="outline" disabled={returningId === l.id} onClick={() => markReturned(l.id)} className="gap-1.5">
                        {returningId === l.id ? <Loader2 className="size-3.5 animate-spin" /> : <Check className="size-3.5" />}
                        Mark returned
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
