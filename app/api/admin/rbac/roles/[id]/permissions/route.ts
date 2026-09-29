import { NextRequest, NextResponse } from "next/server";
import { getCurrentContext } from "@/lib/demo-session";
import { setRolePermissions } from "@/lib/services/rbac-admin";
import { handleApiError } from "@/lib/api-helpers";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await getCurrentContext();
    const { id } = await params;
    const body = await req.json();
    const result = await setRolePermissions(ctx, Number(id), body.permissions ?? []);
    return NextResponse.json(result);
  } catch (err) {
    return handleApiError(err);
  }
}
