import { NextResponse } from "next/server";
import { getCurrentContext } from "@/lib/demo-session";
import { getLibraryOverview } from "@/lib/services/library";
import { handleApiError } from "@/lib/api-helpers";

export async function GET() {
  try {
    const ctx = await getCurrentContext();
    const overview = await getLibraryOverview(ctx);
    return NextResponse.json(overview);
  } catch (err) {
    return handleApiError(err);
  }
}
