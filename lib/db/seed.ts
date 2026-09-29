/**
 * Seeds a full demo dataset for "Central Institute of Technology".
 * Run with: npm run db:seed
 */
import { eq } from "drizzle-orm";
import { sqlite, db } from "./client";
import * as schema from "./schema";
import {
  mulberry32,
  pick,
  pickWeighted,
  randInt,
  formatDate,
  addDays,
  fullName,
  AVATAR_COLORS,
} from "./seed-helpers";
import { ROLE_TEMPLATES, GLOBAL_SCOPE_ROLE_KEYS, DEFAULT_LEGACY_ROLE_MAP } from "../rbac/seed-data";

const rand = mulberry32(42);
const TODAY = new Date("2026-09-22T00:00:00");
const PERIODS = ["09:00-10:00", "10:00-11:00", "11:15-12:15", "13:15-14:15", "14:15-15:15"];
const LAB_PERIODS = ["09:00-11:00", "11:15-13:15", "14:15-16:15"];

type DeptDef = {
  code: string;
  name: string;
  programme: { code: string; name: string; degreeLevel: "UG" | "PG"; duration: number };
  theory: { sem: number; code: string; name: string; credits: number }[];
};

const DEPARTMENTS: DeptDef[] = [
  {
    code: "CSE",
    name: "Computer Science",
    programme: { code: "BT-CSE", name: "B.Tech Computer Science Engineering", degreeLevel: "UG", duration: 8 },
    theory: [
      { sem: 1, code: "CS101", name: "Programming Fundamentals", credits: 4 },
      { sem: 1, code: "MA101", name: "Engineering Mathematics I", credits: 4 },
      { sem: 2, code: "CS102", name: "Data Structures", credits: 4 },
      { sem: 2, code: "MA102", name: "Discrete Mathematics", credits: 3 },
      { sem: 3, code: "CS201", name: "Database Management Systems", credits: 4 },
      { sem: 3, code: "CS202", name: "Computer Organization", credits: 3 },
      { sem: 4, code: "CS203", name: "Operating Systems", credits: 4 },
      { sem: 4, code: "CS204", name: "Design and Analysis of Algorithms", credits: 4 },
      { sem: 5, code: "CS301", name: "Computer Networks", credits: 3 },
      { sem: 5, code: "CS302", name: "Software Engineering", credits: 3 },
      { sem: 6, code: "CS303", name: "Machine Learning", credits: 4 },
      { sem: 6, code: "CS304", name: "Web Technologies", credits: 3 },
      { sem: 7, code: "CS401", name: "Artificial Intelligence", credits: 3 },
      { sem: 7, code: "CS402", name: "Cloud Computing", credits: 3 },
      { sem: 8, code: "CS403", name: "Major Project", credits: 6 },
      { sem: 8, code: "CS404", name: "Distributed Systems", credits: 3 },
    ],
  },
  {
    code: "ECE",
    name: "Electronics",
    programme: { code: "BT-ECE", name: "B.Tech Electronics & Communication", degreeLevel: "UG", duration: 8 },
    theory: [
      { sem: 1, code: "EC101", name: "Basic Electronics", credits: 4 },
      { sem: 1, code: "MA101", name: "Engineering Mathematics I", credits: 4 },
      { sem: 2, code: "EC102", name: "Circuit Theory", credits: 4 },
      { sem: 2, code: "EC103", name: "Digital Logic Design", credits: 3 },
      { sem: 3, code: "EC201", name: "Signals and Systems", credits: 4 },
      { sem: 3, code: "EC202", name: "Electronic Devices", credits: 3 },
      { sem: 4, code: "EC203", name: "Analog Communication", credits: 4 },
      { sem: 4, code: "EC204", name: "Microprocessors", credits: 4 },
      { sem: 5, code: "EC301", name: "Digital Communication", credits: 3 },
      { sem: 5, code: "EC302", name: "Control Systems", credits: 3 },
      { sem: 6, code: "EC303", name: "VLSI Design", credits: 4 },
      { sem: 6, code: "EC304", name: "Embedded Systems", credits: 3 },
      { sem: 7, code: "EC401", name: "Wireless Networks", credits: 3 },
      { sem: 7, code: "EC402", name: "Antenna Theory", credits: 3 },
      { sem: 8, code: "EC403", name: "Major Project", credits: 6 },
      { sem: 8, code: "EC404", name: "Optical Communication", credits: 3 },
    ],
  },
  {
    code: "ME",
    name: "Mechanical",
    programme: { code: "BT-ME", name: "B.Tech Mechanical Engineering", degreeLevel: "UG", duration: 8 },
    theory: [
      { sem: 1, code: "ME101", name: "Engineering Mechanics", credits: 4 },
      { sem: 1, code: "MA101", name: "Engineering Mathematics I", credits: 4 },
      { sem: 2, code: "ME102", name: "Thermodynamics", credits: 4 },
      { sem: 2, code: "ME103", name: "Material Science", credits: 3 },
      { sem: 3, code: "ME201", name: "Fluid Mechanics", credits: 4 },
      { sem: 3, code: "ME202", name: "Manufacturing Processes", credits: 3 },
      { sem: 4, code: "ME203", name: "Machine Design I", credits: 4 },
      { sem: 4, code: "ME204", name: "Heat Transfer", credits: 3 },
      { sem: 5, code: "ME301", name: "Dynamics of Machinery", credits: 3 },
      { sem: 5, code: "ME302", name: "CAD/CAM", credits: 3 },
      { sem: 6, code: "ME303", name: "Machine Design II", credits: 4 },
      { sem: 6, code: "ME304", name: "Industrial Engineering", credits: 3 },
      { sem: 7, code: "ME401", name: "Automobile Engineering", credits: 3 },
      { sem: 7, code: "ME402", name: "Refrigeration and AC", credits: 3 },
      { sem: 8, code: "ME403", name: "Major Project", credits: 6 },
      { sem: 8, code: "ME404", name: "Robotics", credits: 3 },
    ],
  },
  {
    code: "CE",
    name: "Civil",
    programme: { code: "BT-CE", name: "B.Tech Civil Engineering", degreeLevel: "UG", duration: 8 },
    theory: [
      { sem: 1, code: "CE101", name: "Engineering Mechanics", credits: 4 },
      { sem: 1, code: "MA101", name: "Engineering Mathematics I", credits: 4 },
      { sem: 2, code: "CE102", name: "Building Materials", credits: 3 },
      { sem: 2, code: "CE103", name: "Surveying", credits: 3 },
      { sem: 3, code: "CE201", name: "Structural Analysis I", credits: 4 },
      { sem: 3, code: "CE202", name: "Fluid Mechanics", credits: 3 },
      { sem: 4, code: "CE203", name: "Geotechnical Engineering", credits: 4 },
      { sem: 4, code: "CE204", name: "Structural Analysis II", credits: 3 },
      { sem: 5, code: "CE301", name: "Concrete Technology", credits: 3 },
      { sem: 5, code: "CE302", name: "Transportation Engineering", credits: 3 },
      { sem: 6, code: "CE303", name: "Steel Structures", credits: 4 },
      { sem: 6, code: "CE304", name: "Environmental Engineering", credits: 3 },
      { sem: 7, code: "CE401", name: "Estimation and Costing", credits: 3 },
      { sem: 7, code: "CE402", name: "Construction Management", credits: 3 },
      { sem: 8, code: "CE403", name: "Major Project", credits: 6 },
      { sem: 8, code: "CE404", name: "Earthquake Engineering", credits: 3 },
    ],
  },
  {
    code: "MGMT",
    name: "Management",
    programme: { code: "MBA", name: "Master of Business Administration", degreeLevel: "PG", duration: 4 },
    theory: [
      { sem: 1, code: "MB101", name: "Principles of Management", credits: 4 },
      { sem: 1, code: "MB102", name: "Managerial Economics", credits: 3 },
      { sem: 2, code: "MB103", name: "Financial Accounting", credits: 4 },
      { sem: 2, code: "MB104", name: "Organizational Behaviour", credits: 3 },
      { sem: 3, code: "MB201", name: "Marketing Management", credits: 4 },
      { sem: 3, code: "MB202", name: "Human Resource Management", credits: 3 },
      { sem: 4, code: "MB203", name: "Strategic Management", credits: 4 },
      { sem: 4, code: "MB204", name: "Business Analytics", credits: 3 },
    ],
  },
];

