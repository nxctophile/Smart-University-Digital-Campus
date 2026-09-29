import { NextRequest, NextResponse } from "next/server";
import { getCurrentContext } from "@/lib/demo-session";
import { updateRole, deleteRole } from "@/lib/services/rbac-admin";
import { handleApiError } from "@/lib/api-helpers";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await getCurrentContext();
    const { id } = await params;
    const body = await req.json();
    const role = await updateRole(ctx, Number(id), body);
    return NextResponse.json({ role });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await getCurrentContext();
    const { id } = await params;
    const result = await deleteRole(ctx, Number(id));
    return NextResponse.json(result);
  } catch (err) {
    return handleApiError(err);
  }
}
