import { NextRequest, NextResponse } from "next/server";
import { getCurrentContext } from "@/lib/demo-session";
import { aiProvider } from "@/lib/ai/engine";
import { ChatMessage } from "@/lib/ai/types";
import { handleApiError } from "@/lib/api-helpers";

export async function POST(req: NextRequest) {
  try {
    const ctx = await getCurrentContext();
    const body = await req.json();
    const message = String(body.message ?? "");
    const history = (body.history ?? []) as ChatMessage[];
    const reply = await aiProvider.respond(ctx, message, history);
    return NextResponse.json(reply);
  } catch (err) {
    return handleApiError(err);
  }
}
