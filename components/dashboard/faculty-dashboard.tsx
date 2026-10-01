import Link from "next/link";
import { BookOpen, Users, CalendarCheck, AlertTriangle, ArrowRight } from "lucide-react";
import { backendGet } from "@/lib/server-context";
import type { FacultyProfile, FacultyCourseWithStats } from "@/lib/api-types";
import { StatCard } from "@/components/common/stat-card";
import { NoticesCard } from "@/components/common/notices-card";
import { EventsCalendar } from "@/components/common/events-calendar";
import { HomeAiInput } from "./home-ai-input";

const FACULTY_PROMPTS = ["Show my students below 75% attendance", "Which of my students have exams this week?"];

export async function FacultyDashboard() {
  const [{ ctx, profile }, { courses }] = await Promise.all([
    backendGet<{ ctx: { name: string }; profile: FacultyProfile | null }>("/api/profile"),
    backendGet<{ courses: FacultyCourseWithStats[] }>("/api/faculty/courses"),
  ]);

  const totalStudents = new Set(courses.map((c) => `${c.programmeId}-${c.semester}`)).size
    ? courses.reduce((sum, c) => sum + c.studentCount, 0)
    : 0;
  const totalAtRisk = courses.reduce((sum, c) => sum + c.atRiskCount, 0);
  const avgAttendance = courses.length
    ? Math.round((courses.reduce((sum, c) => sum + c.avgAttendance, 0) / courses.length) * 10) / 10
    : 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">{ctx.name}</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          {profile?.designation} · {courses.length} sections this semester
        </p>
      </div>

      <HomeAiInput suggestedPrompts={FACULTY_PROMPTS} />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard icon={BookOpen} label="Sections teaching" value={String(courses.length)} />
        <StatCard icon={Users} label="Students taught" value={String(totalStudents)} />
        <StatCard icon={CalendarCheck} label="Avg. attendance" value={`${avgAttendance}%`} tone={avgAttendance < 75 ? "warning" : "default"} />
        <StatCard icon={AlertTriangle} label="At-risk students" value={String(totalAtRisk)} tone={totalAtRisk > 0 ? "destructive" : "default"} />
      </div>

      <section className="card-surface p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-medium">My classes</h2>
          <Link href="/faculty/classes" className="flex items-center gap-1 text-xs text-accent hover:underline">
            View all <ArrowRight className="size-3" />
          </Link>
        </div>
        <div className="space-y-2">
          {courses.map((c) => (
            <div key={c.sectionId} className="flex items-center justify-between rounded-md border border-border/70 px-3 py-2.5 text-sm">
              <div>
                <p className="font-medium">
                  {c.courseCode} <span className="font-normal text-muted-foreground">— {c.courseName}</span>
                </p>
                <p className="text-xs text-muted-foreground">{c.studentCount} students · Semester {c.semester}</p>
              </div>
              <div className="flex items-center gap-3 text-xs">
                <span className={c.avgAttendance < 75 ? "font-medium text-destructive" : "text-muted-foreground"}>{c.avgAttendance}% attendance</span>
                {c.atRiskCount > 0 && <span className="font-medium text-warning">{c.atRiskCount} at-risk</span>}
              </div>
            </div>
          ))}
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <NoticesCard />
        <EventsCalendar />
      </div>
    </div>
  );
}