const STUDENT_COUNTS: Record<string, number> = { CSE: 400, ECE: 300, ME: 300, CE: 250, MGMT: 250 };
const DESIGNATIONS: [string, number][] = [
  ["Professor", 15],
  ["Associate Professor", 30],
  ["Assistant Professor", 55],
];

function main() {
  console.log("Resetting database...");
  for (const table of [
    "audit_logs", "user_roles", "role_permissions", "roles", "legacy_role_mappings",
    "book_loans", "books", "scholarship_applications", "scholarships",
    "ticket_messages", "helpdesk_tickets", "notifications", "import_jobs",
    "transport_assignments", "transport_stops", "transport_routes",
    "room_assignments", "rooms", "hostels",
    "certificates", "documents", "payments", "fees",
    "exam_results", "exams", "timetable_slots", "attendance",
    "sections", "users", "employees", "parents", "faculty", "students",
    "courses", "programmes", "departments", "universities",
  ]) {
    sqlite.exec(`DELETE FROM ${table};`);
    sqlite.exec(`DELETE FROM sqlite_sequence WHERE name='${table}';`);
  }

  const university = insertUniversity();
  const { deptRows, programmeRows, courseRows } = insertAcademicStructure(university.id);
  const facultyRows = insertFaculty(deptRows);
  const sectionRows = insertSections(courseRows, facultyRows);
  const studentRows = insertStudents(deptRows, programmeRows);
  insertTimetable(programmeRows, courseRows, facultyRows, sectionRows);
  insertAttendance(studentRows, courseRows);
  const examRows = insertExams(courseRows);
  insertExamResults(examRows, studentRows, courseRows);
  insertFees(studentRows, programmeRows);
  insertDocumentsAndCertificates(studentRows);
  const hostelCtx = insertHostel(university.id, studentRows);
  const transportCtx = insertTransport(university.id, studentRows);
  insertHelpdesk(studentRows);
  insertNotifications(university.id);
  insertLibrary(studentRows);
  insertScholarships(studentRows, deptRows);

  const roleIds = insertRbacRoles();
  const nonAcademicDepts = insertNonAcademicDepartments(university.id);
  const staffRows = insertCampusStaff(university.id, nonAcademicDepts);
  insertLegacyRoleMappings();
  insertDemoUsers(studentRows, facultyRows, courseRows, sectionRows, hostelCtx, transportCtx, deptRows, roleIds, staffRows);

  console.log(`Seeded ${studentRows.length} students across ${deptRows.length} departments.`);
}

// ---------------------------------------------------------------------------
// RBAC: roles/permissions, non-academic departments, campus staff
// ---------------------------------------------------------------------------

function insertRbacRoles(): Map<string, number> {
  const roleIds = new Map<string, number>();
  for (const template of ROLE_TEMPLATES) {
    const row = db
      .insert(schema.roles)
      .values({ key: template.key, name: template.name, description: template.description, category: template.category, isSystem: true })
      .returning()
      .get();
    roleIds.set(template.key, row.id);
    if (template.permissions.length) {
      db.insert(schema.rolePermissions)
        .values(template.permissions.map((permissionKey) => ({ roleId: row.id, permissionKey })))
        .run();
    }
  }
  return roleIds;
}

function insertLegacyRoleMappings() {
  db.insert(schema.legacyRoleMappings)
    .values(DEFAULT_LEGACY_ROLE_MAP.map((m) => ({ legacyRole: m.legacyRole, mappedRoleKey: m.mappedRoleKey, notes: m.notes ?? null })))
    .run();
}

const NON_ACADEMIC_DEPARTMENTS = [
  { code: "ADM", name: "Admission Cell" },
  { code: "SCHOL", name: "Scholarship Department" },
  { code: "EXAM", name: "Examination Department" },
  { code: "ACCT", name: "Accounts Department" },
  { code: "HR", name: "HR Department" },
  { code: "TNP", name: "Training & Placement" },
  { code: "LIB", name: "Central Library" },
  { code: "MAINT", name: "Maintenance & Welfare" },
  { code: "ITD", name: "IT / Technical Department" },
] as const;

function insertNonAcademicDepartments(universityId: number) {
  const rows: Record<string, typeof schema.departments.$inferSelect> = {};
  for (const d of NON_ACADEMIC_DEPARTMENTS) {
    rows[d.code] = db.insert(schema.departments).values({ universityId, name: d.name, code: d.code }).returning().get();
  }
  return rows;
}

const STAFF_DEFS: { deptCode: string; roleKey: string; designation: string }[] = [
  { deptCode: "ADM", roleKey: "admission_officer", designation: "Admission Officer" },
  { deptCode: "SCHOL", roleKey: "scholarship_officer", designation: "Scholarship Officer" },
  { deptCode: "EXAM", roleKey: "examination_officer", designation: "Examination Controller" },
  { deptCode: "ACCT", roleKey: "accounts_officer", designation: "Accounts Officer" },
  { deptCode: "HR", roleKey: "hr_officer", designation: "HR Executive" },
  { deptCode: "TNP", roleKey: "placement_officer", designation: "Placement Officer" },
  { deptCode: "LIB", roleKey: "librarian", designation: "Librarian" },
  { deptCode: "MAINT", roleKey: "maintenance_officer", designation: "Maintenance Supervisor" },
  { deptCode: "ITD", roleKey: "it_administrator", designation: "IT Administrator" },
];

/** One realistic employee per department-employee role, so every seeded
 * role in ROLE_TEMPLATES has at least one linked demo login. */
function insertCampusStaff(universityId: number, depts: Record<string, typeof schema.departments.$inferSelect>) {
  const rows: { roleKey: string; employee: typeof schema.employees.$inferSelect }[] = [];
  let seq = 1;
  for (const def of STAFF_DEFS) {
    const dept = depts[def.deptCode];
    const { first, last } = fullName(rand);
    const employee = db
      .insert(schema.employees)
      .values({
        universityId,
        departmentId: dept.id,
        employeeCode: `STF${String(seq++).padStart(4, "0")}`,
        firstName: first,
        lastName: last,
        email: `${first.toLowerCase()}.${last.toLowerCase()}@cit.edu.in`,
        phone: `9${randInt(rand, 100000000, 999999999)}`,
        designation: def.designation,
      })
      .returning()
      .get();
    rows.push({ roleKey: def.roleKey, employee });
  }
  return rows;
}

function insertUniversity() {
  const row = db
    .insert(schema.universities)
    .values({ name: "Central Institute of Technology", code: "CIT", city: "Bhopal", state: "Madhya Pradesh" })
    .returning().get();
  return row;
}

