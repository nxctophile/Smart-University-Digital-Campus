import { NextRequest, NextResponse } from "next/server";
import { getCurrentContext } from "@/lib/demo-session";
import { listRecentAdmissions, onboardStudent, listProgrammesForOnboarding } from "@/lib/services/admission";
import { handleApiError } from "@/lib/api-helpers";

export async function GET() {
  try {
    const ctx = await getCurrentContext();
    const [admissions, programmes] = await Promise.all([listRecentAdmissions(ctx), listProgrammesForOnboarding()]);
    return NextResponse.json({ admissions, programmes });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const ctx = await getCurrentContext();
    const body = await req.json();
    const student = await onboardStudent(ctx, body);
    return NextResponse.json({ student });
  } catch (err) {
    return handleApiError(err);
  }
}
