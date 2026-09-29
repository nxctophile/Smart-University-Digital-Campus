import { NextResponse } from "next/server";
import { listRoutesWithStops } from "@/lib/services/transport";
import { handleApiError } from "@/lib/api-helpers";

export async function GET() {
  try {
    const routes = await listRoutesWithStops();
    return NextResponse.json({ routes });
  } catch (err) {
    return handleApiError(err);
  }
}
