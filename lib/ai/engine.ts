import { AccessContext, AccessDeniedError } from "@/lib/services/context";
import { can } from "@/lib/rbac/authorize";
import { AssistantMessage, ChatMessage, ToolTrace, AICard } from "./types";
import { tools, encodePendingAction } from "./tools";
import * as attendanceSvc from "@/lib/services/attendance";
import * as timetableSvc from "@/lib/services/timetable";
import * as examsSvc from "@/lib/services/exams";
import * as riskSvc from "@/lib/services/risk";
import * as studentsSvc from "@/lib/services/students";
import { AIProvider } from "./provider";
import { GroqProvider } from "./groq-provider";

let msgSeq = 0;
function nextId() {
  msgSeq += 1;
  return `am-${Date.now().toString(36)}-${msgSeq}`;
}

async function callTool(ctx: AccessContext, name: string, args: Record<string, unknown>, trace: ToolTrace[]) {
  const tool = tools[name];
  if (!tool) throw new Error(`Unknown tool: ${name}`);
  const result = await tool.run(ctx, args);
  trace.push({ tool: name, summary: tool.description });
  return result;
}

function reply(text: string, opts: Partial<Omit<AssistantMessage, "id" | "role" | "text">> = {}): AssistantMessage {
  return {
    id: nextId(),
    role: "assistant",
    text,
    toolTrace: opts.toolTrace ?? [],
    cards: opts.cards ?? [],
    actions: opts.actions ?? [],
    meta: opts.meta,
  };
}

// ---------------------------------------------------------------------------
// Course alias resolution - lets "the DBMS class" match "Database Management
// Systems" without requiring the user to type an exact course name.
// ---------------------------------------------------------------------------
const COURSE_ALIASES: Record<string, string> = {
  dbms: "CS201",
  database: "CS201",
  os: "CS203",
  "operating system": "CS203",
  dsa: "CS204",
  algorithms: "CS204",
  networks: "CS301",
  "computer networks": "CS301",
  "software engineering": "CS302",
  ml: "CS303",
  "machine learning": "CS303",
};

function findCourseFromMessage(
  message: string,
  courses: { courseId: number; courseCode: string; courseName: string }[],
): { courseId: number; courseCode: string; courseName: string } | null {
  const lower = message.toLowerCase();
  for (const [alias, code] of Object.entries(COURSE_ALIASES)) {
    if (lower.includes(alias)) {
      const match = courses.find((c) => c.courseCode === code);
      if (match) return match;
    }
  }
  for (const course of courses) {
    if (lower.includes(course.courseCode.toLowerCase())) return course;
    const nameWords = course.courseName.toLowerCase().split(/\s+/).filter((w) => w.length > 4);
    if (nameWords.some((w) => lower.includes(w))) return course;
  }
  return null;
}

