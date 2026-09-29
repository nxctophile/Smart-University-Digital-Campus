import { db } from "@/lib/db/client";
import { users, faculty, employees, departments } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import type { Role, ClientContext } from "@/lib/types";
import type { PermissionKey } from "@/lib/rbac/permissions";
import { loadGrantsForUser, loadRoleKeysForUser } from "@/lib/rbac/grants";
import { authorize, AccessDeniedError, UnauthenticatedError, resolveOwnStudentId } from "@/lib/rbac/authorize";
import type { AccessContext } from "@/lib/rbac/types";

export type { Role, AccessContext };
export { AccessDeniedError, UnauthenticatedError, authorize };

/** Every role-scoped service call takes a context and enforces access
 * through the centralized authorize()/can() layer (lib/rbac) rather than
 * relying on the UI to simply hide buttons, or on ad-hoc `if (role===...)`
 * checks scattered through services. */
export async function loadContext(userId: number): Promise<AccessContext> {
  const user = await db.query.users.findFirst({ where: eq(users.id, userId) });
  if (!user) throw new AccessDeniedError("Unknown demo user.");

  let departmentId: number | null = null;
  let departmentName: string | null = null;
  if (user.facultyId) {
    const f = await db.query.faculty.findFirst({ where: eq(faculty.id, user.facultyId) });
    departmentId = f?.departmentId ?? null;
  } else if (user.employeeId) {
    const e = await db.query.employees.findFirst({ where: eq(employees.id, user.employeeId) });
    departmentId = e?.departmentId ?? null;
  }
  if (departmentId) {
    const d = await db.query.departments.findFirst({ where: eq(departments.id, departmentId) });
    departmentName = d?.name ?? null;
  }

  const [grants, roles] = await Promise.all([loadGrantsForUser(user.id), loadRoleKeysForUser(user.id)]);
  const permissions = Array.from(new Set(grants.map((g) => g.permission)));

  return {
    userId: user.id,
    role: user.role as Role,
    name: user.name,
    studentId: user.studentId,
    facultyId: user.facultyId,
    parentId: user.parentId,
    employeeId: user.employeeId,
    departmentId,
    departmentName,
    roles,
    permissions,
    grants,
    _cache: new Map(),
  };
}

/** Returns the client-safe subset of an AccessContext (no grants/scope
 * internals) - this is what gets sent to the browser as session state. */
export function toClientContext(ctx: AccessContext): ClientContext {
  const { userId, role, name, studentId, facultyId, parentId, employeeId, departmentId, departmentName, roles, permissions } = ctx;
  return { userId, role, name, studentId, facultyId, parentId, employeeId, departmentId, departmentName, roles, permissions };
}

/** Resolves which student a given caller is allowed to reach for a given
 * permission: themselves (student), their child (parent), any student in
 * their own roster (faculty), or any student at all (admin with an
 * `{all:true}` scope) - and throws AccessDeniedError otherwise. This is the
 * one place nearly every student-scoped service function funnels through. */
export async function resolveStudentIdForAccess(
  ctx: AccessContext,
  permission: PermissionKey,
  requestedStudentId?: number,
): Promise<number> {
  const targetId = requestedStudentId ?? (await resolveOwnStudentId(ctx)) ?? undefined;
  if (!targetId) throw new AccessDeniedError("A student id is required for this role.");
  await authorize(ctx, permission, { studentId: targetId });
  return targetId;
}
