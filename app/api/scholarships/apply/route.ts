import { NextRequest, NextResponse } from "next/server";
import { getCurrentContext } from "@/lib/demo-session";
import { applyForScholarship } from "@/lib/services/scholarships";
import { handleApiError } from "@/lib/api-helpers";

export async function POST(req: NextRequest) {
  try {
    const ctx = await getCurrentContext();
    const body = await req.json();
    const result = await applyForScholarship(ctx, body.scholarshipId);
    return NextResponse.json(result);
  } catch (err) {
    return handleApiError(err);
  }
}
