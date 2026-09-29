import { db } from "@/lib/db/client";
import { students, departments, programmes, documents } from "@/lib/db/schema";
import { desc, eq } from "drizzle-orm";
import { AccessContext, authorize } from "./context";

/** Admission Cell dashboard: the most recently onboarded students, i.e. the
 * live "admissions ledger" for this prototype (a dedicated
 * applications/leads pipeline is out of scope for the hackathon build, but
 * the RBAC surface - admission.application.view / student.onboard - is
 * real and enforced). */
export async function listRecentAdmissions(ctx: AccessContext, limit = 30) {
  await authorize(ctx, "admission.application.view");
  return db
    .select({
      id: students.id,
      rollNumber: students.rollNumber,
      firstName: students.firstName,
      lastName: students.lastName,
      email: students.email,
      admissionYear: students.admissionYear,
      status: students.status,
      department: departments.name,
      programme: programmes.name,
      createdAt: students.createdAt,
    })
    .from(students)
    .innerJoin(departments, eq(students.departmentId, departments.id))
    .innerJoin(programmes, eq(students.programmeId, programmes.id))
    .orderBy(desc(students.createdAt))
    .limit(limit);
}

export async function listProgrammesForOnboarding() {
  return db
    .select({ id: programmes.id, name: programmes.name, departmentId: programmes.departmentId, departmentName: departments.name })
    .from(programmes)
    .innerJoin(departments, eq(programmes.departmentId, departments.id));
}

export type OnboardStudentInput = {
  programmeId: number;
  rollNumber: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  dob: string;
  gender: string;
};

/** Admission Cell action: registers a new student after document
 * verification. Sensitive + audited. */
export async function onboardStudent(ctx: AccessContext, input: OnboardStudentInput) {
  await authorize(ctx, "student.onboard", undefined, { resourceLabel: `roll:${input.rollNumber}`, forceAudit: true });

  const programme = await db.query.programmes.findFirst({ where: eq(programmes.id, input.programmeId) });
  if (!programme) throw new Error("Programme not found.");

  const existing = await db.query.students.findFirst({ where: eq(students.rollNumber, input.rollNumber) });
  if (existing) throw new Error(`Roll number ${input.rollNumber} is already in use.`);

  const now = new Date();
  const row = db
    .insert(students)
    .values({
      universityId: 1,
      departmentId: programme.departmentId,
      programmeId: programme.id,
      rollNumber: input.rollNumber,
      firstName: input.firstName,
      lastName: input.lastName,
      email: input.email,
      phone: input.phone,
      dob: input.dob,
      gender: input.gender,
      admissionYear: now.getFullYear(),
      currentSemester: 1,
      status: "active",
      sourceSystem: "admission_cell",
      sourceId: input.rollNumber,
      lastSyncedAt: now.toISOString(),
    })
    .returning()
    .get();

  db.insert(documents)
    .values({ studentId: row.id, type: "id_card", title: "Student ID Card", issuedAt: now.toISOString().slice(0, 10), status: "available" })
    .run();

  return row;
}
