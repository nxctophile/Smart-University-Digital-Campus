import { NextRequest, NextResponse } from "next/server";
import { getCurrentClientContextOrNull, loginAsUser, loginAsRole, logout, listDemoUsers } from "@/lib/demo-session";
import { Role } from "@/lib/types";

export async function GET() {
  const ctx = await getCurrentClientContextOrNull();
  return NextResponse.json(ctx);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  if (typeof body.userId === "number") {
    const users = await listDemoUsers();
    if (!users.some((u) => u.id === body.userId)) {
      return NextResponse.json({ error: "Invalid user" }, { status: 400 });
    }
    const ctx = await loginAsUser(body.userId);
    return NextResponse.json(ctx);
  }

  const role = body.role as Role;
  if (!["student", "faculty", "parent", "admin", "employee"].includes(role)) {
    return NextResponse.json({ error: "Invalid role" }, { status: 400 });
  }
  const ctx = await loginAsRole(role);
  return NextResponse.json(ctx);
}

export async function DELETE() {
  await logout();
  return NextResponse.json({ success: true });
}
