/**
 * Central permission catalog. This is the single source of truth for every
 * permission string the system understands - resource.action (or
 * resource.subresource.action) shaped, per the RBAC design doc.
 *
 * Roles (DB-backed, admin-editable) grant a subset of these keys. Nothing
 * outside this file should invent a new permission string.
 */

export type PermissionGroup =
  | "profile"
  | "attendance"
  | "marks"
  | "timetable"
  | "documents"
  | "fees"
  | "scholarship"
  | "library"
  | "helpdesk"
  | "notifications"
  | "hostel"
  | "transport"
  | "placement"
  | "student"
  | "faculty"
  | "employee"
  | "department"
  | "admission"
  | "exam"
  | "finance"
  | "payroll"
  | "facility"
  | "system"
  | "reports";

export type PermissionDef = {
  key: string;
  label: string;
  description: string;
  group: PermissionGroup;
  /** Marks actions the audit log + AI confirm-before-execute treat as sensitive. */
  sensitive?: boolean;
};

export const PERMISSIONS = [
  // ---- Self-service (student / parent / anyone viewing "their" record) ----
  { key: "profile.view", label: "View profile", description: "View a student's identity & enrollment details.", group: "profile" },
  { key: "profile.edit", label: "Edit profile", description: "Edit a student's own contact details.", group: "profile" },
  { key: "attendance.view", label: "View attendance", description: "View attendance records.", group: "attendance" },
  { key: "marks.view", label: "View marks/results", description: "View published exam results.", group: "marks" },
  { key: "timetable.view", label: "View timetable", description: "View class timetable.", group: "timetable" },
  { key: "exam.schedule.view", label: "View exam schedule", description: "View upcoming/past exam schedule.", group: "exam" },
  { key: "documents.view", label: "View documents", description: "View issued documents & certificates.", group: "documents" },
  { key: "documents.certificate.request", label: "Request certificate", description: "Request a new certificate.", group: "documents", sensitive: true },
  { key: "fees.status.view", label: "View fee status", description: "View fee balance & payment status.", group: "fees" },
  { key: "fees.pay", label: "Pay fees", description: "Make an online fee payment.", group: "fees", sensitive: true },
  { key: "scholarship.status.view", label: "View scholarship status", description: "View eligible scholarships & application status.", group: "scholarship" },
  { key: "scholarship.apply", label: "Apply for scholarship", description: "Submit a scholarship application.", group: "scholarship", sensitive: true },
  { key: "library.loan.view", label: "View library loans", description: "View borrowed books, due dates & fines.", group: "library" },
  { key: "library.catalog.view", label: "Browse library catalog", description: "Search the library catalog.", group: "library" },
  { key: "helpdesk.ticket.view", label: "View helpdesk tickets", description: "View own helpdesk tickets.", group: "helpdesk" },
  { key: "helpdesk.ticket.create", label: "Create helpdesk ticket", description: "File a helpdesk complaint/request.", group: "helpdesk", sensitive: true },
  { key: "notice.view", label: "View notices", description: "View campus notifications/notices.", group: "notifications" },
  { key: "hostel.view", label: "View hostel info", description: "View hostel/room assignment.", group: "hostel" },
  { key: "transport.view", label: "View transport info", description: "View assigned transport route/stop.", group: "transport" },
  { key: "transport.update", label: "Update transport assignment", description: "Change assigned transport route/stop.", group: "transport" },
  { key: "placement.view", label: "View placement info", description: "View placement drives & own applications.", group: "placement" },

  // ---- Faculty (scoped to their assigned classes/courses) ----
  { key: "student.view", label: "View students", description: "View student directory / roster records.", group: "student" },
  { key: "student.performance.view", label: "View student performance", description: "View a student's attendance + academic risk profile.", group: "student" },
  { key: "attendance.create", label: "Mark attendance", description: "Record attendance for a class session.", group: "attendance" },
  { key: "attendance.edit", label: "Edit attendance", description: "Correct a previously recorded attendance entry.", group: "attendance" },
  { key: "marks.create", label: "Enter marks", description: "Enter exam marks for students.", group: "marks" },
  { key: "marks.edit", label: "Edit marks", description: "Correct previously entered exam marks.", group: "marks" },
  { key: "class.view", label: "View class/section", description: "View assigned classes/sections.", group: "student" },
  { key: "student.communication.create", label: "Message students/parents", description: "Send an academic alert to students or parents.", group: "student", sensitive: true },

  // ---- Administrator / management ----
  { key: "student.manage", label: "Manage students", description: "Create/update/deactivate any student record.", group: "student" },
  { key: "student.onboard", label: "Onboard student", description: "Create a new student record from an admission.", group: "admission" },
  { key: "faculty.manage", label: "Manage faculty", description: "Create/update faculty records & assignments.", group: "faculty" },
  { key: "employee.view", label: "View employees", description: "View campus staff directory.", group: "employee" },
  { key: "employee.manage", label: "Manage employees", description: "Create/update/deactivate staff records.", group: "employee" },
  { key: "employee.attendance.view", label: "View staff attendance", description: "View staff attendance records.", group: "employee" },
  { key: "employee.leave.manage", label: "Manage staff leave", description: "Approve/reject staff leave requests.", group: "employee" },
  { key: "department.manage", label: "Manage departments", description: "Create/update departments, programmes & courses.", group: "department" },
  { key: "report.view", label: "View reports", description: "View institution-wide reports & analytics.", group: "reports" },
  { key: "data.import", label: "Import legacy data", description: "Run the legacy-data import pipeline.", group: "system", sensitive: true },

  // ---- Admission Cell ----
  { key: "admission.application.view", label: "View admission applications", description: "View admission applications.", group: "admission" },
  { key: "admission.application.create", label: "Create admission application", description: "Register a new admission application.", group: "admission" },
  { key: "admission.application.edit", label: "Edit admission application", description: "Update an admission application.", group: "admission" },
  { key: "admission.document.verify", label: "Verify admission documents", description: "Mark admission documents as verified.", group: "admission", sensitive: true },

  // ---- Scholarship Department ----
  { key: "scholarship.application.view", label: "View scholarship applications", description: "View all scholarship applications.", group: "scholarship" },
  { key: "scholarship.application.verify", label: "Verify scholarship application", description: "Review a scholarship application.", group: "scholarship" },
  { key: "scholarship.document.verify", label: "Verify scholarship documents", description: "Mark scholarship documents as verified.", group: "scholarship" },
  { key: "scholarship.status.update", label: "Decide scholarship application", description: "Approve/reject/disburse a scholarship application.", group: "scholarship", sensitive: true },

  // ---- Accounts Department ----
  { key: "finance.fees.view", label: "View fee records", description: "View any student's fee records.", group: "finance" },
  { key: "finance.fees.collect", label: "Collect fees", description: "Record a fee payment / collection.", group: "finance", sensitive: true },
  { key: "finance.transaction.view", label: "View transactions", description: "View the institution payment ledger.", group: "finance" },
  { key: "finance.vendor_payment.manage", label: "Manage vendor payments", description: "Record/manage vendor payments.", group: "finance", sensitive: true },
  { key: "payroll.view", label: "View payroll", description: "View staff payroll records.", group: "payroll" },
  { key: "payroll.manage", label: "Manage payroll", description: "Process staff payroll.", group: "payroll", sensitive: true },

  // ---- Examination Department (treated as highly sensitive) ----
  { key: "exam.schedule.manage", label: "Manage exam schedule", description: "Create/update exam schedules.", group: "exam", sensitive: true },
  { key: "exam.application.manage", label: "Manage exam applications", description: "Manage student exam-form applications.", group: "exam", sensitive: true },
  { key: "exam.marks.manage", label: "Manage exam marks (dept)", description: "Enter/correct marks at the examination-department level.", group: "exam", sensitive: true },
  { key: "exam.results.manage", label: "Manage exam results", description: "Compile exam results ahead of publication.", group: "exam", sensitive: true },
  { key: "exam.results.publish", label: "Publish exam results", description: "Release exam results to students/parents.", group: "exam", sensitive: true },

  // ---- HR Department ----
  // (employee.* above is shared with admin; HR gets it via role grant)

  // ---- Training & Placement ----
  { key: "placement.drive.manage", label: "Manage placement drives", description: "Create/update placement drives.", group: "placement" },
  { key: "placement.company.manage", label: "Manage recruiter companies", description: "Manage recruiting company records.", group: "placement" },
  { key: "student.placement.view", label: "View student placement status", description: "View a student's placement applications.", group: "placement" },
  { key: "student.placement.update", label: "Update student placement status", description: "Update a student's placement status.", group: "placement" },

  // ---- Central Library ----
  { key: "library.book.manage", label: "Manage library catalog", description: "Add/update/remove books in the catalog.", group: "library" },
  { key: "library.issue.create", label: "Issue library book", description: "Issue a book to a student.", group: "library" },
  { key: "library.issue.return", label: "Process book return", description: "Process a book return / clear a loan.", group: "library" },

  // ---- Maintenance & Welfare / IT ----
  { key: "facility.view", label: "View facilities", description: "View campus facilities & tickets.", group: "facility" },
  { key: "facility.maintenance.create", label: "Log maintenance request", description: "Log a new maintenance issue.", group: "facility" },
  { key: "facility.maintenance.update", label: "Update maintenance request", description: "Update/resolve a maintenance issue.", group: "facility" },
  { key: "campus.issue.manage", label: "Manage campus issues", description: "Triage & resolve helpdesk/facility tickets.", group: "facility" },

  // ---- System / RBAC administration ----
  { key: "user.manage", label: "Manage users", description: "Create/deactivate user accounts & assign roles.", group: "system", sensitive: true },
  { key: "role.manage", label: "Manage roles", description: "Create/edit/delete roles.", group: "system", sensitive: true },
  { key: "permission.manage", label: "Manage role permissions", description: "Assign/remove permissions on a role.", group: "system", sensitive: true },
  { key: "system.config", label: "System configuration", description: "Configure system-wide settings.", group: "system", sensitive: true },
  { key: "audit.view", label: "View audit log", description: "View the security audit trail.", group: "system" },
] as const satisfies readonly PermissionDef[];

export type PermissionKey = (typeof PERMISSIONS)[number]["key"];

export const PERMISSION_KEYS: readonly PermissionKey[] = PERMISSIONS.map((p) => p.key);

const PERMISSION_SET: ReadonlySet<string> = new Set(PERMISSION_KEYS);

export function isPermissionKey(value: string): value is PermissionKey {
  return PERMISSION_SET.has(value);
}

export function getPermissionDef(key: string): PermissionDef | undefined {
  return PERMISSIONS.find((p) => p.key === key);
}

export const PERMISSION_GROUPS: PermissionGroup[] = Array.from(new Set(PERMISSIONS.map((p) => p.group)));
