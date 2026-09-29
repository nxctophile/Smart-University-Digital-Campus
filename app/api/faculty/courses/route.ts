import { NextResponse } from "next/server";
import { getCurrentContext } from "@/lib/demo-session";
import { getMyCoursesWithStats } from "@/lib/services/faculty";
import { handleApiError } from "@/lib/api-helpers";

export async function GET() {
  try {
    const ctx = await getCurrentContext();
    const courses = await getMyCoursesWithStats(ctx);
    return NextResponse.json({ courses });
  } catch (err) {
    return handleApiError(err);
  }
}
