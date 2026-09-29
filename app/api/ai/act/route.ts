import { NextRequest, NextResponse } from "next/server";
import { getCurrentContext } from "@/lib/demo-session";
import { executePendingAction } from "@/lib/ai/engine";
import { decodePendingAction } from "@/lib/ai/tools";
import { handleApiError } from "@/lib/api-helpers";

export async function POST(req: NextRequest) {
  try {
    const ctx = await getCurrentContext();
    const body = await req.json();
    const pending = decodePendingAction(String(body.payload));
    const reply = await executePendingAction(ctx, pending);
    return NextResponse.json(reply);
  } catch (err) {
    return handleApiError(err);
  }
}
