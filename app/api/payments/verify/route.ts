import { NextRequest, NextResponse } from "next/server";
import { getCurrentContext } from "@/lib/demo-session";
import { verifyFeePayment } from "@/lib/services/payments";
import { handleApiError } from "@/lib/api-helpers";

export async function POST(req: NextRequest) {
  try {
    const ctx = await getCurrentContext();
    const body = await req.json();
    const result = await verifyFeePayment(ctx, {
      feeId: body.feeId,
      orderId: body.orderId,
      paymentId: body.paymentId,
      signature: body.signature,
    });
    return NextResponse.json(result);
  } catch (err) {
    return handleApiError(err);
  }
}
