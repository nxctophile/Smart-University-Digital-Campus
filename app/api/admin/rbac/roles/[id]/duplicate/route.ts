import { NextRequest, NextResponse } from "next/server";
import { getCurrentContext } from "@/lib/demo-session";
import { duplicateRole } from "@/lib/services/rbac-admin";
import { handleApiError } from "@/lib/api-helpers";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await getCurrentContext();
    const { id } = await params;
    const body = await req.json();
    const role = await duplicateRole(ctx, Number(id), body.name ?? "Copy of role");
    return NextResponse.json({ role });
  } catch (err) {
    return handleApiError(err);
  }
}
