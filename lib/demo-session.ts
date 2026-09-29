import { cookies } from "next/headers";
import { db } from "@/lib/db/client";
import { users, roles, userRoles } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { loadContext, toClientContext, UnauthenticatedError } from "@/lib/services/context";
import type { AccessContext } from "@/lib/rbac/types";
import type { ClientContext, Role } from "@/lib/types";
import { recordAuditRaw } from "@/lib/rbac/audit";
import { DEMO_COOKIE } from "@/lib/demo-session-constants";

export { DEMO_COOKIE };

/** Throws UnauthenticatedError if there's no logged-in demo user - callers
 * that render authenticated pages/APIs should let this propagate (a page
 * request never gets this far anyway, since proxy.ts redirects to /login
 * first; an API request turns this into a 401). Use
 * getCurrentContextOrNull() for places that need to render *something*
 * either way (the root layout). */
export async function getCurrentContext(): Promise<AccessContext> {
  const store = await cookies();
  const raw = store.get(DEMO_COOKIE)?.value;
  const userId = raw ? Number(raw) : NaN;
  if (!Number.isFinite(userId)) throw new UnauthenticatedError();

  try {
    return await loadContext(userId);
  } catch {
    // Stale/deleted-user cookie (e.g. after a reseed) - treat exactly like
    // "not logged in" rather than leaking that the id used to exist.
    throw new UnauthenticatedError();
  }
}

export async function getCurrentContextOrNull(): Promise<AccessContext | null> {
  try {
    return await getCurrentContext();
  } catch {
    return null;
  }
}

export async function getCurrentClientContext(): Promise<ClientContext> {
  return toClientContext(await getCurrentContext());
}

export async function getCurrentClientContextOrNull(): Promise<ClientContext | null> {
  const ctx = await getCurrentContextOrNull();
  return ctx ? toClientContext(ctx) : null;
}

/** Every seeded demo login, for the /login persona picker - includes each
 * user's assigned role name(s) so the dropdown can show e.g. "Ansh Pandey -
 * Faculty + Head of Department" instead of just an email address. */
export async function listDemoUsers() {
  const userRows = await db.select({ id: users.id, name: users.name, email: users.email, role: users.role }).from(users).orderBy(users.id);
  const assignments = await db
    .select({ userId: userRoles.userId, roleName: roles.name })
    .from(userRoles)
    .innerJoin(roles, eq(userRoles.roleId, roles.id));
  const rolesByUser = new Map<number, string[]>();
  for (const a of assignments) rolesByUser.set(a.userId, [...(rolesByUser.get(a.userId) ?? []), a.roleName]);
  return userRows.map((u) => ({ ...u, roleNames: rolesByUser.get(u.id) ?? [] }));
}

export async function loginAsUser(userId: number): Promise<ClientContext> {
  const user = await db.query.users.findFirst({ where: eq(users.id, userId) });
  if (!user) throw new Error("Unknown demo user.");
  const store = await cookies();
  store.set(DEMO_COOKIE, String(user.id), { path: "/", sameSite: "lax" });
  const ctx = await loadContext(user.id);
  await recordAuditRaw({ userId: user.id, userName: user.name, userRole: user.role, action: "auth.login", result: "success" });
  return toClientContext(ctx);
}

/** Back-compat: log in as the first seeded user with a given primary role
 * bucket (used by any older client code still posting {role}). */
export async function loginAsRole(role: Role): Promise<ClientContext> {
  const user = await db.query.users.findFirst({ where: eq(users.role, role) });
  if (!user) throw new Error(`No demo user seeded for role ${role}`);
  return loginAsUser(user.id);
}

export async function logout(): Promise<void> {
  const ctx = await getCurrentContextOrNull();
  const store = await cookies();
  store.delete(DEMO_COOKIE);
  if (ctx) await recordAuditRaw({ userId: ctx.userId, userName: ctx.name, userRole: ctx.role, action: "auth.logout", result: "success" });
}
