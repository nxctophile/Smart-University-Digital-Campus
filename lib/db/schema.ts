import { sqliteTable, text, integer, real, index, uniqueIndex } from "drizzle-orm/sqlite-core";
import { relations, sql } from "drizzle-orm";

/**
 * Canonical Campus Data Model.
 *
 * This schema is the normalized internal representation every legacy import
 * is mapped into (see lib/importer). Entities that can originate from an
 * external ERP carry sourceSystem/sourceTable/sourceId/lastSyncedAt so
 * imported records can always be reconciled with their system of record.
 */

const timestamps = {
  createdAt: text("created_at").notNull().default(sql`(current_timestamp)`),
  updatedAt: text("updated_at").notNull().default(sql`(current_timestamp)`),
};

const sourceMeta = {
  sourceSystem: text("source_system"),
  sourceTable: text("source_table"),
  sourceId: text("source_id"),
  lastSyncedAt: text("last_synced_at"),
};

// ---------------------------------------------------------------------------
// Institution structure
// ---------------------------------------------------------------------------

export const universities = sqliteTable("universities", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  code: text("code").notNull(),
  city: text("city").notNull(),
  state: text("state").notNull(),
  ...timestamps,
});

export const departments = sqliteTable("departments", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  universityId: integer("university_id").notNull().references(() => universities.id),
  name: text("name").notNull(),
  code: text("code").notNull(),
  headOfDeptFacultyId: integer("head_of_dept_faculty_id"),
});

export const programmes = sqliteTable("programmes", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  departmentId: integer("department_id").notNull().references(() => departments.id),
  name: text("name").notNull(),
  code: text("code").notNull(),
  degreeLevel: text("degree_level").notNull(), // UG | PG
  durationSemesters: integer("duration_semesters").notNull(),
});

export const courses = sqliteTable("courses", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  programmeId: integer("programme_id").notNull().references(() => programmes.id),
  code: text("code").notNull(),
  name: text("name").notNull(),
  credits: integer("credits").notNull(),
  semester: integer("semester").notNull(),
});

export const sections = sqliteTable("sections", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  courseId: integer("course_id").notNull().references(() => courses.id),
  facultyId: integer("faculty_id").references(() => faculty.id),
  name: text("name").notNull(), // e.g. "A"
  academicYear: text("academic_year").notNull(), // e.g. "2026-27"
});

// ---------------------------------------------------------------------------
// People
// ---------------------------------------------------------------------------

export const students = sqliteTable(
  "students",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    universityId: integer("university_id").notNull().references(() => universities.id),
    departmentId: integer("department_id").notNull().references(() => departments.id),
    programmeId: integer("programme_id").notNull().references(() => programmes.id),
    rollNumber: text("roll_number").notNull(),
    firstName: text("first_name").notNull(),
    lastName: text("last_name").notNull(),
    email: text("email").notNull(),
    phone: text("phone").notNull(),
    dob: text("dob").notNull(),
    gender: text("gender").notNull(),
    admissionYear: integer("admission_year").notNull(),
    currentSemester: integer("current_semester").notNull(),
    status: text("status").notNull().default("active"), // active | alumni | suspended
    address: text("address"),
    guardianName: text("guardian_name"),
    guardianPhone: text("guardian_phone"),
    avatarColor: text("avatar_color"),
    ...sourceMeta,
    ...timestamps,
  },
  (t) => [
    uniqueIndex("students_roll_number_idx").on(t.rollNumber),
    index("students_department_idx").on(t.departmentId),
  ],
);

export const faculty = sqliteTable("faculty", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  universityId: integer("university_id").notNull().references(() => universities.id),
  departmentId: integer("department_id").notNull().references(() => departments.id),
  employeeId: text("employee_id").notNull(),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  email: text("email").notNull(),
  phone: text("phone").notNull(),
  designation: text("designation").notNull(),
  ...sourceMeta,
});

