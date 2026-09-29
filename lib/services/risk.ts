import { sqlite } from "@/lib/db/client";
import { AccessContext, authorize, resolveStudentIdForAccess } from "./context";
import { formatDate } from "@/lib/db/seed-helpers";

export type RiskFactor = { label: string; detail: string; severity: "low" | "medium" | "high" };

export type StudentRisk = {
  studentId: number;
  rollNumber: string;
  name: string;
  department: string;
  departmentCode: string;
  programme: string;
  semester: number;
  attendancePercentage: number;
  recentTestAverage: number;
  feeStatus: string;
  openTickets: number;
  riskScore: number;
  riskLevel: "low" | "medium" | "high";
  factors: RiskFactor[];
  programmeId: number;
};

type RawRow = {
  student_id: number;
  roll_number: string;
  first_name: string;
  last_name: string;
  current_semester: number;
  programme_id: number;
  department: string;
  department_code: string;
  programme: string;
  att_total: number;
  att_present: number;
  recent_test_avg: number | null;
  fee_status: string | null;
  open_tickets: number;
};

const AGGREGATE_QUERY = `
  SELECT
    s.id as student_id, s.roll_number, s.first_name, s.last_name, s.current_semester, s.programme_id,
    d.name as department, d.code as department_code, p.name as programme,
    COALESCE(att.total, 0) as att_total, COALESCE(att.present, 0) as att_present,
    ex.avg_pct as recent_test_avg,
    fe.status as fee_status,
    COALESCE(tk.open_count, 0) as open_tickets
  FROM students s
  JOIN departments d ON d.id = s.department_id
  JOIN programmes p ON p.id = s.programme_id
  LEFT JOIN (
    SELECT student_id, COUNT(*) total, SUM(CASE WHEN status IN ('present','excused') THEN 1 ELSE 0 END) present
    FROM attendance GROUP BY student_id
  ) att ON att.student_id = s.id
  LEFT JOIN (
    SELECT er.student_id, AVG(er.marks_obtained * 100.0 / e.max_marks) avg_pct
    FROM exam_results er JOIN exams e ON e.id = er.exam_id
    GROUP BY er.student_id
  ) ex ON ex.student_id = s.id
  LEFT JOIN fees fe ON fe.student_id = s.id
  LEFT JOIN (
    SELECT student_id, COUNT(*) open_count FROM helpdesk_tickets
    WHERE status IN ('open','in_progress') AND student_id IS NOT NULL
    GROUP BY student_id
  ) tk ON tk.student_id = s.id
  WHERE s.status = 'active'
`;

function scoreRow(row: RawRow): StudentRisk {
  const attendancePercentage = row.att_total ? Math.round((row.att_present / row.att_total) * 1000) / 10 : 100;
  const recentTestAverage = row.recent_test_avg ? Math.round(row.recent_test_avg * 10) / 10 : 100;
  const feeStatus = row.fee_status ?? "paid";

  let score = 0;
  const factors: RiskFactor[] = [];

  if (attendancePercentage < 60) {
    score += 40;
    factors.push({ label: "Attendance", detail: `${attendancePercentage}% (below 60%)`, severity: "high" });
  } else if (attendancePercentage < 75) {
    score += 25;
    factors.push({ label: "Attendance", detail: `${attendancePercentage}% (below the 75% requirement)`, severity: "medium" });
  } else if (attendancePercentage < 85) {
    score += 8;
    factors.push({ label: "Attendance", detail: `${attendancePercentage}%`, severity: "low" });
  }

  if (recentTestAverage < 50) {
    score += 35;
    factors.push({ label: "Recent test average", detail: `${recentTestAverage}%`, severity: "high" });
  } else if (recentTestAverage < 60) {
    score += 20;
    factors.push({ label: "Recent test average", detail: `${recentTestAverage}%`, severity: "medium" });
  } else if (recentTestAverage < 70) {
    score += 8;
    factors.push({ label: "Recent test average", detail: `${recentTestAverage}%`, severity: "low" });
  }

  if (feeStatus === "overdue") {
    score += 15;
    factors.push({ label: "Fee status", detail: "Overdue balance", severity: "medium" });
  } else if (feeStatus === "pending") {
    score += 4;
    factors.push({ label: "Fee status", detail: "Payment pending", severity: "low" });
  }

  if (row.open_tickets > 0) {
    score += 5;
    factors.push({ label: "Open grievances", detail: `${row.open_tickets} open helpdesk ticket(s)`, severity: "low" });
  }

  score = Math.min(100, score);
  const riskLevel: StudentRisk["riskLevel"] = score >= 50 ? "high" : score >= 25 ? "medium" : "low";

  return {
    studentId: row.student_id,
    rollNumber: row.roll_number,
    name: `${row.first_name} ${row.last_name}`,
    department: row.department,
    departmentCode: row.department_code,
    programme: row.programme,
    programmeId: row.programme_id,
    semester: row.current_semester,
    attendancePercentage,
    recentTestAverage,
    feeStatus,
    openTickets: row.open_tickets,
    riskScore: score,
    riskLevel,
    factors,
  };
}

