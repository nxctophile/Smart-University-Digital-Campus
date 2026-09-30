"use client";

import { useState } from "react";
import { Settings, KeyRound, History, Loader2, ShieldCheck } from "lucide-react";
import { PageHeader } from "@/components/common/page-header";
import { LoadingBlock, ErrorBlock, EmptyState } from "@/components/common/state-blocks";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useApiGet } from "@/lib/client/use-api";
import { apiPost } from "@/lib/client/api";
import { toast } from "sonner";
import type { PasswordChangeEntry } from "@/lib/api-types";

export default function AccountPage() {
  const { data, loading, error, reload } = useApiGet<{ history: PasswordChangeEntry[] }>("/api/account/password-history");
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [saving, setSaving] = useState(false);

  async function changePassword(e: React.FormEvent) {
    e.preventDefault();
    if (next.length < 6) {
      toast.error("Password must be at least 6 characters.");
      return;
    }
    if (next !== confirm) {
      toast.error("New password and confirmation don't match.");
      return;
    }
    setSaving(true);
    try {
      await apiPost("/api/account/password", { newPassword: next });
      toast.success("Password changed.");
      setCurrent("");
      setNext("");
      setConfirm("");
      reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to change password");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-2xl space-y-6">
      <PageHeader title="My Account" description="Security settings for your account." />

      <section className="card-surface p-5">
        <div className="mb-4 flex items-center gap-2">
          <KeyRound className="size-4 text-accent" />
          <h2 className="text-sm font-medium">Change password</h2>
        </div>
        <div className="mb-4 flex items-start gap-2 rounded-lg border border-border bg-muted/30 p-3 text-xs text-muted-foreground">
          <ShieldCheck className="mt-0.5 size-3.5 shrink-0" />
          This is a demo prototype - sign-in uses persona selection, not a real password. This form records a change in
          your account history so the flow can still be demoed end to end.
        </div>
        <form onSubmit={changePassword} className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="current">Current password</Label>
            <Input id="current" type="password" value={current} onChange={(e) => setCurrent(e.target.value)} placeholder="••••••••" />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="next">New password</Label>
              <Input id="next" type="password" value={next} onChange={(e) => setNext(e.target.value)} required minLength={6} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="confirm">Confirm new password</Label>
              <Input id="confirm" type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required minLength={6} />
            </div>
          </div>
          <Button type="submit" disabled={saving} className="gap-1.5">
            {saving && <Loader2 className="size-3.5 animate-spin" />}
            Change password
          </Button>
        </form>
      </section>

      <section className="card-surface p-5">
        <div className="mb-4 flex items-center gap-2">
          <History className="size-4 text-accent" />
          <h2 className="text-sm font-medium">Password change history</h2>
        </div>
        {loading && <LoadingBlock rows={2} />}
        {error && <ErrorBlock message={error} onRetry={reload} />}
        {data && data.history.length === 0 && <EmptyState icon={Settings} title="No password changes recorded yet" />}
        {data && data.history.length > 0 && (
          <ul className="space-y-2">
            {data.history.map((h) => (
              <li key={h.id} className="flex items-center justify-between rounded-md border border-border/70 px-3 py-2 text-sm">
                <span>{h.note ?? "Password changed"}</span>
                <span className="text-xs text-muted-foreground">{new Date(h.changedAt).toLocaleString("en-IN")}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
