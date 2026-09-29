/**
 * AI tool layer.
 *
 * The AI never touches the database directly. Every tool below is a thin,
 * typed wrapper around the application/service layer (lib/services/*), so
 * the same authorization rules that protect the REST API also protect the
 * AI. `parameters` is a JSON-Schema fragment in OpenAI/Groq function-calling
 * shape - it's what lets a real LLM (see lib/ai/groq-provider.ts) select a
 * tool and fill in arguments; the deterministic RuleBasedProvider ignores it
 * and fills args itself.
 */
import { AccessContext } from "@/lib/services/context";
import * as studentsSvc from "@/lib/services/students";
import * as attendanceSvc from "@/lib/services/attendance";
import * as timetableSvc from "@/lib/services/timetable";
import * as feesSvc from "@/lib/services/fees";
import * as examsSvc from "@/lib/services/exams";
import * as documentsSvc from "@/lib/services/documents";
import * as helpdeskSvc from "@/lib/services/helpdesk";
import * as hostelSvc from "@/lib/services/hostel";
import * as transportSvc from "@/lib/services/transport";
import * as riskSvc from "@/lib/services/risk";
import * as adminSvc from "@/lib/services/admin";
import * as librarySvc from "@/lib/services/library";
import * as scholarshipSvc from "@/lib/services/scholarships";

export type JSONSchema = {
  type: "object";
  properties: Record<string, { type: string; description?: string; enum?: string[]; items?: { type: string } }>;
  required?: string[];
};

export type ToolDefinition = {
  description: string;
  /** Actions that must never fire from a raw LLM tool-call - the caller
   * gets a confirm button instead, same as the rule-based provider. */
  sensitive?: boolean;
  parameters: JSONSchema;
  run: (ctx: AccessContext, args: Record<string, unknown>) => Promise<unknown>;
};

const EMPTY_SCHEMA: JSONSchema = { type: "object", properties: {} };

