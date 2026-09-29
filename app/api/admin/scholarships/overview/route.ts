import { NextResponse } from "next/server";
import { getCurrentContext } from "@/lib/demo-session";
import { getScholarshipAdminOverview } from "@/lib/services/scholarships";
import { handleApiError } from "@/lib/api-helpers";

export async function GET() {
  try {
    const ctx = await getCurrentContext();
    const overview = await getScholarshipAdminOverview(ctx);
    return NextResponse.json(overview);
  } catch (err) {
    return handleApiError(err);
  }
}
