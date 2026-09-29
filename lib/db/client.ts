import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import path from "node:path";
import * as schema from "./schema";

const DB_PATH = process.env.CAMPUS_DB_PATH ?? path.join(process.cwd(), "data", "campus.db");

declare global {
  var __campusSqlite: Database.Database | undefined;
}

const sqlite = globalThis.__campusSqlite ?? new Database(DB_PATH);
sqlite.pragma("journal_mode = WAL");
sqlite.pragma("foreign_keys = ON");

if (process.env.NODE_ENV !== "production") {
  globalThis.__campusSqlite = sqlite;
}

export const db = drizzle(sqlite, { schema });
export { sqlite };
