import { NextResponse } from "next/server";
import { getCurrentContext } from "@/lib/demo-session";
import { getStudentScholarshipView } from "@/lib/services/scholarships";
import { handleApiError } from "@/lib/api-helpers";

export async function GET() {
  try {
    const ctx = await getCurrentContext();
    const data = await getStudentScholarshipView(ctx);
    return NextResponse.json(data);
  } catch (err) {
    return handleApiError(err);
  }
}
