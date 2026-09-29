import { NextRequest, NextResponse } from "next/server";
import { getCurrentContext } from "@/lib/demo-session";
import { getAuditLog } from "@/lib/services/rbac-admin";
import { handleApiError } from "@/lib/api-helpers";

export async function GET(req: NextRequest) {
  try {
    const ctx = await getCurrentContext();
    const url = new URL(req.url);
    const result = new URLSearchParams(url.search);
    const logs = await getAuditLog(ctx, {
      action: result.get("action") ?? undefined,
      result: result.get("result") ?? undefined,
      limit: result.get("limit") ? Number(result.get("limit")) : undefined,
    });
    return NextResponse.json({ logs });
  } catch (err) {
    return handleApiError(err);
  }
}
