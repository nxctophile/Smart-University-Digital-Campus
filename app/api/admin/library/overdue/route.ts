import { NextResponse } from "next/server";
import { getCurrentContext } from "@/lib/demo-session";
import { listOverdueLoans } from "@/lib/services/library";
import { handleApiError } from "@/lib/api-helpers";

export async function GET() {
  try {
    const ctx = await getCurrentContext();
    const loans = await listOverdueLoans(ctx);
    return NextResponse.json({ loans });
  } catch (err) {
    return handleApiError(err);
  }
}
