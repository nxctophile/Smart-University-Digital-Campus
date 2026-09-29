import { NextResponse } from "next/server";
import { getCurrentContext } from "@/lib/demo-session";
import { resolveStudentIdForAccess } from "@/lib/services/context";
import { getStudentRisk } from "@/lib/services/risk";
import { handleApiError } from "@/lib/api-helpers";

export async function GET() {
  try {
    const ctx = await getCurrentContext();
    const studentId = await resolveStudentIdForAccess(ctx, "student.performance.view");
    const risk = await getStudentRisk(studentId);
    return NextResponse.json({ risk });
  } catch (err) {
    return handleApiError(err);
  }
}
