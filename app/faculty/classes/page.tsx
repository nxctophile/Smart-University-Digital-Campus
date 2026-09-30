"use client";

import { useEffect, useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { PageHeader } from "@/components/common/page-header";
import { LoadingBlock, ErrorBlock, EmptyState } from "@/components/common/state-blocks";
import { Badge } from "@/components/ui/badge";
import { useApiGet } from "@/lib/client/use-api";
import { apiGet } from "@/lib/client/api";
import { BookOpen } from "lucide-react";
import { cn } from "@/lib/utils";
import { MarkAttendancePanel } from "@/components/faculty/mark-attendance-panel";
import { EnterMarksPanel } from "@/components/faculty/enter-marks-panel";
import type { FacultyCourseWithStats as Course, FacultyRosterStudent } from "@/lib/api-types";

type Roster = FacultyRosterStudent[];

const RISK_VARIANT: Record<string, "default" | "secondary" | "destructive"> = {
  high: "destructive",
  medium: "default",
  low: "secondary",
};

type PanelTab = "roster" | "attendance" | "marks";
const TABS: { key: PanelTab; label: string }[] = [
  { key: "roster", label: "Roster" },
  { key: "attendance", label: "Mark attendance" },
  { key: "marks", label: "Enter marks" },
];

function RosterPanel({ courseId }: { courseId: number }) {
  const [tab, setTab] = useState<PanelTab>("roster");
  const [roster, setRoster] = useState<Roster | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    apiGet<{ students: Roster }>(`/api/faculty/students?courseId=${courseId}`)
      .then((d) => {
        if (!cancelled) setRoster(d.students);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [courseId]);

  return (
    <div className="space-y-3">
      <div className="flex gap-1 rounded-lg bg-muted p-0.5 text-xs">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={cn(
              "flex-1 rounded-md px-2 py-1.5 font-medium transition-colors",
              tab === t.key ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "roster" &&
        (loading ? (
          <LoadingBlock rows={3} />
        ) : !roster || roster.length === 0 ? (
          <p className="px-1 py-3 text-sm text-muted-foreground">No students enrolled.</p>
        ) : (
          <div className="overflow-hidden card-surface">
            <table className="w-full text-left text-sm">
              <thead className="bg-muted/50 text-xs font-medium text-muted-foreground">
                <tr>
                  <th className="px-4 py-2 font-medium">Roll No.</th>
                  <th className="px-4 py-2 font-medium">Name</th>
                  <th className="px-4 py-2 font-medium">Attendance</th>
                  <th className="px-4 py-2 font-medium">Risk</th>
                </tr>
              </thead>
              <tbody>
                {roster.map((s) => (
                  <tr key={s.id} className="border-t border-border transition-colors hover:bg-muted/30">
                    <td className="px-4 py-2 font-mono text-xs">{s.rollNumber}</td>
                    <td className="px-4 py-2">
                      {s.firstName} {s.lastName}
                    </td>
                    <td className="px-4 py-2">
                      {s.risk ? (
                        <span className={s.risk.attendancePercentage < 75 ? "font-medium text-destructive" : ""}>{s.risk.attendancePercentage}%</span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-4 py-2">
                      {s.risk ? (
                        <Badge variant={RISK_VARIANT[s.risk.riskLevel]} className="capitalize">
                          {s.risk.riskLevel}
                        </Badge>
                      ) : (
                        "—"
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}

      {tab === "attendance" && <MarkAttendancePanel courseId={courseId} />}
      {tab === "marks" && <EnterMarksPanel courseId={courseId} />}
    </div>
  );
}

export default function FacultyClassesPage() {
  const { data, loading, error, reload } = useApiGet<{ courses: Course[] }>("/api/faculty/courses");
  const [expanded, setExpanded] = useState<number | null>(null);
  const courses = data?.courses ?? [];

  return (
    <div>
      <PageHeader title="My Classes" description="Your teaching sections, rosters, and at-a-glance risk signals." />

      {loading && <LoadingBlock rows={4} />}
      {error && <ErrorBlock message={error} onRetry={reload} />}
      {data && courses.length === 0 && <EmptyState icon={BookOpen} title="No sections assigned" />}

      <div className="space-y-2">
        {courses.map((c) => {
          const isOpen = expanded === c.sectionId;
          return (
            <div key={c.sectionId} className="card-surface">
              <button
                className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
                onClick={() => setExpanded(isOpen ? null : c.sectionId)}
              >
                <div className="flex items-center gap-2">
                  {isOpen ? <ChevronDown className="size-4 text-muted-foreground" /> : <ChevronRight className="size-4 text-muted-foreground" />}
                  <div>
                    <p className="text-sm font-medium">
                      {c.courseCode} <span className="font-normal text-muted-foreground">— {c.courseName}</span>
                    </p>
                    <p className="text-xs text-muted-foreground">{c.studentCount} students · Semester {c.semester}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 text-xs">
                  <span className={c.avgAttendance < 75 ? "font-medium text-destructive" : "text-muted-foreground"}>{c.avgAttendance}% avg attendance</span>
                  {c.atRiskCount > 0 && (
                    <Badge variant="destructive" className="shrink-0">
                      {c.atRiskCount} at-risk
                    </Badge>
                  )}
                </div>
              </button>
              {isOpen && (
                <div className="border-t border-border p-4 pt-3">
                  <RosterPanel courseId={c.courseId} />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
