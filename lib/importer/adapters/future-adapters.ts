import type { ImporterAdapter } from "./types";

/**
 * Not implemented in the prototype - present to show the adapter interface
 * is genuinely extensible to live systems, not just flat files. A
 * production build would implement `parse` with a real driver connection
 * (pg / mysql2 / fetch) and stream rows through the same mapping and
 * validation pipeline the file adapters use.
 */
function notImplemented(name: string): ImporterAdapter {
  return {
    format: name,
    async parse() {
      throw new Error(`${name} connector is architected but not enabled in this prototype.`);
    },
  };
}

export const PostgreSQLAdapter = notImplemented("postgresql");
export const MySQLAdapter = notImplemented("mysql");
export const SQLServerAdapter = notImplemented("sqlserver");
export const OracleAdapter = notImplemented("oracle");
export const APIAdapter = notImplemented("api");
