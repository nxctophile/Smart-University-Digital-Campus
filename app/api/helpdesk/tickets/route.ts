import { NextRequest, NextResponse } from "next/server";
import { getCurrentContext } from "@/lib/demo-session";
import { listMyTickets, createTicket, TicketCategory } from "@/lib/services/helpdesk";
import { handleApiError } from "@/lib/api-helpers";

export async function GET() {
  try {
    const ctx = await getCurrentContext();
    const tickets = await listMyTickets(ctx);
    return NextResponse.json({ tickets });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const ctx = await getCurrentContext();
    const body = await req.json();
    const ticket = await createTicket(
      ctx,
      undefined,
      { category: body.category as TicketCategory, subject: body.subject, description: body.description },
      "web",
    );
    return NextResponse.json({ ticket });
  } catch (err) {
    return handleApiError(err);
  }
}
