"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { GraduationCap, Loader2, LogIn } from "lucide-react";
import { Button } from "@/components/ui/button";

type DemoUser = { id: number; name: string; email: string; role: string; roleNames: string[] };

const CATEGORY_LABEL: Record<string, string> = {
  student: "Student",
  parent: "Parent",
  faculty: "Faculty",
  admin: "Administrator",
  employee: "Department staff",
};
const CATEGORY_ORDER = ["student", "parent", "faculty", "admin", "employee"];

function personaLabel(user: DemoUser): string {
  const roleText = user.roleNames.length ? user.roleNames.join(" + ") : CATEGORY_LABEL[user.role] ?? user.role;
  return `${user.name} — ${roleText}`;
}

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
    <div className="flex min-h-dvh items-center justify-center bg-muted/30 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center gap-2 text-center">
          <div className="flex size-11 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
            <GraduationCap className="size-5.5" />
          </div>
          <div>
            <p className="text-base font-semibold tracking-tight">Central Institute of Technology</p>
            <p className="text-xs text-muted-foreground">Campus OS</p>
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
            <label htmlFor="persona" className="text-xs font-medium text-muted-foreground">
              Log in as
            </label>
            {!users ? (
              <div className="h-9 w-full animate-pulse rounded-md bg-muted" />
            ) : (
              <select
                id="persona"
                value={selected}
                onChange={(e) => setSelected(e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                {grouped.map((group) => (
                  <optgroup key={group.category} label={CATEGORY_LABEL[group.category] ?? group.category}>
                    {group.users.map((u) => (
                      <option key={u.id} value={u.id}>
                        {personaLabel(u)}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
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
