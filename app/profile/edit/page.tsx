"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, ShieldCheck, Upload, Check, Mail } from "lucide-react";
import { PageHeader } from "@/components/common/page-header";
import { LoadingBlock, ErrorBlock } from "@/components/common/state-blocks";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useApiGet } from "@/lib/client/use-api";
import { apiMutate, apiPost } from "@/lib/client/api";
import { apiUpload } from "@/lib/client/upload";
import { toast } from "sonner";
import type { LockerDocument, ProfileEditCurrent, PendingProfileEditRequest, LockerCategory } from "@/lib/api-types";

const CATEGORY_OPTIONS: Record<string, string> = { sc: "SC", st: "ST", obc: "OBC", gen: "General" };

type EditData = { current: ProfileEditCurrent; pendingRequest: PendingProfileEditRequest | null };

function ProofUpload({ category, label, onUploaded }: { category: LockerCategory; label: string; onUploaded: (doc: LockerDocument) => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploaded, setUploaded] = useState<LockerDocument | null>(null);

  async function handleChange() {
    const file = fileRef.current?.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const result = await apiUpload<{ document: LockerDocument }>("/api/locker", { category, title: label }, file);
      setUploaded(result.document);
      onUploaded(result.document);
      toast.success(`${label} uploaded.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <div className="flex items-center gap-2">
        <input ref={fileRef} type="file" accept="image/*,application/pdf" onChange={handleChange} className="block flex-1 text-xs file:mr-2 file:rounded-md file:border-0 file:bg-secondary file:px-2.5 file:py-1.5 file:text-xs file:font-medium" />
        {uploading && <Loader2 className="size-4 shrink-0 animate-spin text-muted-foreground" />}
        {uploaded && !uploading && <Check className="size-4 shrink-0 text-success" />}
      </div>
    </div>
  );
}

export default function ProfileEditPage() {
  const { data, loading, error, reload } = useApiGet<EditData>("/api/profile/edit");

  const [form, setForm] = useState({ fatherName: "", motherName: "", category: "gen", address: "", pincode: "" });
  const [documentIds, setDocumentIds] = useState<number[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [emailDialogOpen, setEmailDialogOpen] = useState(false);
  const [code, setCode] = useState("");
  const [verifying, setVerifying] = useState(false);

  useEffect(() => {
    if (!data) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- hydrate the form once from the fetched current values, not on every edit
    setForm({
      fatherName: data.current.fatherName ?? "",
      motherName: data.current.motherName ?? "",
      category: data.current.category ?? "gen",
      address: data.current.address ?? "",
      pincode: data.current.pincode ?? "",
    });
  }, [data]);
  const { fatherName, motherName, category, address, pincode } = form;
  const setFatherName = (v: string) => setForm((f) => ({ ...f, fatherName: v }));
  const setMotherName = (v: string) => setForm((f) => ({ ...f, motherName: v }));
  const setCategory = (v: string) => setForm((f) => ({ ...f, category: v }));
  const setAddress = (v: string) => setForm((f) => ({ ...f, address: v }));
  const setPincode = (v: string) => setForm((f) => ({ ...f, pincode: v }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await apiMutate("/api/profile/edit", {
        body: { fatherName, motherName, category, address, pincode, documentIds },
      });
      toast.success("Profile update submitted for review by the Admission Cell.");
      reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to submit");
    } finally {
      setSubmitting(false);
    }
  }

  async function sendCode() {
    setEmailDialogOpen(true);
  }

  async function verifyCode() {
    setVerifying(true);
    try {
      await apiPost("/api/profile/verify-email", { code });
      toast.success("Email verified.");
      setEmailDialogOpen(false);
      setCode("");
      reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Verification failed");
    } finally {
      setVerifying(false);
    }
  }

  if (loading) return <LoadingBlock rows={6} />;
  if (error) return <ErrorBlock message={error} onRetry={reload} />;
  if (!data) return null;

  const pending = data.pendingRequest;

  return (
    <div className="max-w-2xl space-y-6">
      <PageHeader title="Edit Profile" description="Changes are reviewed by the Admission Cell before they take effect." />

      {pending && (
        <div className="card-surface flex items-center gap-3 border-warning/40 bg-warning/10 p-4">
          <ShieldCheck className="size-4 shrink-0 text-warning" />
          <div>
            <p className="text-sm font-medium">A profile update is pending review</p>
            <p className="text-xs text-muted-foreground">Submitted {new Date(pending.submittedAt).toLocaleString("en-IN")} · Status: {pending.status}</p>
          </div>
        </div>
      )}

      <section className="card-surface space-y-3 p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">Email address</p>
            <p className="text-xs text-muted-foreground">{data.current.email}</p>
          </div>
          {data.current.emailVerified ? (
            <Badge variant="secondary" className="gap-1">
              <Check className="size-3" /> Verified
            </Badge>
          ) : (
            <Button size="sm" variant="outline" onClick={sendCode} className="gap-1.5">
              <Mail className="size-3.5" /> Verify email
            </Button>
          )}
        </div>
      </section>

      <form onSubmit={submit} className="card-surface space-y-4 p-4">
        <h2 className="text-sm font-medium">Family & personal details</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Father&apos;s name</Label>
            <Input value={fatherName} onChange={(e) => setFatherName(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Mother&apos;s name</Label>
            <Input value={motherName} onChange={(e) => setMotherName(e.target.value)} />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label>Category</Label>
          <Select items={CATEGORY_OPTIONS} value={category} onValueChange={(v) => v && setCategory(v)}>
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(CATEGORY_OPTIONS).map(([key, label]) => (
                <SelectItem key={key} value={key}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Address</Label>
          <Textarea value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Full residential address" />
        </div>
        <div className="space-y-1.5">
          <Label>Pincode</Label>
          <Input value={pincode} onChange={(e) => setPincode(e.target.value)} maxLength={6} className="w-32" />
        </div>

        <h2 className="pt-2 text-sm font-medium">Supporting documents</h2>
        <p className="text-xs text-muted-foreground">
          Uploaded files are saved to your <a href="/locker" className="text-accent hover:underline">Digital Locker</a> and attached to this request.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <ProofUpload category="photo" label="Photograph" onUploaded={(d) => setDocumentIds((ids) => [...ids, d.id])} />
          <ProofUpload category="signature" label="Signature" onUploaded={(d) => setDocumentIds((ids) => [...ids, d.id])} />
          <ProofUpload category="age_proof" label="Age proof (Aadhaar / DL)" onUploaded={(d) => setDocumentIds((ids) => [...ids, d.id])} />
          <ProofUpload category="address_proof" label="Address proof" onUploaded={(d) => setDocumentIds((ids) => [...ids, d.id])} />
        </div>

        <Button type="submit" disabled={submitting || !!pending} className="gap-1.5">
          {submitting ? <Loader2 className="size-3.5 animate-spin" /> : <Upload className="size-3.5" />}
          {pending ? "Request already pending" : "Submit for review"}
        </Button>
      </form>

      <Dialog open={emailDialogOpen} onOpenChange={setEmailDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Mail className="size-4 text-accent" /> Verify email - demo mode
            </DialogTitle>
            <DialogDescription>
              No SMTP is configured for this prototype, so the verification code is always <strong>000000</strong>. Enter
              it below to simulate a verification email being sent and confirmed.
            </DialogDescription>
          </DialogHeader>
          <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="000000" maxLength={6} />
          <DialogFooter>
            <Button onClick={verifyCode} disabled={verifying} className="gap-1.5">
              {verifying && <Loader2 className="size-3.5 animate-spin" />}
              Verify
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
