import { NextRequest, NextResponse } from "next/server";
import { getCurrentContext } from "@/lib/demo-session";
import { createFeeOrder } from "@/lib/services/payments";
import { handleApiError } from "@/lib/api-helpers";

export async function POST(req: NextRequest) {
  try {
    const ctx = await getCurrentContext();
    const body = await req.json();
    const order = await createFeeOrder(ctx, body.feeId);
    return NextResponse.json(order);
  } catch (err) {
    return handleApiError(err);
  }
}
