"use client";

import { useState } from "react";
import { Landmark, IndianRupee, AlertTriangle, Clock, Loader2, Check } from "lucide-react";
import { PageHeader } from "@/components/common/page-header";
import { LoadingBlock, ErrorBlock, EmptyState } from "@/components/common/state-blocks";
import { StatCard } from "@/components/common/stat-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useApiGet } from "@/lib/client/use-api";
import { apiMutate } from "@/lib/client/api";
import { toast } from "sonner";
import type { FinanceOverview as Overview, FeeRecord } from "@/lib/api-types";

const STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive"> = {
  paid: "secondary",
  pending: "default",
  overdue: "destructive",
  partial: "default",
};

export default function FinancePage() {
  const { data: overview, loading, error, reload } = useApiGet<Overview>("/api/admin/finance/overview");
  const { data: feesData, reload: reloadFees } = useApiGet<{ fees: FeeRecord[] }>("/api/admin/finance/fees?status=overdue");
  const [collectingId, setCollectingId] = useState<number | null>(null);

  async function collect(fee: FeeRecord) {
    setCollectingId(fee.id);
    try {
      const pending = fee.amount - fee.amountPaid;
      await apiMutate("/api/admin/finance/collect", { method: "POST", body: { feeId: fee.id, amount: pending, method: "cash" } });
      toast.success(`Collected ₹${pending.toLocaleString("en-IN")} from ${fee.firstName} ${fee.lastName}.`);
      reload();
      reloadFees();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to record payment");
    } finally {
      setCollectingId(null);
    }
  }

  const fees = feesData?.fees ?? [];

  return (
    <div className="space-y-8">
      <div>
        <PageHeader title="Finance" description="Accounts Department - fee collection, transactions & outstanding balances." />

        {loading && <LoadingBlock rows={3} />}
        {error && <ErrorBlock message={error} onRetry={reload} />}

        {overview && (
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard icon={IndianRupee} label="Total billed" value={`₹${(overview.totalBilled / 100000).toFixed(1)}L`} />
            <StatCard icon={Landmark} label="Total collected" value={`₹${(overview.totalCollected / 100000).toFixed(1)}L`} tone="success" />
            <StatCard icon={AlertTriangle} label="Overdue accounts" value={String(overview.overdueCount)} tone="destructive" />
            <StatCard icon={Clock} label="Pending accounts" value={String(overview.pendingCount)} tone="warning" />
          </div>
        )}
      </div>

      <section>
        <h2 className="mb-3 text-sm font-medium text-muted-foreground">Overdue fee accounts</h2>
        {!feesData && <LoadingBlock rows={3} />}
        {feesData && fees.length === 0 && <EmptyState icon={Check} title="No overdue accounts" />}
        {fees.length > 0 && (
          <div className="overflow-hidden card-surface">
            <table className="w-full text-left text-sm">
              <thead className="bg-muted/50 text-xs font-medium text-muted-foreground">
                <tr>
                  <th className="px-4 py-2 font-medium">Student</th>
                  <th className="px-4 py-2 font-medium">Type</th>
                  <th className="px-4 py-2 font-medium">Pending</th>
                  <th className="px-4 py-2 font-medium">Due</th>
                  <th className="px-4 py-2 font-medium">Status</th>
                  <th className="px-4 py-2 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {fees.map((f) => (
                  <tr key={f.id} className="border-t border-border transition-colors hover:bg-brand-tint">
                    <td className="px-4 py-2.5">
                      {f.firstName} {f.lastName} <span className="font-mono text-xs text-muted-foreground">({f.rollNumber})</span>
                    </td>
                    <td className="px-4 py-2.5 capitalize">{f.feeType}</td>
                    <td className="px-4 py-2.5">₹{(f.amount - f.amountPaid).toLocaleString("en-IN")}</td>
                    <td className="px-4 py-2.5 text-destructive">{f.dueDate}</td>
                    <td className="px-4 py-2.5">
                      <Badge variant={STATUS_VARIANT[f.status] ?? "default"} className="capitalize">
                        {f.status}
                      </Badge>
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <Button size="sm" variant="outline" disabled={collectingId === f.id} onClick={() => collect(f)} className="gap-1.5">
                        {collectingId === f.id ? <Loader2 className="size-3.5 animate-spin" /> : null}
                        Record payment
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
