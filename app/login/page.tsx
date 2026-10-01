"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Loader2, LogIn, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LogoMark } from "@/components/brand/logo-mark";
import { cn } from "@/lib/utils";

type DemoUser = { id: number; name: string; email: string; role: string; roleNames: string[] };

const CATEGORY_LABEL: Record<string, string> = {
  student: "Student",
  parent: "Parent",
  faculty: "Faculty",
  admin: "Administrator",
  employee: "Department staff",
};
const CATEGORY_ORDER = ["student", "parent", "faculty", "admin", "employee"];

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") ?? "/";

  const [users, setUsers] = useState<DemoUser[] | null>(null);
  const [selected, setSelected] = useState<string>("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch("/api/demo/users")
      .then((r) => r.json())
      .then((d: { users: DemoUser[] }) => {
        setUsers(d.users);
        if (d.users.length) setSelected(String(d.users[0].id));
      })
      .catch(() => toast.error("Couldn't load the demo login list."));
  }, []);

  const grouped = useMemo(() => {
    if (!users) return [];
    const byCategory = new Map<string, DemoUser[]>();
    for (const u of users) byCategory.set(u.role, [...(byCategory.get(u.role) ?? []), u]);
    return CATEGORY_ORDER.filter((c) => byCategory.has(c)).map((c) => ({ category: c, users: byCategory.get(c)! }));
  }, [users]);

  async function signIn(e: React.FormEvent) {
    e.preventDefault();
    if (!selected) return;
    setLoading(true);
    try {
      const res = await fetch("/api/demo/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: Number(selected) }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: "Sign in failed" }));
        throw new Error(body.error ?? "Sign in failed");
      }
      router.push(next);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Sign in failed");
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-muted/40 px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-8 flex flex-col items-center gap-3 text-center">
          <div className="flex size-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-sm">
            <LogoMark className="size-6" />
          </div>
          <div>
            <p className="text-lg font-bold tracking-tight">Campus OS</p>
            <p className="text-xs text-muted-foreground">Central Institute of Technology</p>
          </div>
        </div>

        <form onSubmit={signIn} className="card-surface space-y-4 p-6">
          <div>
            <h1 className="text-sm font-semibold">Sign in</h1>
            <p className="mt-1 text-xs text-muted-foreground">
              Demo prototype — no password required. Pick a persona below to explore the platform as that role; every
              module you see is gated by that persona&rsquo;s real, server-enforced permissions.
            </p>
          </div>

          <div className="space-y-1.5">
            <p className="text-xs font-medium text-muted-foreground">Log in as</p>
            {!users ? (
              <div className="space-y-2">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="h-14 w-full animate-pulse rounded-lg bg-secondary" />
                ))}
              </div>
            ) : (
              <div className="max-h-80 space-y-4 overflow-y-auto pr-1">
                {grouped.map((group) => (
                  <div key={group.category} className="space-y-1.5">
                    <p className="px-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">
                      {CATEGORY_LABEL[group.category] ?? group.category}
                    </p>
                    <div className="space-y-1.5">
                      {group.users.map((u) => {
                        const active = selected === String(u.id);
                        return (
                          <button
                            key={u.id}
                            type="button"
                            onClick={() => setSelected(String(u.id))}
                            className={cn(
                              "flex w-full items-center justify-between gap-3 rounded-lg border p-3 text-left text-sm transition-colors",
                              active
                                ? "border-primary bg-brand-tint"
                                : "border-border bg-card hover:border-primary/40 hover:bg-brand-tint/60",
                            )}
                          >
                            <span className="min-w-0">
                              <span className="block truncate font-medium">{u.name}</span>
                              <span className="block truncate text-xs text-muted-foreground">
                                {u.roleNames.length ? u.roleNames.join(" + ") : CATEGORY_LABEL[u.role] ?? u.role}
                              </span>
                            </span>
                            {active && <Check className="size-4 shrink-0 text-primary" />}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <Button type="submit" disabled={!selected || loading} className="w-full gap-1.5">
            {loading ? <Loader2 className="size-4 animate-spin" /> : <LogIn className="size-4" />}
            Sign in
          </Button>
        </form>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
