import { NextResponse } from "next/server";
import { getCurrentContext } from "@/lib/demo-session";
import { getFeeStatus } from "@/lib/services/fees";
import { handleApiError } from "@/lib/api-helpers";

export async function GET() {
  try {
    const ctx = await getCurrentContext();
    const fees = await getFeeStatus(ctx);
    return NextResponse.json(fees);
  } catch (err) {
    return handleApiError(err);
  }
}
