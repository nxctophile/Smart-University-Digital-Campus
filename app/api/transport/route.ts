import { NextRequest, NextResponse } from "next/server";
import { getCurrentContext } from "@/lib/demo-session";
import { getTransportInfo, updateTransportAssignment } from "@/lib/services/transport";
import { handleApiError } from "@/lib/api-helpers";

export async function GET() {
  try {
    const ctx = await getCurrentContext();
    const info = await getTransportInfo(ctx);
    return NextResponse.json({ info });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const ctx = await getCurrentContext();
    const body = await req.json();
    const info = await updateTransportAssignment(ctx, { routeId: body.routeId, stopId: body.stopId });
    return NextResponse.json({ info });
  } catch (err) {
    return handleApiError(err);
  }
}