function insertAcademicStructure(universityId: number) {
  const deptRows: (typeof schema.departments.$inferSelect & { code: string })[] = [];
  const programmeRows: (typeof schema.programmes.$inferSelect & { deptCode: string })[] = [];
  const courseRows: (typeof schema.courses.$inferSelect & { deptCode: string })[] = [];

  for (const dept of DEPARTMENTS) {
    const deptRow = db
      .insert(schema.departments)
      .values({ universityId, name: dept.name, code: dept.code })
      .returning().get();
    deptRows.push({ ...deptRow, code: dept.code });

    const programmeRow = db
      .insert(schema.programmes)
      .values({
        departmentId: deptRow.id,
        name: dept.programme.name,
        code: dept.programme.code,
        degreeLevel: dept.programme.degreeLevel,
        durationSemesters: dept.programme.duration,
      })
      .returning().get();
    programmeRows.push({ ...programmeRow, deptCode: dept.code });

    const isEngineering = dept.code !== "MGMT";
    const allCourses = [...dept.theory];
    if (isEngineering) {
      for (const c of dept.theory) {
        if (c.sem <= 6 && !c.name.includes("Major Project")) {
          allCourses.push({
            sem: c.sem,
            code: `${c.code}L`,
            name: `${c.name.replace(/ I$| II$/, "")} Lab`,
            credits: 1,
          });
        }
      }
    }

    for (const c of allCourses) {
      const courseRow = db
        .insert(schema.courses)
        .values({ programmeId: programmeRow.id, code: c.code, name: c.name, credits: c.credits, semester: c.sem })
        .returning().get();
      courseRows.push({ ...courseRow, deptCode: dept.code });
    }
  }
  return { deptRows, programmeRows, courseRows };
}

function insertFaculty(deptRows: (typeof schema.departments.$inferSelect & { code: string })[]) {
  const rows: (typeof schema.faculty.$inferSelect & { deptCode: string })[] = [];
  let empSeq = 1;
  for (const dept of deptRows) {
    const count = dept.code === "CSE" ? 18 : dept.code === "MGMT" ? 10 : 14;
    for (let i = 0; i < count; i++) {
      const { first, last } = fullName(rand);
      const designation = pickWeighted(rand, DESIGNATIONS);
      const employeeId = `EMP${String(empSeq++).padStart(4, "0")}`;
      const row = db
        .insert(schema.faculty)
        .values({
          universityId: dept.universityId,
          departmentId: dept.id,
          employeeId,
          firstName: first,
          lastName: last,
          email: `${first.toLowerCase()}.${last.toLowerCase()}@cit.edu.in`,
          phone: `9${randInt(rand, 100000000, 999999999)}`,
          designation,
        })
        .returning().get();
      rows.push({ ...row, deptCode: dept.code });
    }
  }
  return rows;
}

function insertSections(
  courseRows: (typeof schema.courses.$inferSelect & { deptCode: string })[],
  facultyRows: (typeof schema.faculty.$inferSelect & { deptCode: string })[],
) {
  const rows: (typeof schema.sections.$inferSelect)[] = [];
  for (const course of courseRows) {
    const deptFaculty = facultyRows.filter((f) => f.deptCode === course.deptCode);
    const row = db
      .insert(schema.sections)
      .values({
        courseId: course.id,
        facultyId: pick(rand, deptFaculty).id,
        name: "A",
        academicYear: "2026-27",
      })
      .returning().get();
    rows.push(row);
  }
  return rows;
}

function insertStudents(
  deptRows: (typeof schema.departments.$inferSelect & { code: string })[],
  programmeRows: (typeof schema.programmes.$inferSelect & { deptCode: string })[],
) {
  const rows: (typeof schema.students.$inferSelect & { deptCode: string; baseAttendanceRate: number })[] = [];
  for (const dept of deptRows) {
    const programme = programmeRows.find((p) => p.deptCode === dept.code)!;
    const total = STUDENT_COUNTS[dept.code];
    const maxSem = programme.durationSemesters;
    let rollSeq = 1;
    for (let i = 0; i < total; i++) {
      // Weight toward earlier semesters (natural cohort growth + some attrition).
      const semWeights: [number, number][] = Array.from({ length: maxSem }, (_, idx) => [idx + 1, maxSem - idx * 0.5]);
      const currentSemester = pickWeighted(rand, semWeights);
      const yearsIn = Math.floor((currentSemester - 1) / 2);
      const admissionYear = 2026 - yearsIn;
      const { first, last, gender } = fullName(rand);
      const rollNumber = `${dept.code}${admissionYear}${String(rollSeq++).padStart(3, "0")}`;
      const ageYears = 18 + yearsIn + (programme.degreeLevel === "PG" ? 4 : 0);
      const dob = formatDate(new Date(2026 - ageYears, randInt(rand, 0, 11), randInt(rand, 1, 28)));
      const baseAttendanceRate = pickWeighted(rand, [
        [randInt(rand, 55, 70) / 100, 15],
        [randInt(rand, 75, 90) / 100, 55],
        [randInt(rand, 90, 98) / 100, 30],
      ]);

      const row = db
        .insert(schema.students)
        .values({
          universityId: dept.universityId,
          departmentId: dept.id,
          programmeId: programme.id,
          rollNumber,
          firstName: first,
          lastName: last,
          email: `${first.toLowerCase()}.${last.toLowerCase()}${rollSeq}@cit.edu.in`,
          phone: `9${randInt(rand, 100000000, 999999999)}`,
          dob,
          gender,
          admissionYear,
          currentSemester,
          status: "active",
          address: `${randInt(rand, 1, 200)}, ${pick(rand, ["Arera Colony", "Kolar Road", "MP Nagar", "Bairagarh", "Habibganj", "Awadhpuri"])}, Bhopal, MP`,
          guardianName: `${pick(rand, ["Mr.", "Mrs."])} ${last}`,
          guardianPhone: `9${randInt(rand, 100000000, 999999999)}`,
          avatarColor: pick(rand, AVATAR_COLORS),
          sourceSystem: "seed",
          sourceTable: "students",
          sourceId: rollNumber,
          lastSyncedAt: formatDate(TODAY),
        })
        .returning().get();
      rows.push({ ...row, deptCode: dept.code, baseAttendanceRate });
    }
  }
  return rows;
}

function insertTimetable(
  programmeRows: (typeof schema.programmes.$inferSelect & { deptCode: string })[],
  courseRows: (typeof schema.courses.$inferSelect & { deptCode: string })[],
  facultyRows: (typeof schema.faculty.$inferSelect & { deptCode: string })[],
  sectionRows: (typeof schema.sections.$inferSelect)[],
) {
  const insert = db.insert(schema.timetableSlots);
  const batch: (typeof schema.timetableSlots.$inferInsert)[] = [];

  for (const programme of programmeRows) {
    const maxSem = programme.durationSemesters;
    for (let sem = 1; sem <= maxSem; sem++) {
      const semCourses = courseRows.filter((c) => c.programmeId === programme.id && c.semester === sem);
      semCourses.forEach((course, idx) => {
        const section = sectionRows.find((s) => s.courseId === course.id)!;
        const isLab = course.code.endsWith("L");
        const roomPrefix = programme.deptCode === "MGMT" ? "M" : programme.deptCode[0];
        const room = `${roomPrefix}-${100 + ((course.id * 7) % 50) + sem}`;

        if (isLab) {
          const day = (idx + 2) % 5;
          const [start, end] = pick(rand, LAB_PERIODS).split("-");
          batch.push({
            sectionId: section.id,
            courseId: course.id,
            facultyId: section.facultyId,
            dayOfWeek: day,
            startTime: start,
            endTime: end,
            room,
            programmeId: programme.id,
            semester: sem,
          });
        } else {
          // Force Database Management Systems onto a Mon/Wed/Fri 10-11am slot
          // in room B-204 so the demo ("can I skip tomorrow's DBMS class")
          // and the student dashboard ("Next class") line up.
          const isDbms = course.code === "CS201";
          const days = isDbms ? [0, 2, 4] : idx % 2 === 0 ? [0, 2, 4] : [1, 3];
          const period = isDbms ? "10:00-11:00" : PERIODS[idx % PERIODS.length];
          const [start, end] = period.split("-");
          for (const day of days) {
            batch.push({
              sectionId: section.id,
              courseId: course.id,
              facultyId: section.facultyId,
              dayOfWeek: day,
              startTime: start,
              endTime: end,
              room: isDbms ? "B-204" : room,
              programmeId: programme.id,
              semester: sem,
            });
          }
        }
      });
    }
  }

  const chunk = 500;
  for (let i = 0; i < batch.length; i += chunk) insert.values(batch.slice(i, i + chunk)).run();
}

