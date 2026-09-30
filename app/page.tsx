import { getCurrentClientContext } from "@/lib/server-context";
import { StudentDashboard } from "@/components/dashboard/student-dashboard";
import { AdminDashboard } from "@/components/dashboard/admin-dashboard";
import { FacultyDashboard } from "@/components/dashboard/faculty-dashboard";
import { EmployeeDashboard } from "@/components/dashboard/employee-dashboard";

export default async function HomePage() {
  const ctx = await getCurrentClientContext();

  // Which shell widget to render is picked from the caller's own identity,
  // never used as a security decision - every dashboard's data still comes
  // from permission-checked API calls underneath.
  if (ctx.role === "admin") return <AdminDashboard />;
  if (ctx.role === "employee") return <EmployeeDashboard />;
  if (ctx.facultyId) return <FacultyDashboard />;
  // student and parent share the same lifecycle dashboard - the service
  // layer transparently resolves "my data" vs. "my child's data".
  return <StudentDashboard />;
}
