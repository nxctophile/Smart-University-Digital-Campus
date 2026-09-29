import { db } from "@/lib/db/client";
import { fees, payments, students } from "@/lib/db/schema";
import { eq, desc, sql } from "drizzle-orm";
import { AccessContext, authorize, resolveStudentIdForAccess } from "./context";

export async function getFeeStatus(ctx: AccessContext, requestedStudentId?: number) {
  const studentId = await resolveStudentIdForAccess(ctx, "fees.status.view", requestedStudentId);
  const rows = await db.select().from(fees).where(eq(fees.studentId, studentId));

  const totalDue = rows.reduce((sum, f) => sum + (f.amount - f.amountPaid), 0);
  const hasOverdue = rows.some((f) => f.status === "overdue");

  return {
    studentId,
    items: rows.map((f) => ({
      id: f.id,
      feeType: f.feeType,
      academicYear: f.academicYear,
      semester: f.semester,
      amount: f.amount,
      amountPaid: f.amountPaid,
      pending: f.amount - f.amountPaid,
      dueDate: f.dueDate,
      status: f.status,
    })),
    totalDue,
    hasOverdue,
  };
}

export async function getPaymentHistory(ctx: AccessContext, requestedStudentId?: number) {
  const studentId = await resolveStudentIdForAccess(ctx, "fees.status.view", requestedStudentId);
  return db.select().from(payments).where(eq(payments.studentId, studentId));
}

// ---------------------------------------------------------------------------
// Accounts Department (finance.* permissions - not scoped to a single
// student, department-wide by design).
// ---------------------------------------------------------------------------

export async function getFinanceOverview(ctx: AccessContext) {
  await authorize(ctx, "finance.fees.view");
  const row = await db
    .select({
      totalBilled: sql<number>`sum(${fees.amount})`,
      totalCollected: sql<number>`sum(${fees.amountPaid})`,
      overdueCount: sql<number>`sum(case when ${fees.status} = 'overdue' then 1 else 0 end)`,
      pendingCount: sql<number>`sum(case when ${fees.status} = 'pending' then 1 else 0 end)`,
    })
    .from(fees)
    .get();
  return {
    totalBilled: row?.totalBilled ?? 0,
    totalCollected: row?.totalCollected ?? 0,
    totalPending: (row?.totalBilled ?? 0) - (row?.totalCollected ?? 0),
    overdueCount: row?.overdueCount ?? 0,
    pendingCount: row?.pendingCount ?? 0,
  };
}

export type FeeRecordFilters = { status?: string; limit?: number };

export async function listFeeRecords(ctx: AccessContext, filters: FeeRecordFilters = {}) {
  await authorize(ctx, "finance.fees.view");
  const rows = await db
    .select({
      id: fees.id,
      studentId: fees.studentId,
      rollNumber: students.rollNumber,
      firstName: students.firstName,
      lastName: students.lastName,
      feeType: fees.feeType,
      amount: fees.amount,
      amountPaid: fees.amountPaid,
      dueDate: fees.dueDate,
      status: fees.status,
    })
    .from(fees)
    .innerJoin(students, eq(fees.studentId, students.id))
    .where(filters.status ? eq(fees.status, filters.status) : undefined)
    .orderBy(desc(fees.dueDate))
    .limit(filters.limit ?? 100);
  return rows;
}

/** Accounts-department manual fee collection (e.g. cash/cheque recorded at
 * the desk) - distinct from the student's own online payment flow. */
export async function collectFeePayment(ctx: AccessContext, feeId: number, amount: number, method: string) {
  await authorize(ctx, "finance.fees.collect", undefined, { resourceLabel: `fee:${feeId}`, forceAudit: true });
  const fee = await db.query.fees.findFirst({ where: eq(fees.id, feeId) });
  if (!fee) throw new Error("Fee record not found.");

  const newPaid = Math.min(fee.amount, fee.amountPaid + amount);
  const status = newPaid >= fee.amount ? "paid" : "partial";
  db.update(fees).set({ amountPaid: newPaid, status }).where(eq(fees.id, feeId)).run();
  db.insert(payments)
    .values({
      feeId,
      studentId: fee.studentId,
      amount,
      method,
      transactionRef: `desk_${Date.now().toString(36)}`,
      status: "paid",
      paidAt: new Date().toISOString(),
    })
    .run();

  return { success: true, amountPaid: newPaid, status };
}
