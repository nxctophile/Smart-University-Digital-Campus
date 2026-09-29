import { NextResponse } from "next/server";
import { getCurrentContext } from "@/lib/demo-session";
import { getFinanceOverview } from "@/lib/services/fees";
import { handleApiError } from "@/lib/api-helpers";

export async function GET() {
  try {
    const ctx = await getCurrentContext();
    const overview = await getFinanceOverview(ctx);
    return NextResponse.json(overview);
  } catch (err) {
    return handleApiError(err);
  }
}
