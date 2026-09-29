import { db, sqlite } from "@/lib/db/client";
import { scholarships, scholarshipApplications, students } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import { AccessContext, authorize, resolveStudentIdForAccess } from "./context";
import { getStudentRisk } from "./risk";

const STATUS_STEPS = ["submitted", "under_review", "approved", "disbursed"] as const;

export async function getStudentScholarshipView(ctx: AccessContext, requestedStudentId?: number) {
  const studentId = await resolveStudentIdForAccess(ctx, "scholarship.status.view", requestedStudentId);
  const student = await db.query.students.findFirst({ where: eq(students.id, studentId) });
  if (!student) throw new Error("Student not found.");

  const risk = await getStudentRisk(studentId);
  const attendance = risk?.attendancePercentage ?? 100;

  const allScholarships = await db.select().from(scholarships).orderBy(scholarships.deadline);
  const myApplications = await db
    .select({
      id: scholarshipApplications.id,
      scholarshipId: scholarshipApplications.scholarshipId,
      status: scholarshipApplications.status,
      appliedAt: scholarshipApplications.appliedAt,
      decidedAt: scholarshipApplications.decidedAt,
      remarks: scholarshipApplications.remarks,
    })
    .from(scholarshipApplications)
    .where(eq(scholarshipApplications.studentId, studentId));

  const appliedIds = new Set(myApplications.map((a) => a.scholarshipId));
  const today = new Date().toISOString().slice(0, 10);

  const eligible = allScholarships
    .map((s) => {
      const deptOk = !s.departmentCode || s.departmentCode === deptCodeOf(student);
      const attendanceOk = !s.minAttendance || attendance >= s.minAttendance;
      const deadlineOk = s.deadline >= today;
      return {
        ...s,
        eligible: deptOk && attendanceOk && deadlineOk,
        deadlinePassed: !deadlineOk,
        alreadyApplied: appliedIds.has(s.id),
      };
    });

  const applications = myApplications.map((a) => {
    const scholarship = allScholarships.find((s) => s.id === a.scholarshipId)!;
    return { ...a, scholarshipName: scholarship?.name, amount: scholarship?.amount, statusSteps: STATUS_STEPS, rejected: a.status === "rejected" };
  });

  return { scholarships: eligible, applications, attendance };
}

function deptCodeOf(student: { departmentId: number }): string | null {
  const row = sqlite.prepare(`SELECT code FROM departments WHERE id = ?`).get(student.departmentId) as { code: string } | undefined;
  return row?.code ?? null;
}

export async function applyForScholarship(ctx: AccessContext, scholarshipId: number, requestedStudentId?: number) {
  const studentId = await resolveStudentIdForAccess(ctx, "scholarship.apply", requestedStudentId);
  const scholarship = await db.query.scholarships.findFirst({ where: eq(scholarships.id, scholarshipId) });
  if (!scholarship) throw new Error("Scholarship not found.");

  const existing = await db.query.scholarshipApplications.findFirst({
    where: (a, { and, eq }) => and(eq(a.scholarshipId, scholarshipId), eq(a.studentId, studentId)),
  });
  if (existing) return { success: false, reason: "already_applied" as const, application: existing };

  const today = new Date().toISOString().slice(0, 10);
  if (scholarship.deadline < today) return { success: false, reason: "deadline_passed" as const, application: null };

  const risk = await getStudentRisk(studentId);
  if (scholarship.minAttendance && (risk?.attendancePercentage ?? 0) < scholarship.minAttendance) {
    return { success: false, reason: "not_eligible" as const, application: null };
  }

  const application = db
    .insert(scholarshipApplications)
    .values({
      scholarshipId,
      studentId,
      status: "submitted",
      appliedAt: today,
      documentsSubmitted: true,
    })
    .returning()
    .get();

  return { success: true, reason: null, application };
}

export async function getScholarshipAdminOverview(ctx: AccessContext) {
  await authorize(ctx, "scholarship.application.view");
  const stats = sqlite
    .prepare(
      `SELECT
        COUNT(*) total,
        SUM(CASE WHEN status IN ('submitted','under_review') THEN 1 ELSE 0 END) pending,
        SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) approved,
        SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END) rejected,
        SUM(CASE WHEN status = 'disbursed' THEN 1 ELSE 0 END) disbursed
       FROM scholarship_applications`,
    )
    .get() as { total: number; pending: number; approved: number; rejected: number; disbursed: number };

  const disbursedAmount = sqlite
    .prepare(
      `SELECT COALESCE(SUM(s.amount), 0) total FROM scholarship_applications sa JOIN scholarships s ON s.id = sa.scholarship_id WHERE sa.status = 'disbursed'`,
    )
    .get() as { total: number };

  return { ...stats, disbursedAmount: disbursedAmount.total };
}

export type ScholarshipApplicationFilters = { status?: string; limit?: number };

export async function listApplications(ctx: AccessContext, filters: ScholarshipApplicationFilters = {}) {
  await authorize(ctx, "scholarship.application.view");
  const whereClause = filters.status ? `WHERE sa.status = @status` : "";
  const rows = sqlite
    .prepare(
      `SELECT sa.id, sa.status, sa.applied_at as appliedAt, sa.decided_at as decidedAt, sa.remarks,
        s.name as scholarshipName, s.amount,
        st.roll_number as rollNumber, st.first_name as firstName, st.last_name as lastName, d.code as departmentCode
       FROM scholarship_applications sa
       JOIN scholarships s ON s.id = sa.scholarship_id
       JOIN students st ON st.id = sa.student_id
       JOIN departments d ON d.id = st.department_id
       ${whereClause}
       ORDER BY sa.applied_at DESC
       LIMIT @limit`,
    )
    .all({ status: filters.status ?? null, limit: filters.limit ?? 100 });
  return rows;
}

export async function decideApplication(ctx: AccessContext, applicationId: number, decision: "approved" | "rejected", remarks?: string) {
  await authorize(ctx, "scholarship.status.update", undefined, { resourceLabel: `scholarship_application:${applicationId}`, forceAudit: true });
  const today = new Date().toISOString().slice(0, 10);
  db.update(scholarshipApplications)
    .set({ status: decision, decidedAt: today, remarks: remarks ?? null })
    .where(eq(scholarshipApplications.id, applicationId))
    .run();
  return db.query.scholarshipApplications.findFirst({ where: eq(scholarshipApplications.id, applicationId) });
}

export async function listAllScholarships() {
  return db.select().from(scholarships).orderBy(desc(scholarships.deadline));
}
