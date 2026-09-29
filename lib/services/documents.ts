import { db } from "@/lib/db/client";
import { documents, certificates, students, fees } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { AccessContext, resolveStudentIdForAccess } from "./context";

export const CERT_TYPES = ["bonafide", "enrollment", "character", "transfer"] as const;
export type CertificateType = (typeof CERT_TYPES)[number];

export async function listDocuments(ctx: AccessContext, requestedStudentId?: number) {
  const studentId = await resolveStudentIdForAccess(ctx, "documents.view", requestedStudentId);
  const [docs, certs] = await Promise.all([
    db.select().from(documents).where(eq(documents.studentId, studentId)),
    db.select().from(certificates).where(eq(certificates.studentId, studentId)),
  ]);
  return { documents: docs, certificates: certs };
}

export type EligibilityCheck = {
  eligible: boolean;
  checks: { label: string; passed: boolean; detail: string }[];
};

/** Deterministic eligibility rules the AI (or the Documents page) evaluates
 * before generating a certificate - mirrors what a registrar would check. */
export async function checkCertificateEligibility(studentId: number): Promise<EligibilityCheck> {
  const student = await db.query.students.findFirst({ where: eq(students.id, studentId) });
  const feeRows = await db.select().from(fees).where(eq(fees.studentId, studentId));
  const hasOverdue = feeRows.some((f) => f.status === "overdue");

  const checks = [
    { label: "Identity verified", passed: !!student, detail: student ? `${student.firstName} ${student.lastName} (${student.rollNumber})` : "Student not found" },
    { label: "Enrollment verified", passed: student?.status === "active", detail: student ? `Status: ${student.status}` : "" },
    { label: "No blocking dues", passed: !hasOverdue, detail: hasOverdue ? "There is an overdue fee balance" : "No overdue fees on record" },
  ];

  return { eligible: checks.every((c) => c.passed), checks };
}

export async function requestCertificate(
  ctx: AccessContext,
  requestedStudentId: number | undefined,
  type: CertificateType,
  purpose: string,
  via: "web" | "ai" = "web",
) {
  const studentId = await resolveStudentIdForAccess(ctx, "documents.certificate.request", requestedStudentId);
  const eligibility = await checkCertificateEligibility(studentId);
  if (!eligibility.eligible) {
    return { success: false, eligibility, certificate: null };
  }

  const today = new Date().toISOString().slice(0, 10);
  const verificationCode = `CIT-CERT-${studentId}-${Date.now().toString(36).toUpperCase()}`;
  const row = db
    .insert(certificates)
    .values({
      studentId,
      type,
      status: "ready", // instantly generated for the prototype demo
      requestedAt: today,
      issuedAt: today,
      verificationCode,
      purpose,
      requestedVia: via,
    })
    .returning()
    .get();

  return { success: true, eligibility, certificate: row };
}
