"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { apiGet, apiMutate } from "@/lib/client/api";

type ExamOption = { id: number; name: string; date: string; maxMarks: number };
type RosterRow = { studentId: number; rollNumber: string; firstName: string; lastName: string; marksObtained: number | null; graded: boolean | null };

export function EnterMarksPanel({ courseId }: { courseId: number }) {
  const [exams, setExams] = useState<ExamOption[] | null>(null);
  const [examId, setExamId] = useState<number | null>(null);
  const [roster, setRoster] = useState<RosterRow[] | null>(null);
  const [marks, setMarks] = useState<Record<number, string>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    apiGet<{ exams: ExamOption[] }>(`/api/faculty/marks?courseId=${courseId}`).then((d) => {
      if (cancelled) return;
      setExams(d.exams);
      if (d.exams.length) setExamId(d.exams[0].id);
    });
    return () => {
      cancelled = true;
    };
  }, [courseId]);

  useEffect(() => {
    if (!examId) return;
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- clears the previous exam's roster before the new fetch resolves, guarded by `cancelled`
    setRoster(null);
    apiGet<{ roster: RosterRow[] }>(`/api/faculty/marks/${examId}`).then((d) => {
      if (cancelled) return;
      setRoster(d.roster);
      setMarks(Object.fromEntries(d.roster.map((r) => [r.studentId, r.marksObtained != null ? String(r.marksObtained) : ""])));
    });
    return () => {
      cancelled = true;
    };
  }, [examId]);

  async function save() {
    if (!examId || !roster) return;
    setSaving(true);
    try {
      const entries = roster
        .filter((r) => marks[r.studentId] !== "" && marks[r.studentId] !== undefined)
        .map((r) => ({ studentId: r.studentId, marksObtained: Number(marks[r.studentId]) }));
      await apiMutate(`/api/faculty/marks/${examId}`, { method: "POST", body: { entries } });
      toast.success("Marks saved - pending Examination Department publish before students can see them.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save marks");
    } finally {
      setSaving(false);
    }
  }

  if (!exams) return <p className="px-1 py-3 text-sm text-muted-foreground">Loading exams...</p>;
  if (!exams.length) return <p className="px-1 py-3 text-sm text-muted-foreground">No exams scheduled for this course yet.</p>;

  const exam = exams.find((e) => e.id === examId);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <label className="text-xs font-medium text-muted-foreground" htmlFor={`exam-select-${courseId}`}>
          Exam
        </label>
        <select
          id={`exam-select-${courseId}`}
          value={examId ?? ""}
          onChange={(e) => setExamId(Number(e.target.value))}
          className="rounded-md border border-input bg-background px-2 py-1 text-sm"
        >
          {exams.map((e) => (
            <option key={e.id} value={e.id}>
              {e.name} ({e.date})
            </option>
          ))}
        </select>
        {exam && <span className="text-xs text-muted-foreground">Max marks: {exam.maxMarks}</span>}
      </div>

      {!roster && <p className="px-1 py-3 text-sm text-muted-foreground">Loading roster...</p>}
      {roster && (
        <>
          <div className="overflow-hidden card-surface">
            <table className="w-full text-left text-sm">
              <thead className="bg-muted/50 text-xs font-medium text-muted-foreground">
                <tr>
                  <th className="px-4 py-2 font-medium">Roll No.</th>
                  <th className="px-4 py-2 font-medium">Name</th>
                  <th className="px-4 py-2 font-medium">Marks</th>
                  <th className="px-4 py-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {roster.map((r) => (
                  <tr key={r.studentId} className="border-t border-border">
                    <td className="px-4 py-2 font-mono text-xs">{r.rollNumber}</td>
                    <td className="px-4 py-2">
                      {r.firstName} {r.lastName}
                    </td>
                    <td className="px-4 py-2">
                      <input
                        type="number"
                        min={0}
                        max={exam?.maxMarks}
                        value={marks[r.studentId] ?? ""}
                        onChange={(e) => setMarks((prev) => ({ ...prev, [r.studentId]: e.target.value }))}
                        className="w-20 rounded-md border border-input bg-background px-2 py-1 text-sm"
                      />
                    </td>
                    <td className="px-4 py-2 text-xs text-muted-foreground">
                      {r.marksObtained == null ? "Not entered" : r.graded ? "Published" : "Pending publish"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Button size="sm" onClick={save} disabled={saving} className="gap-1.5">
            {saving && <Loader2 className="size-3.5 animate-spin" />}
            Save marks
          </Button>
        </>
      )}
    </div>
  );
}
