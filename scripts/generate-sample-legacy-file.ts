/**
 * Generates public/samples/legacy_students.xlsx - a deliberately messy
 * "legacy ERP export" used for the Data Import demo. Run with:
 *   npx tsx scripts/generate-sample-legacy-file.ts
 */
import * as XLSX from "xlsx";
import path from "node:path";
import Database from "better-sqlite3";
import { mulberry32, pick, randInt, fullName } from "../lib/db/seed-helpers";

const rand = mulberry32(7);

const PROGRAMMES = [
  { label: "B.Tech - Computer Science", deptCode: "CSE", maxSem: 8 },
  { label: "B.Tech - Electronics & Comm.", deptCode: "ECE", maxSem: 8 },
  { label: "B.Tech - Mechanical", deptCode: "ME", maxSem: 8 },
  { label: "B.Tech - Civil Engg.", deptCode: "CE", maxSem: 8 },
  { label: "MBA", deptCode: "MGMT", maxSem: 4 },
];

function main() {
  const dbPath = path.join(process.cwd(), "data", "campus.db");
  const db = new Database(dbPath, { readonly: true });
  const existingRolls = db.prepare(`SELECT roll_number FROM students ORDER BY RANDOM() LIMIT 12`).all() as { roll_number: string }[];
  db.close();

  const rows: Record<string, string>[] = [];
  let seq = 1;

  for (let i = 0; i < 260; i++) {
    const programme = pick(rand, PROGRAMMES);
    const { first, last, gender } = fullName(rand);
    const sem = randInt(rand, 1, programme.maxSem);
    const dobYear = 2026 - (18 + Math.floor((sem - 1) / 2));
    const studId =
      i < existingRolls.length
        ? existingRolls[i].roll_number // reconciles against an already-seeded student
        : `LEG-${programme.deptCode}-${String(seq++).padStart(5, "0")}`;

    rows.push({
      stu_id: studId,
      stud_name: `${first} ${last}`,
      dob: `${dobYear}-${String(randInt(rand, 1, 12)).padStart(2, "0")}-${String(randInt(rand, 1, 28)).padStart(2, "0")}`,
      gender: gender === "male" ? "M" : "F",
      dept_cd: programme.deptCode,
      course_nm: programme.label,
      sem: String(sem),
      mobile_no: `9${randInt(rand, 100000000, 999999999)}`,
      mail: `${first.toLowerCase()}.${last.toLowerCase()}${i}@legacy-erp.cit.edu.in`,
    });
  }

  // A few intentionally messy rows to make the "needs attention" flow real.
  rows.push({ stu_id: "LEG-XX-00099", stud_name: "Unmapped Programme Student", dob: "2004-05-01", gender: "M", dept_cd: "", course_nm: "Diploma in Something", sem: "2", mobile_no: "9123456780", mail: "unmapped@legacy-erp.cit.edu.in" });
  rows.push({ stu_id: "", stud_name: "Missing Id Student", dob: "2004-05-01", gender: "F", dept_cd: "CSE", course_nm: "B.Tech - Computer Science", sem: "3", mobile_no: "9123456781", mail: "missingid@legacy-erp.cit.edu.in" });

  const sheet = XLSX.utils.json_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, "Students");
  const outPath = path.join(process.cwd(), "public", "samples", "legacy_students.xlsx");
  XLSX.writeFile(workbook, outPath);
  console.log(`Wrote ${rows.length} rows to ${outPath}`);
}

main();