function weekdaysBack(from: Date, count: number): Date[] {
  const out: Date[] = [];
  const cursor = new Date(from);
  while (out.length < count) {
    cursor.setDate(cursor.getDate() - 1);
    const dow = cursor.getDay();
    if (dow !== 0 && dow !== 6) out.push(new Date(cursor));
  }
  return out.reverse();
}

function insertAttendance(
  studentRows: (typeof schema.students.$inferSelect & { deptCode: string; baseAttendanceRate: number })[],
  courseRows: (typeof schema.courses.$inferSelect & { deptCode: string })[],
) {
  const sessionDates = weekdaysBack(TODAY, 24);
  const insert = db.insert(schema.attendance);
  let batch: (typeof schema.attendance.$inferInsert)[] = [];
  const flush = () => {
    if (batch.length) {
      insert.values(batch).run();
      batch = [];
    }
  };

  for (const student of studentRows) {
    const courses = courseRows.filter((c) => c.programmeId === student.programmeId && c.semester === student.currentSemester);
    for (const course of courses) {
      for (const date of sessionDates) {
        const roll = rand();
        let status: string;
        if (roll < student.baseAttendanceRate) status = "present";
        else if (roll < student.baseAttendanceRate + 0.03) status = "excused";
        else if (roll < student.baseAttendanceRate + 0.06) status = "late";
        else status = "absent";
        batch.push({ studentId: student.id, courseId: course.id, date: formatDate(date), status, markedBy: "faculty" });
        if (batch.length >= 1000) flush();
      }
    }
  }
  flush();
}

function insertExams(courseRows: (typeof schema.courses.$inferSelect & { deptCode: string })[]) {
  const rows: (typeof schema.exams.$inferSelect)[] = [];
  for (const course of courseRows) {
    const isLab = course.code.endsWith("L");
    const pastDate = addDays(TODAY, -randInt(rand, 14, 35));
    const soon = rand() < 0.45;
    const upcomingDate = addDays(TODAY, soon ? randInt(rand, 2, 7) : randInt(rand, 8, 28));

    const past = db
      .insert(schema.exams)
      .values({
        courseId: course.id,
        programmeId: course.programmeId,
        name: `${course.name} - Quiz 1`,
        examType: "quiz",
        date: formatDate(pastDate),
        startTime: "10:00",
        durationMinutes: isLab ? 60 : 45,
        maxMarks: 50,
        semester: course.semester,
      })
      .returning().get();
    rows.push(past);

    const isDbms = course.code === "CS201";
    const upcoming = db
      .insert(schema.exams)
      .values({
        courseId: course.id,
        programmeId: course.programmeId,
        name: isDbms ? "Database Management Systems - Midterm" : `${course.name} - Midterm`,
        examType: "midterm",
        date: isDbms ? "2026-09-28" : formatDate(upcomingDate),
        startTime: "10:00",
        durationMinutes: isLab ? 90 : 90,
        maxMarks: 100,
        semester: course.semester,
      })
      .returning().get();
    rows.push(upcoming);
  }
  return rows;
}

function insertExamResults(
  examRows: (typeof schema.exams.$inferSelect)[],
  studentRows: (typeof schema.students.$inferSelect & { deptCode: string; baseAttendanceRate: number })[],
  courseRows: (typeof schema.courses.$inferSelect & { deptCode: string })[],
) {
  const insert = db.insert(schema.examResults);
  let batch: (typeof schema.examResults.$inferInsert)[] = [];
  const pastExams = examRows.filter((e) => new Date(e.date) < TODAY);

  for (const exam of pastExams) {
    const course = courseRows.find((c) => c.id === exam.courseId)!;
    const students = studentRows.filter((s) => s.programmeId === course.programmeId && s.currentSemester === course.semester);
    for (const student of students) {
      const noise = randInt(rand, -15, 15);
      const pct = Math.min(98, Math.max(20, student.baseAttendanceRate * 100 + noise));
      const marksObtained = Math.round((pct / 100) * exam.maxMarks);
      batch.push({ examId: exam.id, studentId: student.id, marksObtained, graded: true });
      if (batch.length >= 1000) {
        insert.values(batch).run();
        batch = [];
      }
    }
  }
  if (batch.length) insert.values(batch).run();
}

function insertFees(
  studentRows: (typeof schema.students.$inferSelect & { deptCode: string; baseAttendanceRate: number })[],
  programmeRows: (typeof schema.programmes.$inferSelect & { deptCode: string })[],
) {
  for (const student of studentRows) {
    const programme = programmeRows.find((p) => p.id === student.programmeId)!;
    const amount = programme.degreeLevel === "PG" ? 65000 : 45000;
    const outcome = pickWeighted<"paid" | "pending" | "overdue">(rand, [
      ["paid", 55],
      ["pending", 30],
      ["overdue", 15],
    ]);
    const amountPaid = outcome === "paid" ? amount : outcome === "pending" ? amount - randInt(rand, 8000, amount * 0.6) : 0;
    db.insert(schema.fees)
      .values({
        studentId: student.id,
        academicYear: "2026-27",
        semester: student.currentSemester,
        feeType: "tuition",
        amount,
        amountPaid: Math.max(0, amountPaid),
        dueDate: outcome === "overdue" ? "2026-08-15" : "2026-09-30",
        status: outcome,
        sourceSystem: "seed",
      })
      .run();
  }
}

function insertDocumentsAndCertificates(
  studentRows: (typeof schema.students.$inferSelect & { deptCode: string; baseAttendanceRate: number })[],
) {
  for (const student of studentRows) {
    db.insert(schema.documents)
      .values({
        studentId: student.id,
        type: "id_card",
        title: "Student ID Card",
        issuedAt: formatDate(new Date(student.admissionYear, 6, 15)),
        status: "available",
      })
      .run();

    if (rand() < 0.2) {
      db.insert(schema.certificates)
        .values({
          studentId: student.id,
          type: "bonafide",
          status: "ready",
          requestedAt: formatDate(addDays(TODAY, -randInt(rand, 15, 90))),
          issuedAt: formatDate(addDays(TODAY, -randInt(rand, 10, 85))),
          verificationCode: `CIT-${student.rollNumber}-${randInt(rand, 1000, 9999)}`,
          purpose: pick(rand, ["Bank account opening", "Passport application", "Scholarship", "Visa application"]),
          requestedVia: "web",
        })
        .run();
    }
  }
}

function insertHostel(
  universityId: number,
  studentRows: (typeof schema.students.$inferSelect & { deptCode: string; baseAttendanceRate: number })[],
) {
  const blockA = db.insert(schema.hostels).values({ universityId, name: "Hostel Block A", block: "A", warden: "Mr. Suresh Chandel" }).returning().get();
  const blockB = db.insert(schema.hostels).values({ universityId, name: "Hostel Block B", block: "B", warden: "Mrs. Kavita Rane" }).returning().get();

  const roomsA = Array.from({ length: 60 }, (_, i) =>
    db.insert(schema.rooms).values({ hostelId: blockA.id, roomNumber: `${100 + i}`, capacity: 3 }).returning().get(),
  );
  const roomsB = Array.from({ length: 50 }, (_, i) =>
    db.insert(schema.rooms).values({ hostelId: blockB.id, roomNumber: `${200 + i}`, capacity: 3 }).returning().get(),
  );

  const allRooms = [...roomsA, ...roomsB];
  const occupancy = new Map<number, number>();
  const eligible = studentRows.filter(() => rand() < 0.22);
  for (const student of eligible) {
    const room = pick(rand, allRooms);
    const occ = occupancy.get(room.id) ?? 0;
    if (occ >= room.capacity) continue;
    occupancy.set(room.id, occ + 1);
    db.insert(schema.roomAssignments)
      .values({ roomId: room.id, studentId: student.id, assignedAt: formatDate(new Date(student.admissionYear, 6, 20)), status: "active" })
      .run();
  }
  return { blockA, blockB, roomsA, roomsB };
}

