import { NextResponse } from "next/server";
import { getCurrentContext } from "@/lib/demo-session";
import { authorize } from "@/lib/services/context";
import { getPermissionCatalog } from "@/lib/services/rbac-admin";
import { handleApiError } from "@/lib/api-helpers";

export async function GET() {
  try {
    const ctx = await getCurrentContext();
    await authorize(ctx, "role.manage");
    return NextResponse.json({ permissions: getPermissionCatalog() });
  } catch (err) {
    return handleApiError(err);
  }
}
