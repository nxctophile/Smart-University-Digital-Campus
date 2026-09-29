import { sqlite } from "@/lib/db/client";
import { db } from "@/lib/db/client";
import { helpdeskTickets, certificates, notifications } from "@/lib/db/schema";
import { eq, sql, desc } from "drizzle-orm";
import { AccessContext, authorize } from "./context";
import { getAllStudentRiskProfiles } from "./risk";

export async function getAdminOverview(ctx: AccessContext) {
  await authorize(ctx, "report.view");

  const totalStudents = (sqlite.prepare(`SELECT COUNT(*) c FROM students WHERE status='active'`).get() as { c: number }).c;
  const attRow = sqlite
    .prepare(
      `SELECT SUM(CASE WHEN status IN ('present','excused') THEN 1 ELSE 0 END) present, COUNT(*) total FROM attendance`,
    )
    .get() as { present: number; total: number };
  const avgAttendance = attRow.total ? Math.round((attRow.present / attRow.total) * 1000) / 10 : 0;

  const feeRow = sqlite
    .prepare(`SELECT SUM(amount - amount_paid) pending FROM fees WHERE status != 'paid'`)
    .get() as { pending: number | null };

  const openGrievances = (
    await db.select({ count: sql<number>`count(*)` }).from(helpdeskTickets).where(sql`status IN ('open','in_progress')`).get()
  )?.count ?? 0;

  const certificatesIssued = (
    await db.select({ count: sql<number>`count(*)` }).from(certificates).where(eq(certificates.status, "ready")).get()
  )?.count ?? 0;

  const riskProfiles = getAllStudentRiskProfiles();
  const atRiskCount = riskProfiles.filter((r) => r.riskLevel !== "low").length;

  const byDepartment = sqlite
    .prepare(
      `SELECT d.code, d.name, COUNT(*) students,
        ROUND(AVG(CASE WHEN a.total > 0 THEN a.present * 100.0 / a.total ELSE NULL END), 1) avgAttendance
       FROM students s
       JOIN departments d ON d.id = s.department_id
       LEFT JOIN (
         SELECT student_id, COUNT(*) total, SUM(CASE WHEN status IN ('present','excused') THEN 1 ELSE 0 END) present
         FROM attendance GROUP BY student_id
       ) a ON a.student_id = s.id
       WHERE s.status = 'active'
       GROUP BY d.id`,
    )
    .all();

  return {
    totalStudents,
    avgAttendance,
    pendingFees: feeRow.pending ?? 0,
    openGrievances,
    certificatesIssued,
    atRiskCount,
    byDepartment,
  };
}

export async function getRecentNotifications(limit = 10) {
  return db.select().from(notifications).orderBy(desc(notifications.createdAt)).limit(limit);
}

export async function notifyStudents(ctx: AccessContext, studentIds: number[], channel: "student" | "parent", message: string) {
  await authorize(ctx, "student.communication.create", undefined, { resourceLabel: `students:${studentIds.length}`, forceAudit: true });
  // Prototype: log a notification row per student rather than sending real email/SMS.
  const rows = studentIds.map((studentId) => ({
    universityId: 1,
    studentId,
    audienceRole: channel,
    title: channel === "parent" ? "Attendance alert sent to parent" : "Attendance alert",
    message,
    category: "academic",
    createdAt: new Date().toISOString(),
  }));
  for (const row of rows) db.insert(notifications).values(row).run();
  return { notified: rows.length };
}
