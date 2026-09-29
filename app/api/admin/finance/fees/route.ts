import { NextRequest, NextResponse } from "next/server";
import { getCurrentContext } from "@/lib/demo-session";
import { listFeeRecords } from "@/lib/services/fees";
import { handleApiError } from "@/lib/api-helpers";

export async function GET(req: NextRequest) {
  try {
    const ctx = await getCurrentContext();
    const status = new URL(req.url).searchParams.get("status") ?? undefined;
    const rows = await listFeeRecords(ctx, { status });
    return NextResponse.json({ fees: rows });
  } catch (err) {
    return handleApiError(err);
  }
}