function insertTransport(
  universityId: number,
  studentRows: (typeof schema.students.$inferSelect & { deptCode: string; baseAttendanceRate: number })[],
) {
  const routeDefs = [
    { name: "Arera Colony Route", code: "R1", stops: ["Arera Colony", "Char Imli", "New Market", "Campus Gate"] },
    { name: "Kolar Road Route", code: "R2", stops: ["Kolar Road", "Chuna Bhatti", "Shahpura", "Campus Gate"] },
    { name: "MP Nagar Route", code: "R3", stops: ["MP Nagar", "Board Office", "Ratanpur", "Campus Gate"] },
    { name: "Bairagarh Route", code: "R4", stops: ["Bairagarh", "Bhel", "Industrial Area", "Campus Gate"] },
    { name: "Habibganj Route", code: "R5", stops: ["Habibganj Station", "Depot Square", "Awadhpuri", "Campus Gate"] },
    { name: "Kolar Extension Route", code: "R6", stops: ["Kolar Extension", "Sarvadharm", "Indrapuri", "Campus Gate"] },
    { name: "Bhopal Central Route", code: "R7", stops: ["Bhopal Junction", "Royal Market", "TT Nagar", "Campus Gate"] },
    { name: "Raisen Road Route", code: "R8", stops: ["Raisen Road", "Karond", "Piplani", "Campus Gate"] },
  ];
  const routes = routeDefs.map((r) =>
    db
      .insert(schema.transportRoutes)
      .values({
        universityId,
        name: r.name,
        code: r.code,
        vehicleNumber: `MP04 ${pick(rand, ["AB", "CD", "EF", "GH"])} ${randInt(rand, 1000, 9999)}`,
        driverName: `${pick(rand, ["Ramesh", "Suresh", "Mahesh", "Dinesh"])} ${pick(rand, ["Kumar", "Yadav", "Chouhan"])}`,
        capacity: 40,
      })
      .returning()
      .get(),
  );
  const stopsByRoute = routes.map((route, i) => {
    const def = routeDefs[i];
    return def.stops.map((name, seq) =>
      db
        .insert(schema.transportStops)
        .values({ routeId: route.id, name, sequence: seq, arrivalTime: `0${7 + seq}:${seq === 0 ? "30" : "45"}` })
        .returning()
        .get(),
    );
  });

  const eligible = studentRows.filter(() => rand() < 0.35);
  for (const student of eligible) {
    const idx = randInt(rand, 0, routes.length - 1);
    const stops = stopsByRoute[idx];
    db.insert(schema.transportAssignments)
      .values({ studentId: student.id, routeId: routes[idx].id, stopId: pick(rand, stops).id })
      .run();
  }
  return { routes, stopsByRoute };
}

const TICKET_TEMPLATES: { category: string; subject: string; description: string }[] = [
  { category: "hostel", subject: "Wi-Fi not working in room", description: "The hostel Wi-Fi has been down for two days in my block." },
  { category: "hostel", subject: "Water leakage in bathroom", description: "There is a persistent water leak near the bathroom pipeline." },
  { category: "academic", subject: "Grade discrepancy in midterm", description: "My midterm marks are not reflecting correctly on the portal." },
  { category: "fees", subject: "Payment not reflecting", description: "I paid the fee online but the portal still shows it as pending." },
  { category: "transport", subject: "Bus arriving late", description: "The R2 route bus has been arriving 20 minutes late this week." },
  { category: "it", subject: "Unable to login to student portal", description: "Getting an authentication error when logging in." },
  { category: "general", subject: "Request for library timing extension", description: "Requesting extended library hours during exam season." },
];

function insertHelpdesk(
  studentRows: (typeof schema.students.$inferSelect & { deptCode: string; baseAttendanceRate: number })[],
) {
  let ticketSeq = 1000;
  for (let i = 0; i < 180; i++) {
    const student = pick(rand, studentRows);
    const template = pick(rand, TICKET_TEMPLATES);
    const status = pickWeighted<"open" | "in_progress" | "resolved" | "closed">(rand, [
      ["open", 20],
      ["in_progress", 15],
      ["resolved", 50],
      ["closed", 15],
    ]);
    const priority = pickWeighted<"low" | "medium" | "high">(rand, [
      ["low", 30],
      ["medium", 50],
      ["high", 20],
    ]);
    const createdAt = addDays(TODAY, -randInt(rand, 0, 60)).toISOString();
    db.insert(schema.helpdeskTickets)
      .values({
        ticketNumber: `HD-${ticketSeq++}`,
        studentId: student.id,
        category: template.category,
        subject: template.subject,
        description: template.description,
        status,
        priority,
        createdVia: "web",
        assignedTo: status === "open" ? null : "Support Desk",
        createdAt,
        updatedAt: createdAt,
      })
      .run();
  }
}

function insertNotifications(universityId: number) {
  const items: { title: string; message: string; category: string; role?: string }[] = [
    { title: "Mid-semester exam schedule released", message: "Check the exams section for your updated schedule.", category: "academic" },
    { title: "Fee payment deadline approaching", message: "Semester fees are due by Sep 30, 2026.", category: "fees" },
    { title: "Hostel Wi-Fi maintenance", message: "Scheduled maintenance in Block A on Sep 25, 2026 from 1-3 AM.", category: "hostel" },
    { title: "Annual sports fest registrations open", message: "Register for the sports fest by Oct 5.", category: "general" },
    { title: "Placement drive: TCS", message: "Pre-placement talk scheduled for final years on Sep 29.", category: "general" },
    { title: "Library extended hours during exams", message: "Library will remain open until midnight from Sep 24.", category: "general" },
    { title: "Scholarship applications open", message: "Merit scholarship applications close Oct 10.", category: "academic" },
    { title: "Transport route timing update", message: "R3 route departure time moved 10 minutes earlier.", category: "transport" },
  ];
  for (const item of items) {
    db.insert(schema.notifications)
      .values({
        universityId,
        audienceRole: item.role ?? null,
        title: item.title,
        message: item.message,
        category: item.category,
        createdAt: addDays(TODAY, -randInt(rand, 0, 10)).toISOString(),
      })
      .run();
  }
}

