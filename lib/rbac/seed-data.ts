import { PERMISSION_KEYS, type PermissionKey } from "./permissions";

export type RoleCategory = "administrator" | "faculty" | "parent" | "student" | "employee";

export type RoleTemplate = {
  key: string;
  name: string;
  description: string;
  category: RoleCategory;
  permissions: PermissionKey[];
};

const ALL: PermissionKey[] = [...PERMISSION_KEYS];

const p = (...keys: PermissionKey[]) => keys;

/**
 * The default system role catalog. Seeded once by `db:seed`; from then on
 * roles/permissions live in the database and are editable from
 * /admin/rbac. Adding a brand-new role later (e.g. "Placement Coordinator")
 * never requires touching the authorization engine - see lib/rbac/authorize.ts.
 */
export const ROLE_TEMPLATES: RoleTemplate[] = [
  {
    key: "administrator",
    name: "Administrator",
    description: "Senior campus management - full access to every module and configuration surface.",
    category: "administrator",
    permissions: ALL,
  },
  {
    key: "it_administrator",
    name: "IT Administrator",
    description: "System/user/role configuration and campus infrastructure tickets.",
    category: "administrator",
    permissions: p(
      "system.config", "user.manage", "role.manage", "permission.manage", "audit.view",
      "facility.view", "facility.maintenance.update", "campus.issue.manage", "report.view",
    ),
  },
  {
    key: "finance_head",
    name: "Finance Head / CFO",
    description: "Institution-wide finance and payroll oversight.",
    category: "administrator",
    permissions: p(
      "finance.fees.view", "finance.fees.collect", "finance.transaction.view", "finance.vendor_payment.manage",
      "payroll.view", "payroll.manage", "report.view",
    ),
  },
  {
    key: "hod",
    name: "Head of Department",
    description: "Department-scoped academic administration (assigned scope: their department).",
    category: "administrator",
    permissions: p(
      "student.view", "student.performance.view", "attendance.view", "marks.view",
      "faculty.manage", "report.view", "student.communication.create", "class.view",
    ),
  },
  {
    key: "faculty",
    name: "Faculty",
    description: "Teaching staff - scoped to their own assigned classes/courses.",
    category: "faculty",
    permissions: p(
      "student.view", "attendance.view", "attendance.create", "attendance.edit",
      "marks.view", "marks.create", "marks.edit", "class.view", "timetable.view",
      "student.performance.view", "profile.view",
    ),
  },
  {
    key: "class_mentor",
    name: "Class Mentor",
    description: "Stackable add-on for a faculty member acting as class in-charge.",
    category: "faculty",
    permissions: p("student.performance.view", "attendance.view", "student.communication.create"),
  },
  {
    key: "parent",
    name: "Parent",
    description: "Read-only access to their own linked child's records.",
    category: "parent",
    permissions: p(
      "profile.view", "attendance.view", "marks.view", "timetable.view", "exam.schedule.view",
      "fees.status.view", "scholarship.status.view", "documents.view", "notice.view", "placement.view",
    ),
  },
  {
    key: "student",
    name: "Student",
    description: "Access to their own academic and personal information only.",
    category: "student",
    permissions: p(
      "profile.view", "profile.edit", "attendance.view", "marks.view", "timetable.view",
      "exam.schedule.view", "documents.view", "documents.certificate.request",
      "fees.status.view", "fees.pay", "scholarship.status.view", "scholarship.apply",
      "library.loan.view", "library.catalog.view", "helpdesk.ticket.view", "helpdesk.ticket.create",
      "notice.view", "hostel.view", "transport.view", "transport.update", "placement.view",
    ),
  },
  {
    key: "admission_officer",
    name: "Admission Officer",
    description: "Admission Cell - applications, document verification, onboarding.",
    category: "employee",
    permissions: p(
      "admission.application.view", "admission.application.create", "admission.application.edit",
      "admission.document.verify", "student.onboard", "student.view",
    ),
  },
  {
    key: "scholarship_officer",
    name: "Scholarship Officer",
    description: "Scholarship Department - review and decide applications.",
    category: "employee",
    permissions: p(
      "scholarship.application.view", "scholarship.application.verify",
      "scholarship.document.verify", "scholarship.status.update",
    ),
  },
  {
    key: "accounts_officer",
    name: "Accounts Officer",
    description: "Accounts Department - fee collection, transactions, vendor payments.",
    category: "employee",
    permissions: p(
      "finance.fees.view", "finance.fees.collect", "finance.transaction.view",
      "finance.vendor_payment.manage", "payroll.view",
    ),
  },
  {
    key: "examination_officer",
    name: "Examination Officer",
    description: "Examination Department - schedules, applications, and results (highly sensitive).",
    category: "employee",
    permissions: p(
      "exam.schedule.manage", "exam.application.manage", "exam.marks.manage",
      "exam.results.manage", "exam.results.publish",
    ),
  },
  {
    key: "hr_officer",
    name: "HR Officer",
    description: "HR Department - staff records, attendance, leave, payroll view.",
    category: "employee",
    permissions: p("employee.view", "employee.manage", "employee.attendance.view", "employee.leave.manage", "payroll.view"),
  },
  {
    key: "placement_officer",
    name: "Placement Officer",
    description: "Training & Placement - drives, companies, student placement status.",
    category: "employee",
    permissions: p("placement.drive.manage", "placement.company.manage", "student.placement.view", "student.placement.update"),
  },
  {
    key: "librarian",
    name: "Librarian",
    description: "Central Library - catalog, issues, and returns.",
    category: "employee",
    permissions: p("library.book.manage", "library.issue.create", "library.issue.return", "library.catalog.view"),
  },
  {
    key: "maintenance_officer",
    name: "Maintenance & Welfare Officer",
    description: "Maintenance & Welfare - facility issues and campus tickets.",
    category: "employee",
    permissions: p("facility.view", "facility.maintenance.create", "facility.maintenance.update", "campus.issue.manage"),
  },
];

/** Roles whose single assignment scope is unrestricted ({all:true}) rather
 * than resolved dynamically from the caller's own identity. */
export const GLOBAL_SCOPE_ROLE_KEYS = new Set([
  "administrator", "it_administrator", "finance_head",
  "admission_officer", "scholarship_officer", "accounts_officer",
  "examination_officer", "hr_officer", "placement_officer", "librarian", "maintenance_officer",
]);

/** Default legacy-system role label -> new RBAC role key mapping, shown and
 * editable in /admin/rbac (section 18 of the spec). */
export const DEFAULT_LEGACY_ROLE_MAP: { legacyRole: string; mappedRoleKey: string; notes?: string }[] = [
  { legacyRole: "Teacher", mappedRoleKey: "faculty" },
  { legacyRole: "Principal", mappedRoleKey: "hod", notes: "Review before import - may warrant Administrator instead." },
  { legacyRole: "Accountant", mappedRoleKey: "accounts_officer" },
  { legacyRole: "Student", mappedRoleKey: "student" },
  { legacyRole: "Parent", mappedRoleKey: "parent" },
  { legacyRole: "Guardian", mappedRoleKey: "parent" },
  { legacyRole: "Admission Officer", mappedRoleKey: "admission_officer" },
  { legacyRole: "Registrar", mappedRoleKey: "administrator" },
  { legacyRole: "Librarian", mappedRoleKey: "librarian" },
  { legacyRole: "HR Executive", mappedRoleKey: "hr_officer" },
  { legacyRole: "Placement Officer", mappedRoleKey: "placement_officer" },
  { legacyRole: "Exam Controller", mappedRoleKey: "examination_officer" },
];