function lastStudentIdsFromHistory(history: ChatMessage[]): number[] | null {
  for (let i = history.length - 1; i >= 0; i--) {
    const msg = history[i];
    if (msg.role === "assistant" && Array.isArray(msg.meta?.studentIds)) {
      return msg.meta!.studentIds as number[];
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Intent handlers
// ---------------------------------------------------------------------------

async function handleSkipClass(ctx: AccessContext, message: string): Promise<AssistantMessage> {
  const trace: ToolTrace[] = [];
  const timetable = await callTool(ctx, "get_timetable", {}, trace);
  const attendance = await callTool(ctx, "get_attendance", {}, trace);
  const tt = timetable as Awaited<ReturnType<typeof timetableSvc.getStudentTimetable>>;
  const att = attendance as Awaited<ReturnType<typeof attendanceSvc.getAttendanceSummary>>;

  const course = findCourseFromMessage(message, att.courses);
  if (!course) {
    return reply("I couldn't identify which class you meant. Could you name the course, e.g. \"Can I miss tomorrow's DBMS class?\"", { toolTrace: trace });
  }

  const isTomorrow = /tomorrow/i.test(message);
  const targetDow = isTomorrow ? (new Date().getDay() + 1 + 6) % 7 : null;
  const meetsOnTarget = targetDow !== null && tt.some((s) => s.courseCode === course.courseCode && s.dayOfWeek === targetDow);

  if (isTomorrow && !meetsOnTarget) {
    return reply(`Good news - ${course.courseName} doesn't meet tomorrow, so there's nothing to skip.`, { toolTrace: trace });
  }

  const projected = await callTool(
    ctx,
    "get_attendance",
    {},
    trace,
  );
  const courseAtt = (projected as typeof att).courses.find((c) => c.courseId === course.courseId)!;
  const projectedTotal = courseAtt.total + 1;
  const projectedPresent = courseAtt.present + courseAtt.excused;
  const projectedPct = Math.round((projectedPresent / projectedTotal) * 1000) / 10;
  const safe = projectedPct >= 75;

  const text = safe
    ? `You're currently at ${courseAtt.percentage}% in ${course.courseName}. If you miss tomorrow's class, your attendance drops to about ${projectedPct}% - still above the 75% minimum, so you can safely skip it.`
    : `You're currently at ${courseAtt.percentage}% in ${course.courseName}. Missing tomorrow's class would drop you to about ${projectedPct}%, which is below the 75% minimum. I'd recommend attending.`;

  return reply(text, {
    toolTrace: trace,
    cards: [
      {
        type: "stat",
        title: `${course.courseCode} attendance`,
        value: `${courseAtt.percentage}%`,
        detail: `Projected after 1 more absence: ${projectedPct}%`,
        tone: safe ? "default" : "warning",
      },
    ],
    actions: [{ id: "view-attendance", label: "View full attendance", kind: "link", href: "/attendance" }],
  });
}

async function handleCertificateRequest(ctx: AccessContext, message: string): Promise<AssistantMessage> {
  const trace: ToolTrace[] = [];
  const profile = (await callTool(ctx, "get_student_profile", {}, trace)) as Awaited<ReturnType<typeof studentsSvc.getStudentProfile>>;

  const typeMatch = /enrollment/i.test(message) ? "enrollment" : /character/i.test(message) ? "character" : /transfer/i.test(message) ? "transfer" : "bonafide";
  const purposeMatch = message.match(/for ([a-z ]+)/i);
  const purpose = purposeMatch ? purposeMatch[1].trim() : "General purpose";

  const result = (await callTool(ctx, "request_certificate", { type: typeMatch, purpose }, trace)) as {
    success: boolean;
    eligibility: { checks: { label: string; passed: boolean; detail: string }[] };
    certificate: { id: number; verificationCode: string; issuedAt: string; purpose: string | null; type: string } | null;
  };

  const checklist: AICard = {
    type: "checklist",
    title: "Eligibility check",
    items: result.eligibility.checks.map((c) => ({ label: c.label, passed: c.passed, detail: c.detail })),
  };

  if (!result.success || !result.certificate) {
    return reply(`I checked your eligibility for a ${typeMatch} certificate, but couldn't generate it yet - see the details below.`, {
      toolTrace: trace,
      cards: [checklist],
    });
  }

  return reply(
    `Your ${typeMatch} certificate is ready, ${profile.firstName}.`,
    {
      toolTrace: trace,
      cards: [
        checklist,
        {
          type: "certificate",
          title: `${typeMatch[0].toUpperCase()}${typeMatch.slice(1)} Certificate`,
          verificationCode: result.certificate.verificationCode,
          issuedAt: result.certificate.issuedAt,
          purpose: result.certificate.purpose ?? undefined,
          certType: typeMatch,
        },
      ],
      actions: [
        { id: "view-cert", label: "View certificate", kind: "link", href: `/documents?highlight=${result.certificate.id}` },
        { id: "go-documents", label: "Go to Documents", kind: "link", href: "/documents" },
      ],
    },
  );
}

async function handleHelpdeskComplaint(ctx: AccessContext, message: string): Promise<AssistantMessage> {
  const trace: ToolTrace[] = [];
  const hostel = await callTool(ctx, "get_hostel_information", {}, trace);
  const hostelInfo = hostel as Awaited<ReturnType<typeof import("@/lib/services/hostel").getHostelInfo>>;

  const isWifi = /wifi|internet|network/i.test(message);
  const isTransport = /bus|transport|route/i.test(message);
  const isFee = /fee|payment|receipt/i.test(message);
  const category = isTransport ? "transport" : isFee ? "fees" : isWifi || /hostel/i.test(message) ? "hostel" : "general";
  const subject = isWifi ? "Hostel Wi-Fi connectivity issue" : message.length < 80 ? message : `${message.slice(0, 77)}...`;

  const locationLine = hostelInfo ? `You're currently assigned to ${hostelInfo.hostelName}, Room ${hostelInfo.roomNumber}. ` : "";

  const pendingPayload = encodePendingAction({
    tool: "create_helpdesk_ticket",
    args: { category, subject, description: message },
    successText: `Ticket created for "${subject}".`,
  });

  return reply(`${locationLine}I can create a ${category === "hostel" ? "hostel connectivity" : category} complaint for this. Would you like me to proceed?`, {
    toolTrace: trace,
    actions: [
      { id: "create-ticket", label: "Create complaint", kind: "confirm", payload: pendingPayload, style: "primary" },
      { id: "cancel", label: "Not now", kind: "confirm", payload: encodePendingAction({ tool: "noop", args: {}, successText: "No problem - let me know if you change your mind." }) },
    ],
  });
}

async function handleFeeStatus(ctx: AccessContext): Promise<AssistantMessage> {
  const trace: ToolTrace[] = [];
  const fees = (await callTool(ctx, "get_fee_status", {}, trace)) as Awaited<ReturnType<typeof import("@/lib/services/fees").getFeeStatus>>;
  if (!fees.items.length) return reply("You have no fee records on file.", { toolTrace: trace });

  const text = fees.totalDue > 0
    ? `You have ₹${fees.totalDue.toLocaleString("en-IN")} pending${fees.hasOverdue ? " (including an overdue amount)" : ""}.`
    : "You're all paid up - no pending fees.";

  return reply(text, {
    toolTrace: trace,
    cards: [
      {
        type: "table",
        title: "Fee status",
        columns: [
          { key: "feeType", label: "Type" },
          { key: "amount", label: "Amount" },
          { key: "pending", label: "Pending" },
          { key: "dueDate", label: "Due" },
          { key: "status", label: "Status" },
        ],
        rows: fees.items.map((f) => ({ ...f, amount: `₹${f.amount.toLocaleString("en-IN")}`, pending: `₹${f.pending.toLocaleString("en-IN")}` })),
      },
    ],
    actions: [{ id: "go-fees", label: "Go to Fees", kind: "link", href: "/fees" }],
  });
}

async function handleAttendance(ctx: AccessContext): Promise<AssistantMessage> {
  const trace: ToolTrace[] = [];
  const att = (await callTool(ctx, "get_attendance", {}, trace)) as Awaited<ReturnType<typeof attendanceSvc.getAttendanceSummary>>;
  return reply(`Your overall attendance is ${att.overallPercentage}% across ${att.courses.length} courses.`, {
    toolTrace: trace,
    cards: [
      {
        type: "table",
        title: "Attendance by course",
        columns: [
          { key: "courseCode", label: "Course" },
          { key: "courseName", label: "Name" },
          { key: "percentage", label: "Attendance" },
        ],
        rows: att.courses.map((c) => ({ ...c, percentage: `${c.percentage}%` })),
      },
    ],
    actions: [{ id: "go-attendance", label: "Go to Attendance", kind: "link", href: "/attendance" }],
  });
}

async function handleNextClass(ctx: AccessContext): Promise<AssistantMessage> {
  const trace: ToolTrace[] = [];
  const next = await timetableSvc.getNextClass(ctx, ctx.studentId ?? undefined, new Date());
  trace.push({ tool: "get_timetable", summary: "Computed next upcoming session" });
  if (!next) return reply("You don't have any more classes scheduled this week.", { toolTrace: trace });

  const when = next.daysFromNow === 0 ? "today" : next.daysFromNow === 1 ? "tomorrow" : next.dayName;
  return reply(`Your next class is ${next.courseName} ${when} at ${next.startTime} in Room ${next.room}.`, {
    toolTrace: trace,
    cards: [{ type: "stat", title: next.courseName, value: next.startTime, detail: `${when} - Room ${next.room}${next.facultyName ? ` - ${next.facultyName}` : ""}` }],
    actions: [{ id: "go-timetable", label: "View timetable", kind: "link", href: "/timetable" }],
  });
}

async function handleExamSchedule(ctx: AccessContext): Promise<AssistantMessage> {
  const trace: ToolTrace[] = [];
  const exams = (await callTool(ctx, "get_exam_schedule", {}, trace)) as Awaited<ReturnType<typeof examsSvc.getExamSchedule>>;
  const upcoming = exams.filter((e) => new Date(e.date) >= new Date(new Date().toDateString()));
  if (!upcoming.length) return reply("No upcoming exams scheduled right now.", { toolTrace: trace });

  return reply(`You have ${upcoming.length} upcoming exam(s). The next is ${upcoming[0].name} on ${upcoming[0].date}.`, {
    toolTrace: trace,
    cards: [
      {
        type: "table",
        title: "Upcoming exams",
        columns: [
          { key: "name", label: "Exam" },
          { key: "date", label: "Date" },
          { key: "maxMarks", label: "Max marks" },
        ],
        rows: upcoming,
      },
    ],
  });
}

async function handleTransport(ctx: AccessContext): Promise<AssistantMessage> {
  const trace: ToolTrace[] = [];
  const info = (await callTool(ctx, "get_transport_status", {}, trace)) as Awaited<ReturnType<typeof import("@/lib/services/transport").getTransportInfo>>;
  if (!info) return reply("You don't have a transport route assigned yet. You can request one from the Transport section.", { toolTrace: trace });
  return reply(`You're on ${info.routeName} (${info.routeCode}), boarding at ${info.stopName} around ${info.arrivalTime}.`, {
    toolTrace: trace,
    cards: [{ type: "stat", title: info.routeName, value: info.stopName, detail: `Arrival ${info.arrivalTime} - Vehicle ${info.vehicleNumber}` }],
  });
}

async function handleLibrary(ctx: AccessContext): Promise<AssistantMessage> {
  const trace: ToolTrace[] = [];
  const r = (await callTool(ctx, "get_library_status", {}, trace)) as Awaited<ReturnType<typeof import("@/lib/services/library").getMyLoans>>;
  const text =
    r.activeCount === 0
      ? "You don't have any books borrowed right now."
      : `You have ${r.activeCount} book(s) borrowed${r.totalFine > 0 ? `, with ₹${r.totalFine} in outstanding fines` : ""}.`;
  return reply(text, {
    toolTrace: trace,
    cards: [{ type: "stat", title: "Books borrowed", value: String(r.activeCount), detail: r.totalFine > 0 ? `₹${r.totalFine} outstanding fine` : "No outstanding fines" }],
    actions: [{ id: "go-library", label: "Go to Library", kind: "link", href: "/library" }],
  });
}

async function handleScholarships(ctx: AccessContext): Promise<AssistantMessage> {
  const trace: ToolTrace[] = [];
  const r = (await callTool(ctx, "get_scholarships", {}, trace)) as Awaited<
    ReturnType<typeof import("@/lib/services/scholarships").getStudentScholarshipView>
  >;
  const eligibleCount = r.scholarships.filter((s) => s.eligible && !s.alreadyApplied).length;
  const text = r.applications.length
    ? `You have ${r.applications.length} scholarship application(s) in progress, and ${eligibleCount} more you're eligible to apply for.`
    : `You're eligible for ${eligibleCount} scholarship(s) right now. Want me to apply on your behalf?`;
  return reply(text, { toolTrace: trace, actions: [{ id: "go-scholarships", label: "Go to Scholarships", kind: "link", href: "/scholarships" }] });
}

async function handleAdminAtRisk(ctx: AccessContext, message: string): Promise<AssistantMessage> {
  const trace: ToolTrace[] = [];
  const attendanceMatch = message.match(/below\s+(\d{1,3})%?/i);
  const maxAttendance = attendanceMatch ? Number(attendanceMatch[1]) : 75;
  const daysMatch = message.match(/next\s+(\d+)\s*day/i) || message.match(/(\d+)\s*day/i);
  const examWithinDays = /week/i.test(message) ? 7 : daysMatch ? Number(daysMatch[1]) : /exam/i.test(message) ? 7 : undefined;

  const rows = (await callTool(ctx, "get_at_risk_students", { maxAttendance, examWithinDays, limit: 200 }, trace)) as Awaited<
    ReturnType<typeof riskSvc.getAtRiskStudents>
  >;

  const text = examWithinDays
    ? `${rows.length} students found with attendance below ${maxAttendance}% who have exams within the next ${examWithinDays} days.`
    : `${rows.length} students found with attendance below ${maxAttendance}%.`;

  return reply(text, {
    toolTrace: trace,
    cards: [
      {
        type: "table",
        title: "At-risk students",
        columns: [
          { key: "rollNumber", label: "Roll No." },
          { key: "name", label: "Name" },
          { key: "department", label: "Department" },
          { key: "attendancePercentage", label: "Attendance" },
          { key: "riskLevel", label: "Risk" },
        ],
        rows: rows.slice(0, 25).map((r) => ({ ...r, attendancePercentage: `${r.attendancePercentage}%` })),
      },
    ],
    actions: rows.length
      ? [
          {
            id: "notify-students",
            label: "Notify Students",
            kind: "confirm",
            payload: encodePendingAction({
              tool: "notify_students",
              args: { studentIds: rows.map((r) => r.studentId), channel: "student", message: text },
              successText: `Notified ${rows.length} student(s).`,
            }),
          },
          {
            id: "notify-parents",
            label: "Notify Parents",
            kind: "confirm",
            payload: encodePendingAction({
              tool: "notify_students",
              args: { studentIds: rows.map((r) => r.studentId), channel: "parent", message: text },
              successText: `Notified ${rows.length} parent(s).`,
            }),
          },
          { id: "export", label: "Export", kind: "link", href: "/admin/students" },
        ]
      : [],
    meta: { studentIds: rows.map((r) => r.studentId) },
  });
}

async function handleAdminNotify(ctx: AccessContext, message: string, history: ChatMessage[]): Promise<AssistantMessage> {
  const studentIds = lastStudentIdsFromHistory(history);
  if (!studentIds || !studentIds.length) {
    return reply("I don't have a recent student list to notify. Try a search first, e.g. \"Show students below 75% attendance.\"");
  }
  const channel: "parent" | "student" = /parent/i.test(message) ? "parent" : "student";
  const payload = encodePendingAction({
    tool: "notify_students",
    args: { studentIds, channel, message: "Academic attention needed - please review attendance/performance." },
    successText: `Notified ${studentIds.length} ${channel}(s).`,
  });
  return reply(`This will notify ${studentIds.length} ${channel === "parent" ? "parents" : "students"} from the last search. Confirm?`, {
    actions: [{ id: "confirm-notify", label: `Notify ${channel === "parent" ? "Parents" : "Students"}`, kind: "confirm", payload, style: "primary" }],
  });
}

async function handleGreeting(): Promise<AssistantMessage> {
  return reply(
    "I can help with attendance, timetable, fees, certificates, hostel/transport info, and helpdesk requests. What would you like to do?",
  );
}

// ---------------------------------------------------------------------------
// Rule-based provider
// ---------------------------------------------------------------------------

export class RuleBasedProvider implements AIProvider {
  async respond(ctx: AccessContext, message: string, history: ChatMessage[]): Promise<AssistantMessage> {
    const m = message.toLowerCase().trim();

    try {
      if (await can(ctx, "student.performance.view")) {
        if (/notify/.test(m) && (/parent/.test(m) || /student/.test(m)) && !/(below|attendance|exam)/.test(m)) {
          return await handleAdminNotify(ctx, message, history);
        }
        if (/(below|above)\s+\d/.test(m) || /at.risk/.test(m) || /struggling/.test(m) || (/attendance/.test(m) && /exam/.test(m))) {
          return await handleAdminAtRisk(ctx, message);
        }
      }

      if (/(skip|miss).*(class|lecture|lab)/.test(m) || (/class/.test(m) && /tomorrow/.test(m))) {
        return await handleSkipClass(ctx, message);
      }
      if (/certificate|bonafide|enrollment letter/.test(m)) {
        return await handleCertificateRequest(ctx, message);
      }
      if (/wifi|complaint|not working|issue|ticket|leak|broken/.test(m)) {
        return await handleHelpdeskComplaint(ctx, message);
      }
      if (/fee|due amount|pending.*fee/.test(m)) {
        return await handleFeeStatus(ctx);
      }
      if (/next class|upcoming class|what.*class.*(today|now)/.test(m)) {
        return await handleNextClass(ctx);
      }
      if (/exam|midterm|test schedule/.test(m)) {
        return await handleExamSchedule(ctx);
      }
      if (/attendance/.test(m)) {
        return await handleAttendance(ctx);
      }
      if (/bus|transport|route|shuttle/.test(m)) {
        return await handleTransport(ctx);
      }
      if (/librar|borrow.*book|book.*borrow|due.*book/.test(m)) {
        return await handleLibrary(ctx);
      }
      if (/scholarship/.test(m)) {
        return await handleScholarships(ctx);
      }
      if (/^(hi|hello|hey)\b/.test(m)) {
        return await handleGreeting();
      }

      return reply(
        "I'm not sure how to help with that yet. Try asking about attendance, your timetable, fees, certificates, hostel, or transport.",
      );
    } catch (err) {
      if (err instanceof AccessDeniedError) {
        return reply("I don't have access to that information for your account.");
      }
      const messageText = err instanceof Error ? err.message : "Something went wrong.";
      return reply(`I couldn't complete that: ${messageText}`);
    }
  }
}

// Real LLM if a key is configured, otherwise the deterministic fallback -
// same tool registry, same UI contract either way. See lib/ai/groq-provider.ts.
function selectProvider(): AIProvider {
  const apiKey = process.env.GROQ_API_KEY;
  return apiKey ? new GroqProvider(apiKey) : new RuleBasedProvider();
}

export const aiProvider: AIProvider = selectProvider();

export async function executePendingAction(
  ctx: AccessContext,
  pending: { tool: string; args: Record<string, unknown>; successText: string },
): Promise<AssistantMessage> {
  if (pending.tool === "noop") return reply(pending.successText);
  const trace: ToolTrace[] = [];
  const result = await callTool(ctx, pending.tool, pending.args, trace);

  if (pending.tool === "create_helpdesk_ticket") {
    const ticket = result as { ticketNumber: string; id: number };
    return reply(`✓ ${pending.successText}`, {
      toolTrace: trace,
      cards: [{ type: "stat", title: "Ticket created", value: ticket.ticketNumber, detail: "You can track its status from Helpdesk." }],
      actions: [{ id: "go-helpdesk", label: "View ticket", kind: "link", href: "/helpdesk" }],
    });
  }
  if (pending.tool === "notify_students") {
    return reply(`✓ ${pending.successText}`, { toolTrace: trace });
  }
  if (pending.tool === "apply_for_scholarship") {
    return reply(`✓ ${pending.successText}`, {
      toolTrace: trace,
      actions: [{ id: "go-scholarships", label: "View application", kind: "link", href: "/scholarships" }],
    });
  }
  return reply(`✓ ${pending.successText}`, { toolTrace: trace });
}
