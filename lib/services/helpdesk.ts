import { db } from "@/lib/db/client";
import { helpdeskTickets, ticketMessages } from "@/lib/db/schema";
import { eq, desc, and } from "drizzle-orm";
import { AccessContext, resolveStudentIdForAccess, authorize } from "./context";
import { can } from "@/lib/rbac/authorize";

export const CATEGORIES = ["academic", "hostel", "transport", "fees", "it", "general"] as const;
export type TicketCategory = (typeof CATEGORIES)[number];

export async function listMyTickets(ctx: AccessContext, requestedStudentId?: number) {
  const studentId = await resolveStudentIdForAccess(ctx, "helpdesk.ticket.view", requestedStudentId);
  return db
    .select()
    .from(helpdeskTickets)
    .where(eq(helpdeskTickets.studentId, studentId))
    .orderBy(desc(helpdeskTickets.createdAt));
}

export async function getTicket(ctx: AccessContext, ticketId: number) {
  const ticket = await db.query.helpdeskTickets.findFirst({ where: eq(helpdeskTickets.id, ticketId) });
  if (!ticket) throw new Error("Ticket not found.");
  const isStaff = await can(ctx, "campus.issue.manage");
  if (!isStaff && ticket.studentId) await resolveStudentIdForAccess(ctx, "helpdesk.ticket.view", ticket.studentId);
  const messages = await db
    .select()
    .from(ticketMessages)
    .where(eq(ticketMessages.ticketId, ticketId))
    .orderBy(ticketMessages.createdAt);
  return { ticket, messages };
}

export async function createTicket(
  ctx: AccessContext,
  requestedStudentId: number | undefined,
  input: { category: TicketCategory; subject: string; description: string },
  via: "web" | "ai" = "web",
) {
  const studentId = await resolveStudentIdForAccess(ctx, "helpdesk.ticket.create", requestedStudentId);
  const ticketNumber = `HD-${Date.now().toString(36).toUpperCase()}`;
  const now = new Date().toISOString();
  const ticket = db
    .insert(helpdeskTickets)
    .values({
      ticketNumber,
      studentId,
      category: input.category,
      subject: input.subject,
      description: input.description,
      status: "open",
      priority: "medium",
      createdVia: via,
      createdAt: now,
      updatedAt: now,
    })
    .returning()
    .get();

  db.insert(ticketMessages)
    .values({ ticketId: ticket.id, sender: via === "ai" ? "ai" : "student", message: input.description })
    .run();

  return ticket;
}

export type TicketFilters = { status?: string; category?: string; limit?: number };

export async function listAllTickets(ctx: AccessContext, filters: TicketFilters = {}) {
  await authorize(ctx, "campus.issue.manage");
  const conditions = [];
  if (filters.status) conditions.push(eq(helpdeskTickets.status, filters.status));
  if (filters.category) conditions.push(eq(helpdeskTickets.category, filters.category));
  return db
    .select()
    .from(helpdeskTickets)
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(helpdeskTickets.createdAt))
    .limit(filters.limit ?? 100);
}
