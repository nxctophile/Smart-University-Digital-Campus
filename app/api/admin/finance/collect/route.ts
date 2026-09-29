import { NextRequest, NextResponse } from "next/server";
import { getCurrentContext } from "@/lib/demo-session";
import { collectFeePayment } from "@/lib/services/fees";
import { handleApiError } from "@/lib/api-helpers";

export async function POST(req: NextRequest) {
  try {
    const ctx = await getCurrentContext();
    const body = await req.json();
    const result = await collectFeePayment(ctx, Number(body.feeId), Number(body.amount), String(body.method ?? "cash"));
    return NextResponse.json(result);
  } catch (err) {
    return handleApiError(err);
  }
}
