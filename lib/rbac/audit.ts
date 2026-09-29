import "server-only";
import { db } from "@/lib/db/client";
import { auditLogs } from "@/lib/db/schema";
import { desc, eq, and, sql } from "drizzle-orm";
import type { AccessContext } from "./types";

export async function recordAudit(
  ctx: Pick<AccessContext, "userId" | "name" | "role">,
  action: string,
  resource: string | undefined,
  result: "success" | "denied",
  metadata?: Record<string, unknown>,
): Promise<void> {
  db.insert(auditLogs)
    .values({
      userId: ctx.userId,
      userName: ctx.name,
      userRole: ctx.role,
      action,
      resource: resource ?? null,
      result,
      metadata: metadata ? JSON.stringify(metadata) : null,
      createdAt: new Date().toISOString(),
    })
    .run();
}

/** For events with no live AccessContext yet (e.g. login) or a system actor. */
export async function recordAuditRaw(entry: {
  userId: number | null;
  userName: string;
  userRole: string;
  action: string;
  resource?: string;
  result: "success" | "denied";
  metadata?: Record<string, unknown>;
}): Promise<void> {
  db.insert(auditLogs)
    .values({
      userId: entry.userId,
      userName: entry.userName,
      userRole: entry.userRole,
      action: entry.action,
      resource: entry.resource ?? null,
      result: entry.result,
      metadata: entry.metadata ? JSON.stringify(entry.metadata) : null,
      createdAt: new Date().toISOString(),
    })
    .run();
}

export type AuditLogFilters = { action?: string; result?: string; userId?: number; limit?: number };

export async function listAuditLogs(filters: AuditLogFilters = {}) {
  const conditions = [];
  if (filters.action) conditions.push(eq(auditLogs.action, filters.action));
  if (filters.result) conditions.push(eq(auditLogs.result, filters.result));
  if (filters.userId) conditions.push(eq(auditLogs.userId, filters.userId));

  const rows = await db
    .select()
    .from(auditLogs)
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(auditLogs.createdAt))
    .limit(filters.limit ?? 200);

  return rows.map((r) => ({ ...r, metadata: r.metadata ? JSON.parse(r.metadata) : null }));
}

export async function auditSummary() {
  const row = await db
    .select({
      total: sql<number>`count(*)`,
      denied: sql<number>`sum(case when result = 'denied' then 1 else 0 end)`,
    })
    .from(auditLogs)
    .get();
  return { total: row?.total ?? 0, denied: row?.denied ?? 0 };
}
