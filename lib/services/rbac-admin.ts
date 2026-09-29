import { db } from "@/lib/db/client";
import { roles, rolePermissions, userRoles, users, departments, legacyRoleMappings } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { AccessContext, authorize } from "./context";
import { isPermissionKey, PERMISSIONS } from "@/lib/rbac/permissions";
import { listAuditLogs, type AuditLogFilters } from "@/lib/rbac/audit";
import { DEFAULT_LEGACY_ROLE_MAP } from "@/lib/rbac/seed-data";

export function getPermissionCatalog() {
  return PERMISSIONS;
}

export async function listRoles(ctx: AccessContext) {
  await authorize(ctx, "role.manage");
  const roleRows = await db.select().from(roles).orderBy(roles.category, roles.name);
  const permRows = await db.select().from(rolePermissions);
  const byRole = new Map<number, string[]>();
  for (const p of permRows) byRole.set(p.roleId, [...(byRole.get(p.roleId) ?? []), p.permissionKey]);
  return roleRows.map((r) => ({ ...r, permissions: (byRole.get(r.id) ?? []).sort() }));
}

export async function createRole(
  ctx: AccessContext,
  input: { key: string; name: string; description?: string; category: string; permissions: string[] },
) {
  await authorize(ctx, "role.manage", undefined, { resourceLabel: `role:${input.key}`, forceAudit: true });
  const key = input.key.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  if (!key) throw new Error("Role key is required.");
  const existing = await db.query.roles.findFirst({ where: eq(roles.key, key) });
  if (existing) throw new Error(`Role "${key}" already exists.`);

  const row = db
    .insert(roles)
    .values({ key, name: input.name, description: input.description ?? null, category: input.category, isSystem: false })
    .returning()
    .get();

  const validPerms = input.permissions.filter(isPermissionKey);
  if (validPerms.length) {
    db.insert(rolePermissions).values(validPerms.map((permissionKey) => ({ roleId: row.id, permissionKey }))).run();
  }
  return row;
}

export async function duplicateRole(ctx: AccessContext, roleId: number, newName: string) {
  await authorize(ctx, "role.manage", undefined, { forceAudit: true });
  const source = await db.query.roles.findFirst({ where: eq(roles.id, roleId) });
  if (!source) throw new Error("Role not found.");
  const perms = await db.select().from(rolePermissions).where(eq(rolePermissions.roleId, roleId));
  return createRole(ctx, {
    key: `${source.key}_copy_${Date.now().toString(36)}`,
    name: newName,
    description: source.description ?? undefined,
    category: source.category,
    permissions: perms.map((p) => p.permissionKey),
  });
}

export async function updateRole(ctx: AccessContext, roleId: number, input: { name?: string; description?: string; category?: string }) {
  await authorize(ctx, "role.manage", undefined, { forceAudit: true });
  db.update(roles)
    .set({ ...input, updatedAt: new Date().toISOString() })
    .where(eq(roles.id, roleId))
    .run();
  return db.query.roles.findFirst({ where: eq(roles.id, roleId) });
}

export async function deleteRole(ctx: AccessContext, roleId: number) {
  await authorize(ctx, "role.manage", undefined, { resourceLabel: `role:${roleId}`, forceAudit: true });
  const role = await db.query.roles.findFirst({ where: eq(roles.id, roleId) });
  if (!role) throw new Error("Role not found.");
  if (role.isSystem) throw new Error("System roles can't be deleted - duplicate it to customize instead.");
  db.delete(userRoles).where(eq(userRoles.roleId, roleId)).run();
  db.delete(rolePermissions).where(eq(rolePermissions.roleId, roleId)).run();
  db.delete(roles).where(eq(roles.id, roleId)).run();
  return { success: true };
}

export async function setRolePermissions(ctx: AccessContext, roleId: number, permissionKeys: string[]) {
  await authorize(ctx, "permission.manage", undefined, { resourceLabel: `role:${roleId}`, forceAudit: true });
  const valid = permissionKeys.filter(isPermissionKey);
  db.delete(rolePermissions).where(eq(rolePermissions.roleId, roleId)).run();
  if (valid.length) db.insert(rolePermissions).values(valid.map((permissionKey) => ({ roleId, permissionKey }))).run();
  return { count: valid.length };
}

// ---------------------------------------------------------------------------
// Users & role assignments
// ---------------------------------------------------------------------------

export async function listUsersWithRoles(ctx: AccessContext) {
  await authorize(ctx, "user.manage");
  const userRows = await db.select().from(users).orderBy(users.name);
  const assignments = await db
    .select({ id: userRoles.id, userId: userRoles.userId, roleId: userRoles.roleId, scope: userRoles.scope, roleName: roles.name, roleKey: roles.key })
    .from(userRoles)
    .innerJoin(roles, eq(userRoles.roleId, roles.id));
  const byUser = new Map<number, typeof assignments>();
  for (const a of assignments) byUser.set(a.userId, [...(byUser.get(a.userId) ?? []), a]);
  return userRows.map((u) => ({ ...u, assignments: byUser.get(u.id) ?? [] }));
}

export async function assignUserRole(ctx: AccessContext, userId: number, roleId: number, scope?: Record<string, unknown> | null) {
  await authorize(ctx, "user.manage", undefined, { resourceLabel: `user:${userId}`, forceAudit: true });
  const row = db
    .insert(userRoles)
    .values({ userId, roleId, scope: scope ? JSON.stringify(scope) : null })
    .returning()
    .get();
  return row;
}

export async function removeUserRole(ctx: AccessContext, userRoleId: number) {
  await authorize(ctx, "user.manage", undefined, { resourceLabel: `user_role:${userRoleId}`, forceAudit: true });
  db.delete(userRoles).where(eq(userRoles.id, userRoleId)).run();
  return { success: true };
}

export async function listDepartmentsForScopePicker(ctx: AccessContext) {
  await authorize(ctx, "user.manage");
  return db.select().from(departments);
}

// ---------------------------------------------------------------------------
// Legacy import role mapping (spec section 18)
// ---------------------------------------------------------------------------

export async function listLegacyRoleMappings(ctx: AccessContext) {
  await authorize(ctx, "role.manage");
  const rows = await db.select().from(legacyRoleMappings).orderBy(legacyRoleMappings.legacyRole);
  return rows.length ? rows : DEFAULT_LEGACY_ROLE_MAP.map((m, i) => ({ id: -1 - i, ...m, notes: m.notes ?? null }));
}

export async function upsertLegacyRoleMapping(ctx: AccessContext, input: { legacyRole: string; mappedRoleKey: string; notes?: string }) {
  await authorize(ctx, "role.manage", undefined, { forceAudit: true });
  const existing = await db.query.legacyRoleMappings.findFirst({ where: eq(legacyRoleMappings.legacyRole, input.legacyRole) });
  if (existing) {
    db.update(legacyRoleMappings)
      .set({ mappedRoleKey: input.mappedRoleKey, notes: input.notes ?? null })
      .where(eq(legacyRoleMappings.id, existing.id))
      .run();
    return { ...existing, mappedRoleKey: input.mappedRoleKey, notes: input.notes ?? null };
  }
  return db.insert(legacyRoleMappings).values({ legacyRole: input.legacyRole, mappedRoleKey: input.mappedRoleKey, notes: input.notes ?? null }).returning().get();
}

// ---------------------------------------------------------------------------
// Audit log
// ---------------------------------------------------------------------------

export async function getAuditLog(ctx: AccessContext, filters: AuditLogFilters = {}) {
  await authorize(ctx, "audit.view");
  return listAuditLogs(filters);
}
