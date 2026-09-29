import { NextResponse } from "next/server";
import { getCurrentContext } from "@/lib/demo-session";
import { listExamsForPublishing } from "@/lib/services/exams";
import { handleApiError } from "@/lib/api-helpers";

export async function GET() {
  try {
    const ctx = await getCurrentContext();
    const exams = await listExamsForPublishing(ctx);
    return NextResponse.json({ exams });
  } catch (err) {
    return handleApiError(err);
  }
}