const BOOK_CATALOG: { title: string; author: string; category: string }[] = [
  { title: "Introduction to Algorithms", author: "Cormen, Leiserson, Rivest, Stein", category: "Computer Science" },
  { title: "Database System Concepts", author: "Silberschatz, Korth, Sudarshan", category: "Computer Science" },
  { title: "Operating System Concepts", author: "Silberschatz, Galvin, Gagne", category: "Computer Science" },
  { title: "Computer Networks", author: "Andrew S. Tanenbaum", category: "Computer Science" },
  { title: "Artificial Intelligence: A Modern Approach", author: "Russell, Norvig", category: "Computer Science" },
  { title: "Design Patterns", author: "Gamma, Helm, Johnson, Vlissides", category: "Computer Science" },
  { title: "Compilers: Principles, Techniques, and Tools", author: "Aho, Lam, Sethi, Ullman", category: "Computer Science" },
  { title: "Computer Organization and Design", author: "Patterson, Hennessy", category: "Computer Science" },
  { title: "The C Programming Language", author: "Kernighan, Ritchie", category: "Computer Science" },
  { title: "Clean Code", author: "Robert C. Martin", category: "Computer Science" },
  { title: "Software Engineering", author: "Ian Sommerville", category: "Computer Science" },
  { title: "Machine Learning", author: "Tom M. Mitchell", category: "Computer Science" },
  { title: "Digital Design", author: "M. Morris Mano", category: "Electronics" },
  { title: "Microelectronic Circuits", author: "Sedra, Smith", category: "Electronics" },
  { title: "Electronic Devices and Circuit Theory", author: "Boylestad, Nashelsky", category: "Electronics" },
  { title: "Signals and Systems", author: "Oppenheim, Willsky", category: "Electronics" },
  { title: "Principles of Communication Systems", author: "Taub, Schilling", category: "Electronics" },
  { title: "Control Systems Engineering", author: "Norman S. Nise", category: "Electronics" },
  { title: "Antenna Theory: Analysis and Design", author: "Balanis", category: "Electronics" },
  { title: "Embedded Systems Design", author: "Steve Heath", category: "Electronics" },
  { title: "Engineering Mechanics: Statics and Dynamics", author: "R.C. Hibbeler", category: "Mechanical" },
  { title: "Theory of Machines", author: "R.S. Khurmi", category: "Mechanical" },
  { title: "Fluid Mechanics and Hydraulic Machines", author: "R.K. Bansal", category: "Mechanical" },
  { title: "Fundamentals of Thermodynamics", author: "Borgnakke, Sonntag", category: "Mechanical" },
  { title: "Machine Design", author: "V.B. Bhandari", category: "Mechanical" },
  { title: "Manufacturing Engineering and Technology", author: "Kalpakjian, Schmid", category: "Mechanical" },
  { title: "Heat and Mass Transfer", author: "Cengel", category: "Mechanical" },
  { title: "Automobile Engineering", author: "Kirpal Singh", category: "Mechanical" },
  { title: "Structural Analysis", author: "R.C. Hibbeler", category: "Civil" },
  { title: "Reinforced Concrete Design", author: "Pillai, Menon", category: "Civil" },
  { title: "Soil Mechanics and Foundation Engineering", author: "K.R. Arora", category: "Civil" },
  { title: "Surveying", author: "B.C. Punmia", category: "Civil" },
  { title: "Building Construction", author: "B.C. Punmia", category: "Civil" },
  { title: "Transportation Engineering", author: "Khanna, Justo", category: "Civil" },
  { title: "Environmental Engineering", author: "Peavy, Rowe, Tchobanoglous", category: "Civil" },
  { title: "Principles of Management", author: "Koontz, Weihrich", category: "Management" },
  { title: "Marketing Management", author: "Philip Kotler", category: "Management" },
  { title: "Financial Management", author: "I.M. Pandey", category: "Management" },
  { title: "Human Resource Management", author: "Gary Dessler", category: "Management" },
  { title: "Organizational Behaviour", author: "Stephen P. Robbins", category: "Management" },
  { title: "Business Analytics", author: "Camm, Cochran, Fry", category: "Management" },
  { title: "Strategic Management", author: "Fred R. David", category: "Management" },
  { title: "Higher Engineering Mathematics", author: "B.S. Grewal", category: "Mathematics" },
  { title: "Advanced Engineering Mathematics", author: "Erwin Kreyszig", category: "Mathematics" },
  { title: "Probability and Statistics for Engineers", author: "Walpole, Myers", category: "Mathematics" },
  { title: "Linear Algebra and Its Applications", author: "David C. Lay", category: "Mathematics" },
  { title: "Discrete Mathematics and Its Applications", author: "Kenneth H. Rosen", category: "Mathematics" },
  { title: "A Brief History of Time", author: "Stephen Hawking", category: "General" },
  { title: "Sapiens: A Brief History of Humankind", author: "Yuval Noah Harari", category: "General" },
  { title: "The Innovator's Dilemma", author: "Clayton M. Christensen", category: "General" },
  { title: "Atomic Habits", author: "James Clear", category: "General" },
  { title: "The Lean Startup", author: "Eric Ries", category: "General" },
  { title: "Wings of Fire", author: "A.P.J. Abdul Kalam", category: "General" },
  { title: "Thinking, Fast and Slow", author: "Daniel Kahneman", category: "General" },
  { title: "Zero to One", author: "Peter Thiel", category: "General" },
  { title: "The Pragmatic Programmer", author: "Hunt, Thomas", category: "Computer Science" },
  { title: "Computer Graphics: Principles and Practice", author: "Foley, van Dam", category: "Computer Science" },
  { title: "Cryptography and Network Security", author: "William Stallings", category: "Computer Science" },
  { title: "Power Electronics", author: "Rashid", category: "Electronics" },
  { title: "VLSI Design", author: "Weste, Harris", category: "Electronics" },
];

function insertLibrary(
  studentRows: (typeof schema.students.$inferSelect & { deptCode: string; baseAttendanceRate: number })[],
) {
  const bookRows = BOOK_CATALOG.map((b, i) => {
    const totalCopies = randInt(rand, 2, 6);
    return db
      .insert(schema.books)
      .values({
        isbn: `978-${randInt(rand, 1000000000, 9999999999)}`.slice(0, 17),
        title: b.title,
        author: b.author,
        category: b.category,
        publisher: pick(rand, ["Pearson", "McGraw Hill", "Wiley", "PHI Learning", "Cengage", "O'Reilly"]),
        totalCopies,
        availableCopies: totalCopies,
        shelfLocation: `${b.category.slice(0, 2).toUpperCase()}-${100 + i}`,
      })
      .returning()
      .get();
  });

  const availableCopy = new Map(bookRows.map((b) => [b.id, b.availableCopies]));
  const borrowers = studentRows.filter(() => rand() < 0.32);

  for (const student of borrowers) {
    const numLoans = randInt(rand, 1, 2);
    for (let i = 0; i < numLoans; i++) {
      const book = pick(rand, bookRows);
      const remaining = availableCopy.get(book.id)!;
      if (remaining <= 0) continue;

      const outcome = pickWeighted<"returned" | "active" | "overdue">(rand, [
        ["returned", 55],
        ["active", 30],
        ["overdue", 15],
      ]);
      const borrowedAt = addDays(TODAY, -randInt(rand, 3, 55));
      const dueAt = addDays(borrowedAt, 14);

      let returnedAt: string | null = null;
      let status = outcome;
      let fineAmount = 0;
      if (outcome === "returned") {
        const returnDate = addDays(borrowedAt, randInt(rand, 3, 13));
        returnedAt = formatDate(returnDate);
      } else if (outcome === "overdue") {
        const daysOverdue = Math.max(1, Math.round((TODAY.getTime() - dueAt.getTime()) / 86400000));
        fineAmount = Math.min(daysOverdue * 5, 200);
      } else if (dueAt < TODAY) {
        // borrowed long enough ago that it would already be overdue - keep it "active" but due today+
        status = "active";
      }

      db.insert(schema.bookLoans)
        .values({
          bookId: book.id,
          studentId: student.id,
          borrowedAt: formatDate(borrowedAt),
          dueAt: formatDate(dueAt),
          returnedAt,
          status,
          fineAmount,
          finePaid: false,
        })
        .run();

      if (status !== "returned") availableCopy.set(book.id, remaining - 1);
    }
  }

  for (const [bookId, remaining] of availableCopy) {
    db.update(schema.books).set({ availableCopies: Math.max(0, remaining) }).where(eq(schema.books.id, bookId)).run();
  }
}

