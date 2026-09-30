/**
 * AI tool layer.
 *
 * The AI never touches the database directly. Every tool below is a thin,
 * typed wrapper around the Rust backend's REST API, called with the caller's
 * own session cookie - so the same authorization the backend enforces for
 * every other client protects the AI too. `parameters` is a JSON-Schema
 * fragment in OpenAI/Groq function-calling shape - it's what lets a real LLM
 * (see lib/ai/groq-provider.ts) select a tool and fill in arguments; the
 * deterministic RuleBasedProvider ignores it and fills args itself.
 */
import { backendFetch, Caller } from "./backend";

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
  run: (caller: Caller, args: Record<string, unknown>) => Promise<unknown>;
};

const EMPTY_SCHEMA: JSONSchema = { type: "object", properties: {} };

function qs(params: Record<string, unknown>): string {
  const usp = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "") continue;
    if (Array.isArray(value)) value.forEach((v) => usp.append(key, String(v)));
    else usp.set(key, String(value));
  }
  const query = usp.toString();
  return query ? `?${query}` : "";
}

function post(caller: Caller, path: string, body: unknown) {
  return backendFetch(caller.cookie, path, { method: "POST", body: JSON.stringify(body) });
}

export const tools: Record<string, ToolDefinition> = {
  get_student_profile: {
    description: "Fetch a student's identity, programme and enrollment details.",
    parameters: EMPTY_SCHEMA,
    run: async (caller) => (await backendFetch<{ profile: unknown }>(caller.cookie, "/api/profile")).profile,
  },
  get_attendance: {
    description: "Fetch a student's attendance broken down by course.",
    parameters: EMPTY_SCHEMA,
    run: (caller, args) => backendFetch(caller.cookie, `/api/attendance${qs({ studentId: args.studentId })}`),
  },
  get_timetable: {
    description: "Fetch a student's weekly class timetable.",
    parameters: EMPTY_SCHEMA,
    run: async (caller) => (await backendFetch<{ timetable: unknown }>(caller.cookie, "/api/timetable")).timetable,
  },
  get_fee_status: {
    description: "Fetch a student's fee balance and payment status.",
    parameters: EMPTY_SCHEMA,
    run: (caller) => backendFetch(caller.cookie, "/api/fees"),
  },
  get_exam_schedule: {
    description: "Fetch a student's upcoming exam schedule.",
    parameters: EMPTY_SCHEMA,
    run: async (caller) => (await backendFetch<{ exams: unknown }>(caller.cookie, "/api/exams")).exams,
  },
  search_documents: {
    description: "List a student's available documents and issued certificates.",
    parameters: EMPTY_SCHEMA,
    run: (caller) => backendFetch(caller.cookie, "/api/documents"),
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
    run: (caller, args) => post(caller, "/api/certificates", { type: args.type ?? "bonafide", purpose: args.purpose ?? "General purpose" }),
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
    run: async (caller, args) =>
      (await post(caller, "/api/helpdesk/tickets", { category: args.category, subject: args.subject, description: args.description }) as { ticket: unknown }).ticket,
  },
  get_transport_status: {
    description: "Fetch a student's assigned transport route and stop.",
    parameters: EMPTY_SCHEMA,
    run: async (caller) => (await backendFetch<{ info: unknown }>(caller.cookie, "/api/transport")).info,
  },
  get_hostel_information: {
    description: "Fetch a student's hostel block and room assignment.",
    parameters: EMPTY_SCHEMA,
    run: async (caller) => (await backendFetch<{ info: unknown }>(caller.cookie, "/api/hostel")).info,
  },
  get_student_performance: {
    description: "Fetch a student's combined attendance + academic risk profile.",
    parameters: {
      type: "object",
      properties: { studentId: { type: "number", description: "Student id (required for faculty/admin callers)" } },
    },
    run: async (caller, args) => (await backendFetch<{ risk: unknown }>(caller.cookie, `/api/academics/performance${qs({ studentId: args.studentId })}`)).risk,
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
    run: async (caller, args) =>
      (await backendFetch<{ students: unknown }>(caller.cookie, `/api/admin/students${qs({ query: args.query, department: args.departmentCode })}`)).students,
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
    run: async (caller, args) =>
      (
        await backendFetch<{ students: unknown }>(
          caller.cookie,
          `/api/admin/at-risk${qs({
            maxAttendance: args.maxAttendance,
            riskLevel: args.riskLevel,
            department: args.departmentCode,
            examWithinDays: args.examWithinDays,
            query: args.query,
            limit: args.limit,
          })}`,
        )
      ).students,
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
    run: (caller, args) => post(caller, "/api/admin/notify", { studentIds: args.studentIds, channel: args.channel ?? "student", message: args.message }),
  },
  get_library_status: {
    description: "Fetch a student's currently borrowed library books, due dates and any fines.",
    parameters: EMPTY_SCHEMA,
    run: (caller) => backendFetch(caller.cookie, "/api/library/loans"),
  },
  search_library_catalog: {
    description: "Search the library catalog by title, author, or category.",
    parameters: {
      type: "object",
      properties: { query: { type: "string", description: "Title, author, or category keyword" } },
    },
    run: async (caller, args) => (await backendFetch<{ books: unknown }>(caller.cookie, `/api/library/catalog${qs({ query: args.query ?? "" })}`)).books,
  },
  get_scholarships: {
    description: "List scholarships a student is eligible to apply for, and the status of any applications already made.",
    parameters: EMPTY_SCHEMA,
    run: (caller) => backendFetch(caller.cookie, "/api/scholarships"),
  },
  apply_for_scholarship: {
    description: "Submit a scholarship application on the student's behalf. Always confirm before calling.",
    sensitive: true,
    parameters: {
      type: "object",
      properties: { scholarshipId: { type: "number", description: "Scholarship id from get_scholarships" } },
      required: ["scholarshipId"],
    },
    run: (caller, args) => post(caller, "/api/scholarships/apply", { scholarshipId: args.scholarshipId }),
  },
};

export function encodePendingAction(action: { tool: string; args: Record<string, unknown>; successText: string }): string {
  return Buffer.from(JSON.stringify(action)).toString("base64url");
}

export function decodePendingAction(payload: string): { tool: string; args: Record<string, unknown>; successText: string } {
  return JSON.parse(Buffer.from(payload, "base64url").toString("utf-8"));
}
