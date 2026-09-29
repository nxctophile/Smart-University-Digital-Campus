import { NextRequest, NextResponse } from "next/server";
import { getCurrentContext } from "@/lib/demo-session";
import { listRoles, createRole } from "@/lib/services/rbac-admin";
import { handleApiError } from "@/lib/api-helpers";

export async function GET() {
  try {
    const ctx = await getCurrentContext();
    const roles = await listRoles(ctx);
    return NextResponse.json({ roles });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const ctx = await getCurrentContext();
    const body = await req.json();
    const role = await createRole(ctx, body);
    return NextResponse.json({ role });
  } catch (err) {
    return handleApiError(err);
  }
}
