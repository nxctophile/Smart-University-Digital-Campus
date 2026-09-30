"use client";

import { useRef, useState } from "react";
import { Lock, Upload, Trash2, Loader2, FileText, Eye } from "lucide-react";
import { PageHeader } from "@/components/common/page-header";
import { LoadingBlock, ErrorBlock, EmptyState } from "@/components/common/state-blocks";
import { Button, buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useApiGet } from "@/lib/client/use-api";
import { apiMutate } from "@/lib/client/api";
import { apiUpload } from "@/lib/client/upload";
import { toast } from "sonner";
import type { LockerCategory, LockerDocument } from "@/lib/api-types";

const CATEGORY_LABEL: Record<LockerCategory, string> = {
  photo: "Photograph",
  signature: "Signature",
  age_proof: "Age proof (Aadhaar/DL)",
  address_proof: "Address proof",
  marksheet: "Marksheet",
  certificate: "Certificate",
  other: "Other",
};

export default function LockerPage() {
  const { data, loading, error, reload } = useApiGet<{ documents: LockerDocument[] }>("/api/locker");
  const [category, setCategory] = useState<LockerCategory>("other");
  const [title, setTitle] = useState("");
  const [uploading, setUploading] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function upload() {
    const file = fileRef.current?.files?.[0];
    if (!file) {
      toast.error("Choose a file first.");
      return;
    }
    setUploading(true);
    try {
      await apiUpload("/api/locker", { category, title: title || file.name }, file);
      toast.success("Document added to your locker.");
      setTitle("");
      if (fileRef.current) fileRef.current.value = "";
      reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  async function remove(id: number) {
    setDeletingId(id);
    try {
      await apiMutate(`/api/locker/${id}`, { method: "DELETE" });
      toast.success("Document removed.");
      reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to remove");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Digital Locker" description="Store your identity, address, and academic documents securely in one place." />

      <section className="card-surface space-y-3 p-4">
        <h2 className="text-sm font-medium">Add a document</h2>
        <div className="grid gap-3 sm:grid-cols-[180px_1fr_auto]">
          <div className="space-y-1.5">
            <Label>Category</Label>
            <Select items={CATEGORY_LABEL} value={category} onValueChange={(v) => v && setCategory(v as LockerCategory)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(CATEGORY_LABEL).map(([key, label]) => (
                  <SelectItem key={key} value={key}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Title (optional)</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Aadhaar card" />
          </div>
          <div className="space-y-1.5">
            <Label>File</Label>
            <input ref={fileRef} type="file" className="block text-xs file:mr-2 file:rounded-md file:border-0 file:bg-secondary file:px-2.5 file:py-1.5 file:text-xs file:font-medium" />
          </div>
        </div>
        <Button onClick={upload} disabled={uploading} className="gap-1.5">
          {uploading ? <Loader2 className="size-3.5 animate-spin" /> : <Upload className="size-3.5" />}
          Upload
        </Button>
      </section>

      {loading && <LoadingBlock rows={3} />}
      {error && <ErrorBlock message={error} onRetry={reload} />}
      {data && data.documents.length === 0 && <EmptyState icon={Lock} title="Your locker is empty" description="Uploaded documents will appear here." />}

      {data && data.documents.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {data.documents.map((doc) => (
            <div key={doc.id} className="card-surface flex flex-col gap-2 p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <FileText className="size-4 shrink-0 text-muted-foreground" />
                  <p className="truncate text-sm font-medium">{doc.title}</p>
                </div>
                <Badge variant="secondary" className="shrink-0 capitalize">
                  {CATEGORY_LABEL[doc.category] ?? doc.category}
                </Badge>
              </div>
              <p className="truncate text-xs text-muted-foreground">{doc.fileName}</p>
              <p className="text-[11px] text-muted-foreground">Uploaded {new Date(doc.uploadedAt).toLocaleDateString("en-IN")}</p>
              <div className="mt-auto flex gap-2 pt-2">
                <a
                  href={`/api/locker/${doc.id}/file`}
                  target="_blank"
                  rel="noreferrer"
                  className={buttonVariants({ size: "sm", variant: "outline", className: "flex-1 gap-1.5" })}
                >
                  <Eye className="size-3.5" /> View
                </a>
                <Button size="sm" variant="outline" disabled={deletingId === doc.id} onClick={() => remove(doc.id)} className="gap-1.5 text-destructive hover:text-destructive">
                  {deletingId === doc.id ? <Loader2 className="size-3.5 animate-spin" /> : <Trash2 className="size-3.5" />}
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