export function getAllStudentRiskProfiles(): StudentRisk[] {
  const rows = sqlite.prepare(AGGREGATE_QUERY).all() as RawRow[];
  return rows.map(scoreRow);
}

export async function getStudentRisk(studentId: number): Promise<StudentRisk | null> {
  const rows = sqlite.prepare(`${AGGREGATE_QUERY} AND s.id = ?`).all(studentId) as RawRow[];
  return rows.length ? scoreRow(rows[0]) : null;
}

/** Authorization-checked entry point for callers (including AI tools) that
 * only have a possibly-arbitrary requested studentId in hand - never call
 * getStudentRisk() directly with an unchecked id. */
export async function getStudentRiskForCaller(ctx: AccessContext, requestedStudentId?: number): Promise<StudentRisk | null> {
  const studentId = await resolveStudentIdForAccess(ctx, "student.performance.view", requestedStudentId);
  return getStudentRisk(studentId);
}

export type AtRiskFilters = {
  maxAttendance?: number;
  minAttendance?: number;
  riskLevel?: "low" | "medium" | "high";
  departmentCode?: string;
  examWithinDays?: number;
  from?: Date;
  limit?: number;
  query?: string;
};

export async function getAtRiskStudents(ctx: AccessContext, filters: AtRiskFilters = {}): Promise<StudentRisk[]> {
  await authorize(ctx, "student.performance.view");
  let rows = getAllStudentRiskProfiles();

  if (filters.maxAttendance !== undefined) rows = rows.filter((r) => r.attendancePercentage < filters.maxAttendance!);
  if (filters.minAttendance !== undefined) rows = rows.filter((r) => r.attendancePercentage >= filters.minAttendance!);
  if (filters.riskLevel) rows = rows.filter((r) => r.riskLevel === filters.riskLevel);
  if (filters.departmentCode) rows = rows.filter((r) => r.departmentCode === filters.departmentCode);
  if (filters.query) {
    const q = filters.query.toLowerCase();
    rows = rows.filter((r) => r.name.toLowerCase().includes(q) || r.rollNumber.toLowerCase().includes(q));
  }

  if (filters.examWithinDays !== undefined) {
    const from = filters.from ?? new Date();
    const to = new Date(from);
    to.setDate(to.getDate() + filters.examWithinDays);
    const fromStr = formatDate(from);
    const toStr = formatDate(to);
    const examKeys = new Set(
      (
        sqlite
          .prepare(`SELECT DISTINCT programme_id, semester FROM exams WHERE date BETWEEN ? AND ?`)
          .all(fromStr, toStr) as { programme_id: number; semester: number }[]
      ).map((e) => `${e.programme_id}-${e.semester}`),
    );
    rows = rows.filter((r) => examKeys.has(`${r.programmeId}-${r.semester}`));
  }

  rows.sort((a, b) => b.riskScore - a.riskScore);
  return filters.limit ? rows.slice(0, filters.limit) : rows;
}
