import { db } from "@/lib/db/client";
import { attendance, courses } from "@/lib/db/schema";
import { eq, and, sql } from "drizzle-orm";
import { AccessContext, resolveStudentIdForAccess, authorize } from "./context";

export type CourseAttendance = {
  courseId: number;
  courseCode: string;
  courseName: string;
  present: number;
  absent: number;
  late: number;
  excused: number;
  total: number;
  percentage: number;
};

export async function getAttendanceSummary(ctx: AccessContext, requestedStudentId?: number) {
  const studentId = await resolveStudentIdForAccess(ctx, "attendance.view", requestedStudentId);

  const rows = await db
    .select({
      courseId: courses.id,
      courseCode: courses.code,
      courseName: courses.name,
      status: attendance.status,
      count: sql<number>`count(*)`,
    })
    .from(attendance)
    .innerJoin(courses, eq(attendance.courseId, courses.id))
    .where(eq(attendance.studentId, studentId))
    .groupBy(courses.id, attendance.status);

  const byCourse = new Map<number, CourseAttendance>();
  for (const r of rows) {
    if (!byCourse.has(r.courseId)) {
      byCourse.set(r.courseId, {
        courseId: r.courseId,
        courseCode: r.courseCode,
        courseName: r.courseName,
        present: 0,
        absent: 0,
        late: 0,
        excused: 0,
        total: 0,
        percentage: 0,
      });
    }
    const entry = byCourse.get(r.courseId)!;
    entry[r.status as "present" | "absent" | "late" | "excused"] += r.count;
    entry.total += r.count;
  }

  const courseList = Array.from(byCourse.values()).map((c) => ({
    ...c,
    percentage: c.total ? Math.round(((c.present + c.excused) / c.total) * 1000) / 10 : 0,
  }));

  const totals = courseList.reduce(
    (acc, c) => ({ present: acc.present + c.present + c.excused, total: acc.total + c.total }),
    { present: 0, total: 0 },
  );
  const overallPercentage = totals.total ? Math.round((totals.present / totals.total) * 1000) / 10 : 0;

  return { studentId, courses: courseList, overallPercentage, totalSessions: totals.total };
}

/** Projects attendance if the student attends/misses a given number of
 * upcoming sessions of one course — used by the "can I skip class" AI flow. */
export async function projectAttendance(
  ctx: AccessContext,
  requestedStudentId: number | undefined,
  courseId: number,
  additionalMissed: number,
) {
  const studentId = await resolveStudentIdForAccess(ctx, "attendance.view", requestedStudentId);
  const summary = await getAttendanceSummary(ctx, studentId);
  const course = summary.courses.find((c) => c.courseId === courseId);
  if (!course) throw new Error("No attendance record found for that course.");

  const projectedTotal = course.total + additionalMissed;
  const projectedPresent = course.present + course.excused;
  const projectedPercentage = projectedTotal ? Math.round((projectedPresent / projectedTotal) * 1000) / 10 : 0;

  return {
    courseCode: course.courseCode,
    courseName: course.courseName,
    currentPercentage: course.percentage,
    projectedPercentage,
    safeToMiss: projectedPercentage >= 75,
    minimumRequired: 75,
  };
}

export type AttendanceMark = { studentId: number; status: "present" | "absent" | "late" | "excused" };

/** Faculty marks/edits attendance for one course session. Scope is enforced
 * on the courseId (must be one of the caller's own sections) via
 * authorize()'s dynamic courseIds resolution - never on the UI. */
export async function markAttendance(
  ctx: AccessContext,
  courseId: number,
  date: string,
  records: AttendanceMark[],
): Promise<{ marked: number }> {
  await authorize(ctx, "attendance.create", { courseId });

  const existing = await db
    .select({ id: attendance.id, studentId: attendance.studentId })
    .from(attendance)
    .where(and(eq(attendance.courseId, courseId), eq(attendance.date, date)));
  const existingByStudent = new Map(existing.map((r) => [r.studentId, r.id]));

  for (const rec of records) {
    const existingId = existingByStudent.get(rec.studentId);
    if (existingId) {
      db.update(attendance).set({ status: rec.status, markedBy: ctx.name }).where(eq(attendance.id, existingId)).run();
    } else {
      db.insert(attendance).values({ studentId: rec.studentId, courseId, date, status: rec.status, markedBy: ctx.name }).run();
    }
  }
  return { marked: records.length };
}

export async function getRecentAttendanceRate(studentId: number, courseId: number, lastN = 24): Promise<number> {
  const rows = await db
    .select({ status: attendance.status })
    .from(attendance)
    .where(and(eq(attendance.studentId, studentId), eq(attendance.courseId, courseId)))
    .orderBy(sql`${attendance.date} desc`)
    .limit(lastN);
  if (!rows.length) return 1;
  const present = rows.filter((r) => r.status === "present" || r.status === "excused").length;
  return present / rows.length;
}
