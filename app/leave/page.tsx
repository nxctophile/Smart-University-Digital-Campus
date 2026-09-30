"use client";

import { useState } from "react";
import { CalendarX2, Loader2, Check, X } from "lucide-react";
import { PageHeader } from "@/components/common/page-header";
import { LoadingBlock, ErrorBlock, EmptyState } from "@/components/common/state-blocks";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useApiGet } from "@/lib/client/use-api";
import { apiMutate } from "@/lib/client/api";
import { toast } from "sonner";
import { usePermissions } from "@/lib/client/use-permissions";
import type { LeaveApplication, LeaveQueueItem } from "@/lib/api-types";

const STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive"> = {
  pending: "default",
  approved: "secondary",
  rejected: "destructive",
};

const LEAVE_TYPES: Record<string, string> = { sick: "Sick leave", casual: "Casual leave", academic: "Academic/exam leave", other: "Other" };

export default function LeavePage() {
  const { permissions } = usePermissions();
  const canManage = permissions.includes("leave.manage");

  const { data, loading, error, reload } = useApiGet<{ applications: LeaveApplication[] }>("/api/leave");
  const [leaveType, setLeaveType] = useState("casual");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function apply(e: React.FormEvent) {
    e.preventDefault();
    if (!fromDate || !toDate || !reason.trim()) {
      toast.error("Fill in the dates and reason.");
      return;
    }
    setSubmitting(true);
    try {
      await apiMutate("/api/leave", { body: { leaveType, fromDate, toDate, reason } });
      toast.success("Leave application submitted.");
      setReason("");
      setFromDate("");
      setToDate("");
      reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to submit");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Leave" description="Apply for leave and track the status of your applications." />

      <section className="card-surface space-y-3 p-4">
        <h2 className="text-sm font-medium">Apply for leave</h2>
        <form onSubmit={apply} className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label>Leave type</Label>
              <Select items={LEAVE_TYPES} value={leaveType} onValueChange={(v) => v && setLeaveType(v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(LEAVE_TYPES).map(([key, label]) => (
                    <SelectItem key={key} value={key}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>From</Label>
              <Input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} required />
            </div>
            <div className="space-y-1.5">
              <Label>To</Label>
              <Input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} required />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Reason</Label>
            <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Briefly describe the reason for leave" required />
          </div>
          <Button type="submit" disabled={submitting} className="gap-1.5">
            {submitting && <Loader2 className="size-3.5 animate-spin" />}
            Submit application
          </Button>
        </form>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-medium">My applications</h2>
        {loading && <LoadingBlock rows={3} />}
        {error && <ErrorBlock message={error} onRetry={reload} />}
        {data && data.applications.length === 0 && <EmptyState icon={CalendarX2} title="No leave applications yet" />}
        {data && data.applications.length > 0 && (
          <div className="space-y-2">
            {data.applications.map((a) => (
              <div key={a.id} className="card-surface flex items-center justify-between gap-3 p-3.5 text-sm">
                <div>
                  <p className="font-medium">
                    {LEAVE_TYPES[a.leaveType] ?? a.leaveType} · {a.fromDate} to {a.toDate}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{a.reason}</p>
                  {a.remarks && <p className="mt-0.5 text-xs text-muted-foreground">Remarks: {a.remarks}</p>}
                </div>
                <Badge variant={STATUS_VARIANT[a.status]} className="shrink-0 capitalize">
                  {a.status}
                </Badge>
              </div>
            ))}
          </div>
        )}
      </section>

      {canManage && <ReviewQueue />}
    </div>
  );
}

function ReviewQueue() {
  const { data, loading, error, reload } = useApiGet<{ applications: LeaveQueueItem[] }>("/api/admin/leave");
  const [decidingId, setDecidingId] = useState<number | null>(null);

  async function decide(id: number, decision: "approved" | "rejected") {
    setDecidingId(id);
    try {
      await apiMutate("/api/admin/leave/decide", { body: { applicationId: id, decision } });
      toast.success(`Application ${decision}.`);
      reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to decide");
    } finally {
      setDecidingId(null);
    }
  }

  const pending = data?.applications.filter((a) => a.status === "pending") ?? [];

  return (
    <section className="space-y-3">
      <h2 className="text-sm font-medium">Review queue</h2>
      {loading && <LoadingBlock rows={3} />}
      {error && <ErrorBlock message={error} onRetry={reload} />}
      {data && pending.length === 0 && <EmptyState icon={CalendarX2} title="No pending leave applications" />}
      {pending.length > 0 && (
        <div className="space-y-2">
          {pending.map((a) => (
            <div key={a.id} className="card-surface flex items-center justify-between gap-3 p-3.5 text-sm">
              <div>
                <p className="font-medium">
                  {a.applicantName} <span className="font-normal text-muted-foreground capitalize">({a.applicantRole})</span>
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {LEAVE_TYPES[a.leaveType] ?? a.leaveType} · {a.fromDate} to {a.toDate}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">{a.reason}</p>
              </div>
              <div className="flex shrink-0 gap-2">
                <Button size="sm" variant="outline" disabled={decidingId === a.id} onClick={() => decide(a.id, "approved")} className="gap-1.5 text-success hover:text-success">
                  <Check className="size-3.5" /> Approve
                </Button>
                <Button size="sm" variant="outline" disabled={decidingId === a.id} onClick={() => decide(a.id, "rejected")} className="gap-1.5 text-destructive hover:text-destructive">
                  <X className="size-3.5" /> Reject
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