export const parents = sqliteTable("parents", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  studentId: integer("student_id").notNull().references(() => students.id),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  email: text("email").notNull(),
  phone: text("phone").notNull(),
  relation: text("relation").notNull(), // father | mother | guardian
});

// Non-faculty campus staff (Accounts, Admission, HR, Examination, T&P,
// Library, Maintenance/IT desks). Faculty keep their own table since they
// also carry teaching assignments (sections/timetable).
export const employees = sqliteTable("employees", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  universityId: integer("university_id").notNull().references(() => universities.id),
  departmentId: integer("department_id").notNull().references(() => departments.id),
  employeeCode: text("employee_code").notNull(),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  email: text("email").notNull(),
  phone: text("phone").notNull(),
  designation: text("designation").notNull(), // e.g. "Accounts Officer", "Admission Officer"
});

// Demo login/identity table - NOT production auth. Maps a person to their
// linked student/faculty/parent/employee record. Real authorization is
// resolved through userRoles -> roles -> rolePermissions (see lib/rbac).
export const users = sqliteTable("users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  email: text("email").notNull(),
  role: text("role").notNull(), // legacy primary-role label, kept for display/back-compat only
  studentId: integer("student_id").references(() => students.id),
  facultyId: integer("faculty_id").references(() => faculty.id),
  parentId: integer("parent_id").references(() => parents.id),
  employeeId: integer("employee_id").references(() => employees.id),
});

// ---------------------------------------------------------------------------
// RBAC: roles, permissions, assignments, audit trail
// ---------------------------------------------------------------------------

export const roles = sqliteTable("roles", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  key: text("key").notNull(), // stable slug, e.g. "administrator", "hod", "accounts_officer"
  name: text("name").notNull(), // display name, e.g. "Accounts Officer"
  description: text("description"),
  category: text("category").notNull(), // administrator | faculty | parent | student | employee
  isSystem: integer("is_system", { mode: "boolean" }).notNull().default(false), // seeded roles - not deletable
  ...timestamps,
}, (t) => [uniqueIndex("roles_key_idx").on(t.key)]);

// Which permission strings (see lib/rbac/permissions.ts) a role grants.
export const rolePermissions = sqliteTable("role_permissions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  roleId: integer("role_id").notNull().references(() => roles.id, { onDelete: "cascade" }),
  permissionKey: text("permission_key").notNull(),
}, (t) => [uniqueIndex("role_permissions_unique_idx").on(t.roleId, t.permissionKey)]);

// A user can hold multiple roles. Each assignment can carry an explicit
// scope (JSON) - e.g. {"all":true} for an administrator, or
// {"departmentId":3} for a department-scoped HOD/employee. When scope is
// null, the authorization layer resolves it dynamically from the caller's
// own identity (their own student/child/course roster/department).
export const userRoles = sqliteTable("user_roles", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  roleId: integer("role_id").notNull().references(() => roles.id, { onDelete: "cascade" }),
  scope: text("scope"), // JSON string | null
  ...timestamps,
}, (t) => [index("user_roles_user_idx").on(t.userId)]);

export const auditLogs = sqliteTable("audit_logs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id"),
  userName: text("user_name").notNull(),
  userRole: text("user_role").notNull(),
  action: text("action").notNull(), // permission key or named action, e.g. "attendance.update"
  resource: text("resource"), // e.g. "student:123", "class:CSE-S3"
  result: text("result").notNull(), // success | denied
  metadata: text("metadata"), // JSON string
  createdAt: text("created_at").notNull().default(sql`(current_timestamp)`),
}, (t) => [index("audit_logs_created_idx").on(t.createdAt), index("audit_logs_user_idx").on(t.userId)]);

// Legacy-import role reconciliation: how a source system's free-text role
// label should map onto a system role here. Admin-editable (section 18).
export const legacyRoleMappings = sqliteTable("legacy_role_mappings", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  legacyRole: text("legacy_role").notNull(),
  mappedRoleKey: text("mapped_role_key").notNull(), // roles.key
  notes: text("notes"),
}, (t) => [uniqueIndex("legacy_role_mappings_legacy_idx").on(t.legacyRole)]);

