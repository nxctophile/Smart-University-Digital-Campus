import "server-only";
import { db } from "@/lib/db/client";
import { userRoles, roles, rolePermissions } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { parseScope, type Scope } from "./scope";

export type Grant = {
  permission: string;
  /** Explicit scope stored on the role assignment, or null to resolve
   * dynamically from the caller's own identity at authorize() time. */
  scope: Scope | null;
  roleKey: string;
  roleName: string;
};

/** Every (userRole x rolePermission) pair for a user, flattened. A user with
 * multiple role assignments (e.g. Faculty + Class Mentor) gets the union. */
export async function loadGrantsForUser(userId: number): Promise<Grant[]> {
  const rows = await db
    .select({
      permissionKey: rolePermissions.permissionKey,
      scope: userRoles.scope,
      roleKey: roles.key,
      roleName: roles.name,
    })
    .from(userRoles)
    .innerJoin(roles, eq(userRoles.roleId, roles.id))
    .innerJoin(rolePermissions, eq(rolePermissions.roleId, roles.id))
    .where(eq(userRoles.userId, userId));

  return rows.map((r) => ({
    permission: r.permissionKey,
    scope: parseScope(r.scope),
    roleKey: r.roleKey,
    roleName: r.roleName,
  }));
}

export async function loadRoleKeysForUser(userId: number): Promise<{ key: string; name: string }[]> {
  const rows = await db
    .select({ key: roles.key, name: roles.name })
    .from(userRoles)
    .innerJoin(roles, eq(userRoles.roleId, roles.id))
    .where(eq(userRoles.userId, userId));
  const seen = new Set<string>();
  return rows.filter((r) => (seen.has(r.key) ? false : (seen.add(r.key), true)));
}
