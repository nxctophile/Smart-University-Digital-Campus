/**
 * AI-assisted schema mapping.
 *
 * This module infers which legacy column maps to which canonical campus
 * field, with a confidence score - exactly the shape a real LLM-based
 * mapper would return (column name in, {field, confidence} out), so the
 * deterministic heuristic below can be swapped for a model call later
 * without touching the UI or the import pipeline.
 */

export type CanonicalField = {
  key: string;
  label: string;
  required?: boolean;
  aliases: string[];
};

export const CANONICAL_STUDENT_FIELDS: CanonicalField[] = [
  { key: "studentId", label: "Student ID", required: true, aliases: ["stu_id", "student_id", "stuid", "id", "roll_no", "rollno", "sid", "enrollment_no"] },
  { key: "fullName", label: "Full Name", required: true, aliases: ["stud_name", "full_name", "name", "student_name", "studname"] },
  { key: "dob", label: "Date of Birth", aliases: ["dob", "date_of_birth", "birth_date", "dateofbirth"] },
  { key: "gender", label: "Gender", aliases: ["gender", "sex"] },
  { key: "department", label: "Department", aliases: ["dept", "dept_cd", "department", "branch_cd", "branch"] },
  { key: "programme", label: "Programme", required: true, aliases: ["course_nm", "course", "programme", "program", "prog_name"] },
  { key: "semester", label: "Semester", aliases: ["sem", "semester", "current_sem"] },
  { key: "phone", label: "Phone", aliases: ["mobile_no", "mobile", "phone", "contact_no", "phone_no", "cell"] },
  { key: "email", label: "Email", aliases: ["mail", "email", "email_id", "emailaddress", "e_mail"] },
];

function normalize(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function similarity(a: string, b: string): number {
  const na = normalize(a);
  const nb = normalize(b);
  if (!na || !nb) return 0;
  if (na === nb) return 1;
  if (na.includes(nb) || nb.includes(na)) return 0.85 + 0.1 * (Math.min(na.length, nb.length) / Math.max(na.length, nb.length));

  // token overlap fallback (handles things like "student_full_name" vs "full_name")
  const ta = new Set(a.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean));
  const tb = new Set(b.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean));
  const shared = [...ta].filter((t) => tb.has(t)).length;
  const union = new Set([...ta, ...tb]).size;
  return union ? (0.55 * shared) / union : 0;
}

export type FieldSuggestion = {
  column: string;
  canonicalKey: string | null;
  canonicalLabel: string | null;
  confidence: number; // 0-1
};

export function inferMapping(columns: string[], fields: CanonicalField[] = CANONICAL_STUDENT_FIELDS): FieldSuggestion[] {
  const scored = columns.map((column) => {
    let best: { field: CanonicalField; score: number } | null = null;
    for (const field of fields) {
      const score = Math.max(similarity(column, field.key), ...field.aliases.map((a) => similarity(column, a)));
      if (score > 0.4 && (!best || score > best.score)) best = { field, score };
    }
    return { column, best };
  });

  // Greedy unique assignment: highest-confidence column wins each canonical
  // field if two columns would otherwise map to the same target.
  const claimed = new Map<string, { column: string; score: number }>();
  for (const { column, best } of scored) {
    if (!best) continue;
    const existing = claimed.get(best.field.key);
    if (!existing || best.score > existing.score) claimed.set(best.field.key, { column, score: best.score });
  }

  return columns.map((column) => {
    const match = [...claimed.entries()].find(([, v]) => v.column === column);
    if (!match) return { column, canonicalKey: null, canonicalLabel: null, confidence: 0 };
    const [key, v] = match;
    const field = fields.find((f) => f.key === key)!;
    return { column, canonicalKey: key, canonicalLabel: field.label, confidence: Math.round(v.score * 100) / 100 };
  });
}
