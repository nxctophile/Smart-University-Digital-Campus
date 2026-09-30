"use client";

import { useState } from "react";
import { Award, Users, CheckCircle2, XCircle, IndianRupee, Loader2 } from "lucide-react";
import { PageHeader } from "@/components/common/page-header";
import { LoadingBlock, ErrorBlock, EmptyState } from "@/components/common/state-blocks";
import { StatCard } from "@/components/common/stat-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useApiGet } from "@/lib/client/use-api";
import { apiMutate } from "@/lib/client/api";
import { toast } from "sonner";
import type { ScholarshipAdminOverview as Overview, ScholarshipApplication as Application } from "@/lib/api-types";

export default function AdminScholarshipsPage() {
  const { data: overview, loading, error, reload } = useApiGet<Overview>("/api/admin/scholarships/overview");
  const [statusFilter, setStatusFilter] = useState("pending");
  const queryParam = statusFilter === "pending" ? "submitted" : statusFilter === "all" ? "" : statusFilter;
  const { data: appData, reload: reloadApps } = useApiGet<{ applications: Application[] }>(
    `/api/admin/scholarships/applications${queryParam ? `?status=${queryParam}` : ""}`,
  );
  const [decidingId, setDecidingId] = useState<number | null>(null);

  async function decide(id: number, decision: "approved" | "rejected") {
    setDecidingId(id);
    try {
      await apiMutate("/api/admin/scholarships/decide", { method: "POST", body: { applicationId: id, decision } });
      toast.success(decision === "approved" ? "Application approved." : "Application rejected.");
      reload();
      reloadApps();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update");
    } finally {
      setDecidingId(null);
    }
  }

  const applications = appData?.applications.filter((a) => (statusFilter === "pending" ? a.status === "submitted" || a.status === "under_review" : true)) ?? [];

  return (
    <div className="space-y-6">
      <div>
        <PageHeader title="Scholarships" description="Review applications and track disbursement across the university." />

        {loading && <LoadingBlock rows={3} />}
        {error && <ErrorBlock message={error} onRetry={reload} />}

        {overview && (
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
            <StatCard icon={Users} label="Total applications" value={overview.total.toLocaleString("en-IN")} />
            <StatCard icon={Award} label="Pending review" value={String(overview.pending)} tone="warning" />
            <StatCard icon={CheckCircle2} label="Approved" value={String(overview.approved)} tone="success" />
            <StatCard icon={XCircle} label="Rejected" value={String(overview.rejected)} tone="destructive" />
            <StatCard icon={IndianRupee} label="Disbursed" value={`₹${(overview.disbursedAmount / 100000).toFixed(1)}L`} />
          </div>
        )}
      </div>

      <div className="flex items-center gap-2">
        <Select
          items={{ pending: "Pending review", approved: "Approved", rejected: "Rejected", disbursed: "Disbursed", all: "All applications" }}
          value={statusFilter}
          onValueChange={(v) => setStatusFilter(v ?? "pending")}
        >
          <SelectTrigger className="w-52">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="pending">Pending review</SelectItem>
            <SelectItem value="approved">Approved</SelectItem>
            <SelectItem value="rejected">Rejected</SelectItem>
            <SelectItem value="disbursed">Disbursed</SelectItem>
            <SelectItem value="all">All applications</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {!appData && <LoadingBlock rows={4} />}
      {appData && applications.length === 0 && <EmptyState icon={Award} title="No applications in this view" />}
      {applications.length > 0 && (
        <div className="overflow-hidden card-surface">
          <table className="w-full text-left text-sm">
            <thead className="bg-muted/50 text-xs font-medium text-muted-foreground">
              <tr>
                <th className="px-4 py-2 font-medium">Student</th>
                <th className="px-4 py-2 font-medium">Scholarship</th>
                <th className="px-4 py-2 font-medium">Amount</th>
                <th className="px-4 py-2 font-medium">Applied</th>
                <th className="px-4 py-2 font-medium">Status</th>
                <th className="px-4 py-2 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {applications.map((a) => (
                <tr key={a.id} className="border-t border-border transition-colors hover:bg-muted/30">
                  <td className="px-4 py-2.5">
                    <p className="font-medium">
                      {a.firstName} {a.lastName}
                    </p>
                    <p className="font-mono text-xs text-muted-foreground">
                      {a.rollNumber} · {a.departmentCode}
                    </p>
                  </td>
                  <td className="px-4 py-2.5">{a.scholarshipName}</td>
                  <td className="px-4 py-2.5">₹{a.amount.toLocaleString("en-IN")}</td>
                  <td className="px-4 py-2.5 text-muted-foreground">{a.appliedAt}</td>
                  <td className="px-4 py-2.5">
                    <Badge variant={a.status === "rejected" ? "destructive" : "secondary"} className="capitalize">
                      {a.status.replace("_", " ")}
                    </Badge>
                  </td>
                  <td className="px-4 py-2.5">
                    {(a.status === "submitted" || a.status === "under_review") && (
                      <div className="flex justify-end gap-1.5">
                        <Button size="sm" variant="outline" disabled={decidingId === a.id} onClick={() => decide(a.id, "approved")}>
                          {decidingId === a.id ? <Loader2 className="size-3.5 animate-spin" /> : "Approve"}
                        </Button>
                        <Button size="sm" variant="outline" className="border-destructive text-destructive" disabled={decidingId === a.id} onClick={() => decide(a.id, "rejected")}>
                          Reject
                        </Button>
                      </div>
                    )}
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
