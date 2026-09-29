import { db } from "@/lib/db/client";
import { exams, examResults, courses, students } from "@/lib/db/schema";
import { eq, and, gte, lte, inArray, desc, sql } from "drizzle-orm";
import { AccessContext, authorize, resolveStudentIdForAccess } from "./context";
import { formatDate } from "@/lib/db/seed-helpers";

export async function getExamSchedule(ctx: AccessContext, requestedStudentId?: number) {
  const studentId = await resolveStudentIdForAccess(ctx, "exam.schedule.view", requestedStudentId);
  const student = await db.query.students.findFirst({ where: eq(students.id, studentId) });
  if (!student) throw new Error("Student not found.");

  const rows = await db
    .select({
      id: exams.id,
      name: exams.name,
      examType: exams.examType,
      date: exams.date,
      startTime: exams.startTime,
      durationMinutes: exams.durationMinutes,
      maxMarks: exams.maxMarks,
      courseCode: courses.code,
      courseName: courses.name,
    })
    .from(exams)
    .innerJoin(courses, eq(exams.courseId, courses.id))
    .where(and(eq(exams.programmeId, student.programmeId), eq(exams.semester, student.currentSemester)))
    .orderBy(exams.date);

  return rows;
}

/** Published (graded=true) results only - a mark entered by faculty stays
 * invisible to the student/parent until Examination publishes it. */
export async function getMyResults(ctx: AccessContext, requestedStudentId?: number) {
  const studentId = await resolveStudentIdForAccess(ctx, "marks.view", requestedStudentId);
  const rows = await db
    .select({
      examId: exams.id,
      examName: exams.name,
      examType: exams.examType,
      date: exams.date,
      maxMarks: exams.maxMarks,
      courseCode: courses.code,
      courseName: courses.name,
      marksObtained: examResults.marksObtained,
    })
    .from(examResults)
    .innerJoin(exams, eq(examResults.examId, exams.id))
    .innerJoin(courses, eq(exams.courseId, courses.id))
    .where(and(eq(examResults.studentId, studentId), eq(examResults.graded, true)))
    .orderBy(desc(exams.date));

  return rows.map((r) => ({ ...r, percentage: Math.round((r.marksObtained / r.maxMarks) * 1000) / 10 }));
}

export async function getUpcomingExamsWithin(ctx: AccessContext, requestedStudentId: number | undefined, days: number, from: Date) {
  const schedule = await getExamSchedule(ctx, requestedStudentId);
  const to = new Date(from);
  to.setDate(to.getDate() + days);
  const fromStr = formatDate(from);
  const toStr = formatDate(to);
  return schedule.filter((e) => e.date >= fromStr && e.date <= toStr);
}

export async function getRecentTestAverage(studentId: number): Promise<{ average: number; count: number }> {
  const rows = await db
    .select({ marksObtained: examResults.marksObtained, maxMarks: exams.maxMarks })
    .from(examResults)
    .innerJoin(exams, eq(examResults.examId, exams.id))
    .where(eq(examResults.studentId, studentId));

  if (!rows.length) return { average: 0, count: 0 };
  const pct = rows.map((r) => (r.marksObtained / r.maxMarks) * 100);
  const average = Math.round((pct.reduce((s, v) => s + v, 0) / pct.length) * 10) / 10;
  return { average, count: rows.length };
}

/** Exams for one of the caller's own courses (faculty marks-entry screen). */
export async function getExamsForCourse(ctx: AccessContext, courseId: number) {
  await authorize(ctx, "marks.create", { courseId });
  return db.select().from(exams).where(eq(exams.courseId, courseId)).orderBy(exams.date);
}

export type MarksEntry = { studentId: number; marksObtained: number };

/** Faculty enters/edits marks for their own course's exam. New results are
 * stored ungraded (unpublished) until an Examination-department user calls
 * publishResults - reusing the existing `graded` column as the publish
 * flag, so students/parents never see a mark before it's released. */
