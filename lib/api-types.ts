// Client-safe response shapes for the Rust backend's REST API. This is the
// contract the frontend codes against now that the data layer lives outside
// the Next.js process - see backend/src/routes/*.rs for what actually
// produces each shape.

export type RiskFactor = { label: string; detail: string; severity: "low" | "medium" | "high" };

export type StudentRisk = {
  studentId: number;
  rollNumber: string;
  name: string;
  department: string;
  departmentCode: string;
  programme: string;
  programmeId: number;
  semester: number;
  attendancePercentage: number;
  recentTestAverage: number;
  feeStatus: string;
  openTickets: number;
  riskScore: number;
  riskLevel: "low" | "medium" | "high";
  factors: RiskFactor[];
};

export type StudentProfile = {
  id: number;
  rollNumber: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  dob: string;
  gender: string;
  admissionYear: number;
  currentSemester: number;
  status: string;
  avatarColor: string | null;
  department: string;
  departmentCode: string;
  programme: string;
  degreeLevel: string;
};

export type FacultyProfile = {
  id: number;
  universityId: number;
  departmentId: number;
  employeeId: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  designation: string;
};

export type CourseAttendance = {
  courseId: number;
  courseCode: string;
  courseName: string;
  present: number;
  absent: number;
  late: number;
  excused: number;
  total: number;
  percentage: number;
};

export type AttendanceSummary = {
  studentId: number;
  courses: CourseAttendance[];
  overallPercentage: number;
  totalSessions: number;
};

export type TimetableSlot = {
  id: number;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  room: string;
  courseCode: string;
  courseName: string;
  facultyName: string | null;
  dayName: string;
};

export type FeeItem = {
  id: number;
  feeType: string;
  academicYear: string;
  semester: number;
  amount: number;
  amountPaid: number;
  pending: number;
  dueDate: string;
  status: string;
};

export type FeeStatus = {
  studentId: number;
  items: FeeItem[];
  totalDue: number;
  hasOverdue: boolean;
};

export type Exam = {
  id: number;
  name: string;
  examType: string;
  date: string;
  startTime: string;
  durationMinutes: number;
  maxMarks: number;
  courseCode: string;
  courseName: string;
};

export type ResultRow = {
  examId: number;
  examName: string;
  examType: string;
  date: string;
  maxMarks: number;
  courseCode: string;
  courseName: string;
  marksObtained: number;
  percentage: number;
};

export type ExamPendingRow = {
  id: number;
  name: string;
  date: string;
  courseCode: string;
  courseName: string;
  totalEntered: number;
  pendingPublish: number;
};

export type DocsData = {
  documents: { id: number; studentId: number; type: string; title: string; issuedAt: string; status: string }[];
  certificates: {
    id: number;
    studentId: number;
    type: string;
    status: string;
    requestedAt: string;
    issuedAt: string | null;
    verificationCode: string | null;
    purpose: string | null;
    requestedVia: string | null;
  }[];
};

export type CertificateType = "bonafide" | "enrollment" | "character" | "transfer";

export type HostelInfo = {
  hostelName: string;
  block: string;
  warden: string;
  roomNumber: string;
  capacity: number;
  assignedAt: string;
} | null;

export type TransportInfo = {
  routeId: number;
  routeName: string;
  routeCode: string;
  vehicleNumber: string;
  driverName: string;
  stopId: number;
  stopName: string;
  arrivalTime: string;
} | null;

export type TransportStop = { id: number; routeId: number; name: string; sequence: number; arrivalTime: string };

export type RouteWithStops = {
  id: number;
  universityId: number;
  name: string;
  code: string;
  vehicleNumber: string;
  driverName: string;
  capacity: number;
  stops: TransportStop[];
};

export type TicketCategory = "academic" | "hostel" | "transport" | "fees" | "it" | "general";

export type HelpdeskTicket = {
  id: number;
  ticketNumber: string;
  studentId: number | null;
  category: string;
  subject: string;
  description: string;
  status: string;
  priority: string;
  createdVia: string;
  assignedTo: string | null;
  createdAt: string;
  updatedAt: string;
};

export type LibraryBook = {
  id: number;
  isbn: string;
  title: string;
  author: string;
  category: string;
  publisher: string | null;
  totalCopies: number;
  availableCopies: number;
  shelfLocation: string | null;
};

export type LibraryLoan = {
  id: number;
  title: string;
  author: string;
  category: string;
  borrowedAt: string;
  dueAt: string;
  returnedAt: string | null;
  status: string;
  fineAmount: number;
  finePaid: boolean;
};

export type LoanData = { loans: LibraryLoan[]; activeCount: number; totalFine: number };

