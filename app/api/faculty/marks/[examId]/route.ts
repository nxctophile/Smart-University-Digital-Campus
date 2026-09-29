import { NextRequest, NextResponse } from "next/server";
import { getCurrentContext } from "@/lib/demo-session";
import { getResultsForExam, enterMarks } from "@/lib/services/exams";
import { handleApiError } from "@/lib/api-helpers";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ examId: string }> }) {
  try {
    const ctx = await getCurrentContext();
    const { examId } = await params;
    const roster = await getResultsForExam(ctx, Number(examId));
    return NextResponse.json({ roster });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ examId: string }> }) {
  try {
    const ctx = await getCurrentContext();
    const { examId } = await params;
    const body = await req.json();
    const result = await enterMarks(ctx, Number(examId), body.entries ?? []);
    return NextResponse.json(result);
  } catch (err) {
    return handleApiError(err);
  }
}
