import { NextRequest, NextResponse } from "next/server";
import { getCurrentContext } from "@/lib/demo-session";
import { resetFeeDemo } from "@/lib/services/payments";
import { handleApiError } from "@/lib/api-helpers";

export async function POST(req: NextRequest) {
  try {
    const ctx = await getCurrentContext();
    const body = await req.json();
    const result = await resetFeeDemo(ctx, body.feeId);
    return NextResponse.json(result);
  } catch (err) {
    return handleApiError(err);
  }
}
