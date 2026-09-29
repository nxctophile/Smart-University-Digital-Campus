import { NextResponse } from "next/server";
import { getCurrentContext } from "@/lib/demo-session";
import { getAttendanceSummary } from "@/lib/services/attendance";
import { handleApiError } from "@/lib/api-helpers";

export async function GET(req: Request) {
  try {
    const ctx = await getCurrentContext();
    const studentId = new URL(req.url).searchParams.get("studentId");
    const summary = await getAttendanceSummary(ctx, studentId ? Number(studentId) : undefined);
    return NextResponse.json(summary);
  } catch (err) {
    return handleApiError(err);
  }
}