const SCHOLARSHIP_CATALOG: {
  name: string;
  provider: string;
  amount: number;
  eligibility: string;
  minAttendance?: number;
  maxFamilyIncome?: number;
  departmentCode?: string;
  deadline: string;
  seats: number;
}[] = [
  {
    name: "Chief Minister Merit Scholarship",
    provider: "Government of Madhya Pradesh",
    amount: 25000,
    eligibility: "Attendance ≥ 85% and consistent academic performance",
    minAttendance: 85,
    deadline: "2026-10-15",
    seats: 120,
  },
  {
    name: "Post-Matric Scholarship (SC/ST/OBC)",
    provider: "Government of India",
    amount: 18000,
    eligibility: "Family income below ₹2.5L per annum, category certificate required",
    maxFamilyIncome: 250000,
    deadline: "2026-10-31",
    seats: 200,
  },
  {
    name: "Single Girl Child Scholarship",
    provider: "AICTE",
    amount: 30000,
    eligibility: "Only girl child in the family, minimum 75% attendance",
    minAttendance: 75,
    deadline: "2026-11-05",
    seats: 40,
  },
  {
    name: "Central Sector Scholarship",
    provider: "Government of India",
    amount: 20000,
    eligibility: "Top 20th percentile in qualifying exam, family income below ₹4.5L",
    maxFamilyIncome: 450000,
    deadline: "2026-10-20",
    seats: 80,
  },
  {
    name: "Institute Need-Based Scholarship",
    provider: "Central Institute of Technology",
    amount: 15000,
    eligibility: "Demonstrated financial need, minimum 70% attendance",
    minAttendance: 70,
    deadline: "2026-11-10",
    seats: 100,
  },
  {
    name: "Sports Excellence Scholarship",
    provider: "Central Institute of Technology",
    amount: 12000,
    eligibility: "State or national-level sports representation",
    deadline: "2026-10-25",
    seats: 25,
  },
  {
    name: "Minority Welfare Scholarship",
    provider: "State Minority Commission",
    amount: 16000,
    eligibility: "Belongs to a notified minority community, family income below ₹3L",
    maxFamilyIncome: 300000,
    deadline: "2026-11-01",
    seats: 60,
  },
  {
    name: "CSE Department Alumni Endowment",
    provider: "CIT Alumni Association",
    amount: 22000,
    eligibility: "Computer Science students with attendance ≥ 80%",
    minAttendance: 80,
    departmentCode: "CSE",
    deadline: "2026-10-18",
    seats: 15,
  },
];

function insertScholarships(
  studentRows: (typeof schema.students.$inferSelect & { deptCode: string; baseAttendanceRate: number })[],
  deptRows: (typeof schema.departments.$inferSelect & { code: string })[],
) {
  void deptRows;
  const scholarshipRows = SCHOLARSHIP_CATALOG.map((s) =>
    db
      .insert(schema.scholarships)
      .values({
        name: s.name,
        provider: s.provider,
        amount: s.amount,
        eligibility: s.eligibility,
        minAttendance: s.minAttendance ?? null,
        maxFamilyIncome: s.maxFamilyIncome ?? null,
        departmentCode: s.departmentCode ?? null,
        deadline: s.deadline,
        seatsAvailable: s.seats,
      })
      .returning()
      .get(),
  );

  const applicants = studentRows.filter(() => rand() < 0.2);
  for (const student of applicants) {
    const eligibleScholarships = scholarshipRows.filter(
      (s) => !s.departmentCode || s.departmentCode === student.deptCode,
    );
    if (!eligibleScholarships.length) continue;
    const scholarship = pick(rand, eligibleScholarships);
    const status = pickWeighted<"submitted" | "under_review" | "approved" | "rejected" | "disbursed">(rand, [
      ["submitted", 30],
      ["under_review", 25],
      ["approved", 20],
      ["rejected", 10],
      ["disbursed", 15],
    ]);
    const appliedAt = addDays(TODAY, -randInt(rand, 1, 45));
    const decidedAt = status === "submitted" || status === "under_review" ? null : formatDate(addDays(appliedAt, randInt(rand, 5, 20)));

    db.insert(schema.scholarshipApplications)
      .values({
        scholarshipId: scholarship.id,
        studentId: student.id,
        status,
        appliedAt: formatDate(appliedAt),
        decidedAt,
        remarks: status === "rejected" ? "Did not meet minimum attendance criteria at time of review." : null,
        documentsSubmitted: true,
      })
      .run();
  }
}

