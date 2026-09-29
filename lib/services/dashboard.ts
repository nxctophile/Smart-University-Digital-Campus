import { AccessContext, authorize } from "./context";
import { getStudentProfile } from "./students";
import { getAttendanceSummary } from "./attendance";
import { getStudentTimetable, getNextClass } from "./timetable";
import { getFeeStatus } from "./fees";
import { listDocuments } from "./documents";
import { getExamSchedule } from "./exams";
import { getStudentRisk } from "./risk";

export async function getStudentDashboard(ctx: AccessContext) {
  await authorize(ctx, "profile.view");

  const profile = await getStudentProfile(ctx);
  const [attendance, timetable, fees, documents, exams, risk] = await Promise.all([
    getAttendanceSummary(ctx, profile.id),
    getStudentTimetable(ctx, profile.id),
    getFeeStatus(ctx, profile.id),
    listDocuments(ctx, profile.id),
    getExamSchedule(ctx, profile.id),
    getStudentRisk(profile.id),
  ]);

  const nextClass = await getNextClass(ctx, profile.id, new Date());
  const upcomingExams = exams
    .filter((e) => new Date(e.date) >= new Date(new Date().toDateString()))
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 3);

  const recentCertificate = documents.certificates
    .filter((c) => c.status === "ready")
    .sort((a, b) => (b.issuedAt ?? "").localeCompare(a.issuedAt ?? ""))[0];

  return {
    profile,
    attendance,
    nextClass,
    timetableCount: timetable.length,
    fees,
    upcomingExams,
    recentCertificate: recentCertificate ?? null,
    risk,
  };
}
