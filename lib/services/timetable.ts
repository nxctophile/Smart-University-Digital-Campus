import { db } from "@/lib/db/client";
import { timetableSlots, courses, faculty, students } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { AccessContext, resolveStudentIdForAccess, authorize } from "./context";
import { DAY_NAMES } from "@/lib/types";

export { DAY_NAMES };

export async function getStudentTimetable(ctx: AccessContext, requestedStudentId?: number) {
  const studentId = await resolveStudentIdForAccess(ctx, "timetable.view", requestedStudentId);
  const student = await db.query.students.findFirst({ where: eq(students.id, studentId) });
  if (!student) throw new Error("Student not found.");

  const rows = await db
    .select({
      id: timetableSlots.id,
      dayOfWeek: timetableSlots.dayOfWeek,
      startTime: timetableSlots.startTime,
      endTime: timetableSlots.endTime,
      room: timetableSlots.room,
      courseCode: courses.code,
      courseName: courses.name,
      facultyFirstName: faculty.firstName,
      facultyLastName: faculty.lastName,
    })
    .from(timetableSlots)
    .innerJoin(courses, eq(timetableSlots.courseId, courses.id))
    .leftJoin(faculty, eq(timetableSlots.facultyId, faculty.id))
    .where(and(eq(timetableSlots.programmeId, student.programmeId), eq(timetableSlots.semester, student.currentSemester)))
    .orderBy(timetableSlots.dayOfWeek, timetableSlots.startTime);

  return rows.map((r) => ({
    ...r,
    dayName: DAY_NAMES[r.dayOfWeek],
    facultyName: r.facultyFirstName ? `${r.facultyFirstName} ${r.facultyLastName}` : null,
  }));
}

export async function getNextClass(ctx: AccessContext, requestedStudentId: number | undefined, from: Date) {
  const timetable = await getStudentTimetable(ctx, requestedStudentId);
  if (!timetable.length) return null;

  const dow = (from.getDay() + 6) % 7; // Mon=0..Sun=6
  const hhmm = `${String(from.getHours()).padStart(2, "0")}:${String(from.getMinutes()).padStart(2, "0")}`;

  for (let offset = 0; offset < 8; offset++) {
    const day = (dow + offset) % 7;
    if (day > 4) continue; // weekends have no classes
    const slotsToday = timetable
      .filter((s) => s.dayOfWeek === day)
      .filter((s) => (offset === 0 ? s.startTime > hhmm : true))
      .sort((a, b) => a.startTime.localeCompare(b.startTime));
    if (slotsToday.length) return { ...slotsToday[0], daysFromNow: offset };
  }
  return null;
}

export async function getClassOnDate(ctx: AccessContext, requestedStudentId: number | undefined, courseCode: string, date: Date) {
  const timetable = await getStudentTimetable(ctx, requestedStudentId);
  const dow = (date.getDay() + 6) % 7;
  return timetable.find((s) => s.dayOfWeek === dow && s.courseCode.toLowerCase() === courseCode.toLowerCase()) ?? null;
}

export async function getFacultyTimetable(ctx: AccessContext) {
  await authorize(ctx, "timetable.view");
  if (!ctx.facultyId) throw new Error("No faculty profile linked to this account.");
  const rows = await db
    .select({
      id: timetableSlots.id,
      dayOfWeek: timetableSlots.dayOfWeek,
      startTime: timetableSlots.startTime,
      endTime: timetableSlots.endTime,
      room: timetableSlots.room,
      courseCode: courses.code,
      courseName: courses.name,
      semester: timetableSlots.semester,
    })
    .from(timetableSlots)
    .innerJoin(courses, eq(timetableSlots.courseId, courses.id))
    .where(eq(timetableSlots.facultyId, ctx.facultyId))
    .orderBy(timetableSlots.dayOfWeek, timetableSlots.startTime);
  return rows.map((r) => ({ ...r, dayName: DAY_NAMES[r.dayOfWeek] }));
}
