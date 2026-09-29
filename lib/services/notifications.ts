import { db } from "@/lib/db/client";
import { notifications } from "@/lib/db/schema";
import { desc, or, eq, isNull } from "drizzle-orm";
import { AccessContext } from "./context";

export async function getNotificationsForRole(ctx: AccessContext, limit = 10) {
  return db
    .select()
    .from(notifications)
    .where(or(isNull(notifications.audienceRole), eq(notifications.audienceRole, ctx.role)))
    .orderBy(desc(notifications.createdAt))
    .limit(limit);
}
