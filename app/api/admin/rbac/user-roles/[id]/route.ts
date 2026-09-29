import { NextRequest, NextResponse } from "next/server";
import { getCurrentContext } from "@/lib/demo-session";
import { removeUserRole } from "@/lib/services/rbac-admin";
import { handleApiError } from "@/lib/api-helpers";

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await getCurrentContext();
    const { id } = await params;
    const result = await removeUserRole(ctx, Number(id));
    return NextResponse.json(result);
  } catch (err) {
    return handleApiError(err);
  }
}