export type LibraryOverview = {
  titles: number;
  totalCopies: number;
  availableCopies: number;
  borrowedCopies: number;
  activeLoans: number;
  overdueLoans: number;
  outstandingFines: number;
  byCategory: { category: string; titles: number; copies: number }[];
};

export type OverdueLoan = { id: number; dueAt: string; fineAmount: number; title: string; rollNumber: string; firstName: string; lastName: string };

export type Scholarship = {
  id: number;
  name: string;
  provider: string;
  amount: number;
  eligibility: string;
  minAttendance: number | null;
  maxFamilyIncome: number | null;
  departmentCode: string | null;
  deadline: string;
  seatsAvailable: number;
  eligible: boolean;
  deadlinePassed: boolean;
  alreadyApplied: boolean;
};

export type ScholarshipApplicationSummary = {
  id: number;
  scholarshipId: number;
  status: string;
  appliedAt: string;
  decidedAt: string | null;
  remarks: string | null;
  scholarshipName?: string;
  amount?: number;
  statusSteps: string[];
  rejected: boolean;
};

export type StudentScholarshipView = { scholarships: Scholarship[]; applications: ScholarshipApplicationSummary[]; attendance: number };

export type ScholarshipApplication = {
  id: number;
  status: string;
  appliedAt: string;
  decidedAt: string | null;
  remarks: string | null;
  scholarshipName: string;
  amount: number;
  rollNumber: string;
  firstName: string;
  lastName: string;
  departmentCode: string;
};

export type ScholarshipAdminOverview = {
  total: number;
  pending: number;
  approved: number;
  rejected: number;
  disbursed: number;
  disbursedAmount: number;
};

export type FacultyCourseWithStats = {
  sectionId: number;
  courseId: number;
  courseCode: string;
  courseName: string;
  programmeId: number;
  semester: number;
  academicYear: string;
  studentCount: number;
  avgAttendance: number;
  atRiskCount: number;
};

export type FacultyRosterStudent = { id: number; rollNumber: string; firstName: string; lastName: string; avatarColor: string | null; risk: StudentRisk | null };

export type StudentDashboard = {
  profile: StudentProfile;
  attendance: AttendanceSummary;
  nextClass: (TimetableSlot & { daysFromNow: number }) | null;
  timetableCount: number;
  fees: FeeStatus;
  upcomingExams: Exam[];
  recentCertificate: DocsData["certificates"][number] | null;
  risk: StudentRisk | null;
};

export type AdminOverview = {
  totalStudents: number;
  avgAttendance: number;
  pendingFees: number;
  openGrievances: number;
  certificatesIssued: number;
  atRiskCount: number;
  byDepartment: { code: string; name: string; students: number; avgAttendance: number | null }[];
};

export type StaffDirectoryEntry = {
  id: number;
  employeeCode: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  designation: string;
  departmentId: number;
  departmentName: string;
  kind: "faculty" | "staff";
};

export type StaffOverview = { facultyCount: number; staffCount: number; totalStaff: number; byDepartment: { name: string; count: number }[] };

export type Admission = {
  id: number;
  rollNumber: string;
  firstName: string;
  lastName: string;
  email: string;
  admissionYear: number;
  status: string;
  department: string;
  programme: string;
  createdAt: string;
};

export type Programme = { id: number; name: string; departmentId: number; departmentName: string };

export type FinanceOverview = { totalBilled: number; totalCollected: number; totalPending: number; overdueCount: number; pendingCount: number };

export type FeeRecord = {
  id: number;
  studentId: number;
  rollNumber: string;
  firstName: string;
  lastName: string;
  feeType: string;
  amount: number;
  amountPaid: number;
  dueDate: string;
  status: string;
};

export type PermissionDef = { key: string; label: string; description: string; group: string; sensitive: boolean };

export type RoleRow = { id: number; key: string; name: string; description: string | null; category: string; isSystem: boolean; permissions: string[] };

export type UserRoleAssignment = { id: number; userId: number; roleId: number; scope: string | null; roleName: string; roleKey: string };

export type UserRow = {
  id: number;
  name: string;
  email: string;
  role: string;
  studentId: number | null;
  facultyId: number | null;
  parentId: number | null;
  employeeId: number | null;
  assignments: UserRoleAssignment[];
};

export type DeptRow = { id: number; name: string; code: string };

export type LegacyRow = { id: number; legacyRole: string; mappedRoleKey: string; notes: string | null };

export type ValidationIssue = { rowIndex: number; message: string };

export type ImportPreview = {
  totalRows: number;
  validRows: number;
  issueRows: number;
  issues: ValidationIssue[];
  entityCounts: { label: string; count: number }[];
};

