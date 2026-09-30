"use client";

import { UserCog, Users, Briefcase } from "lucide-react";
import { PageHeader } from "@/components/common/page-header";
import { LoadingBlock, ErrorBlock, EmptyState } from "@/components/common/state-blocks";
import { StatCard } from "@/components/common/stat-card";
import { Badge } from "@/components/ui/badge";
import { useApiGet } from "@/lib/client/use-api";
import type { StaffDirectoryEntry as Staff, StaffOverview as Overview } from "@/lib/api-types";

export default function EmployeesPage() {
  const { data, loading, error, reload } = useApiGet<{ staff: Staff[]; overview: Overview }>("/api/admin/employees");
  const staff = data?.staff ?? [];

  return (
    <div className="space-y-8">
      <div>
        <PageHeader title="Employees" description="HR Department - staff directory across faculty and campus departments." />

        {loading && <LoadingBlock rows={3} />}
        {error && <ErrorBlock message={error} onRetry={reload} />}

        {data && (
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
            <StatCard icon={Users} label="Total staff" value={String(data.overview.totalStaff)} />
            <StatCard icon={UserCog} label="Faculty" value={String(data.overview.facultyCount)} />
            <StatCard icon={Briefcase} label="Department staff" value={String(data.overview.staffCount)} />
          </div>
        )}
      </div>

      <section>
        {data && staff.length === 0 && <EmptyState icon={Users} title="No staff records" />}
        {staff.length > 0 && (
          <div className="overflow-hidden card-surface">
            <table className="w-full text-left text-sm">
              <thead className="bg-muted/50 text-xs font-medium text-muted-foreground">
                <tr>
                  <th className="px-4 py-2 font-medium">Employee code</th>
                  <th className="px-4 py-2 font-medium">Name</th>
                  <th className="px-4 py-2 font-medium">Designation</th>
                  <th className="px-4 py-2 font-medium">Department</th>
                  <th className="px-4 py-2 font-medium">Type</th>
                </tr>
              </thead>
              <tbody>
                {staff.map((s) => (
                  <tr key={`${s.kind}-${s.id}`} className="border-t border-border transition-colors hover:bg-muted/30">
                    <td className="px-4 py-2 font-mono text-xs">{s.employeeCode}</td>
                    <td className="px-4 py-2">
                      {s.firstName} {s.lastName}
                    </td>
                    <td className="px-4 py-2">{s.designation}</td>
                    <td className="px-4 py-2">{s.departmentName}</td>
                    <td className="px-4 py-2">
                      <Badge variant={s.kind === "faculty" ? "secondary" : "default"} className="capitalize">
                        {s.kind}
                      </Badge>
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
