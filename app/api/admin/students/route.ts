import { NextResponse } from "next/server";
import { getCurrentContext } from "@/lib/demo-session";
import { searchStudents } from "@/lib/services/students";
import { handleApiError } from "@/lib/api-helpers";

export async function GET(req: Request) {
  try {
    const ctx = await getCurrentContext();
    const params = new URL(req.url).searchParams;
    const rows = await searchStudents(ctx, {
      query: params.get("query") ?? undefined,
      departmentCode: params.get("department") ?? undefined,
      status: params.get("status") ?? undefined,
      limit: params.get("limit") ? Number(params.get("limit")) : undefined,
    });
    return NextResponse.json({ students: rows });
  } catch (err) {
    return handleApiError(err);
  }
}
