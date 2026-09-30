import { NextRequest, NextResponse } from "next/server";
import { loadCaller, backendErrorResponse } from "@/lib/ai/backend";
import { aiProvider } from "@/lib/ai/engine";
import { ChatMessage } from "@/lib/ai/types";

export async function POST(req: NextRequest) {
  try {
    const caller = await loadCaller(req.headers.get("cookie") ?? "");
    const body = await req.json();
    const message = String(body.message ?? "");
    const history = (body.history ?? []) as ChatMessage[];
    const reply = await aiProvider.respond(caller, message, history);
    return NextResponse.json(reply);
  } catch (err) {
    return backendErrorResponse(err);
  }
}
