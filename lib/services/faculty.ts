import { db } from "@/lib/db/client";
import { sections, courses, students, faculty } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { AccessContext, authorize } from "./context";
import { getAllStudentRiskProfiles } from "./risk";

export async function getMyCourses(ctx: AccessContext) {
  await authorize(ctx, "class.view");
  if (!ctx.facultyId) return [];
  const rows = await db
    .select({
      sectionId: sections.id,
      courseId: courses.id,
      courseCode: courses.code,
      courseName: courses.name,
      programmeId: courses.programmeId,
      semester: courses.semester,
      academicYear: sections.academicYear,
    })
    .from(sections)
    .innerJoin(courses, eq(sections.courseId, courses.id))
    .where(eq(sections.facultyId, ctx.facultyId));
  return rows;
}

export async function getMyCoursesWithStats(ctx: AccessContext) {
  const myCourses = await getMyCourses(ctx);
  const riskProfiles = getAllStudentRiskProfiles();

  return myCourses.map((course) => {
    const roster = riskProfiles.filter((r) => r.programmeId === course.programmeId && r.semester === course.semester);
    const avgAttendance = roster.length
      ? Math.round((roster.reduce((sum, r) => sum + r.attendancePercentage, 0) / roster.length) * 10) / 10
      : 0;
    const atRiskCount = roster.filter((r) => r.riskLevel !== "low").length;
    return { ...course, studentCount: roster.length, avgAttendance, atRiskCount };
  });
}

export async function getStudentsInCourse(ctx: AccessContext, courseId: number) {
  await authorize(ctx, "class.view");
  const course = await db.query.courses.findFirst({ where: eq(courses.id, courseId) });
  if (!course) throw new Error("Course not found.");

  const roster = await db
    .select({
      id: students.id,
      rollNumber: students.rollNumber,
      firstName: students.firstName,
      lastName: students.lastName,
      avatarColor: students.avatarColor,
    })
    .from(students)
    .where(and(eq(students.programmeId, course.programmeId), eq(students.currentSemester, course.semester)));

  const riskByStudent = new Map(getAllStudentRiskProfiles().map((r) => [r.studentId, r]));
  return roster.map((s) => ({ ...s, risk: riskByStudent.get(s.id) ?? null }));
}

export async function getFacultyProfile(ctx: AccessContext) {
  await authorize(ctx, "class.view");
  if (!ctx.facultyId) throw new Error("No faculty profile linked to this account.");
  return db.query.faculty.findFirst({ where: eq(faculty.id, ctx.facultyId) });
}
