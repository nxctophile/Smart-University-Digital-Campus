use std::env;

pub const COOKIE_NAME: &str = "campus_demo_user";

pub struct Config {
    pub database_url: String,
    pub port: u16,
}

impl Config {
    pub fn from_env() -> Self {
        Config {
            database_url: env::var("DATABASE_URL")
                .unwrap_or_else(|_| "postgres://campus:campus@localhost:5432/campus".to_string()),
            port: env::var("PORT")
                .ok()
                .and_then(|v| v.parse().ok())
                .unwrap_or(4000),
        }
    }
}

pub struct PermissionDef {
    pub key: &'static str,
    pub label: &'static str,
    pub description: &'static str,
    pub group: &'static str,
    pub sensitive: bool,
}

pub const PERMISSIONS: &[PermissionDef] = &[
    p("profile.view", "View profile", "View a student's identity & enrollment details.", "profile", false),
    p("profile.edit", "Edit profile", "Edit a student's own contact details.", "profile", false),
    p("attendance.view", "View attendance", "View attendance records.", "attendance", false),
    p("marks.view", "View marks/results", "View published exam results.", "marks", false),
    p("timetable.view", "View timetable", "View class timetable.", "timetable", false),
    p("exam.schedule.view", "View exam schedule", "View upcoming/past exam schedule.", "exam", false),
    p("documents.view", "View documents", "View issued documents & certificates.", "documents", false),
    p("documents.certificate.request", "Request certificate", "Request a new certificate.", "documents", true),
    p("fees.status.view", "View fee status", "View fee balance & payment status.", "fees", false),
    p("fees.pay", "Pay fees", "Make an online fee payment.", "fees", true),
    p("scholarship.status.view", "View scholarship status", "View eligible scholarships & application status.", "scholarship", false),
    p("scholarship.apply", "Apply for scholarship", "Submit a scholarship application.", "scholarship", true),
    p("library.loan.view", "View library loans", "View borrowed books, due dates & fines.", "library", false),
    p("library.catalog.view", "Browse library catalog", "Search the library catalog.", "library", false),
    p("helpdesk.ticket.view", "View helpdesk tickets", "View own helpdesk tickets.", "helpdesk", false),
    p("helpdesk.ticket.create", "Create helpdesk ticket", "File a helpdesk complaint/request.", "helpdesk", true),
    p("notice.view", "View notices", "View campus notifications/notices.", "notifications", false),
    p("hostel.view", "View hostel info", "View hostel/room assignment.", "hostel", false),
    p("transport.view", "View transport info", "View assigned transport route/stop.", "transport", false),
    p("transport.update", "Update transport assignment", "Change assigned transport route/stop.", "transport", false),
    p("placement.view", "View placement info", "View placement drives & own applications.", "placement", false),
    p("student.view", "View students", "View student directory / roster records.", "student", false),
    p("student.performance.view", "View student performance", "View a student's attendance + academic risk profile.", "student", false),
    p("attendance.create", "Mark attendance", "Record attendance for a class session.", "attendance", false),
    p("attendance.edit", "Edit attendance", "Correct a previously recorded attendance entry.", "attendance", false),
    p("marks.create", "Enter marks", "Enter exam marks for students.", "marks", false),
    p("marks.edit", "Edit marks", "Correct previously entered exam marks.", "marks", false),
    p("class.view", "View class/section", "View assigned classes/sections.", "student", false),
    p("student.communication.create", "Message students/parents", "Send an academic alert to students or parents.", "student", true),
    p("student.manage", "Manage students", "Create/update/deactivate any student record.", "student", false),
    p("student.onboard", "Onboard student", "Create a new student record from an admission.", "admission", false),
    p("faculty.manage", "Manage faculty", "Create/update faculty records & assignments.", "faculty", false),
    p("employee.view", "View employees", "View campus staff directory.", "employee", false),
    p("employee.manage", "Manage employees", "Create/update/deactivate staff records.", "employee", false),
    p("employee.attendance.view", "View staff attendance", "View staff attendance records.", "employee", false),
    p("employee.leave.manage", "Manage staff leave", "Approve/reject staff leave requests.", "employee", false),
    p("department.manage", "Manage departments", "Create/update departments, programmes & courses.", "department", false),
    p("report.view", "View reports", "View institution-wide reports & analytics.", "reports", false),
    p("data.import", "Import legacy data", "Run the legacy-data import pipeline.", "system", true),
    p("admission.application.view", "View admission applications", "View admission applications.", "admission", false),
    p("admission.application.create", "Create admission application", "Register a new admission application.", "admission", false),
    p("admission.application.edit", "Edit admission application", "Update an admission application.", "admission", false),
    p("admission.document.verify", "Verify admission documents", "Mark admission documents as verified.", "admission", true),
    p("scholarship.application.view", "View scholarship applications", "View all scholarship applications.", "scholarship", false),
    p("scholarship.application.verify", "Verify scholarship application", "Review a scholarship application.", "scholarship", false),
    p("scholarship.document.verify", "Verify scholarship documents", "Mark scholarship documents as verified.", "scholarship", false),
    p("scholarship.status.update", "Decide scholarship application", "Approve/reject/disburse a scholarship application.", "scholarship", true),
    p("finance.fees.view", "View fee records", "View any student's fee records.", "finance", false),
    p("finance.fees.collect", "Collect fees", "Record a fee payment / collection.", "finance", true),
    p("finance.transaction.view", "View transactions", "View the institution payment ledger.", "finance", false),
    p("finance.vendor_payment.manage", "Manage vendor payments", "Record/manage vendor payments.", "finance", true),
    p("payroll.view", "View payroll", "View staff payroll records.", "payroll", false),
    p("payroll.manage", "Manage payroll", "Process staff payroll.", "payroll", true),
    p("exam.schedule.manage", "Manage exam schedule", "Create/update exam schedules.", "exam", true),
    p("exam.application.manage", "Manage exam applications", "Manage student exam-form applications.", "exam", true),
    p("exam.marks.manage", "Manage exam marks (dept)", "Enter/correct marks at the examination-department level.", "exam", true),
    p("exam.results.manage", "Manage exam results", "Compile exam results ahead of publication.", "exam", true),
    p("exam.results.publish", "Publish exam results", "Release exam results to students/parents.", "exam", true),
    p("placement.drive.manage", "Manage placement drives", "Create/update placement drives.", "placement", false),
    p("placement.company.manage", "Manage recruiter companies", "Manage recruiting company records.", "placement", false),
    p("student.placement.view", "View student placement status", "View a student's placement applications.", "placement", false),
    p("student.placement.update", "Update student placement status", "Update a student's placement status.", "placement", false),
    p("library.book.manage", "Manage library catalog", "Add/update/remove books in the catalog.", "library", false),
    p("library.issue.create", "Issue library book", "Issue a book to a student.", "library", false),
    p("library.issue.return", "Process book return", "Process a book return / clear a loan.", "library", false),
    p("facility.view", "View facilities", "View campus facilities & tickets.", "facility", false),
    p("facility.maintenance.create", "Log maintenance request", "Log a new maintenance issue.", "facility", false),
    p("facility.maintenance.update", "Update maintenance request", "Update/resolve a maintenance issue.", "facility", false),
    p("campus.issue.manage", "Manage campus issues", "Triage & resolve helpdesk/facility tickets.", "facility", false),
    p("user.manage", "Manage users", "Create/deactivate user accounts & assign roles.", "system", true),
    p("role.manage", "Manage roles", "Create/edit/delete roles.", "system", true),
    p("permission.manage", "Manage role permissions", "Assign/remove permissions on a role.", "system", true),
    p("system.config", "System configuration", "Configure system-wide settings.", "system", true),
    p("audit.view", "View audit log", "View the security audit trail.", "system", false),

    // ---- Portal self-service (profile, locker, leave, exam services) ----
    p("profile.update.request", "Request profile update", "Submit a profile correction for review.", "profile", true),
    p("profile.update.review", "Review profile updates", "Approve/reject a student's submitted profile changes.", "admission", true),
    p("documents.locker.manage", "Manage digital locker", "Upload/remove personal documents in the digital locker.", "documents", false),
    p("leave.apply", "Apply for leave", "Submit a leave application.", "student", false),
    p("leave.manage", "Manage leave applications", "Approve/reject leave applications.", "student", true),
    p("exam.form.fill", "Fill exam form", "Confirm courses and submit the exam form for a published window.", "exam", false),
    p("exam.form.manage", "Manage exam form windows", "Publish/close exam form windows.", "exam", true),
    p("exam.review.apply", "Apply reval/retotal/challenge", "Apply for revaluation, retotaling, or a result challenge.", "exam", true),
    p("exam.review.manage", "Manage reval/retotal/challenge", "Decide revaluation/retotal/challenge applications.", "exam", true),
];

