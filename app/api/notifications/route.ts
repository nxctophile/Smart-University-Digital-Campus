import { NextResponse } from "next/server";
import { getCurrentContext } from "@/lib/demo-session";
import { getNotificationsForRole } from "@/lib/services/notifications";
import { handleApiError } from "@/lib/api-helpers";

export async function GET() {
  try {
    const ctx = await getCurrentContext();
    const notifications = await getNotificationsForRole(ctx, 12);
    return NextResponse.json({ notifications });
  } catch (err) {
    return handleApiError(err);
  }
}
