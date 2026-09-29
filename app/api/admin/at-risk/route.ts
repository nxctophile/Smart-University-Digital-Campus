import { NextResponse } from "next/server";
import { getCurrentContext } from "@/lib/demo-session";
import { getAtRiskStudents } from "@/lib/services/risk";
import { handleApiError } from "@/lib/api-helpers";

export async function GET(req: Request) {
  try {
    const ctx = await getCurrentContext();
    const params = new URL(req.url).searchParams;
    const rows = await getAtRiskStudents(ctx, {
      maxAttendance: params.get("maxAttendance") ? Number(params.get("maxAttendance")) : undefined,
      riskLevel: (params.get("riskLevel") as "low" | "medium" | "high" | null) ?? undefined,
      departmentCode: params.get("department") ?? undefined,
      examWithinDays: params.get("examWithinDays") ? Number(params.get("examWithinDays")) : undefined,
      limit: params.get("limit") ? Number(params.get("limit")) : undefined,
      query: params.get("query") ?? undefined,
    });
    return NextResponse.json({ students: rows });
  } catch (err) {
    return handleApiError(err);
  }
}
