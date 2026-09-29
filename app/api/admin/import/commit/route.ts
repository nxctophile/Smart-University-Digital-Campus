import { NextRequest, NextResponse } from "next/server";
import { getCurrentContext } from "@/lib/demo-session";
import { commitImportJob } from "@/lib/services/import";
import { handleApiError } from "@/lib/api-helpers";

export async function POST(req: NextRequest) {
  try {
    const ctx = await getCurrentContext();
    const body = await req.json();
    const result = await commitImportJob(ctx, body.jobId, body.mapping);
    return NextResponse.json(result);
  } catch (err) {
    return handleApiError(err);
  }
}
