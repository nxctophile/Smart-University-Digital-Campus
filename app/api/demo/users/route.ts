import { NextResponse } from "next/server";
import { listDemoUsers } from "@/lib/demo-session";

/** Backs the /login persona picker - name/email/role + assigned role
 * names, deliberately unauthenticated (this IS the "who am I logging in as"
 * lookup, there's no session yet when it's called). */
export async function GET() {
  const users = await listDemoUsers();
  return NextResponse.json({ users });
}
