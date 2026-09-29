import crypto from "node:crypto";
import { db } from "@/lib/db/client";
import { fees, payments } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { AccessContext, resolveStudentIdForAccess } from "./context";

function getRazorpayClient() {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keyId || !keySecret) return null;
  // Lazy require: keeps the SDK (and its network calls) out of the path
  // entirely when running in demo mode.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const Razorpay = require("razorpay");
  return new Razorpay({ key_id: keyId, key_secret: keySecret }) as {
    orders: { create: (opts: { amount: number; currency: string; receipt: string }) => Promise<{ id: string; amount: number; currency: string }> };
  };
}

export async function createFeeOrder(ctx: AccessContext, feeId: number, requestedStudentId?: number) {
  const studentId = await resolveStudentIdForAccess(ctx, "fees.pay", requestedStudentId);
  const fee = await db.query.fees.findFirst({ where: eq(fees.id, feeId) });
  if (!fee || fee.studentId !== studentId) throw new Error("Fee record not found.");

  const pending = Math.round((fee.amount - fee.amountPaid) * 100) / 100;
  if (pending <= 0) throw new Error("This fee is already paid.");

  const client = getRazorpayClient();
  const amountPaise = Math.round(pending * 100);

  if (!client) {
    // Demo mode: no Razorpay keys configured yet. Still records a "created"
    // payment row so the rest of the flow (verify, receipts) works exactly
    // the same once real keys are added - only the order id's origin differs.
    const orderId = `demo_order_${Date.now().toString(36)}`;
    db.insert(payments)
      .values({ feeId, studentId, amount: pending, method: "razorpay", transactionRef: orderId, status: "created", razorpayOrderId: orderId, paidAt: new Date().toISOString() })
      .run();
    return { orderId, amount: amountPaise, currency: "INR", keyId: null, demoMode: true as const };
  }

  const order = await client.orders.create({ amount: amountPaise, currency: "INR", receipt: `fee_${feeId}_${Date.now()}` });
  db.insert(payments)
    .values({
      feeId,
      studentId,
      amount: pending,
      method: "razorpay",
      transactionRef: order.id,
      status: "created",
      razorpayOrderId: order.id,
      paidAt: new Date().toISOString(),
    })
    .run();

  return { orderId: order.id, amount: order.amount, currency: order.currency, keyId: process.env.RAZORPAY_KEY_ID, demoMode: false as const };
}

export type VerifyPaymentInput = {
  feeId: number;
  orderId: string;
  paymentId: string;
  signature?: string;
};

export async function verifyFeePayment(ctx: AccessContext, input: VerifyPaymentInput, requestedStudentId?: number) {
  const studentId = await resolveStudentIdForAccess(ctx, "fees.pay", requestedStudentId);
  const fee = await db.query.fees.findFirst({ where: eq(fees.id, input.feeId) });
  if (!fee || fee.studentId !== studentId) throw new Error("Fee record not found.");

  const payment = await db.query.payments.findFirst({
    where: (p, { and, eq }) => and(eq(p.razorpayOrderId, input.orderId), eq(p.feeId, input.feeId)),
  });
  if (!payment) throw new Error("Payment order not found - start a new payment.");

  const isDemo = input.orderId.startsWith("demo_order_");
  if (!isDemo) {
    const keySecret = process.env.RAZORPAY_KEY_SECRET;
    if (!keySecret) throw new Error("Payment gateway is not configured.");
    const expected = crypto.createHmac("sha256", keySecret).update(`${input.orderId}|${input.paymentId}`).digest("hex");
    if (expected !== input.signature) throw new Error("Payment signature verification failed.");
  }

  const now = new Date().toISOString();
  db.update(payments)
    .set({ status: "paid", razorpayPaymentId: input.paymentId, razorpaySignature: input.signature ?? null, paidAt: now, transactionRef: input.paymentId })
    .where(eq(payments.id, payment.id))
    .run();

  db.update(fees)
    .set({ amountPaid: fee.amount, status: "paid" })
    .where(eq(fees.id, fee.id))
    .run();

  return { success: true, amount: payment.amount, demoMode: isDemo };
}

export async function resetFeeDemo(ctx: AccessContext, feeId: number, requestedStudentId?: number) {
  const studentId = await resolveStudentIdForAccess(ctx, "fees.pay", requestedStudentId);
  const fee = await db.query.fees.findFirst({ where: eq(fees.id, feeId) });
  if (!fee || fee.studentId !== studentId) throw new Error("Fee record not found.");

  db.update(fees).set({ amountPaid: 0, status: "pending" }).where(eq(fees.id, feeId)).run();
  return { success: true };
}
