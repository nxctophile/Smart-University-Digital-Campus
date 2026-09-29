import { db } from "@/lib/db/client";
import { students, departments, programmes } from "@/lib/db/schema";
import { eq, and, sql, like, or } from "drizzle-orm";
import { AccessContext, authorize, resolveStudentIdForAccess } from "./context";

export async function getStudentProfile(ctx: AccessContext, requestedStudentId?: number) {
  const studentId = await resolveStudentIdForAccess(ctx, "profile.view", requestedStudentId);
  const row = await db
    .select({
      id: students.id,
      rollNumber: students.rollNumber,
      firstName: students.firstName,
      lastName: students.lastName,
      email: students.email,
      phone: students.phone,
      dob: students.dob,
      gender: students.gender,
      admissionYear: students.admissionYear,
      currentSemester: students.currentSemester,
      status: students.status,
      avatarColor: students.avatarColor,
      department: departments.name,
      departmentCode: departments.code,
      programme: programmes.name,
      degreeLevel: programmes.degreeLevel,
    })
    .from(students)
    .innerJoin(departments, eq(students.departmentId, departments.id))
    .innerJoin(programmes, eq(students.programmeId, programmes.id))
    .where(eq(students.id, studentId))
    .get();

  if (!row) throw new Error("Student not found.");
  return row;
}

export type StudentSearchFilters = {
  query?: string;
  departmentCode?: string;
  minAttendance?: number;
  maxAttendance?: number;
  status?: string;
  limit?: number;
};

/** Admin/faculty-only directory search. Access is enforced by role, not by
 * hiding the search box. */
export async function searchStudents(ctx: AccessContext, filters: StudentSearchFilters = {}) {
  await authorize(ctx, "student.view");
  const conditions = [];
  if (filters.query) {
    conditions.push(
      or(
        like(students.firstName, `%${filters.query}%`),
        like(students.lastName, `%${filters.query}%`),
        like(students.rollNumber, `%${filters.query}%`),
        like(students.email, `%${filters.query}%`),
      ),
    );
  }
  if (filters.status) conditions.push(eq(students.status, filters.status));

  let deptId: number | undefined;
  if (filters.departmentCode) {
    const dept = await db.query.departments.findFirst({ where: eq(departments.code, filters.departmentCode) });
    deptId = dept?.id;
    if (deptId) conditions.push(eq(students.departmentId, deptId));
  }

  const rows = await db
    .select({
      id: students.id,
      rollNumber: students.rollNumber,
      firstName: students.firstName,
      lastName: students.lastName,
      email: students.email,
      currentSemester: students.currentSemester,
      status: students.status,
      department: departments.name,
      departmentCode: departments.code,
      programme: programmes.name,
    })
    .from(students)
    .innerJoin(departments, eq(students.departmentId, departments.id))
    .innerJoin(programmes, eq(students.programmeId, programmes.id))
    .where(conditions.length ? and(...conditions) : undefined)
    .limit(filters.limit ?? 50);

  return rows;
}

export async function listDepartments() {
  return db.select().from(departments);
}

export async function countStudents() {
  const row = await db.select({ count: sql<number>`count(*)` }).from(students).get();
  return row?.count ?? 0;
}
