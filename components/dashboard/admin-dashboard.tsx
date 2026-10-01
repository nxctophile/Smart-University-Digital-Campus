import Link from "next/link";
import { Users, CalendarCheck, Wallet, LifeBuoy, FileCheck2, AlertTriangle, ArrowRight } from "lucide-react";
import { backendGet } from "@/lib/server-context";
import type { AdminOverview, StudentRisk } from "@/lib/api-types";
import { StatCard } from "@/components/common/stat-card";
import { HomeAiInput } from "./home-ai-input";
import { DepartmentAttendanceChart } from "./department-attendance-chart";
import { Badge } from "@/components/ui/badge";
import { NoticesCard } from "@/components/common/notices-card";
import { EventsCalendar } from "@/components/common/events-calendar";

const ADMIN_PROMPTS = [
  "Show students with attendance below 75% who have exams this week",
  "Show at-risk students in Computer Science",
  "Notify their parents",
];

const RISK_VARIANT: Record<string, "default" | "secondary" | "destructive"> = {
  high: "destructive",
  medium: "default",
  low: "secondary",
};

export async function AdminDashboard() {
  const overview = await backendGet<AdminOverview>("/api/admin/overview");
  const { students: atRisk } = await backendGet<{ students: StudentRisk[] }>("/api/admin/at-risk?riskLevel=high&limit=6");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">University overview</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">Central Institute of Technology · Academic year 2026-27</p>
      </div>

      <HomeAiInput suggestedPrompts={ADMIN_PROMPTS} />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
        <StatCard icon={Users} label="Total students" value={overview.totalStudents.toLocaleString("en-IN")} />
        <StatCard
          icon={CalendarCheck}
          label="Avg. attendance"
          value={`${overview.avgAttendance}%`}
          tone={overview.avgAttendance < 75 ? "warning" : "default"}
        />
        <StatCard
          icon={Wallet}
          label="Pending fees"
          value={`₹${(overview.pendingFees / 100000).toFixed(1)}L`}
          tone="warning"
        />
        <StatCard icon={LifeBuoy} label="Open grievances" value={String(overview.openGrievances)} />
        <StatCard icon={FileCheck2} label="Certificates issued" value={String(overview.certificatesIssued)} tone="success" />
        <StatCard icon={AlertTriangle} label="At-risk students" value={String(overview.atRiskCount)} tone="destructive" />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="card-surface p-4">
          <h2 className="mb-3 text-sm font-medium">Attendance by department</h2>
          <DepartmentAttendanceChart
            data={(overview.byDepartment as { code: string; name: string; students: number; avgAttendance: number | null }[]).map((d) => ({
              code: d.code,
              avgAttendance: d.avgAttendance ?? 0,
            }))}
          />
        </section>

        <section className="card-surface p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-medium">Highest-risk students</h2>
            <Link href="/admin/students" className="flex items-center gap-1 text-xs text-accent hover:underline">
              View all <ArrowRight className="size-3" />
            </Link>
          </div>
          <div className="space-y-2">
            {atRisk.length === 0 && <p className="text-sm text-muted-foreground">No high-risk students right now.</p>}
            {atRisk.map((s) => (
              <div key={s.studentId} className="flex items-center justify-between gap-2 rounded-md border border-border/70 px-3 py-2 text-sm">
                <div>
                  <p className="font-medium">{s.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {s.rollNumber} · {s.department}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">{s.attendancePercentage}%</span>
                  <Badge variant={RISK_VARIANT[s.riskLevel]} className="capitalize">
                    {s.riskLevel}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <NoticesCard />
        <EventsCalendar />
      </div>
    </div>
  );
}
