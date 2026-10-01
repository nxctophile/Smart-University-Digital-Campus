"use client";

import { useState } from "react";
import { ClipboardCheck, UserPlus, Loader2, FileCheck, Check, X, Eye } from "lucide-react";
import { PageHeader } from "@/components/common/page-header";
import { LoadingBlock, ErrorBlock, EmptyState } from "@/components/common/state-blocks";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useApiGet } from "@/lib/client/use-api";
import { apiMutate } from "@/lib/client/api";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { usePermissions } from "@/lib/client/use-permissions";
import type { Admission, Programme, ProfileEditRequestRow } from "@/lib/api-types";

const EMPTY_FORM = { programmeId: "", rollNumber: "", firstName: "", lastName: "", email: "", phone: "", dob: "", gender: "male" };

type Tab = "onboard" | "profile-requests";

export default function AdmissionsPage() {
  const { permissions } = usePermissions();
  const canReview = permissions.includes("profile.update.review");
  const [tab, setTab] = useState<Tab>("onboard");

  return (
    <div className="space-y-6">
      <PageHeader title="Admissions" description="Admission Cell - onboard verified students, review profile updates, and track recent admissions." />

      {canReview && (
        <div className="flex gap-1 overflow-x-auto rounded-lg bg-muted p-0.5 text-xs">
          {([
            { key: "onboard", label: "Onboard & Admissions" },
            { key: "profile-requests", label: "Profile Update Requests" },
          ] as { key: Tab; label: string }[]).map((t) => (
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

      {tab === "onboard" && <OnboardTab />}
      {tab === "profile-requests" && canReview && <ProfileRequestsTab />}
    </div>
  );
}

function OnboardTab() {
  const { data, loading, error, reload } = useApiGet<{ admissions: Admission[]; programmes: Programme[] }>("/api/admin/admissions");
  const [form, setForm] = useState(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);

  const admissions = data?.admissions ?? [];
  const programmes = data?.programmes ?? [];

  async function onboard(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await apiMutate("/api/admin/admissions", {
        method: "POST",
        body: { ...form, programmeId: Number(form.programmeId) },
      });
      toast.success(`${form.firstName} ${form.lastName} onboarded successfully.`);
      setForm(EMPTY_FORM);
      reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to onboard student");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-8">
      {loading && <LoadingBlock rows={3} />}
      {error && <ErrorBlock message={error} onRetry={reload} />}

      <section>
        <h2 className="mb-3 text-sm font-medium text-muted-foreground">Onboard a new student</h2>
        <form onSubmit={onboard} className="card-surface grid grid-cols-1 gap-3 p-4 sm:grid-cols-2 lg:grid-cols-3">
          <select
            required
            value={form.programmeId}
            onChange={(e) => setForm((f) => ({ ...f, programmeId: e.target.value }))}
            className="rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            <option value="" disabled>
              Select programme
            </option>
            {programmes.map((p) => (
              <option key={p.id} value={p.id}>
                {p.departmentName} - {p.name}
              </option>
            ))}
          </select>
          <input
            required
            placeholder="Roll number"
            value={form.rollNumber}
            onChange={(e) => setForm((f) => ({ ...f, rollNumber: e.target.value }))}
            className="rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
          <select
            value={form.gender}
            onChange={(e) => setForm((f) => ({ ...f, gender: e.target.value }))}
            className="rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            <option value="male">Male</option>
            <option value="female">Female</option>
            <option value="other">Other</option>
          </select>
          <input
            required
            placeholder="First name"
            value={form.firstName}
            onChange={(e) => setForm((f) => ({ ...f, firstName: e.target.value }))}
            className="rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
          <input
            required
            placeholder="Last name"
            value={form.lastName}
            onChange={(e) => setForm((f) => ({ ...f, lastName: e.target.value }))}
            className="rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
          <input
            type="date"
            required
            value={form.dob}
            onChange={(e) => setForm((f) => ({ ...f, dob: e.target.value }))}
            className="rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
          <input
            type="email"
            required
            placeholder="Email"
            value={form.email}
            onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
            className="rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
          <input
            required
            placeholder="Phone"
            value={form.phone}
            onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
            className="rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
          <Button type="submit" disabled={submitting} className="gap-1.5">
            {submitting ? <Loader2 className="size-3.5 animate-spin" /> : <UserPlus className="size-3.5" />}
            Onboard student
          </Button>
        </form>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-medium text-muted-foreground">Recently onboarded</h2>
        {data && admissions.length === 0 && <EmptyState icon={ClipboardCheck} title="No admissions yet" />}
        {admissions.length > 0 && (
          <div className="overflow-hidden card-surface">
            <table className="w-full text-left text-sm">
              <thead className="bg-muted/50 text-xs font-medium text-muted-foreground">
                <tr>
                  <th className="px-4 py-2 font-medium">Roll No.</th>
                  <th className="px-4 py-2 font-medium">Name</th>
                  <th className="px-4 py-2 font-medium">Department</th>
                  <th className="px-4 py-2 font-medium">Programme</th>
                  <th className="px-4 py-2 font-medium">Year</th>
                </tr>
              </thead>
              <tbody>
                {admissions.map((a) => (
                  <tr key={a.id} className="border-t border-border transition-colors hover:bg-brand-tint">
                    <td className="px-4 py-2 font-mono text-xs">{a.rollNumber}</td>
                    <td className="px-4 py-2">
                      {a.firstName} {a.lastName}
                    </td>
                    <td className="px-4 py-2">{a.department}</td>
                    <td className="px-4 py-2">{a.programme}</td>
                    <td className="px-4 py-2">{a.admissionYear}</td>
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

function ProfileRequestsTab() {
  const { data, loading, error, reload } = useApiGet<{ requests: ProfileEditRequestRow[] }>("/api/admin/profile-requests");
  const [decidingId, setDecidingId] = useState<number | null>(null);

  async function decide(id: number, decision: "approved" | "rejected") {
    setDecidingId(id);
    try {
      await apiMutate("/api/admin/profile-requests/decide", { body: { requestId: id, decision } });
      toast.success(`Request ${decision}.`);
      reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to decide");
    } finally {
      setDecidingId(null);
    }
  }

  if (loading) return <LoadingBlock rows={3} />;
  if (error) return <ErrorBlock message={error} onRetry={reload} />;
  if (!data) return null;

  const pending = data.requests.filter((r) => r.status === "pending");
  const decided = data.requests.filter((r) => r.status !== "pending");

  return (
    <div className="space-y-6">
      <section className="space-y-2">
        <h2 className="text-sm font-medium text-muted-foreground">Pending review</h2>
        {pending.length === 0 && <EmptyState icon={FileCheck} title="No profile update requests pending" />}
        {pending.map((r) => (
          <div key={r.id} className="card-surface space-y-3 p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-medium">
                  {r.firstName} {r.lastName} <span className="font-normal text-muted-foreground">({r.rollNumber})</span>
                </p>
                <p className="text-xs text-muted-foreground">Submitted {new Date(r.submittedAt).toLocaleString("en-IN")}</p>
              </div>
              <Badge className="shrink-0 capitalize">{r.status}</Badge>
            </div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs sm:grid-cols-3">
              {r.payload.fatherName && <Field label="Father's name" value={r.payload.fatherName} />}
              {r.payload.motherName && <Field label="Mother's name" value={r.payload.motherName} />}
              {r.payload.category && <Field label="Category" value={r.payload.category.toUpperCase()} />}
              {r.payload.pincode && <Field label="Pincode" value={r.payload.pincode} />}
              {r.payload.address && <Field label="Address" value={r.payload.address} />}
            </div>
            {r.documentIds.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {r.documentIds.map((id) => (
                  <a
                    key={id}
                    href={`/api/admin/locker/${id}/file`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs text-muted-foreground hover:text-foreground"
                  >
                    <Eye className="size-3" /> Document #{id}
                  </a>
                ))}
              </div>
            )}
            <div className="flex gap-2">
              <Button size="sm" variant="outline" disabled={decidingId === r.id} onClick={() => decide(r.id, "approved")} className="gap-1.5 text-success hover:text-success">
                <Check className="size-3.5" /> Approve
              </Button>
              <Button size="sm" variant="outline" disabled={decidingId === r.id} onClick={() => decide(r.id, "rejected")} className="gap-1.5 text-destructive hover:text-destructive">
                <X className="size-3.5" /> Reject
              </Button>
            </div>
          </div>
        ))}
      </section>

      {decided.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-medium text-muted-foreground">Decided</h2>
          <div className="overflow-hidden card-surface">
            <table className="w-full text-left text-sm">
              <thead className="bg-muted/50 text-xs font-medium text-muted-foreground">
                <tr>
                  <th className="px-4 py-2 font-medium">Student</th>
                  <th className="px-4 py-2 font-medium">Decided</th>
                  <th className="px-4 py-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {decided.map((r) => (
                  <tr key={r.id} className="border-t border-border">
                    <td className="px-4 py-2">
                      {r.firstName} {r.lastName} ({r.rollNumber})
                    </td>
                    <td className="px-4 py-2 text-xs text-muted-foreground">{r.decidedAt ? new Date(r.decidedAt).toLocaleString("en-IN") : "-"}</td>
                    <td className="px-4 py-2">
                      <Badge variant={r.status === "approved" ? "secondary" : "destructive"} className="capitalize">
                        {r.status}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-muted-foreground">{label}</p>
      <p className="font-medium">{value}</p>
    </div>
  );
}
