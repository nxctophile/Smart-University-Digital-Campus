import { NextRequest, NextResponse } from "next/server";
import { loadCaller, backendErrorResponse } from "@/lib/ai/backend";
import { executePendingAction } from "@/lib/ai/engine";
import { decodePendingAction } from "@/lib/ai/tools";

export async function POST(req: NextRequest) {
  try {
    const caller = await loadCaller(req.headers.get("cookie") ?? "");
    const body = await req.json();
    const pending = decodePendingAction(String(body.payload));
    const reply = await executePendingAction(caller, pending);
    return NextResponse.json(reply);
  } catch (err) {
    return backendErrorResponse(err);
  }
}
