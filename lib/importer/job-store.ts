import type { ParsedRow } from "./adapters/types";

export type ImportJob = {
  id: string;
  fileName: string;
  sourceFormat: string;
  columns: string[];
  rows: ParsedRow[];
  createdAt: string;
};

// In-memory for the prototype: fine for a single long-lived `next dev` /
// `next start` process. A production build would persist parsed rows in
// object storage keyed by job id instead.
const jobs = new Map<string, ImportJob>();

export function createJob(fileName: string, sourceFormat: string, columns: string[], rows: ParsedRow[]): ImportJob {
  const id = `job-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  const job: ImportJob = { id, fileName, sourceFormat, columns, rows, createdAt: new Date().toISOString() };
  jobs.set(id, job);
  return job;
}

export function getJob(id: string): ImportJob | undefined {
  return jobs.get(id);
}
