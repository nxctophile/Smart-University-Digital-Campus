import { NextResponse } from "next/server";
import { getCurrentContext } from "@/lib/demo-session";
import { listApplications } from "@/lib/services/scholarships";
import { handleApiError } from "@/lib/api-helpers";

export async function GET(req: Request) {
  try {
    const ctx = await getCurrentContext();
    const status = new URL(req.url).searchParams.get("status") ?? undefined;
    const applications = await listApplications(ctx, { status });
    return NextResponse.json({ applications });
  } catch (err) {
    return handleApiError(err);
  }
}
