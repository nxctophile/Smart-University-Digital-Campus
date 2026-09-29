import { NextResponse } from "next/server";
import { getCurrentContext } from "@/lib/demo-session";
import { getMyResults } from "@/lib/services/exams";
import { handleApiError } from "@/lib/api-helpers";

export async function GET(req: Request) {
  try {
    const ctx = await getCurrentContext();
    const studentId = new URL(req.url).searchParams.get("studentId");
    const results = await getMyResults(ctx, studentId ? Number(studentId) : undefined);
    return NextResponse.json({ results });
  } catch (err) {
    return handleApiError(err);
  }
}
