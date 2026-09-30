"use client";

import { useRef, useState } from "react";
import { UploadCloud, FileSpreadsheet, CheckCircle2, AlertTriangle, Loader2, ArrowRight } from "lucide-react";
import { PageHeader } from "@/components/common/page-header";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { apiPost } from "@/lib/client/api";
import { toast } from "sonner";
import type { FieldSuggestion, CanonicalField } from "@/lib/importer/mapping";
import type { ImportPreview } from "@/lib/api-types";

type UploadResult = {
  jobId: string;
  fileName: string;
  columns: string[];
  rowCount: number;
  mapping: FieldSuggestion[];
  sampleRows: Record<string, string>[];
  fields: CanonicalField[];
};

type Step = "upload" | "map" | "review" | "done";

function confidenceTone(confidence: number) {
  if (confidence >= 0.9) return "text-success";
  if (confidence >= 0.7) return "text-warning";
  return "text-destructive";
}

export default function DataImportPage() {
  const [step, setStep] = useState<Step>("upload");
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<UploadResult | null>(null);
  const [mapping, setMapping] = useState<FieldSuggestion[]>([]);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [validating, setValidating] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ imported: number; reconciled: number; skipped: number; total: number } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function uploadFile(file: File) {
    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/admin/import/upload", { method: "POST", body: form });
      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: "Upload failed" }));
        throw new Error(body.error ?? "Upload failed");
      }
      const data: UploadResult = await res.json();
      setResult(data);
      setMapping(data.mapping);
      setStep("map");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  async function loadSampleFile() {
    setUploading(true);
    try {
      const res = await fetch("/samples/legacy_students.xlsx");
      const blob = await res.blob();
      const file = new File([blob], "legacy_students.xlsx", { type: blob.type });
      await uploadFile(file);
    } catch {
      toast.error("Could not load the sample file");
      setUploading(false);
    }
  }

  function updateMapping(column: string, canonicalKey: string) {
    setMapping((prev) =>
      prev.map((m) => {
        if (m.column !== column) return m;
        const field = result?.fields.find((f) => f.key === canonicalKey);
        return { ...m, canonicalKey: canonicalKey === "__none__" ? null : canonicalKey, canonicalLabel: field?.label ?? null, confidence: 1 };
      }),
    );
  }

  async function runValidation() {
    if (!result) return;
    setValidating(true);
    try {
      const data = await apiPost<ImportPreview>("/api/admin/import/validate", { jobId: result.jobId, mapping });
      setPreview(data);
      setStep("review");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Validation failed");
    } finally {
      setValidating(false);
    }
  }

  async function runImport() {
    if (!result) return;
    setImporting(true);
    try {
      const data = await apiPost<{ imported: number; reconciled: number; skipped: number; total: number }>("/api/admin/import/commit", {
        jobId: result.jobId,
        mapping,
      });
      setImportResult(data);
      setStep("done");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Import failed");
    } finally {
      setImporting(false);
    }
  }

  function reset() {
    setStep("upload");
    setResult(null);
    setMapping([]);
    setPreview(null);
    setImportResult(null);
  }

  return (
    <div>
      <PageHeader
        title="Data Import"
        description="Bring student data in from your existing university system - no need to replace it."
      />

      {step === "upload" && (
        <div className="max-w-xl space-y-4">
          <div
            className="flex flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed border-border bg-card px-6 py-14 text-center"
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              const file = e.dataTransfer.files?.[0];
              if (file) uploadFile(file);
            }}
          >
            <UploadCloud className="size-8 text-muted-foreground" />
            <div>
              <p className="text-sm font-medium">Drop a CSV, XLSX, or JSON file</p>
              <p className="text-xs text-muted-foreground">Exported from your existing student ERP</p>
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
                Choose file
              </Button>
              <Button size="sm" onClick={loadSampleFile} disabled={uploading} className="gap-1.5">
                {uploading ? <Loader2 className="size-3.5 animate-spin" /> : <FileSpreadsheet className="size-3.5" />}
                Use sample legacy file
              </Button>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.xlsx,.xls,.json"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) uploadFile(file);
              }}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Supports CSV, XLSX and JSON today. The connector architecture (see <code>lib/importer/adapters</code>) is built to
            extend to PostgreSQL, MySQL, SQL Server, Oracle and live REST APIs.
          </p>
        </div>
      )}

      {step === "map" && result && (
        <div className="space-y-5">
          <div className="flex items-center gap-2 text-sm">
            <FileSpreadsheet className="size-4 text-muted-foreground" />
            <span className="font-medium">{result.fileName}</span>
            <span className="text-muted-foreground">
              · {result.columns.length} columns detected · {result.rowCount.toLocaleString("en-IN")} rows
            </span>
          </div>

          <div className="overflow-hidden card-surface">
            <table className="w-full text-left text-sm">
              <thead className="bg-muted/50 text-xs font-medium text-muted-foreground">
                <tr>
                  <th className="px-4 py-2 font-medium">Legacy field</th>
                  <th className="px-4 py-2 font-medium">Sample value</th>
                  <th className="px-4 py-2 font-medium">Campus field</th>
                  <th className="px-4 py-2 font-medium">Confidence</th>
                </tr>
              </thead>
              <tbody>
                {mapping.map((m) => (
                  <tr key={m.column} className="border-t border-border transition-colors hover:bg-muted/30">
                    <td className="px-4 py-2.5 font-mono text-xs">{m.column}</td>
                    <td className="px-4 py-2.5 text-muted-foreground">{result.sampleRows[0]?.[m.column] ?? "—"}</td>
                    <td className="px-4 py-2.5">
                      <Select
                        items={{
                          __none__: "Not mapped",
                          ...Object.fromEntries(result.fields.map((f) => [f.key, `${f.label}${f.required ? " *" : ""}`])),
                        }}
                        value={m.canonicalKey ?? "__none__"}
                        onValueChange={(v) => v && updateMapping(m.column, v)}
                      >
                        <SelectTrigger className="h-8 w-56 text-xs">
                          <SelectValue placeholder="Not mapped" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">Not mapped</SelectItem>
                          {result.fields.map((f) => (
                            <SelectItem key={f.key} value={f.key}>
                              {f.label}
                              {f.required ? " *" : ""}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </td>
                    <td className="px-4 py-2.5">
                      {m.canonicalKey ? (
                        <span className={`text-xs font-medium ${confidenceTone(m.confidence)}`}>{Math.round(m.confidence * 100)}% confident</span>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex gap-2">
            <Button variant="outline" onClick={reset}>
              Start over
            </Button>
            <Button onClick={runValidation} disabled={validating} className="gap-1.5">
              {validating && <Loader2 className="size-3.5 animate-spin" />}
              Review mapping <ArrowRight className="size-3.5" />
            </Button>
          </div>
        </div>
      )}

      {step === "review" && preview && result && (
        <div className="max-w-2xl space-y-5">
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg border border-success/40 bg-success/10 p-4">
              <div className="flex items-center gap-2 text-success">
                <CheckCircle2 className="size-4" />
                <p className="text-sm font-medium">{preview.validRows.toLocaleString("en-IN")} rows ready to import</p>
              </div>
              <div className="mt-2 space-y-0.5 text-xs text-muted-foreground">
                {preview.entityCounts.map((e) => (
                  <p key={e.label}>
                    {e.label}: {e.count.toLocaleString("en-IN")}
                  </p>
                ))}
              </div>
            </div>
            {preview.issueRows > 0 && (
              <div className="rounded-lg border border-warning/40 bg-warning/10 p-4">
                <div className="flex items-center gap-2 text-warning">
                  <AlertTriangle className="size-4" />
                  <p className="text-sm font-medium">{preview.issueRows} rows need attention</p>
                </div>
                <ul className="mt-2 space-y-0.5 text-xs text-muted-foreground">
                  {preview.issues.slice(0, 5).map((issue, i) => (
                    <li key={i}>
                      Row {issue.rowIndex + 1}: {issue.message}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setStep("map")}>
              Back to mapping
            </Button>
            <Button onClick={runImport} disabled={importing} className="gap-1.5">
              {importing && <Loader2 className="size-3.5 animate-spin" />}
              Import data
            </Button>
          </div>
        </div>
      )}

      {step === "done" && importResult && (
        <div className="max-w-lg rounded-lg border border-success/40 bg-success/10 p-6 text-center">
          <CheckCircle2 className="mx-auto size-8 text-success" />
          <p className="mt-3 text-lg font-semibold">
            {(importResult.imported + importResult.reconciled).toLocaleString("en-IN")} students successfully imported
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {importResult.imported} new · {importResult.reconciled} reconciled with existing records · {importResult.skipped} skipped
          </p>
          <Button className="mt-4" variant="outline" onClick={reset}>
            Import another file
          </Button>
        </div>
      )}
    </div>
  );
}
