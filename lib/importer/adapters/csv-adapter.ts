import Papa from "papaparse";
import type { ImporterAdapter, ParsedFile } from "./types";

export const CSVAdapter: ImporterAdapter = {
  format: "csv",
  async parse(buffer: Buffer): Promise<ParsedFile> {
    const text = buffer.toString("utf-8");
    const result = Papa.parse<Record<string, string>>(text, { header: true, skipEmptyLines: true });
    const columns = result.meta.fields ?? [];
    const rows = result.data.map((row) => {
      const clean: Record<string, string> = {};
      for (const col of columns) clean[col] = String(row[col] ?? "").trim();
      return clean;
    });
    return { columns, rows };
  },
};