export async function enterMarks(ctx: AccessContext, examId: number, entries: MarksEntry[]): Promise<{ saved: number }> {
  const exam = await db.query.exams.findFirst({ where: eq(exams.id, examId) });
  if (!exam) throw new Error("Exam not found.");
  await authorize(ctx, "marks.create", { courseId: exam.courseId });

  const existing = await db
    .select({ id: examResults.id, studentId: examResults.studentId })
    .from(examResults)
    .where(eq(examResults.examId, examId));
  const existingByStudent = new Map(existing.map((r) => [r.studentId, r.id]));

  for (const entry of entries) {
    const clamped = Math.max(0, Math.min(exam.maxMarks, entry.marksObtained));
    const existingId = existingByStudent.get(entry.studentId);
    if (existingId) {
      db.update(examResults).set({ marksObtained: clamped, graded: false }).where(eq(examResults.id, existingId)).run();
    } else {
      db.insert(examResults).values({ examId, studentId: entry.studentId, marksObtained: clamped, graded: false }).run();
    }
  }
  return { saved: entries.length };
}

export async function getResultsForExam(ctx: AccessContext, examId: number) {
  const exam = await db.query.exams.findFirst({ where: eq(exams.id, examId) });
  if (!exam) throw new Error("Exam not found.");
  await authorize(ctx, "marks.create", { courseId: exam.courseId });

  return db
    .select({
      studentId: students.id,
      rollNumber: students.rollNumber,
      firstName: students.firstName,
      lastName: students.lastName,
      marksObtained: examResults.marksObtained,
      graded: examResults.graded,
    })
    .from(students)
    .leftJoin(examResults, and(eq(examResults.studentId, students.id), eq(examResults.examId, examId)))
    .where(and(eq(students.programmeId, exam.programmeId), eq(students.currentSemester, exam.semester)));
}

/** Examination-department action: releases every entered mark for an exam
 * to students/parents. Sensitive + audited (see PERMISSIONS catalog). */
export async function publishResults(ctx: AccessContext, examId: number): Promise<{ published: number }> {
  await authorize(ctx, "exam.results.publish", undefined, { resourceLabel: `exam:${examId}`, forceAudit: true });
  const result = db.update(examResults).set({ graded: true }).where(eq(examResults.examId, examId)).run();
  return { published: result.changes };
}

export async function listExamsForPublishing(ctx: AccessContext) {
  await authorize(ctx, "exam.results.manage");
  const rows = await db
    .select({
      id: exams.id,
      name: exams.name,
      date: exams.date,
      courseCode: courses.code,
      courseName: courses.name,
    })
    .from(exams)
    .innerJoin(courses, eq(exams.courseId, courses.id))
    .where(lte(exams.date, formatDate(new Date())))
    .orderBy(desc(exams.date));

  const examIds = rows.map((r) => r.id);
  if (!examIds.length) return [];
  const counts = await db
    .select({
      examId: examResults.examId,
      total: sql<number>`count(*)`,
      pending: sql<number>`sum(case when ${examResults.graded} = 0 then 1 else 0 end)`,
    })
    .from(examResults)
    .where(inArray(examResults.examId, examIds))
    .groupBy(examResults.examId);
  const byExam = new Map(counts.map((c) => [c.examId, c]));

  return rows.map((r) => ({
    ...r,
    totalEntered: byExam.get(r.id)?.total ?? 0,
    pendingPublish: byExam.get(r.id)?.pending ?? 0,
  }));
}

export async function getUniversityWideExamsWithin(days: number, from: Date) {
  const to = new Date(from);
  to.setDate(to.getDate() + days);
  return db
    .select({
      id: exams.id,
      name: exams.name,
      date: exams.date,
      courseCode: courses.code,
      courseName: courses.name,
      programmeId: exams.programmeId,
      semester: exams.semester,
    })
    .from(exams)
    .innerJoin(courses, eq(exams.courseId, courses.id))
    .where(and(gte(exams.date, formatDate(from)), lte(exams.date, formatDate(to))));
}
