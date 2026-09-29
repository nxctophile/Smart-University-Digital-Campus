import { NextRequest, NextResponse } from "next/server";
import { getCurrentContext } from "@/lib/demo-session";
import { listUsersWithRoles, assignUserRole, listDepartmentsForScopePicker } from "@/lib/services/rbac-admin";
import { handleApiError } from "@/lib/api-helpers";

export async function GET() {
  try {
    const ctx = await getCurrentContext();
    const [users, departments] = await Promise.all([listUsersWithRoles(ctx), listDepartmentsForScopePicker(ctx)]);
    return NextResponse.json({ users, departments });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const ctx = await getCurrentContext();
    const body = await req.json();
    const assignment = await assignUserRole(ctx, Number(body.userId), Number(body.roleId), body.scope ?? null);
    return NextResponse.json({ assignment });
  } catch (err) {
    return handleApiError(err);
  }
}