// ---------------------------------------------------------------------------
// Academics
// ---------------------------------------------------------------------------

export const attendance = sqliteTable(
  "attendance",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    studentId: integer("student_id").notNull().references(() => students.id),
    courseId: integer("course_id").notNull().references(() => courses.id),
    date: text("date").notNull(),
    status: text("status").notNull(), // present | absent | late | excused
    markedBy: text("marked_by"),
    ...sourceMeta,
  },
  (t) => [index("attendance_student_idx").on(t.studentId), index("attendance_course_idx").on(t.courseId)],
);

export const timetableSlots = sqliteTable("timetable_slots", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  sectionId: integer("section_id").notNull().references(() => sections.id),
  courseId: integer("course_id").notNull().references(() => courses.id),
  facultyId: integer("faculty_id").references(() => faculty.id),
  dayOfWeek: integer("day_of_week").notNull(), // 0=Mon .. 6=Sun
  startTime: text("start_time").notNull(), // "10:00"
  endTime: text("end_time").notNull(),
  room: text("room").notNull(),
  programmeId: integer("programme_id").notNull().references(() => programmes.id),
  semester: integer("semester").notNull(),
});

export const exams = sqliteTable("exams", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  courseId: integer("course_id").notNull().references(() => courses.id),
  programmeId: integer("programme_id").notNull().references(() => programmes.id),
  name: text("name").notNull(),
  examType: text("exam_type").notNull(), // quiz | midterm | final
  date: text("date").notNull(),
  startTime: text("start_time").notNull(),
  durationMinutes: integer("duration_minutes").notNull(),
  maxMarks: integer("max_marks").notNull(),
  semester: integer("semester").notNull(),
});

export const examResults = sqliteTable(
  "exam_results",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    examId: integer("exam_id").notNull().references(() => exams.id),
    studentId: integer("student_id").notNull().references(() => students.id),
    marksObtained: real("marks_obtained").notNull(),
    graded: integer("graded", { mode: "boolean" }).notNull().default(true),
  },
  (t) => [index("exam_results_student_idx").on(t.studentId)],
);

// ---------------------------------------------------------------------------
// Finance
// ---------------------------------------------------------------------------

export const fees = sqliteTable(
  "fees",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    studentId: integer("student_id").notNull().references(() => students.id),
    academicYear: text("academic_year").notNull(),
    semester: integer("semester").notNull(),
    feeType: text("fee_type").notNull(), // tuition | hostel | transport | exam | misc
    amount: real("amount").notNull(),
    amountPaid: real("amount_paid").notNull().default(0),
    dueDate: text("due_date").notNull(),
    status: text("status").notNull(), // paid | pending | partial | overdue
    ...sourceMeta,
  },
  (t) => [index("fees_student_idx").on(t.studentId)],
);

export const payments = sqliteTable("payments", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  feeId: integer("fee_id").notNull().references(() => fees.id),
  studentId: integer("student_id").notNull().references(() => students.id),
  amount: real("amount").notNull(),
  method: text("method").notNull(),
  transactionRef: text("transaction_ref").notNull(),
  status: text("status").notNull().default("paid"), // created | paid | failed
  razorpayOrderId: text("razorpay_order_id"),
  razorpayPaymentId: text("razorpay_payment_id"),
  razorpaySignature: text("razorpay_signature"),
  paidAt: text("paid_at").notNull(),
});

// ---------------------------------------------------------------------------
// Documents & certificates
// ---------------------------------------------------------------------------

export const documents = sqliteTable("documents", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  studentId: integer("student_id").notNull().references(() => students.id),
  type: text("type").notNull(), // id_card | marksheet | fee_receipt | enrollment_certificate
  title: text("title").notNull(),
  issuedAt: text("issued_at").notNull(),
  status: text("status").notNull().default("available"),
});

