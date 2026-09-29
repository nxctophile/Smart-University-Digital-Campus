import { NextResponse } from "next/server";
import { getCurrentContext } from "@/lib/demo-session";
import { getStudentsInCourse } from "@/lib/services/faculty";
import { handleApiError } from "@/lib/api-helpers";

export async function GET(req: Request) {
  try {
    const ctx = await getCurrentContext();
    const courseId = Number(new URL(req.url).searchParams.get("courseId"));
    const students = await getStudentsInCourse(ctx, courseId);
    return NextResponse.json({ students });
  } catch (err) {
    return handleApiError(err);
  }
}