function insertDemoUsers(
  studentRows: (typeof schema.students.$inferSelect & { deptCode: string; baseAttendanceRate: number })[],
  facultyRows: (typeof schema.faculty.$inferSelect & { deptCode: string })[],
  courseRows: (typeof schema.courses.$inferSelect & { deptCode: string })[],
  sectionRows: (typeof schema.sections.$inferSelect)[],
  hostelCtx: ReturnType<typeof insertHostel>,
  transportCtx: ReturnType<typeof insertTransport>,
  deptRows: (typeof schema.departments.$inferSelect & { code: string })[],
  roleIds: Map<string, number>,
  staffRows: { roleKey: string; employee: typeof schema.employees.$inferSelect }[],
) {
  function assignRole(userId: number, roleKey: string, scope?: Record<string, unknown> | null) {
    const roleId = roleIds.get(roleKey);
    if (!roleId) throw new Error(`Unknown role template "${roleKey}"`);
    const resolvedScope = scope !== undefined ? scope : GLOBAL_SCOPE_ROLE_KEYS.has(roleKey) ? { all: true } : null;
    db.insert(schema.userRoles).values({ userId, roleId, scope: resolvedScope ? JSON.stringify(resolvedScope) : null }).run();
  }
  function staffFor(roleKey: string) {
    const row = staffRows.find((s) => s.roleKey === roleKey);
    if (!row) throw new Error(`No seeded employee for role "${roleKey}"`);
    return row.employee;
  }
  const dbmsCourse = courseRows.find((c) => c.code === "CS201")!;
  const dbmsSection = sectionRows.find((s) => s.courseId === dbmsCourse.id)!;
  const dbmsFaculty = facultyRows.find((f) => f.id === dbmsSection.facultyId)!;

  // Showcase student: overrides a random sem-3 CSE student to hit exact demo numbers.
  const showcase = studentRows.find((s) => s.deptCode === "CSE" && s.currentSemester === 3)!;
  db.update(schema.students)
    .set({
      firstName: "Samarth",
      lastName: "Rathore",
      email: "samarth.rathore@cit.edu.in",
      rollNumber: "CSE2025SHOWCASE",
    })
    .where(eq(schema.students.id, showcase.id))
    .run();

  // Force an ~82% attendance profile on DBMS specifically for the showcase student.
  sqlite.prepare(`DELETE FROM attendance WHERE student_id = ? AND course_id = ?`).run(showcase.id, dbmsCourse.id);
  const sessions = weekdaysBack(TODAY, 24);
  sessions.forEach((date, idx) => {
    const present = idx / sessions.length < 0.82;
    sqlite
      .prepare(`INSERT INTO attendance (student_id, course_id, date, status, marked_by) VALUES (?, ?, ?, ?, ?)`)
      .run(showcase.id, dbmsCourse.id, formatDate(date), present ? "present" : "absent", "faculty");
  });

  // Force the showcase fee record: 12,500 pending, due Sep 30.
  sqlite.prepare(`DELETE FROM fees WHERE student_id = ?`).run(showcase.id);
  sqlite
    .prepare(
      `INSERT INTO fees (student_id, academic_year, semester, fee_type, amount, amount_paid, due_date, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(showcase.id, "2026-27", 3, "tuition", 45000, 32500, "2026-09-30", "pending");

  // Recent activity: an already-issued bonafide certificate.
  sqlite.prepare(`DELETE FROM certificates WHERE student_id = ?`).run(showcase.id);
  sqlite
    .prepare(
      `INSERT INTO certificates (student_id, type, status, requested_at, issued_at, verification_code, purpose, requested_via) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(showcase.id, "bonafide", "ready", formatDate(addDays(TODAY, -12)), formatDate(addDays(TODAY, -11)), "CIT-CSE2025SHOWCASE-7741", "Bank account opening", "web");

  // Hostel: Block B, Room 204.
  sqlite.prepare(`DELETE FROM room_assignments WHERE student_id = ?`).run(showcase.id);
  const room204 = hostelCtx.roomsB.find((r) => r.roomNumber === "204")!;
  sqlite
    .prepare(`INSERT INTO room_assignments (room_id, student_id, assigned_at, status) VALUES (?, ?, ?, ?)`)
    .run(room204.id, showcase.id, formatDate(new Date(2025, 6, 20)), "active");

  // Transport: Kolar Road Route, boarding at Chuna Bhatti.
  sqlite.prepare(`DELETE FROM transport_assignments WHERE student_id = ?`).run(showcase.id);
  const r2Idx = transportCtx.routes.findIndex((r) => r.code === "R2");
  const chunaBhatti = transportCtx.stopsByRoute[r2Idx].find((s) => s.name === "Chuna Bhatti")!;
  sqlite
    .prepare(`INSERT INTO transport_assignments (student_id, route_id, stop_id) VALUES (?, ?, ?)`)
    .run(showcase.id, transportCtx.routes[r2Idx].id, chunaBhatti.id);

  // Library: two active loans + one overdue with a fine, for a realistic demo state.
  sqlite.prepare(`DELETE FROM book_loans WHERE student_id = ?`).run(showcase.id);
  const demoBooks = sqlite
    .prepare(`SELECT id, title FROM books WHERE title IN (?, ?, ?)`)
    .all("Introduction to Algorithms", "Database System Concepts", "Clean Code") as { id: number; title: string }[];
  const bookByTitle = new Map(demoBooks.map((b) => [b.title, b.id]));
  const insertLoan = sqlite.prepare(
    `INSERT INTO book_loans (book_id, student_id, borrowed_at, due_at, status, fine_amount, fine_paid) VALUES (?, ?, ?, ?, ?, ?, 0)`,
  );
  if (bookByTitle.has("Introduction to Algorithms")) {
    insertLoan.run(bookByTitle.get("Introduction to Algorithms"), showcase.id, formatDate(addDays(TODAY, -5)), formatDate(addDays(TODAY, 9)), "active", 0);
  }
  if (bookByTitle.has("Database System Concepts")) {
    insertLoan.run(bookByTitle.get("Database System Concepts"), showcase.id, formatDate(addDays(TODAY, -10)), formatDate(addDays(TODAY, 4)), "active", 0);
  }
  if (bookByTitle.has("Clean Code")) {
    insertLoan.run(bookByTitle.get("Clean Code"), showcase.id, formatDate(addDays(TODAY, -22)), formatDate(addDays(TODAY, -8)), "overdue", 40);
  }

  // Scholarship: one application already under review.
  sqlite.prepare(`DELETE FROM scholarship_applications WHERE student_id = ?`).run(showcase.id);
  const meritScholarship = sqlite.prepare(`SELECT id FROM scholarships WHERE name = ?`).get("Chief Minister Merit Scholarship") as
    | { id: number }
    | undefined;
  if (meritScholarship) {
    sqlite
      .prepare(
        `INSERT INTO scholarship_applications (scholarship_id, student_id, status, applied_at, documents_submitted) VALUES (?, ?, 'under_review', ?, 1)`,
      )
      .run(meritScholarship.id, showcase.id, formatDate(addDays(TODAY, -6)));
  }

  const parent = db
    .insert(schema.parents)
    .values({ studentId: showcase.id, firstName: "Rakesh", lastName: "Rathore", email: "rakesh.rathore@gmail.com", phone: "9876543210", relation: "father" })
    .returning()
    .get();

  // --- Original CIT-branded demo logins (preserved) -----------------------
  const studentUser = db.insert(schema.users).values({ name: "Samarth Rathore", email: "samarth.rathore@cit.edu.in", role: "student", studentId: showcase.id }).returning().get();
  const facultyUser = db
    .insert(schema.users)
    .values({ name: `${dbmsFaculty.firstName} ${dbmsFaculty.lastName}`, email: dbmsFaculty.email, role: "faculty", facultyId: dbmsFaculty.id })
    .returning()
    .get();
  const parentUser = db.insert(schema.users).values({ name: "Rakesh Rathore", email: parent.email, role: "parent", parentId: parent.id }).returning().get();
  const adminUser = db.insert(schema.users).values({ name: "Priya Deshpande", email: "registrar@cit.edu.in", role: "admin" }).returning().get();

  assignRole(studentUser.id, "student");
  assignRole(facultyUser.id, "faculty");
  // Faculty A also acts as class mentor for their own sections - a
  // stackable second role on the same person (spec section 6).
  assignRole(facultyUser.id, "class_mentor");
  assignRole(parentUser.id, "parent");
  assignRole(adminUser.id, "administrator");

  // --- Head of Department: a second CSE faculty member, department-scoped -
  const cseDept = deptRows.find((d) => d.code === "CSE")!;
  const hodFaculty = facultyRows.find((f) => f.deptCode === "CSE" && f.designation === "Professor" && f.id !== dbmsFaculty.id) ?? dbmsFaculty;
  db.update(schema.departments).set({ headOfDeptFacultyId: hodFaculty.id }).where(eq(schema.departments.id, cseDept.id)).run();
  const hodUser = db
    .insert(schema.users)
    .values({ name: `${hodFaculty.firstName} ${hodFaculty.lastName}`, email: "hod@demo.college", role: "faculty", facultyId: hodFaculty.id })
    .returning()
    .get();
  assignRole(hodUser.id, "faculty");
  assignRole(hodUser.id, "hod", { departmentId: cseDept.id });

  // --- Department-employee demo logins (spec section 20) -------------------
  const accountsUser = db
    .insert(schema.users)
    .values({ name: `${staffFor("accounts_officer").firstName} ${staffFor("accounts_officer").lastName}`, email: "accounts@demo.college", role: "employee", employeeId: staffFor("accounts_officer").id })
    .returning()
    .get();
  assignRole(accountsUser.id, "accounts_officer");

  const admissionUser = db
    .insert(schema.users)
    .values({ name: `${staffFor("admission_officer").firstName} ${staffFor("admission_officer").lastName}`, email: "admission@demo.college", role: "employee", employeeId: staffFor("admission_officer").id })
    .returning()
    .get();
  assignRole(admissionUser.id, "admission_officer");

  // Extra department desks beyond the required demo set - so every admin
  // module built (examinations/HR/placement/library/maintenance/IT) has a
  // matching login to exercise its RBAC scenario.
  const EXTRA_STAFF_LOGINS: [string, string][] = [
    ["examination_officer", "examination@demo.college"],
    ["hr_officer", "hr@demo.college"],
    ["placement_officer", "placement@demo.college"],
    ["librarian", "librarian@demo.college"],
    ["maintenance_officer", "maintenance@demo.college"],
    ["it_administrator", "it@demo.college"],
  ];
  for (const [roleKey, email] of EXTRA_STAFF_LOGINS) {
    const employee = staffFor(roleKey);
    const user = db
      .insert(schema.users)
      .values({ name: `${employee.firstName} ${employee.lastName}`, email, role: "employee", employeeId: employee.id })
      .returning()
      .get();
    assignRole(user.id, roleKey);
  }

  // --- Spec-exact demo emails: aliases onto the same student/parent so
  // "Student A -> Parent A -> Class" relationships stay consistent whichever
  // login a reviewer signs in with. ---------------------------------------
  const studentAlias = db
    .insert(schema.users)
    .values({ name: "Samarth Rathore", email: "student@demo.college", role: "student", studentId: showcase.id })
    .returning()
    .get();
  assignRole(studentAlias.id, "student");

  const parentAlias = db
    .insert(schema.users)
    .values({ name: "Rakesh Rathore", email: "parent@demo.college", role: "parent", parentId: parent.id })
    .returning()
    .get();
  assignRole(parentAlias.id, "parent");

  const facultyAlias = db
    .insert(schema.users)
    .values({ name: `${dbmsFaculty.firstName} ${dbmsFaculty.lastName}`, email: "faculty@demo.college", role: "faculty", facultyId: dbmsFaculty.id })
    .returning()
    .get();
  assignRole(facultyAlias.id, "faculty");

  const adminAlias = db.insert(schema.users).values({ name: "Priya Deshpande", email: "admin@demo.college", role: "admin" }).returning().get();
  assignRole(adminAlias.id, "administrator");
}

main();
console.log("Seed complete.");