export const certificates = sqliteTable("certificates", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  studentId: integer("student_id").notNull().references(() => students.id),
  type: text("type").notNull(), // bonafide | enrollment | character | transfer
  status: text("status").notNull().default("requested"), // requested | processing | ready | rejected
  requestedAt: text("requested_at").notNull(),
  issuedAt: text("issued_at"),
  verificationCode: text("verification_code"),
  purpose: text("purpose"),
  requestedVia: text("requested_via").default("web"), // web | ai
});

// ---------------------------------------------------------------------------
// Hostel
// ---------------------------------------------------------------------------

export const hostels = sqliteTable("hostels", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  universityId: integer("university_id").notNull().references(() => universities.id),
  name: text("name").notNull(),
  block: text("block").notNull(),
  warden: text("warden").notNull(),
});

export const rooms = sqliteTable("rooms", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  hostelId: integer("hostel_id").notNull().references(() => hostels.id),
  roomNumber: text("room_number").notNull(),
  capacity: integer("capacity").notNull(),
});

export const roomAssignments = sqliteTable("room_assignments", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  roomId: integer("room_id").notNull().references(() => rooms.id),
  studentId: integer("student_id").notNull().references(() => students.id),
  assignedAt: text("assigned_at").notNull(),
  status: text("status").notNull().default("active"),
});

// ---------------------------------------------------------------------------
// Transport
// ---------------------------------------------------------------------------

export const transportRoutes = sqliteTable("transport_routes", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  universityId: integer("university_id").notNull().references(() => universities.id),
  name: text("name").notNull(),
  code: text("code").notNull(),
  vehicleNumber: text("vehicle_number").notNull(),
  driverName: text("driver_name").notNull(),
  capacity: integer("capacity").notNull(),
});

export const transportStops = sqliteTable("transport_stops", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  routeId: integer("route_id").notNull().references(() => transportRoutes.id),
  name: text("name").notNull(),
  sequence: integer("sequence").notNull(),
  arrivalTime: text("arrival_time").notNull(),
});

export const transportAssignments = sqliteTable("transport_assignments", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  studentId: integer("student_id").notNull().references(() => students.id),
  routeId: integer("route_id").notNull().references(() => transportRoutes.id),
  stopId: integer("stop_id").notNull().references(() => transportStops.id),
});

// ---------------------------------------------------------------------------
// Helpdesk
// ---------------------------------------------------------------------------

export const helpdeskTickets = sqliteTable(
  "helpdesk_tickets",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    ticketNumber: text("ticket_number").notNull(),
    studentId: integer("student_id").references(() => students.id),
    category: text("category").notNull(), // academic | hostel | transport | fees | it | general
    subject: text("subject").notNull(),
    description: text("description").notNull(),
    status: text("status").notNull().default("open"), // open | in_progress | resolved | closed
    priority: text("priority").notNull().default("medium"), // low | medium | high
    createdVia: text("created_via").notNull().default("web"), // web | ai
    assignedTo: text("assigned_to"),
    ...timestamps,
  },
  (t) => [index("helpdesk_student_idx").on(t.studentId)],
);

export const ticketMessages = sqliteTable("ticket_messages", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  ticketId: integer("ticket_id").notNull().references(() => helpdeskTickets.id),
  sender: text("sender").notNull(), // student | staff | ai
  message: text("message").notNull(),
  createdAt: text("created_at").notNull().default(sql`(current_timestamp)`),
});

// ---------------------------------------------------------------------------
// Notifications
// ---------------------------------------------------------------------------

export const notifications = sqliteTable("notifications", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  universityId: integer("university_id").notNull().references(() => universities.id),
  audienceRole: text("audience_role"), // student | faculty | parent | admin | null=all
  studentId: integer("student_id").references(() => students.id),
  title: text("title").notNull(),
  message: text("message").notNull(),
  category: text("category").notNull(), // academic | fees | hostel | transport | general
  createdAt: text("created_at").notNull().default(sql`(current_timestamp)`),
  readAt: text("read_at"),
});

