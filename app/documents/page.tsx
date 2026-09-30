"use client";

import { useState } from "react";
import { FileText, ShieldCheck, Download, Eye, Plus, Loader2 } from "lucide-react";
import { useApiGet } from "@/lib/client/use-api";
import { apiMutate } from "@/lib/client/api";
import { PageHeader } from "@/components/common/page-header";
import { LoadingBlock, ErrorBlock } from "@/components/common/state-blocks";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import type { DocsData, CertificateType } from "@/lib/api-types";

type Certificate = DocsData["certificates"][number];

const STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive"> = {
  ready: "secondary",
  requested: "default",
  processing: "default",
  rejected: "destructive",
};

function downloadCertificate(cert: Certificate) {
  const content = `CENTRAL INSTITUTE OF TECHNOLOGY\n${"=".repeat(40)}\n\n${cert.type.toUpperCase()} CERTIFICATE\n\nVerification code: ${cert.verificationCode}\nIssued: ${cert.issuedAt}\nPurpose: ${cert.purpose ?? "—"}\n\nThis is a prototype-generated document for demonstration purposes.\n`;
  const blob = new Blob([content], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${cert.type}-certificate-${cert.verificationCode}.txt`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function DocumentsPage() {
  const { data, loading, error, reload } = useApiGet<DocsData>("/api/documents");
  const [previewCert, setPreviewCert] = useState<Certificate | null>(null);
  const [requestOpen, setRequestOpen] = useState(false);
  const [certType, setCertType] = useState<CertificateType>("bonafide");
  const [purpose, setPurpose] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleRequest() {
    setSubmitting(true);
    try {
      const result = await apiMutate<{ success: boolean; certificate: Certificate | null }>("/api/certificates", {
        method: "POST",
        body: { type: certType, purpose: purpose || "General purpose" },
        offlineCapable: true,
        queueLabel: `${certType} certificate request`,
      });
      if ("queued" in result && result.queued) {
        toast.success("Saved locally — will generate once you're back online.");
      } else if (result.success) {
        toast.success("Certificate generated.");
      } else {
        toast.error("Certificate could not be generated — check eligibility.");
      }
      setRequestOpen(false);
      setPurpose("");
      reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Request failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="Documents"
        description="View, download, and request official documents and certificates."
        action={
          <Dialog open={requestOpen} onOpenChange={setRequestOpen} disablePointerDismissal>
            <DialogTrigger render={<Button size="sm" className="gap-1.5" />}>
              <Plus className="size-3.5" /> Request certificate
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Request a certificate</DialogTitle>
                <DialogDescription>We&apos;ll verify eligibility automatically and generate it instantly.</DialogDescription>
              </DialogHeader>
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label>Certificate type</Label>
                  <Select
                    items={{ bonafide: "Bonafide", enrollment: "Enrollment", character: "Character", transfer: "Transfer" }}
                    value={certType}
                    onValueChange={(v) => setCertType(v as CertificateType)}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="bonafide">Bonafide</SelectItem>
                      <SelectItem value="enrollment">Enrollment</SelectItem>
                      <SelectItem value="character">Character</SelectItem>
                      <SelectItem value="transfer">Transfer</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Purpose</Label>
                  <Input value={purpose} onChange={(e) => setPurpose(e.target.value)} placeholder="e.g. Bank account opening" />
                </div>
              </div>
              <DialogFooter>
                <Button onClick={handleRequest} disabled={submitting} className="gap-1.5">
                  {submitting && <Loader2 className="size-3.5 animate-spin" />}
                  Generate certificate
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        }
      />

      {loading && <LoadingBlock rows={4} />}
      {error && <ErrorBlock message={error} onRetry={reload} />}

      {data && (
        <div className="space-y-8">
          <section>
            <h2 className="mb-3 text-sm font-medium text-muted-foreground">Documents</h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {data.documents.map((d) => (
                <div key={d.id} className="flex items-start gap-3 card-surface p-3.5">
                  <FileText className="mt-0.5 size-4 text-muted-foreground" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">{d.title}</p>
                    <p className="text-xs text-muted-foreground">Issued {d.issuedAt}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section>
            <h2 className="mb-3 text-sm font-medium text-muted-foreground">Certificates</h2>
            {data.certificates.length === 0 ? (
              <p className="text-sm text-muted-foreground">No certificates issued yet — request one above.</p>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {data.certificates.map((c) => (
                  <div key={c.id} className="card-surface p-3.5">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-start gap-2">
                        <ShieldCheck className="mt-0.5 size-4 text-accent" />
                        <div>
                          <p className="text-sm font-medium capitalize">{c.type} Certificate</p>
                          <p className="text-xs text-muted-foreground">Requested {c.requestedAt}</p>
                        </div>
                      </div>
                      <Badge variant={STATUS_VARIANT[c.status] ?? "default"} className="capitalize">
                        {c.status}
                      </Badge>
                    </div>
                    {c.status === "ready" && (
                      <div className="mt-3 flex gap-2">
                        <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setPreviewCert(c)}>
                          <Eye className="size-3.5" /> View
                        </Button>
                        <Button size="sm" variant="outline" className="gap-1.5" onClick={() => downloadCertificate(c)}>
                          <Download className="size-3.5" /> Download
                        </Button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      )}

      <Dialog open={!!previewCert} onOpenChange={(open) => !open && setPreviewCert(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="capitalize">{previewCert?.type} Certificate</DialogTitle>
          </DialogHeader>
          {previewCert && (
            <div className="rounded-lg border border-border bg-background p-6 text-sm leading-relaxed">
              <p className="text-center text-xs uppercase tracking-widest text-muted-foreground">Central Institute of Technology</p>
              <p className="mt-4 text-center text-base font-semibold uppercase">{previewCert.type} Certificate</p>
              <p className="mt-4">
                This is to certify that the student is a bonafide member of this institution, currently enrolled and in good
                standing, for the purpose of: <span className="font-medium">{previewCert.purpose}</span>.
              </p>
              <div className="mt-6 flex justify-between text-xs text-muted-foreground">
                <span>Verification: {previewCert.verificationCode}</span>
                <span>Issued: {previewCert.issuedAt}</span>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
