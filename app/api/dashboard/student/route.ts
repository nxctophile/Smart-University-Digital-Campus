import { NextResponse } from "next/server";
import { getCurrentContext } from "@/lib/demo-session";
import { getStudentDashboard } from "@/lib/services/dashboard";
import { handleApiError } from "@/lib/api-helpers";

export async function GET() {
  try {
    const ctx = await getCurrentContext();
    const dashboard = await getStudentDashboard(ctx);
    return NextResponse.json(dashboard);
  } catch (err) {
    return handleApiError(err);
  }
}
