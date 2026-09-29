import { NextResponse } from "next/server";
import { getCurrentContext } from "@/lib/demo-session";
import { listImportJobs } from "@/lib/services/import";
import { handleApiError } from "@/lib/api-helpers";

export async function GET() {
  try {
    const ctx = await getCurrentContext();
    const jobs = await listImportJobs(ctx);
    return NextResponse.json({ jobs });
  } catch (err) {
    return handleApiError(err);
  }
}
