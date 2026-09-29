import type { ImporterAdapter, ParsedFile } from "./types";

export const JSONAdapter: ImporterAdapter = {
  format: "json",
  async parse(buffer: Buffer): Promise<ParsedFile> {
    const parsed = JSON.parse(buffer.toString("utf-8"));
    const records: Record<string, unknown>[] = Array.isArray(parsed) ? parsed : (parsed.records ?? parsed.data ?? []);
    const columnSet = new Set<string>();
    for (const record of records) Object.keys(record).forEach((k) => columnSet.add(k));
    const columns = Array.from(columnSet);
    const rows = records.map((record) => {
      const out: Record<string, string> = {};
      for (const col of columns) out[col] = String(record[col] ?? "").trim();
      return out;
    });
    return { columns, rows };
  },
};
