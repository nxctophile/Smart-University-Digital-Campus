import { NextRequest, NextResponse } from "next/server";
import { getCurrentContext } from "@/lib/demo-session";
import { notifyStudents } from "@/lib/services/admin";
import { handleApiError } from "@/lib/api-helpers";

export async function POST(req: NextRequest) {
  try {
    const ctx = await getCurrentContext();
    const body = await req.json();
    const result = await notifyStudents(ctx, body.studentIds as number[], body.channel ?? "student", body.message ?? "");
    return NextResponse.json(result);
  } catch (err) {
    return handleApiError(err);
  }
}