export const tools: Record<string, ToolDefinition> = {
  get_student_profile: {
    description: "Fetch a student's identity, programme and enrollment details.",
    parameters: EMPTY_SCHEMA,
    run: (ctx, args) => studentsSvc.getStudentProfile(ctx, args.studentId as number | undefined),
  },
  get_attendance: {
    description: "Fetch a student's attendance broken down by course.",
    parameters: EMPTY_SCHEMA,
    run: (ctx, args) => attendanceSvc.getAttendanceSummary(ctx, args.studentId as number | undefined),
  },
  get_timetable: {
    description: "Fetch a student's weekly class timetable.",
    parameters: EMPTY_SCHEMA,
    run: (ctx, args) => timetableSvc.getStudentTimetable(ctx, args.studentId as number | undefined),
  },
  get_fee_status: {
    description: "Fetch a student's fee balance and payment status.",
    parameters: EMPTY_SCHEMA,
    run: (ctx, args) => feesSvc.getFeeStatus(ctx, args.studentId as number | undefined),
  },
  get_exam_schedule: {
    description: "Fetch a student's upcoming exam schedule.",
    parameters: EMPTY_SCHEMA,
    run: (ctx, args) => examsSvc.getExamSchedule(ctx, args.studentId as number | undefined),
  },
  search_documents: {
    description: "List a student's available documents and issued certificates.",
    parameters: EMPTY_SCHEMA,
    run: (ctx, args) => documentsSvc.listDocuments(ctx, args.studentId as number | undefined),
  },
  request_certificate: {
    description: "Verify eligibility and generate a certificate for a student.",
    parameters: {
      type: "object",
      properties: {
        type: { type: "string", enum: ["bonafide", "enrollment", "character", "transfer"], description: "Certificate type" },
        purpose: { type: "string", description: "Why the student needs this certificate" },
      },
    },
    run: (ctx, args) =>
      documentsSvc.requestCertificate(
        ctx,
        args.studentId as number | undefined,
        (args.type as documentsSvc.CertificateType) ?? "bonafide",
        (args.purpose as string) ?? "General purpose",
        "ai",
      ),
  },
  create_helpdesk_ticket: {
    description: "File a helpdesk ticket on behalf of a student. Always confirm with the user before calling this.",
    sensitive: true,
    parameters: {
      type: "object",
      properties: {
        category: { type: "string", enum: ["academic", "hostel", "transport", "fees", "it", "general"] },
        subject: { type: "string", description: "Short ticket subject" },
        description: { type: "string", description: "Full description of the issue" },
      },
      required: ["category", "subject", "description"],
    },
    run: (ctx, args) =>
      helpdeskSvc.createTicket(
        ctx,
        args.studentId as number | undefined,
        {
          category: args.category as helpdeskSvc.TicketCategory,
          subject: args.subject as string,
          description: args.description as string,
        },
        "ai",
      ),
  },
  get_transport_status: {
    description: "Fetch a student's assigned transport route and stop.",
    parameters: EMPTY_SCHEMA,
    run: (ctx, args) => transportSvc.getTransportInfo(ctx, args.studentId as number | undefined),
  },
  get_hostel_information: {
    description: "Fetch a student's hostel block and room assignment.",
    parameters: EMPTY_SCHEMA,
    run: (ctx, args) => hostelSvc.getHostelInfo(ctx, args.studentId as number | undefined),
  },
  get_student_performance: {
    description: "Fetch a student's combined attendance + academic risk profile.",
    parameters: {
      type: "object",
      properties: { studentId: { type: "number", description: "Student id (required for faculty/admin callers)" } },
    },
    run: (ctx, args) => riskSvc.getStudentRiskForCaller(ctx, args.studentId as number | undefined),
  },
  search_students: {
    description: "Search the student directory by name/roll number/department (admin/faculty only).",
    parameters: {
      type: "object",
      properties: {
        query: { type: "string", description: "Name or roll number substring" },
        departmentCode: { type: "string", description: "e.g. CSE, ECE, ME, CE, MGMT" },
      },
    },
    run: (ctx, args) => studentsSvc.searchStudents(ctx, args as studentsSvc.StudentSearchFilters),
  },
  get_at_risk_students: {
    description:
      "Query students by attendance threshold, risk level, department, or upcoming-exam window (admin/faculty only). Use this for questions like 'students below X% attendance' or 'who has exams in the next N days'.",
    parameters: {
      type: "object",
      properties: {
        maxAttendance: { type: "number", description: "Return students with attendance strictly below this percentage" },
        riskLevel: { type: "string", enum: ["low", "medium", "high"] },
        departmentCode: { type: "string", description: "e.g. CSE, ECE, ME, CE, MGMT" },
        examWithinDays: { type: "number", description: "Only students whose programme has an exam within this many days" },
        query: { type: "string", description: "Name or roll number substring" },
      },
    },
    run: (ctx, args) => riskSvc.getAtRiskStudents(ctx, args as riskSvc.AtRiskFilters),
  },
  notify_students: {
    description: "Send an attendance/academic alert to a set of students or their parents (admin/faculty only). Always confirm before calling.",
    sensitive: true,
    parameters: {
      type: "object",
      properties: {
        studentIds: { type: "array", items: { type: "number" }, description: "Student ids to notify - reuse ids from the most recent search result" },
        channel: { type: "string", enum: ["student", "parent"] },
        message: { type: "string", description: "Notification message body" },
      },
      required: ["studentIds", "channel", "message"],
    },
    run: (ctx, args) =>
      adminSvc.notifyStudents(ctx, args.studentIds as number[], (args.channel as "student" | "parent") ?? "student", args.message as string),
  },
  get_library_status: {
    description: "Fetch a student's currently borrowed library books, due dates and any fines.",
    parameters: EMPTY_SCHEMA,
    run: (ctx) => librarySvc.getMyLoans(ctx),
  },
  search_library_catalog: {
    description: "Search the library catalog by title, author, or category.",
    parameters: {
      type: "object",
      properties: { query: { type: "string", description: "Title, author, or category keyword" } },
    },
    run: (ctx, args) => librarySvc.searchCatalog((args.query as string) ?? ""),
  },
  get_scholarships: {
    description: "List scholarships a student is eligible to apply for, and the status of any applications already made.",
    parameters: EMPTY_SCHEMA,
    run: (ctx) => scholarshipSvc.getStudentScholarshipView(ctx),
  },
  apply_for_scholarship: {
    description: "Submit a scholarship application on the student's behalf. Always confirm before calling.",
    sensitive: true,
    parameters: {
      type: "object",
      properties: { scholarshipId: { type: "number", description: "Scholarship id from get_scholarships" } },
      required: ["scholarshipId"],
    },
    run: (ctx, args) => scholarshipSvc.applyForScholarship(ctx, args.scholarshipId as number),
  },
};

export function encodePendingAction(action: { tool: string; args: Record<string, unknown>; successText: string }): string {
  return Buffer.from(JSON.stringify(action)).toString("base64url");
}

export function decodePendingAction(payload: string): { tool: string; args: Record<string, unknown>; successText: string } {
  return JSON.parse(Buffer.from(payload, "base64url").toString("utf-8"));
}