const fn p(key: &'static str, label: &'static str, description: &'static str, group: &'static str, sensitive: bool) -> PermissionDef {
    PermissionDef { key, label, description, group, sensitive }
}

pub fn is_permission_key(key: &str) -> bool {
    PERMISSIONS.iter().any(|def| def.key == key)
}

pub fn is_sensitive(key: &str) -> bool {
    PERMISSIONS.iter().any(|def| def.key == key && def.sensitive)
}

pub struct LegacyRoleMapping {
    pub legacy_role: &'static str,
    pub mapped_role_key: &'static str,
    pub notes: Option<&'static str>,
}

pub const DEFAULT_LEGACY_ROLE_MAP: &[LegacyRoleMapping] = &[
    LegacyRoleMapping { legacy_role: "Teacher", mapped_role_key: "faculty", notes: None },
    LegacyRoleMapping { legacy_role: "Principal", mapped_role_key: "hod", notes: Some("Review before import - may warrant Administrator instead.") },
    LegacyRoleMapping { legacy_role: "Accountant", mapped_role_key: "accounts_officer", notes: None },
    LegacyRoleMapping { legacy_role: "Student", mapped_role_key: "student", notes: None },
    LegacyRoleMapping { legacy_role: "Parent", mapped_role_key: "parent", notes: None },
    LegacyRoleMapping { legacy_role: "Guardian", mapped_role_key: "parent", notes: None },
    LegacyRoleMapping { legacy_role: "Admission Officer", mapped_role_key: "admission_officer", notes: None },
    LegacyRoleMapping { legacy_role: "Registrar", mapped_role_key: "administrator", notes: None },
    LegacyRoleMapping { legacy_role: "Librarian", mapped_role_key: "librarian", notes: None },
    LegacyRoleMapping { legacy_role: "HR Executive", mapped_role_key: "hr_officer", notes: None },
    LegacyRoleMapping { legacy_role: "Placement Officer", mapped_role_key: "placement_officer", notes: None },
    LegacyRoleMapping { legacy_role: "Exam Controller", mapped_role_key: "examination_officer", notes: None },
];
