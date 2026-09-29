import { db } from "@/lib/db/client";
import { employees, faculty, departments } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { AccessContext, authorize } from "./context";

/** HR-facing staff directory - combines faculty and non-teaching employees
 * into one list. Faculty attendance/leave live in the same tables as
 * everyone else's HR record for this prototype. */
export async function listStaffDirectory(ctx: AccessContext) {
  await authorize(ctx, "employee.view");

  const facultyRows = await db
    .select({
      id: faculty.id,
      employeeCode: faculty.employeeId,
      firstName: faculty.firstName,
      lastName: faculty.lastName,
      email: faculty.email,
      phone: faculty.phone,
      designation: faculty.designation,
      departmentId: faculty.departmentId,
      departmentName: departments.name,
    })
    .from(faculty)
    .innerJoin(departments, eq(faculty.departmentId, departments.id));

  const staffRows = await db
    .select({
      id: employees.id,
      employeeCode: employees.employeeCode,
      firstName: employees.firstName,
      lastName: employees.lastName,
      email: employees.email,
      phone: employees.phone,
      designation: employees.designation,
      departmentId: employees.departmentId,
      departmentName: departments.name,
    })
    .from(employees)
    .innerJoin(departments, eq(employees.departmentId, departments.id));

  return [
    ...facultyRows.map((f) => ({ ...f, kind: "faculty" as const })),
    ...staffRows.map((s) => ({ ...s, kind: "staff" as const })),
  ].sort((a, b) => a.lastName.localeCompare(b.lastName));
}

export async function getStaffOverview(ctx: AccessContext) {
  await authorize(ctx, "employee.view");
  const facultyCount = (await db.select().from(faculty)).length;
  const staffCount = (await db.select().from(employees)).length;
  const byDepartment = await db
    .select({ departmentId: employees.departmentId, name: departments.name })
    .from(employees)
    .innerJoin(departments, eq(employees.departmentId, departments.id));
  const counts = new Map<string, number>();
  for (const row of byDepartment) counts.set(row.name, (counts.get(row.name) ?? 0) + 1);
  return {
    facultyCount,
    staffCount,
    totalStaff: facultyCount + staffCount,
    byDepartment: Array.from(counts, ([name, count]) => ({ name, count })),
  };
}
