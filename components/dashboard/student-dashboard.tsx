"use client";

import Link from "next/link";
import { CalendarCheck, Wallet, BookOpen, FileCheck2, AlertTriangle, Clock, ArrowRight } from "lucide-react";
import { useApiGet } from "@/lib/client/use-api";
import { useSession } from "@/lib/client/session";
import { HomeAiInput } from "./home-ai-input";
import { StatCard } from "@/components/common/stat-card";
import { LoadingBlock, ErrorBlock } from "@/components/common/state-blocks";
import { NoticesCard } from "@/components/common/notices-card";
import type { StudentDashboard as DashboardData } from "@/lib/api-types";

const STUDENT_PROMPTS = [
  "Can I miss tomorrow's DBMS class?",
  "Show my fee status",
  "Get my bonafide certificate",
  "When is my next class?",
];
const PARENT_PROMPTS = ["Show my child's attendance", "What is the pending fee?", "Any upcoming exams?"];

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

export function StudentDashboard() {
  const { ctx } = useSession();
  const { data, loading, error, reload } = useApiGet<DashboardData>("/api/dashboard/student");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">
          {greeting()}, {ctx.role === "parent" ? "" : data?.profile.firstName ?? ""}
          {ctx.role === "parent" && data ? `parent of ${data.profile.firstName}` : ""}
        </h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          {data ? `${data.profile.programme} · Semester ${data.profile.currentSemester} · ${data.profile.rollNumber}` : "What would you like to do?"}
        </p>
      </div>

      <HomeAiInput suggestedPrompts={ctx.role === "parent" ? PARENT_PROMPTS : STUDENT_PROMPTS} />

      {loading && <LoadingBlock rows={4} />}
      {error && <ErrorBlock message={error} onRetry={reload} />}

      {data && (
        <>
          {data.risk && data.risk.riskLevel !== "low" && (
            <div className="flex items-start gap-3 rounded-lg border border-warning/40 bg-warning/10 p-3.5">
              <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" />
              <div>
                <p className="text-sm font-medium">Academic attention needed</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {data.risk.factors.map((f) => f.detail).join(" · ")}
                </p>
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard
              icon={CalendarCheck}
              label="Attendance"
              value={`${data.attendance.overallPercentage}%`}
              tone={data.attendance.overallPercentage < 75 ? "warning" : "default"}
            />
            <StatCard
              icon={Clock}
              label="Next class"
              value={data.nextClass ? data.nextClass.courseCode : "—"}
              detail={data.nextClass ? `${data.nextClass.startTime} · Room ${data.nextClass.room}` : "No more classes this week"}
            />
            <StatCard
              icon={Wallet}
              label="Fees"
              value={data.fees.totalDue > 0 ? `₹${data.fees.totalDue.toLocaleString("en-IN")}` : "Paid up"}
              tone={data.fees.hasOverdue ? "destructive" : data.fees.totalDue > 0 ? "warning" : "success"}
              detail={data.fees.items[0]?.dueDate ? `Due ${data.fees.items[0].dueDate}` : undefined}
            />
            <StatCard
              icon={BookOpen}
              label="Upcoming exam"
              value={data.upcomingExams[0]?.courseCode ?? "—"}
              detail={data.upcomingExams[0]?.date}
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <section className="card-surface p-4">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-sm font-medium">Upcoming</h2>
                <Link href="/academics" className="flex items-center gap-1 text-xs text-accent hover:underline">
                  View all <ArrowRight className="size-3" />
                </Link>
              </div>
              {data.upcomingExams.length === 0 ? (
                <p className="text-sm text-muted-foreground">No upcoming exams scheduled.</p>
              ) : (
                <ul className="space-y-2.5">
                  {data.upcomingExams.map((e) => (
                    <li key={e.id} className="flex items-center justify-between text-sm">
                      <span>
                        {e.courseName} <span className="text-muted-foreground">— {e.name.split(" - ")[1] ?? e.examType}</span>
                      </span>
                      <span className="text-muted-foreground">{e.date}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="card-surface p-4">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-sm font-medium">Recent activity</h2>
                <Link href="/documents" className="flex items-center gap-1 text-xs text-accent hover:underline">
                  Documents <ArrowRight className="size-3" />
                </Link>
              </div>
              {data.recentCertificate ? (
                <div className="flex items-center gap-2.5 text-sm">
                  <FileCheck2 className="size-4 text-success" />
                  <span>
                    {data.recentCertificate.type[0].toUpperCase() + data.recentCertificate.type.slice(1)} certificate generated
                    <span className="text-muted-foreground"> · {data.recentCertificate.issuedAt}</span>
                  </span>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No recent document activity.</p>
              )}
            </section>

            <NoticesCard />
          </div>
        </>
      )}
    </div>
  );
}
