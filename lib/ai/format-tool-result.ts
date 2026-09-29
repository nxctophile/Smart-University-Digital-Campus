/**
 * Turns a raw tool result into the same structured UI (tables, stat tiles,
 * checklists, action buttons) the rule-based provider hand-builds per
 * intent. Shared by both providers so an LLM-driven conversation renders
 * exactly like the deterministic one.
 */
import type { AICard, ActionButton } from "./types";

export type FormattedToolResult = { cards: AICard[]; actions: ActionButton[]; meta?: Record<string, unknown> };

const EMPTY: FormattedToolResult = { cards: [], actions: [] };

function cap(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function formatToolResult(toolName: string, result: unknown): FormattedToolResult {
  if (result == null) return EMPTY;
  // A denied/failed tool call comes back as { error: "..." } (see
  // groq-provider's catch block) - never a success-shaped payload, so skip
  // straight to the (already-generic) text reply instead of rendering a card.
  if (typeof result === "object" && result !== null && "error" in result) return EMPTY;

  switch (toolName) {
    case "get_attendance": {
      const r = result as { overallPercentage: number; courses: { courseId: number; courseCode: string; courseName: string; percentage: number }[] };
      if (!r.courses?.length) return EMPTY;
      return {
        cards: [
          {
            type: "table",
            title: "Attendance by course",
            columns: [
              { key: "courseCode", label: "Course" },
              { key: "courseName", label: "Name" },
              { key: "percentage", label: "Attendance" },
            ],
            rows: r.courses.map((c) => ({ ...c, percentage: `${c.percentage}%` })),
          },
        ],
        actions: [{ id: "go-attendance", label: "View full attendance", kind: "link", href: "/attendance" }],
      };
    }

    case "get_fee_status": {
      const r = result as { items: { feeType: string; amount: number; pending: number; dueDate: string; status: string }[] };
      if (!r.items?.length) return EMPTY;
      return {
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
            rows: r.items.map((f) => ({ ...f, amount: `₹${f.amount.toLocaleString("en-IN")}`, pending: `₹${f.pending.toLocaleString("en-IN")}` })),
          },
        ],
        actions: [{ id: "go-fees", label: "Go to Fees", kind: "link", href: "/fees" }],
      };
    }

    case "get_exam_schedule": {
      const r = result as { id: number; name: string; date: string; maxMarks: number; courseCode: string }[];
      if (!r?.length) return EMPTY;
      return {
        cards: [
          {
            type: "table",
            title: "Exam schedule",
            columns: [
              { key: "courseCode", label: "Course" },
              { key: "name", label: "Exam" },
              { key: "date", label: "Date" },
              { key: "maxMarks", label: "Max marks" },
            ],
            rows: r,
          },
        ],
        actions: [],
      };
    }

    case "get_timetable": {
      const r = result as { dayName: string; startTime: string; room: string; courseCode: string; courseName: string }[];
      if (!r?.length) return EMPTY;
      return {
        cards: [
          {
            type: "table",
            title: "Weekly timetable",
            columns: [
              { key: "dayName", label: "Day" },
              { key: "startTime", label: "Time" },
              { key: "courseCode", label: "Course" },
              { key: "room", label: "Room" },
            ],
            rows: r,
          },
        ],
        actions: [{ id: "go-timetable", label: "View timetable", kind: "link", href: "/timetable" }],
      };
    }

    case "request_certificate": {
      const r = result as {
        success: boolean;
        eligibility: { checks: { label: string; passed: boolean; detail: string }[] };
        certificate: { id: number; verificationCode: string; issuedAt: string; purpose: string | null; type: string } | null;
      };
      const cards: AICard[] = [{ type: "checklist", title: "Eligibility check", items: r.eligibility.checks }];
      if (r.success && r.certificate) {
        cards.push({
          type: "certificate",
          title: `${cap(r.certificate.type)} Certificate`,
          verificationCode: r.certificate.verificationCode,
          issuedAt: r.certificate.issuedAt,
          purpose: r.certificate.purpose ?? undefined,
          certType: r.certificate.type,
        });
      }
      return {
        cards,
        actions: r.success
          ? [
              { id: "view-cert", label: "View certificate", kind: "link", href: `/documents?highlight=${r.certificate?.id}` },
              { id: "go-documents", label: "Go to Documents", kind: "link", href: "/documents" },
            ]
          : [],
      };
    }

    case "get_at_risk_students":
    case "search_students": {
      const rows = result as { studentId?: number; id?: number; rollNumber: string; name?: string; firstName?: string; lastName?: string; department: string; attendancePercentage?: number; riskLevel?: string }[];
      if (!rows?.length) return EMPTY;
      const studentIds = rows.map((r) => r.studentId ?? r.id).filter((v): v is number => typeof v === "number");
      return {
        cards: [
          {
            type: "table",
            title: toolName === "get_at_risk_students" ? "At-risk students" : "Students",
            columns: [
              { key: "rollNumber", label: "Roll No." },
              { key: "name", label: "Name" },
              { key: "department", label: "Department" },
              ...(toolName === "get_at_risk_students" ? [{ key: "attendancePercentage", label: "Attendance" }, { key: "riskLevel", label: "Risk" }] : []),
            ],
            rows: rows.slice(0, 25).map((r) => ({
              ...r,
              name: r.name ?? `${r.firstName} ${r.lastName}`,
              attendancePercentage: r.attendancePercentage !== undefined ? `${r.attendancePercentage}%` : undefined,
            })),
          },
        ],
        actions:
          toolName === "get_at_risk_students" && studentIds.length
            ? [
                { id: "export", label: "Export", kind: "link", href: "/admin/students" },
              ]
            : [],
        meta: { studentIds },
      };
    }

    case "get_student_performance": {
      const r = result as { riskLevel: string; factors: { label: string; detail: string; severity: string }[] } | null;
      if (!r) return EMPTY;
      return {
        cards: [
          {
            type: "risk",
            title: r.riskLevel === "low" ? "On track" : "Academic attention needed",
            factors: r.factors.length ? r.factors : [{ label: "Overall", detail: "No risk factors detected", severity: "low" }],
          },
        ],
        actions: [],
      };
    }

    case "get_hostel_information": {
      const r = result as { hostelName: string; roomNumber: string; warden: string } | null;
      if (!r) return EMPTY;
      return {
        cards: [{ type: "stat", title: r.hostelName, value: `Room ${r.roomNumber}`, detail: `Warden: ${r.warden}` }],
        actions: [{ id: "go-hostel", label: "Go to Hostel", kind: "link", href: "/hostel" }],
      };
    }

    case "get_transport_status": {
      const r = result as { routeName: string; stopName: string; arrivalTime: string; vehicleNumber: string } | null;
      if (!r) return EMPTY;
      return {
        cards: [{ type: "stat", title: r.routeName, value: r.stopName, detail: `Arrival ${r.arrivalTime} - Vehicle ${r.vehicleNumber}` }],
        actions: [{ id: "go-transport", label: "Go to Transport", kind: "link", href: "/transport" }],
      };
    }

    case "get_library_status": {
      const r = result as { activeCount: number; totalFine: number };
      return {
        cards: [{ type: "stat", title: "Books borrowed", value: String(r.activeCount), detail: r.totalFine > 0 ? `₹${r.totalFine} outstanding fine` : "No outstanding fines" }],
        actions: [{ id: "go-library", label: "Go to Library", kind: "link", href: "/library" }],
      };
    }

    case "get_scholarships": {
      return { cards: [], actions: [{ id: "go-scholarships", label: "Go to Scholarships", kind: "link", href: "/scholarships" }] };
    }

    default:
      return EMPTY;
  }
}
