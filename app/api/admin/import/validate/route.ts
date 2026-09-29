import { NextRequest, NextResponse } from "next/server";
import { getCurrentContext } from "@/lib/demo-session";
import { validateImportJob } from "@/lib/services/import";
import { handleApiError } from "@/lib/api-helpers";

export async function POST(req: NextRequest) {
  try {
    const ctx = await getCurrentContext();
    const body = await req.json();
    const preview = await validateImportJob(ctx, body.jobId, body.mapping);
    return NextResponse.json(preview);
  } catch (err) {
    return handleApiError(err);
  }
}
