"use client";

import { useState } from "react";
import { LifeBuoy, Plus, Loader2 } from "lucide-react";
import { useApiGet } from "@/lib/client/use-api";
import { apiMutate } from "@/lib/client/api";
import { PageHeader } from "@/components/common/page-header";
import { LoadingBlock, ErrorBlock, EmptyState } from "@/components/common/state-blocks";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import type { HelpdeskTicket as Ticket, TicketCategory } from "@/lib/api-types";

const STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive"> = {
  open: "default",
  in_progress: "default",
  resolved: "secondary",
  closed: "secondary",
};

export default function HelpdeskPage() {
  const { data, loading, error, reload } = useApiGet<{ tickets: Ticket[] }>("/api/helpdesk/tickets");
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState<TicketCategory>("hostel");
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit() {
    if (!subject.trim() || !description.trim()) return;
    setSubmitting(true);
    try {
      const result = await apiMutate<{ ticket?: Ticket }>("/api/helpdesk/tickets", {
        method: "POST",
        body: { category, subject, description },
        offlineCapable: true,
        queueLabel: `Helpdesk ticket: ${subject}`,
      });
      if ("queued" in result && result.queued) {
        toast.success("Saved locally — waiting for network.");
      } else {
        toast.success("Ticket submitted.");
      }
      setOpen(false);
      setSubject("");
      setDescription("");
      reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create ticket");
    } finally {
      setSubmitting(false);
    }
  }

  const tickets = data?.tickets ?? [];

  return (
    <div>
      <PageHeader
        title="Helpdesk"
        description="Raise and track support requests across academics, hostel, transport, fees, and IT."
        action={
          <Dialog open={open} onOpenChange={setOpen} disablePointerDismissal>
            <DialogTrigger render={<Button size="sm" className="gap-1.5" />}>
              <Plus className="size-3.5" /> New ticket
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Raise a ticket</DialogTitle>
                <DialogDescription>Works offline — it&apos;ll sync automatically once you&apos;re back online.</DialogDescription>
              </DialogHeader>
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label>Category</Label>
                  <Select
                    items={{ academic: "Academic", hostel: "Hostel", transport: "Transport", fees: "Fees", it: "IT", general: "General" }}
                    value={category}
                    onValueChange={(v) => setCategory(v as TicketCategory)}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="academic">Academic</SelectItem>
                      <SelectItem value="hostel">Hostel</SelectItem>
                      <SelectItem value="transport">Transport</SelectItem>
                      <SelectItem value="fees">Fees</SelectItem>
                      <SelectItem value="it">IT</SelectItem>
                      <SelectItem value="general">General</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Subject</Label>
                  <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Short summary" />
                </div>
                <div className="space-y-1.5">
                  <Label>Description</Label>
                  <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={4} placeholder="Describe the issue" />
                </div>
              </div>
              <DialogFooter>
                <Button onClick={handleSubmit} disabled={submitting} className="gap-1.5">
                  {submitting && <Loader2 className="size-3.5 animate-spin" />}
                  Submit ticket
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        }
      />

      {loading && <LoadingBlock rows={4} />}
      {error && <ErrorBlock message={error} onRetry={reload} />}
      {data && tickets.length === 0 && <EmptyState icon={LifeBuoy} title="No tickets yet" description="Raise one above, or ask the AI to file it for you." />}

      {tickets.length > 0 && (
        <div className="space-y-2.5">
          {tickets.map((t) => (
            <div key={t.id} className="card-surface p-3.5">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-medium">{t.subject}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {t.ticketNumber} · <span className="capitalize">{t.category}</span> · {new Date(t.createdAt).toLocaleDateString("en-IN")}
                  </p>
                </div>
                <Badge variant={STATUS_VARIANT[t.status] ?? "default"} className="shrink-0 capitalize">
                  {t.status.replace("_", " ")}
                </Badge>
              </div>
              <p className="mt-2 text-sm text-muted-foreground">{t.description}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
