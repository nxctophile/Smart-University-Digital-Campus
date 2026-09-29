import "server-only";
import { db } from "@/lib/db/client";
import { parents, sections, courses, students } from "@/lib/db/schema";
import { eq, inArray } from "drizzle-orm";
import type { AccessContext } from "./types";
import { getPermissionDef, type PermissionKey } from "./permissions";
import { scopeAllows, type Scope, type ResourceNeed } from "./scope";
import { recordAudit } from "./audit";

export class AccessDeniedError extends Error {
  constructor(message = "You don't have permission to access this resource.") {
    super(message);
    this.name = "AccessDeniedError";
  }
}

/** No valid session at all (missing/stale login cookie) - distinct from
 * AccessDeniedError (a real, signed-in identity lacking a permission).
 * Mapped to HTTP 401 by lib/api-helpers.ts; page-level requests are caught
 * by proxy.ts redirecting to /login before they ever reach here. */
export class UnauthenticatedError extends Error {
  constructor(message = "Sign in to continue.") {
    super(message);
    this.name = "UnauthenticatedError";
  }
}

async function cached<T>(ctx: AccessContext, key: string, load: () => Promise<T>): Promise<T> {
  if (ctx._cache.has(key)) return ctx._cache.get(key) as T;
  const value = await load();
  ctx._cache.set(key, value);
  return value;
}

/** Resolves the child studentId for a parent caller. */
async function parentsChildId(ctx: AccessContext): Promise<number | null> {
  if (!ctx.parentId) return null;
  return cached(ctx, "parent:child", async () => {
    const parent = await db.query.parents.findFirst({ where: eq(parents.id, ctx.parentId!) });
    return parent?.studentId ?? null;
  });
}

/** The student id a caller reaches for when they don't name one explicitly:
 * their own record (student), their linked child (parent), or null
 * (faculty/admin/employee callers must always name a specific student). */
export async function resolveOwnStudentId(ctx: AccessContext): Promise<number | null> {
  if (ctx.studentId) return ctx.studentId;
  return parentsChildId(ctx);
}

/** Course ids across all sections a faculty member teaches. */
async function facultyCourseIds(ctx: AccessContext): Promise<number[]> {
  if (!ctx.facultyId) return [];
  return cached(ctx, "faculty:courseIds", async () => {
    const rows = await db.select({ courseId: sections.courseId }).from(sections).where(eq(sections.facultyId, ctx.facultyId!));
    return rows.map((r) => r.courseId);
  });
}

/** Student ids enrolled in any course a faculty member teaches (their
 * combined roster across sections), used to scope per-student lookups like
 * "view this specific student's attendance". */
async function facultyRosterStudentIds(ctx: AccessContext): Promise<number[]> {
  if (!ctx.facultyId) return [];
  return cached(ctx, "faculty:rosterStudentIds", async () => {
    const courseIds = await facultyCourseIds(ctx);
    if (!courseIds.length) return [];
    const myCourses = await db.select().from(courses).where(inArray(courses.id, courseIds));
    const pairs = new Set(myCourses.map((c) => `${c.programmeId}:${c.semester}`));
    if (!pairs.size) return [];
    const all = await db
      .select({ id: students.id, programmeId: students.programmeId, semester: students.currentSemester })
      .from(students);
    return all.filter((s) => pairs.has(`${s.programmeId}:${s.semester}`)).map((s) => s.id);
  });
}

/** When a role assignment carries no explicit scope, resolve one from the
 * caller's own identity based on what kind of resource they're reaching for.
 * This is the ONLY place that maps "who is asking" to "what they can reach"
 * dynamically - everything else just compares scope objects. */
async function resolveDynamicScope(ctx: AccessContext, need: ResourceNeed): Promise<Scope> {
  if (need.studentId !== undefined) {
    if (ctx.studentId) return { studentId: ctx.studentId };
    const childId = await parentsChildId(ctx);
    if (childId) return { studentId: childId };
    if (ctx.facultyId) return { studentIds: await facultyRosterStudentIds(ctx) };
  }
  if (need.courseId !== undefined && ctx.facultyId) {
    return { courseIds: await facultyCourseIds(ctx) };
  }
  if (need.departmentId !== undefined && ctx.departmentId) {
    return { departmentId: ctx.departmentId };
  }
  return {};
}

/** Read-only check - never throws, never audits. Use for UI hints only;
 * every real read/write must still go through authorize(). */
export async function can(ctx: AccessContext, permission: PermissionKey, need?: ResourceNeed): Promise<boolean> {
  const grants = ctx.grants.filter((g) => g.permission === permission);
  if (!grants.length) return false;
  if (!need) return true;
  for (const grant of grants) {
    const scope = grant.scope ?? (await resolveDynamicScope(ctx, need));
    if (scopeAllows(scope, need)) return true;
  }
  return false;
}

export type AuthorizeOptions = {
  /** Human-readable resource label for the audit log, e.g. "student:123". */
  resourceLabel?: string;
  /** Force an audit entry on success even for a non-sensitive, high-frequency
   * read permission (denials are always logged regardless of this flag). */
  forceAudit?: boolean;
};

/** The single authorization entrypoint. Every service function and AI tool
 * must call this (directly or via resolveStudentIdForAccess) before reading
 * or mutating protected data - never branch on ctx.role.
 *
 * Every DENIAL is audited. Every SUCCESS is audited only when the
 * permission is catalogued as sensitive (or the caller asks for it) - this
 * keeps the audit trail focused on what a reviewer actually cares about
 * instead of drowning it in routine dashboard reads. */
export async function authorize(
  ctx: AccessContext,
  permission: PermissionKey,
  need?: ResourceNeed,
  opts: AuthorizeOptions = {},
): Promise<void> {
  const allowed = await can(ctx, permission, need);
  const shouldAudit = !allowed || opts.forceAudit || getPermissionDef(permission)?.sensitive;
  if (shouldAudit) {
    await recordAudit(ctx, permission, opts.resourceLabel ?? describeNeed(need), allowed ? "success" : "denied");
  }
  if (!allowed) throw new AccessDeniedError();
}

function describeNeed(need?: ResourceNeed): string | undefined {
  if (!need) return undefined;
  if (need.studentId !== undefined) return `student:${need.studentId}`;
  if (need.courseId !== undefined) return `course:${need.courseId}`;
  if (need.departmentId !== undefined) return `department:${need.departmentId}`;
  if (need.employeeId !== undefined) return `employee:${need.employeeId}`;
  return undefined;
}
