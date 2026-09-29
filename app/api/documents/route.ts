import { NextResponse } from "next/server";
import { getCurrentContext } from "@/lib/demo-session";
import { listDocuments } from "@/lib/services/documents";
import { handleApiError } from "@/lib/api-helpers";

export async function GET() {
  try {
    const ctx = await getCurrentContext();
    const data = await listDocuments(ctx);
    return NextResponse.json(data);
  } catch (err) {
    return handleApiError(err);
  }
}
