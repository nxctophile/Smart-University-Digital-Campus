import { NextRequest, NextResponse } from "next/server";
import { getCurrentContext } from "@/lib/demo-session";
import { getExamsForCourse } from "@/lib/services/exams";
import { handleApiError } from "@/lib/api-helpers";

export async function GET(req: NextRequest) {
  try {
    const ctx = await getCurrentContext();
    const courseId = Number(new URL(req.url).searchParams.get("courseId"));
    const exams = await getExamsForCourse(ctx, courseId);
    return NextResponse.json({ exams });
  } catch (err) {
    return handleApiError(err);
  }
}
