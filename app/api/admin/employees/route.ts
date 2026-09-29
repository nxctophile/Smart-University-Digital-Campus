import { NextResponse } from "next/server";
import { getCurrentContext } from "@/lib/demo-session";
import { listStaffDirectory, getStaffOverview } from "@/lib/services/employees";
import { handleApiError } from "@/lib/api-helpers";

export async function GET() {
  try {
    const ctx = await getCurrentContext();
    const [staff, overview] = await Promise.all([listStaffDirectory(ctx), getStaffOverview(ctx)]);
    return NextResponse.json({ staff, overview });
  } catch (err) {
    return handleApiError(err);
  }
}