export type AuditRow = {
  id: number;
  userId: number | null;
  userName: string;
  userRole: string;
  action: string;
  resource: string | null;
  result: string;
  createdAt: string;
};

// ---------------------------------------------------------------------------
// Portal features (profile edit, smart card, digital locker, leave, exam
// services, reports) - see backend/src/routes/{profile_edit,locker,account,
// leave,exam_form,exam_review,backlogs}.rs
// ---------------------------------------------------------------------------

export type ProfileEditCurrent = {
  fatherName: string | null;
  motherName: string | null;
  category: string | null;
  address: string | null;
  pincode: string | null;
  phone: string | null;
  email: string;
  emailVerified: boolean;
  dob: string;
};

export type ProfileEditRequestStatus = "pending" | "approved" | "rejected";

export type ProfileEditPayload = {
  fatherName: string | null;
  motherName: string | null;
  category: string | null;
  address: string | null;
  pincode: string | null;
};

export type PendingProfileEditRequest = {
  id: number;
  payload: ProfileEditPayload;
  documentIds: number[];
  status: ProfileEditRequestStatus;
  submittedAt: string;
};

export type ProfileEditRequestRow = PendingProfileEditRequest & {
  studentId: number;
  rollNumber: string;
  firstName: string;
  lastName: string;
  decidedAt: string | null;
  remarks: string | null;
};

export type LockerCategory = "photo" | "signature" | "age_proof" | "address_proof" | "marksheet" | "certificate" | "other";

export type LockerDocument = {
  id: number;
  category: LockerCategory;
  title: string;
  fileName: string;
  mimeType: string;
  status: string;
  uploadedAt: string;
};

export type PasswordChangeEntry = { id: number; changedAt: string; note: string | null };

export type LeaveType = "sick" | "casual" | "academic" | "other";

export type LeaveApplication = {
  id: number;
  leaveType: string;
  fromDate: string;
  toDate: string;
  reason: string;
  status: "pending" | "approved" | "rejected";
  appliedAt: string;
  decidedAt: string | null;
  remarks: string | null;
};

export type LeaveQueueItem = LeaveApplication & {
  applicantUserId: number;
  applicantName: string;
  applicantRole: string;
};

export type ExamFormWindow = { id: number; name: string; semester: number; opensAt: string; closesAt: string; published?: boolean };

export type ExamFormCourse = { id: number; code: string; name: string; credits: number };

export type ExamFormData = {
  student: { firstName: string; lastName: string; rollNumber: string; semester: number; programme: string; department: string };
  window: ExamFormWindow | null;
  courses: ExamFormCourse[];
  submission: { id: number; submittedAt: string; courseIds: number[] } | null;
};

export type ExamReviewKind = "revaluation" | "retotal" | "challenge";

export type ExamReviewEligibleResult = {
  examId: number;
  examName: string;
  maxMarks: number;
  courseId: number;
  courseCode: string;
  courseName: string;
  marksObtained: number;
};

export type ExamReviewApplication = {
  id: number;
  examId: number;
  examName: string;
  courseId: number;
  courseCode: string;
  kind: ExamReviewKind;
  feeAmount: number;
  status: "submitted" | "under_review" | "approved" | "rejected" | "completed";
  appliedAt: string;
  decidedAt: string | null;
  remarks: string | null;
  parentApplicationId: number | null;
};

export type ExamReviewData = {
  eligibleResults: ExamReviewEligibleResult[];
  applications: ExamReviewApplication[];
  fees: { revaluation: number; retotal: number; challenge: number };
};

export type ExamReviewQueueItem = {
  id: number;
  examName: string;
  courseCode: string;
  kind: ExamReviewKind;
  feeAmount: number;
  status: string;
  appliedAt: string;
  remarks: string | null;
  rollNumber: string;
  firstName: string;
  lastName: string;
};

export type BacklogCourse = {
  courseId: number;
  courseCode: string;
  courseName: string;
  semester: number;
  examName: string;
  date: string;
  marksObtained: number;
  maxMarks: number;
  percentage: number;
  status: "pending" | "cleared";
};

export type PaymentReceipt = {
  id: number;
  amount: number;
  method: string;
  transactionRef: string;
  status: string;
  paidAt: string;
  feeType: string;
  academicYear: string;
  semester: number;
};

export type AttendanceHistoryRecord = { date: string; status: string; courseCode: string; courseName: string };

export type Notice = {
  id: number;
  audienceRole: string | null;
  studentId: number | null;
  title: string;
  message: string;
  category: string;
  createdAt: string;
  readAt: string | null;
};
