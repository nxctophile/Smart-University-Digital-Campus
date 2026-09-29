import { NextResponse } from "next/server";
import { getCurrentContext } from "@/lib/demo-session";
import { getAdminOverview } from "@/lib/services/admin";
import { handleApiError } from "@/lib/api-helpers";

export async function GET() {
  try {
    const ctx = await getCurrentContext();
    const overview = await getAdminOverview(ctx);
    return NextResponse.json(overview);
  } catch (err) {
    return handleApiError(err);
  }
}
