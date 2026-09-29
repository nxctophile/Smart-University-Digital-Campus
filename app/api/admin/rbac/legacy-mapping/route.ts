import { NextRequest, NextResponse } from "next/server";
import { getCurrentContext } from "@/lib/demo-session";
import { listLegacyRoleMappings, upsertLegacyRoleMapping } from "@/lib/services/rbac-admin";
import { handleApiError } from "@/lib/api-helpers";

export async function GET() {
  try {
    const ctx = await getCurrentContext();
    const mappings = await listLegacyRoleMappings(ctx);
    return NextResponse.json({ mappings });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const ctx = await getCurrentContext();
    const body = await req.json();
    const mapping = await upsertLegacyRoleMapping(ctx, body);
    return NextResponse.json({ mapping });
  } catch (err) {
    return handleApiError(err);
  }
}
