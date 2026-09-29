import { db, sqlite } from "@/lib/db/client";
import { students, importJobs } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { AccessContext, authorize } from "./context";
import { adapterForFilename } from "@/lib/importer/adapters";
import { getJob, createJob } from "@/lib/importer/job-store";
import { inferMapping, CANONICAL_STUDENT_FIELDS, type FieldSuggestion } from "@/lib/importer/mapping";
import type { ParsedRow } from "@/lib/importer/adapters/types";

export async function startImportJob(ctx: AccessContext, fileName: string, buffer: Buffer) {
  await authorize(ctx, "data.import");
  const adapter = adapterForFilename(fileName);
  const { columns, rows } = await adapter.parse(buffer);
  const job = createJob(fileName, adapter.format, columns, rows);
  const mapping = inferMapping(columns);

  db.insert(importJobs)
    .values({
      fileName,
      sourceFormat: adapter.format,
      targetEntity: "students",
      status: "mapped",
      columnMapping: JSON.stringify(mapping),
      rowCount: rows.length,
      importedCount: 0,
    })
    .run();

  return {
    jobId: job.id,
    fileName,
    columns,
    rowCount: rows.length,
    mapping,
    sampleRows: rows.slice(0, 8),
    fields: CANONICAL_STUDENT_FIELDS,
  };
}

type ProgrammeIndex = { id: number; departmentId: number; name: string; keywords: string[] }[];

function buildProgrammeIndex(rows: { id: number; departmentId: number; name: string; code: string; deptCode: string }[]): ProgrammeIndex {
  return rows.map((p) => ({
    id: p.id,
    departmentId: p.departmentId,
    name: p.name,
    keywords: [p.name, p.code, p.deptCode].map((s) => s.toLowerCase()),
  }));
}

function resolveProgramme(index: ProgrammeIndex, raw: string): { id: number; departmentId: number } | null {
  const text = raw.toLowerCase();
  for (const p of index) {
    if (p.keywords.some((k) => k.length > 1 && text.includes(k))) return { id: p.id, departmentId: p.departmentId };
  }
  const WORD_HINTS: [string, string][] = [
    ["computer", "cse"],
    ["mechanical", "me"],
    ["electronic", "ece"],
    ["civil", "ce"],
    ["business", "mgmt"],
    ["management", "mgmt"],
    ["mba", "mgmt"],
  ];
  for (const [word, deptCode] of WORD_HINTS) {
    if (text.includes(word)) {
      const match = index.find((p) => p.keywords.includes(deptCode));
      if (match) return { id: match.id, departmentId: match.departmentId };
    }
  }
  return null;
}

export type ValidationIssue = { rowIndex: number; message: string };
export type ImportPreview = {
  totalRows: number;
  validRows: number;
  issueRows: number;
  issues: ValidationIssue[];
  entityCounts: { label: string; count: number }[];
};

function mapRow(row: ParsedRow, mapping: FieldSuggestion[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const m of mapping) {
    if (m.canonicalKey) out[m.canonicalKey] = row[m.column] ?? "";
  }
  return out;
}

