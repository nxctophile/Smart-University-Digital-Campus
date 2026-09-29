import { CSVAdapter } from "./csv-adapter";
import { ExcelAdapter } from "./excel-adapter";
import { JSONAdapter } from "./json-adapter";
import { PostgreSQLAdapter, MySQLAdapter, SQLServerAdapter, OracleAdapter, APIAdapter } from "./future-adapters";
import type { ImporterAdapter } from "./types";

export * from "./types";

export const ADAPTERS: Record<string, ImporterAdapter> = {
  csv: CSVAdapter,
  xlsx: ExcelAdapter,
  xls: ExcelAdapter,
  json: JSONAdapter,
  postgresql: PostgreSQLAdapter,
  mysql: MySQLAdapter,
  sqlserver: SQLServerAdapter,
  oracle: OracleAdapter,
  api: APIAdapter,
};

export function adapterForFilename(filename: string): ImporterAdapter {
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";
  const adapter = ADAPTERS[ext];
  if (!adapter) throw new Error(`No importer adapter registered for .${ext} files.`);
  return adapter;
}
