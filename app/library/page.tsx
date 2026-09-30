"use client";

import { useEffect, useState } from "react";
import { BookOpen, Search, AlertTriangle } from "lucide-react";
import { PageHeader } from "@/components/common/page-header";
import { LoadingBlock, ErrorBlock, EmptyState } from "@/components/common/state-blocks";
import { StatCard } from "@/components/common/stat-card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useApiGet } from "@/lib/client/use-api";
import { apiGet } from "@/lib/client/api";
import type { LoanData, LibraryBook as Book } from "@/lib/api-types";

const STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive"> = {
  active: "default",
  returned: "secondary",
  overdue: "destructive",
};

function isDueSoon(dueAt: string): boolean {
  const days = (new Date(dueAt).getTime() - Date.now()) / 86_400_000;
  return days >= 0 && days <= 3;
}

const QUICK_CATEGORIES = ["Computer Science", "Electronics", "Mechanical", "Mathematics", "Management"];

function CatalogBrowser() {
  const [query, setQuery] = useState("");
  const [books, setBooks] = useState<Book[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Book | null>(null);

  useEffect(() => {
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- debounced search-on-type pattern, guarded by `cancelled`
    setLoading(true);
    const timer = setTimeout(() => {
      apiGet<{ books: Book[] }>(`/api/library/catalog?query=${encodeURIComponent(query)}`)
        .then((d) => {
          if (!cancelled) setBooks(d.books);
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query]);

  return (
    <section>
      <div className="mb-3 flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-medium text-muted-foreground">Catalog</h2>
          <div className="relative w-64">
            <Search className="pointer-events-none absolute left-2.5 top-2.5 size-3.5 text-muted-foreground" />
            <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search title, author, category" className="pl-8" />
          </div>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {QUICK_CATEGORIES.map((c) => (
            <button
              key={c}
              onClick={() => setQuery(query === c ? "" : c)}
              className={`rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${
                query === c ? "border-accent bg-accent/10 text-accent" : "border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              {c}
            </button>
          ))}
        </div>
      </div>
      {loading && <LoadingBlock rows={3} />}
      {!loading && books && books.length === 0 && <EmptyState icon={BookOpen} title="No books match your search" />}
      {!loading && books && books.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {books.map((b) => (
            <button key={b.id} onClick={() => setSelected(b)} className="card-surface-interactive p-3.5 text-left">
              <p className="text-sm font-medium leading-snug">{b.title}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">{b.author}</p>
              <div className="mt-2 flex items-center justify-between">
                <Badge variant="secondary" className="text-[10px]">{b.category}</Badge>
                <span className={`text-xs ${b.availableCopies > 0 ? "text-success" : "text-muted-foreground"}`}>
                  {b.availableCopies}/{b.totalCopies} available
                </span>
              </div>
            </button>
          ))}
        </div>
      )}

      <Dialog open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{selected?.title}</DialogTitle>
            <DialogDescription>{selected?.author}</DialogDescription>
          </DialogHeader>
          {selected && (
            <div className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Category</span><span className="font-medium">{selected.category}</span></div>
              {selected.publisher && <div className="flex justify-between"><span className="text-muted-foreground">Publisher</span><span className="font-medium">{selected.publisher}</span></div>}
              <div className="flex justify-between"><span className="text-muted-foreground">ISBN</span><span className="font-medium">{selected.isbn}</span></div>
              {selected.shelfLocation && <div className="flex justify-between"><span className="text-muted-foreground">Shelf</span><span className="font-medium">{selected.shelfLocation}</span></div>}
              <div className="flex justify-between"><span className="text-muted-foreground">Availability</span><span className="font-medium">{selected.availableCopies}/{selected.totalCopies} copies</span></div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </section>
  );
}

export default function LibraryPage() {
  const { data, loading, error, reload } = useApiGet<LoanData>("/api/library/loans");

  return (
    <div className="space-y-8">
      <div>
        <PageHeader title="Library" description="Borrowed books, due dates, and the campus catalog." />

        {loading && <LoadingBlock rows={3} />}
        {error && <ErrorBlock message={error} onRetry={reload} />}

        {data && (
          <>
            <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
              <StatCard icon={BookOpen} label="Books borrowed" value={String(data.activeCount)} />
              <StatCard
                icon={AlertTriangle}
                label="Outstanding fine"
                value={`₹${data.totalFine.toLocaleString("en-IN")}`}
                tone={data.totalFine > 0 ? "destructive" : "default"}
              />
            </div>

            {data.loans.length === 0 ? (
              <EmptyState icon={BookOpen} title="No borrowing history" description="Books you borrow from the library will show up here." />
            ) : (
              <div className="overflow-hidden card-surface">
                <table className="w-full text-left text-sm">
                  <thead className="bg-muted/50 text-xs font-medium text-muted-foreground">
                    <tr>
                      <th className="px-4 py-2 font-medium">Book</th>
                      <th className="px-4 py-2 font-medium">Borrowed</th>
                      <th className="px-4 py-2 font-medium">Due</th>
                      <th className="px-4 py-2 font-medium">Status</th>
                      <th className="px-4 py-2 font-medium">Fine</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.loans.map((l) => (
                      <tr key={l.id} className="border-t border-border transition-colors hover:bg-muted/30">
                        <td className="px-4 py-2.5">
                          <p className="font-medium">{l.title}</p>
                          <p className="text-xs text-muted-foreground">{l.author}</p>
                        </td>
                        <td className="px-4 py-2.5 text-muted-foreground">{l.borrowedAt}</td>
                        <td className={`px-4 py-2.5 ${l.status === "active" && isDueSoon(l.dueAt) ? "font-medium text-warning" : "text-muted-foreground"}`}>
                          {l.dueAt}
                          {l.status === "active" && isDueSoon(l.dueAt) && " · due soon"}
                        </td>
                        <td className="px-4 py-2.5">
                          <Badge variant={STATUS_VARIANT[l.status] ?? "default"} className="capitalize">
                            {l.status}
                          </Badge>
                        </td>
                        <td className="px-4 py-2.5">{l.fineAmount > 0 ? `₹${l.fineAmount}` : "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>

      <CatalogBrowser />
    </div>
  );
}
