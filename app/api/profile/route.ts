import { NextResponse } from "next/server";
import { getCurrentContext } from "@/lib/demo-session";
import { getStudentProfile } from "@/lib/services/students";
import { getFacultyProfile } from "@/lib/services/faculty";
import { toClientContext } from "@/lib/services/context";
import { handleApiError } from "@/lib/api-helpers";

export async function GET() {
  try {
    const ctx = await getCurrentContext();
    // Which linked profile to show is a fact about the account's identity
    // (student/parent vs faculty), not a role-string branch - the service
    // calls below still independently authorize the read.
    if (ctx.studentId || ctx.parentId) {
      const profile = await getStudentProfile(ctx);
      return NextResponse.json({ ctx: toClientContext(ctx), profile });
    }
    if (ctx.facultyId) {
      const profile = await getFacultyProfile(ctx);
      return NextResponse.json({ ctx: toClientContext(ctx), profile });
    }
    return NextResponse.json({ ctx: toClientContext(ctx), profile: null });
  } catch (err) {
    return handleApiError(err);
  }
}
