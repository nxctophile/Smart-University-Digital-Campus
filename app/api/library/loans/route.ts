import { NextResponse } from "next/server";
import { getCurrentContext } from "@/lib/demo-session";
import { getMyLoans } from "@/lib/services/library";
import { handleApiError } from "@/lib/api-helpers";

export async function GET() {
  try {
    const ctx = await getCurrentContext();
    const data = await getMyLoans(ctx);
    return NextResponse.json(data);
  } catch (err) {
    return handleApiError(err);
  }
}
