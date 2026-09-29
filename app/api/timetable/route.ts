import { NextResponse } from "next/server";
import { getCurrentContext } from "@/lib/demo-session";
import { getStudentTimetable, getFacultyTimetable } from "@/lib/services/timetable";
import { handleApiError } from "@/lib/api-helpers";

export async function GET() {
  try {
    const ctx = await getCurrentContext();
    // Faculty identity picks which timetable shape to fetch; the service
    // call still independently authorizes it.
    if (ctx.facultyId) {
      const timetable = await getFacultyTimetable(ctx);
      return NextResponse.json({ timetable });
    }
    const timetable = await getStudentTimetable(ctx);
    return NextResponse.json({ timetable });
  } catch (err) {
    return handleApiError(err);
  }
}
