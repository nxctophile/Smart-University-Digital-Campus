import * as XLSX from "xlsx";
import type { ImporterAdapter, ParsedFile } from "./types";

export const ExcelAdapter: ImporterAdapter = {
  format: "xlsx",
  async parse(buffer: Buffer): Promise<ParsedFile> {
    const workbook = XLSX.read(buffer, { type: "buffer" });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
    const columns = rows.length ? Object.keys(rows[0]) : [];
    const clean = rows.map((row) => {
      const out: Record<string, string> = {};
      for (const col of columns) out[col] = String(row[col] ?? "").trim();
      return out;
    });
    return { columns, rows: clean };
  },
};
