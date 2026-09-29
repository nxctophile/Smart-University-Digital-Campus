import { NextResponse } from "next/server";
import { getCurrentContext } from "@/lib/demo-session";
import { getHostelInfo } from "@/lib/services/hostel";
import { handleApiError } from "@/lib/api-helpers";

export async function GET() {
  try {
    const ctx = await getCurrentContext();
    const info = await getHostelInfo(ctx);
    return NextResponse.json({ info });
  } catch (err) {
    return handleApiError(err);
  }
}
