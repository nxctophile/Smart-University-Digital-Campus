import { NextRequest, NextResponse } from "next/server";
import { getCurrentContext } from "@/lib/demo-session";
import { returnBook } from "@/lib/services/library";
import { handleApiError } from "@/lib/api-helpers";

export async function POST(req: NextRequest) {
  try {
    const ctx = await getCurrentContext();
    const body = await req.json();
    const loan = await returnBook(ctx, body.loanId);
    return NextResponse.json({ loan });
  } catch (err) {
    return handleApiError(err);
  }
}
