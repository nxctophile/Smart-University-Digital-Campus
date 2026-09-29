import { NextRequest, NextResponse } from "next/server";
import { getCurrentContext } from "@/lib/demo-session";
import { decideApplication } from "@/lib/services/scholarships";
import { handleApiError } from "@/lib/api-helpers";

export async function POST(req: NextRequest) {
  try {
    const ctx = await getCurrentContext();
    const body = await req.json();
    const application = await decideApplication(ctx, body.applicationId, body.decision, body.remarks);
    return NextResponse.json({ application });
  } catch (err) {
    return handleApiError(err);
  }
}
