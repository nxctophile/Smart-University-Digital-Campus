"use client";

import { useState } from "react";
import { Wallet, ShieldCheck, Loader2, CreditCard, RotateCcw, Receipt, Printer } from "lucide-react";
import { useApiGet } from "@/lib/client/use-api";
import { apiPost } from "@/lib/client/api";
import { openRazorpayCheckout } from "@/lib/client/razorpay";
import { PageHeader } from "@/components/common/page-header";
import { LoadingBlock, ErrorBlock, EmptyState } from "@/components/common/state-blocks";
import { StatCard } from "@/components/common/stat-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { FeeStatus as Fees, FeeItem, PaymentReceipt } from "@/lib/api-types";

const STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive"> = {
  paid: "secondary",
  pending: "default",
  overdue: "destructive",
};

type CreateOrderResult = { orderId: string; amount: number; currency: string; keyId: string | null; demoMode: boolean };
type Tab = "balance" | "receipts";

export default function FeesPage() {
  const [tab, setTab] = useState<Tab>("balance");

  return (
    <div>
      <PageHeader title="Fees" description="Semester fee balances, payments, and receipts." />
      <div className="mb-6 flex gap-1 overflow-x-auto rounded-lg bg-muted p-0.5 text-xs">
        {([
          { key: "balance", label: "Fee Balance" },
          { key: "receipts", label: "Receipts" },
        ] as { key: Tab; label: string }[]).map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={cn(
              "flex shrink-0 items-center gap-1.5 rounded-md px-3 py-1.5 font-medium transition-colors",
              tab === t.key ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>
      {tab === "balance" && <FeeBalanceTab />}
      {tab === "receipts" && <ReceiptsTab />}
    </div>
  );
}

function FeeBalanceTab() {
  const { data, loading, error, reload } = useApiGet<Fees>("/api/fees");
  const [payingFeeId, setPayingFeeId] = useState<number | null>(null);
  const [demoOrder, setDemoOrder] = useState<{ fee: FeeItem; order: CreateOrderResult } | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [resettingId, setResettingId] = useState<number | null>(null);

  async function resetFee(fee: FeeItem) {
    setResettingId(fee.id);
    try {
      await apiPost("/api/payments/reset", { feeId: fee.id });
      toast.success("Reset to unpaid — demo it again.");
      reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to reset");
    } finally {
      setResettingId(null);
    }
  }

  async function startPayment(fee: FeeItem) {
    setPayingFeeId(fee.id);
    try {
      const order = await apiPost<CreateOrderResult>("/api/payments/create-order", { feeId: fee.id });
      if (order.demoMode) {
        setDemoOrder({ fee, order });
        return;
      }
      await openRazorpayCheckout({
        key: order.keyId!,
        amount: order.amount,
        currency: order.currency,
        order_id: order.orderId,
        name: "Central Institute of Technology",
        description: `${fee.feeType} fee - Semester ${fee.semester}`,
        theme: { color: "#C9432C" },
        handler: async (response) => {
          try {
            await apiPost("/api/payments/verify", {
              feeId: fee.id,
              orderId: order.orderId,
              paymentId: response.razorpay_payment_id,
              signature: response.razorpay_signature,
            });
            toast.success("Payment successful.");
            reload();
          } catch (err) {
            toast.error(err instanceof Error ? err.message : "Payment verification failed");
          }
        },
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't start payment");
    } finally {
      setPayingFeeId(null);
    }
  }

  async function confirmDemoPayment() {
    if (!demoOrder) return;
    setConfirming(true);
    try {
      await apiPost("/api/payments/verify", {
        feeId: demoOrder.fee.id,
        orderId: demoOrder.order.orderId,
        paymentId: `demo_payment_${Date.now()}`,
      });
      toast.success("Demo payment recorded.");
      setDemoOrder(null);
      reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to record payment");
    } finally {
      setConfirming(false);
    }
  }

  return (
    <div>
      {loading && <LoadingBlock rows={3} />}
      {error && <ErrorBlock message={error} onRetry={reload} />}
      {data && data.items.length === 0 && <EmptyState icon={Wallet} title="No fee records found" />}

      {data && data.items.length > 0 && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <StatCard
              icon={Wallet}
              label="Total pending"
              value={`₹${data.totalDue.toLocaleString("en-IN")}`}
              tone={data.hasOverdue ? "destructive" : data.totalDue > 0 ? "warning" : "success"}
            />
          </div>

          <div className="overflow-hidden card-surface">
            <table className="w-full text-left text-sm">
              <thead className="bg-muted/50 text-xs font-medium text-muted-foreground">
                <tr>
                  <th className="px-4 py-2 font-medium">Type</th>
                  <th className="px-4 py-2 font-medium">Semester</th>
                  <th className="px-4 py-2 font-medium">Amount</th>
                  <th className="px-4 py-2 font-medium">Paid</th>
                  <th className="px-4 py-2 font-medium">Pending</th>
                  <th className="px-4 py-2 font-medium">Due</th>
                  <th className="px-4 py-2 font-medium">Status</th>
                  <th className="px-4 py-2 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((f) => (
                  <tr key={f.id} className="border-t border-border transition-colors hover:bg-brand-tint">
                    <td className="px-4 py-2.5 capitalize">{f.feeType}</td>
                    <td className="px-4 py-2.5">{f.semester}</td>
                    <td className="px-4 py-2.5">₹{f.amount.toLocaleString("en-IN")}</td>
                    <td className="px-4 py-2.5">₹{f.amountPaid.toLocaleString("en-IN")}</td>
                    <td className="px-4 py-2.5 font-medium">₹{f.pending.toLocaleString("en-IN")}</td>
                    <td className="px-4 py-2.5">{f.dueDate}</td>
                    <td className="px-4 py-2.5">
                      <Badge variant={STATUS_VARIANT[f.status] ?? "default"} className="capitalize">
                        {f.status}
                      </Badge>
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      {f.pending > 0 ? (
                        <Button size="sm" disabled={payingFeeId === f.id} onClick={() => startPayment(f)} className="gap-1.5">
                          {payingFeeId === f.id ? <Loader2 className="size-3.5 animate-spin" /> : <CreditCard className="size-3.5" />}
                          Pay Now
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={resettingId === f.id}
                          onClick={() => resetFee(f)}
                          className="gap-1.5"
                          title="Demo helper: mark this fee unpaid again"
                        >
                          {resettingId === f.id ? <Loader2 className="size-3.5 animate-spin" /> : <RotateCcw className="size-3.5" />}
                          Reset (demo)
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <Dialog open={!!demoOrder} onOpenChange={(open) => !open && setDemoOrder(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldCheck className="size-4 text-accent" /> Payment gateway - demo mode
            </DialogTitle>
            <DialogDescription>
              Razorpay live keys aren&apos;t configured yet (see <code>.env.example</code>). This simulates a successful payment
              so the fee lifecycle can still be demoed end to end - the real Razorpay Checkout opens automatically once
              <code> RAZORPAY_KEY_ID</code>/<code>RAZORPAY_KEY_SECRET</code> are set.
            </DialogDescription>
          </DialogHeader>
          {demoOrder && (
            <div className="rounded-lg border border-border bg-muted/30 p-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground capitalize">{demoOrder.fee.feeType} fee</span>
                <span className="font-medium">₹{demoOrder.fee.pending.toLocaleString("en-IN")}</span>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button onClick={confirmDemoPayment} disabled={confirming} className="gap-1.5">
              {confirming && <Loader2 className="size-3.5 animate-spin" />}
              Simulate successful payment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ReceiptsTab() {
  const { data, loading, error, reload } = useApiGet<{ payments: PaymentReceipt[] }>("/api/payments/history");
  const [printing, setPrinting] = useState<PaymentReceipt | null>(null);

  if (loading) return <LoadingBlock rows={3} />;
  if (error) return <ErrorBlock message={error} onRetry={reload} />;
  if (!data) return null;
  if (data.payments.length === 0) return <EmptyState icon={Receipt} title="No payments on file yet" />;

  return (
    <div className="space-y-3">
      {data.payments.map((p) => (
        <div key={p.id} className="card-surface flex items-center justify-between gap-3 p-3.5 text-sm">
          <div>
            <p className="font-medium capitalize">
              {p.feeType} fee · {p.academicYear} Sem {p.semester}
            </p>
            <p className="text-xs text-muted-foreground">
              {new Date(p.paidAt).toLocaleDateString("en-IN")} · {p.method} · Ref {p.transactionRef}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-3">
            <span className="font-medium">₹{p.amount.toLocaleString("en-IN")}</span>
            <Button size="sm" variant="outline" onClick={() => setPrinting(p)} className="gap-1.5">
              <Receipt className="size-3.5" /> Receipt
            </Button>
          </div>
        </div>
      ))}

      <Dialog open={!!printing} onOpenChange={(open) => !open && setPrinting(null)}>
        <DialogContent className="print:shadow-none">
          <DialogHeader>
            <DialogTitle>Payment Receipt</DialogTitle>
            <DialogDescription>Central Institute of Technology</DialogDescription>
          </DialogHeader>
          {printing && (
            <div className="space-y-2 rounded-lg border border-border p-4 text-sm">
              <Row label="Receipt No." value={printing.transactionRef} />
              <Row label="Date" value={new Date(printing.paidAt).toLocaleString("en-IN")} />
              <Row label="Fee type" value={`${printing.feeType} (${printing.academicYear}, Sem ${printing.semester})`} />
              <Row label="Payment method" value={printing.method} />
              <Row label="Status" value={printing.status} />
              <div className="mt-2 flex justify-between border-t border-border pt-2 text-base font-semibold">
                <span>Amount paid</span>
                <span>₹{printing.amount.toLocaleString("en-IN")}</span>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button onClick={() => window.print()} className="gap-1.5 print:hidden">
              <Printer className="size-3.5" /> Print
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-muted-foreground capitalize">{label}</span>
      <span className="font-medium capitalize">{value}</span>
    </div>
  );
}
