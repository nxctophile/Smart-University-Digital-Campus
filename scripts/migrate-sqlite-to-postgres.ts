// One-off: copies the existing demo dataset out of data/campus.db into the
// new Postgres database the Rust backend owns. Run once after `db:seed`,
// then throw away - the Rust backend is the system of record from here on.
//
// Usage: DATABASE_URL=postgres://... npx tsx scripts/migrate-sqlite-to-postgres.ts

import Database from "better-sqlite3";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";

const SQLITE_PATH = process.env.CAMPUS_DB_PATH ?? path.join(process.cwd(), "data", "campus.db");
const DATABASE_URL = process.env.DATABASE_URL ?? "postgres://campus:campus@localhost:5432/campus";

const TABLES_IN_ORDER: { name: string; booleanColumns?: string[] }[] = [
  { name: "universities" },
  { name: "departments" },
  { name: "programmes" },
  { name: "courses" },
  { name: "faculty" },
  { name: "sections" },
  { name: "students" },
  { name: "parents" },
  { name: "employees" },
  { name: "users" },
  { name: "roles", booleanColumns: ["is_system"] },
  { name: "role_permissions" },
  { name: "user_roles" },
  { name: "audit_logs" },
  { name: "legacy_role_mappings" },
  { name: "attendance" },
  { name: "timetable_slots" },
  { name: "exams" },
  { name: "exam_results", booleanColumns: ["graded"] },
  { name: "fees" },
  { name: "payments" },
  { name: "documents" },
  { name: "certificates" },
  { name: "hostels" },
  { name: "rooms" },
  { name: "room_assignments" },
  { name: "transport_routes" },
  { name: "transport_stops" },
  { name: "transport_assignments" },
  { name: "helpdesk_tickets" },
  { name: "ticket_messages" },
  { name: "notifications" },
  { name: "books" },
  { name: "book_loans", booleanColumns: ["fine_paid"] },
  { name: "scholarships" },
  { name: "scholarship_applications", booleanColumns: ["documents_submitted"] },
  { name: "import_jobs" },
];

function sqlLiteral(value: unknown, isBoolean: boolean): string {
  if (value === null || value === undefined) return "NULL";
  if (isBoolean) return value ? "TRUE" : "FALSE";
  if (typeof value === "number") return String(value);
  return `'${String(value).replace(/'/g, "''")}'`;
}

function main() {
  const db = new Database(SQLITE_PATH, { readonly: true });
  const statements: string[] = ["BEGIN;"];

  for (const table of TABLES_IN_ORDER) {
    const rows = db.prepare(`SELECT * FROM ${table.name}`).all() as Record<string, unknown>[];
    if (!rows.length) continue;

    const columns = Object.keys(rows[0]);
    const boolSet = new Set(table.booleanColumns ?? []);
    for (const row of rows) {
      const values = columns.map((c) => sqlLiteral(row[c], boolSet.has(c))).join(", ");
      statements.push(`INSERT INTO ${table.name} (${columns.join(", ")}) VALUES (${values});`);
    }
    if (columns.includes("id")) {
      statements.push(`SELECT setval(pg_get_serial_sequence('${table.name}', 'id'), (SELECT COALESCE(MAX(id), 1) FROM ${table.name}));`);
    }
    console.log(`${table.name}: ${rows.length} rows`);
  }

  statements.push("COMMIT;");

  const dir = mkdtempSync(path.join(tmpdir(), "campus-migrate-"));
  const sqlFile = path.join(dir, "dump.sql");
  writeFileSync(sqlFile, statements.join("\n"));

  const result = spawnSync("psql", [DATABASE_URL, "-f", sqlFile], { stdio: "inherit" });
  if (result.status !== 0) {
    console.error(`psql exited with status ${result.status}`);
    process.exit(result.status ?? 1);
  }
  console.log("Migration complete.");
}

main();