export async function validateImportJob(ctx: AccessContext, jobId: string, mapping: FieldSuggestion[]): Promise<ImportPreview> {
  await authorize(ctx, "data.import");
  const job = getJob(jobId);
  if (!job) throw new Error("Import job not found or expired - re-upload the file.");

  const programmeRows = sqlite
    .prepare(
      `SELECT p.id, p.department_id as departmentId, p.name, p.code, d.code as deptCode FROM programmes p JOIN departments d ON d.id = p.department_id`,
    )
    .all() as { id: number; departmentId: number; name: string; code: string; deptCode: string }[];
  const index = buildProgrammeIndex(programmeRows);

  const issues: ValidationIssue[] = [];
  let validRows = 0;
  const existingRolls = new Set(
    (sqlite.prepare(`SELECT roll_number FROM students`).all() as { roll_number: string }[]).map((r) => r.roll_number),
  );
  let newCount = 0;
  let reconciledCount = 0;

  job.rows.forEach((row, idx) => {
    const mapped = mapRow(row, mapping);
    if (!mapped.studentId) {
      issues.push({ rowIndex: idx, message: "Missing Student ID" });
      return;
    }
    if (!mapped.fullName) {
      issues.push({ rowIndex: idx, message: "Missing Full Name" });
      return;
    }
    if (!mapped.programme || !resolveProgramme(index, mapped.programme)) {
      issues.push({ rowIndex: idx, message: `Unrecognized programme "${mapped.programme || ""}"` });
      return;
    }
    validRows += 1;
    if (existingRolls.has(mapped.studentId)) reconciledCount += 1;
    else newCount += 1;
  });

  return {
    totalRows: job.rows.length,
    validRows,
    issueRows: issues.length,
    issues: issues.slice(0, 25),
    entityCounts: [
      { label: "New students", count: newCount },
      { label: "Existing students reconciled", count: reconciledCount },
    ],
  };
}

export async function commitImportJob(ctx: AccessContext, jobId: string, mapping: FieldSuggestion[]) {
  await authorize(ctx, "data.import");
  const job = getJob(jobId);
  if (!job) throw new Error("Import job not found or expired - re-upload the file.");

  const programmeRows = sqlite
    .prepare(
      `SELECT p.id, p.department_id as departmentId, p.name, p.code, d.code as deptCode FROM programmes p JOIN departments d ON d.id = p.department_id`,
    )
    .all() as { id: number; departmentId: number; name: string; code: string; deptCode: string }[];
  const index = buildProgrammeIndex(programmeRows);
  const universityRow = await db.query.universities.findFirst();
  if (!universityRow) throw new Error("No university seeded.");

  const now = new Date().toISOString();
  let imported = 0;
  let reconciled = 0;
  let skipped = 0;

  for (const row of job.rows) {
    const mapped = mapRow(row, mapping);
    const programme = mapped.programme ? resolveProgramme(index, mapped.programme) : null;
    if (!mapped.studentId || !mapped.fullName || !programme) {
      skipped += 1;
      continue;
    }

    const existing = await db.query.students.findFirst({ where: eq(students.rollNumber, mapped.studentId) });
    const [firstName, ...rest] = mapped.fullName.trim().split(/\s+/);
    const lastName = rest.join(" ") || firstName;

    if (existing) {
      db.update(students)
        .set({ sourceSystem: "legacy-import", sourceTable: job.fileName, sourceId: mapped.studentId, lastSyncedAt: now, updatedAt: now })
        .where(eq(students.id, existing.id))
        .run();
      reconciled += 1;
    } else {
      db.insert(students)
        .values({
          universityId: universityRow.id,
          departmentId: programme.departmentId,
          programmeId: programme.id,
          rollNumber: mapped.studentId,
          firstName: firstName || "Unknown",
          lastName,
          email: mapped.email || `${mapped.studentId}@legacy.cit.edu.in`,
          phone: mapped.phone || "9000000000",
          dob: mapped.dob || "2005-01-01",
          gender: mapped.gender || "unspecified",
          admissionYear: new Date().getFullYear(),
          currentSemester: Number(mapped.semester) > 0 && Number(mapped.semester) <= 8 ? Number(mapped.semester) : 1,
          status: "active",
          sourceSystem: "legacy-import",
          sourceTable: job.fileName,
          sourceId: mapped.studentId,
          lastSyncedAt: now,
        })
        .run();
      imported += 1;
    }
  }

  db.update(importJobs)
    .set({ status: "imported", importedCount: imported + reconciled })
    .where(eq(importJobs.fileName, job.fileName))
    .run();

  return { imported, reconciled, skipped, total: job.rows.length };
}

export async function listImportJobs(ctx: AccessContext) {
  await authorize(ctx, "data.import");
  return db.select().from(importJobs).orderBy(importJobs.createdAt);
}
