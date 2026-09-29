import { NextRequest, NextResponse } from "next/server";
import { getCurrentContext } from "@/lib/demo-session";
import { markAttendance } from "@/lib/services/attendance";
import { handleApiError } from "@/lib/api-helpers";

export async function POST(req: NextRequest) {
  try {
    const ctx = await getCurrentContext();
    const body = await req.json();
    const result = await markAttendance(ctx, Number(body.courseId), String(body.date), body.records ?? []);
    return NextResponse.json(result);
  } catch (err) {
    return handleApiError(err);
  }
}