// ---------------------------------------------------------------------------
// Library
// ---------------------------------------------------------------------------

export const books = sqliteTable("books", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  isbn: text("isbn").notNull(),
  title: text("title").notNull(),
  author: text("author").notNull(),
  category: text("category").notNull(),
  publisher: text("publisher"),
  totalCopies: integer("total_copies").notNull(),
  availableCopies: integer("available_copies").notNull(),
  shelfLocation: text("shelf_location"),
});

export const bookLoans = sqliteTable(
  "book_loans",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    bookId: integer("book_id").notNull().references(() => books.id),
    studentId: integer("student_id").notNull().references(() => students.id),
    borrowedAt: text("borrowed_at").notNull(),
    dueAt: text("due_at").notNull(),
    returnedAt: text("returned_at"),
    status: text("status").notNull().default("active"), // active | returned | overdue
    fineAmount: real("fine_amount").notNull().default(0),
    finePaid: integer("fine_paid", { mode: "boolean" }).notNull().default(false),
  },
  (t) => [index("book_loans_student_idx").on(t.studentId)],
);

// ---------------------------------------------------------------------------
// Scholarships
// ---------------------------------------------------------------------------

export const scholarships = sqliteTable("scholarships", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  provider: text("provider").notNull(), // government | institute | private
  amount: real("amount").notNull(),
  eligibility: text("eligibility").notNull(), // human-readable criteria summary
  minAttendance: real("min_attendance"),
  maxFamilyIncome: real("max_family_income"),
  departmentCode: text("department_code"), // null = all departments
  deadline: text("deadline").notNull(),
  seatsAvailable: integer("seats_available").notNull(),
});

export const scholarshipApplications = sqliteTable(
  "scholarship_applications",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    scholarshipId: integer("scholarship_id").notNull().references(() => scholarships.id),
    studentId: integer("student_id").notNull().references(() => students.id),
    status: text("status").notNull().default("submitted"), // submitted | under_review | approved | rejected | disbursed
    appliedAt: text("applied_at").notNull(),
    decidedAt: text("decided_at"),
    remarks: text("remarks"),
    documentsSubmitted: integer("documents_submitted", { mode: "boolean" }).notNull().default(true),
  },
  (t) => [index("scholarship_applications_student_idx").on(t.studentId)],
);

// ---------------------------------------------------------------------------
// Legacy import tracking
// ---------------------------------------------------------------------------

export const importJobs = sqliteTable("import_jobs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  fileName: text("file_name").notNull(),
  sourceFormat: text("source_format").notNull(), // csv | xlsx | json
  targetEntity: text("target_entity").notNull(), // students | attendance | fees ...
  status: text("status").notNull().default("mapped"), // uploaded | mapped | validated | imported | failed
  columnMapping: text("column_mapping").notNull(), // JSON string
  rowCount: integer("row_count").notNull().default(0),
  importedCount: integer("imported_count").notNull().default(0),
  createdAt: text("created_at").notNull().default(sql`(current_timestamp)`),
});

// ---------------------------------------------------------------------------
// Relations (for query ergonomics)
// ---------------------------------------------------------------------------

export const studentsRelations = relations(students, ({ one, many }) => ({
  department: one(departments, { fields: [students.departmentId], references: [departments.id] }),
  programme: one(programmes, { fields: [students.programmeId], references: [programmes.id] }),
  attendance: many(attendance),
  fees: many(fees),
  examResults: many(examResults),
  certificates: many(certificates),
  helpdeskTickets: many(helpdeskTickets),
}));

export const departmentsRelations = relations(departments, ({ many, one }) => ({
  students: many(students),
  programmes: many(programmes),
  university: one(universities, { fields: [departments.universityId], references: [universities.id] }),
}));

export const coursesRelations = relations(courses, ({ one }) => ({
  programme: one(programmes, { fields: [courses.programmeId], references: [programmes.id] }),
}));
