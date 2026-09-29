import { NextRequest, NextResponse } from "next/server";
import { getCurrentContext } from "@/lib/demo-session";
import { publishResults } from "@/lib/services/exams";
import { handleApiError } from "@/lib/api-helpers";

export async function POST(req: NextRequest) {
  try {
    const ctx = await getCurrentContext();
    const body = await req.json();
    const result = await publishResults(ctx, Number(body.examId));
    return NextResponse.json(result);
  } catch (err) {
    return handleApiError(err);
  }
}
