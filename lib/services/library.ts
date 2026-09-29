import { db, sqlite } from "@/lib/db/client";
import { bookLoans, books } from "@/lib/db/schema";
import { eq, like, or, sql } from "drizzle-orm";
import { AccessContext, authorize, resolveStudentIdForAccess } from "./context";

export async function getMyLoans(ctx: AccessContext, requestedStudentId?: number) {
  const studentId = await resolveStudentIdForAccess(ctx, "library.loan.view", requestedStudentId);
  const rows = await db
    .select({
      id: bookLoans.id,
      title: books.title,
      author: books.author,
      category: books.category,
      borrowedAt: bookLoans.borrowedAt,
      dueAt: bookLoans.dueAt,
      returnedAt: bookLoans.returnedAt,
      status: bookLoans.status,
      fineAmount: bookLoans.fineAmount,
      finePaid: bookLoans.finePaid,
    })
    .from(bookLoans)
    .innerJoin(books, eq(bookLoans.bookId, books.id))
    .where(eq(bookLoans.studentId, studentId))
    .orderBy(bookLoans.borrowedAt);

  const active = rows.filter((r) => r.status !== "returned");
  const totalFine = rows.filter((r) => !r.finePaid).reduce((sum, r) => sum + r.fineAmount, 0);

  return { loans: rows.reverse(), activeCount: active.length, totalFine };
}

export async function searchCatalog(query: string, limit = 30) {
  const rows = query.trim()
    ? await db
        .select()
        .from(books)
        .where(or(like(books.title, `%${query}%`), like(books.author, `%${query}%`), like(books.category, `%${query}%`)))
        .limit(limit)
    : await db.select().from(books).limit(limit);
  return rows;
}

export async function getLibraryOverview(ctx: AccessContext) {
  await authorize(ctx, "library.book.manage");
  const totals = sqlite
    .prepare(`SELECT COUNT(*) titles, SUM(total_copies) totalCopies, SUM(available_copies) availableCopies FROM books`)
    .get() as { titles: number; totalCopies: number; availableCopies: number };

  const loanStats = sqlite
    .prepare(
      `SELECT
        SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) activeLoans,
        SUM(CASE WHEN status = 'overdue' THEN 1 ELSE 0 END) overdueLoans,
        SUM(CASE WHEN fine_paid = 0 THEN fine_amount ELSE 0 END) outstandingFines
       FROM book_loans`,
    )
    .get() as { activeLoans: number; overdueLoans: number; outstandingFines: number };

  const byCategory = sqlite
    .prepare(`SELECT category, COUNT(*) titles, SUM(total_copies) copies FROM books GROUP BY category ORDER BY copies DESC`)
    .all();

  return {
    titles: totals.titles,
    totalCopies: totals.totalCopies,
    availableCopies: totals.availableCopies,
    borrowedCopies: totals.totalCopies - totals.availableCopies,
    activeLoans: loanStats.activeLoans ?? 0,
    overdueLoans: loanStats.overdueLoans ?? 0,
    outstandingFines: loanStats.outstandingFines ?? 0,
    byCategory,
  };
}

export async function listOverdueLoans(ctx: AccessContext) {
  await authorize(ctx, "library.book.manage");
  return sqlite
    .prepare(
      `SELECT bl.id, bl.due_at as dueAt, bl.fine_amount as fineAmount, b.title, s.roll_number as rollNumber, s.first_name as firstName, s.last_name as lastName
       FROM book_loans bl
       JOIN books b ON b.id = bl.book_id
       JOIN students s ON s.id = bl.student_id
       WHERE bl.status = 'overdue'
       ORDER BY bl.due_at ASC
       LIMIT 100`,
    )
    .all();
}

export async function returnBook(ctx: AccessContext, loanId: number) {
  await authorize(ctx, "library.issue.return");
  const loan = await db.query.bookLoans.findFirst({ where: eq(bookLoans.id, loanId) });
  if (!loan) throw new Error("Loan not found.");
  if (loan.status === "returned") return loan;

  const today = new Date().toISOString().slice(0, 10);
  db.update(bookLoans).set({ status: "returned", returnedAt: today }).where(eq(bookLoans.id, loanId)).run();
  db.update(books)
    .set({ availableCopies: sql`${books.availableCopies} + 1` })
    .where(eq(books.id, loan.bookId))
    .run();
  return { ...loan, status: "returned", returnedAt: today };
}
