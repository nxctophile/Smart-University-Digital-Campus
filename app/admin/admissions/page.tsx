"use client";

import { useState } from "react";
import { ClipboardCheck, UserPlus, Loader2 } from "lucide-react";
import { PageHeader } from "@/components/common/page-header";
import { LoadingBlock, ErrorBlock, EmptyState } from "@/components/common/state-blocks";
import { Button } from "@/components/ui/button";
import { useApiGet } from "@/lib/client/use-api";
import { apiMutate } from "@/lib/client/api";
import { toast } from "sonner";
import type { listRecentAdmissions, listProgrammesForOnboarding } from "@/lib/services/admission";

type Admission = Awaited<ReturnType<typeof listRecentAdmissions>>[number];
type Programme = Awaited<ReturnType<typeof listProgrammesForOnboarding>>[number];

const EMPTY_FORM = { programmeId: "", rollNumber: "", firstName: "", lastName: "", email: "", phone: "", dob: "", gender: "male" };

export default function AdmissionsPage() {
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
      <div>
        <PageHeader title="Admissions" description="Admission Cell - onboard verified students and track recent admissions." />
        {loading && <LoadingBlock rows={3} />}
        {error && <ErrorBlock message={error} onRetry={reload} />}
      </div>

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
                  <tr key={a.id} className="border-t border-border transition-colors hover:bg-muted/30">
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
