import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { Landmark, ClipboardCheck, Award, UserCog, Briefcase, BookOpen, LifeBuoy, ArrowRight } from "lucide-react";
import { getCurrentClientContext } from "@/lib/server-context";
import { NoticesCard } from "@/components/common/notices-card";
import { EventsCalendar } from "@/components/common/events-calendar";

const QUICK_LINKS: { label: string; href: string; icon: LucideIcon; anyOf: string[]; description: string }[] = [
  { label: "Admissions", href: "/admin/admissions", icon: ClipboardCheck, anyOf: ["admission.application.view"], description: "Review applications & onboard students" },
  { label: "Finance", href: "/admin/finance", icon: Landmark, anyOf: ["finance.fees.view"], description: "Fee collection & transactions" },
  { label: "Examinations", href: "/admin/examinations", icon: Briefcase, anyOf: ["exam.results.manage"], description: "Publish exam results" },
  { label: "Employees", href: "/admin/employees", icon: UserCog, anyOf: ["employee.view"], description: "Staff directory" },
  { label: "Scholarship Desk", href: "/admin/scholarships", icon: Award, anyOf: ["scholarship.application.view"], description: "Review scholarship applications" },
  { label: "Library Desk", href: "/admin/library", icon: BookOpen, anyOf: ["library.book.manage"], description: "Catalog & loan returns" },
  { label: "Campus Tickets", href: "/helpdesk", icon: LifeBuoy, anyOf: ["campus.issue.manage"], description: "Facility & maintenance issues" },
];

/** Shared shell for every department-employee persona (Accounts, Admission,
 * HR, Examination, Library, Maintenance...) - the tiles shown are driven
 * entirely by the caller's actual permissions, not a per-department
 * hardcoded component. Adding a new department role only needs a nav entry
 * + a tile here, never a new dashboard. */
export async function EmployeeDashboard() {
  const ctx = await getCurrentClientContext();
  const visible = QUICK_LINKS.filter((link) => link.anyOf.some((p) => ctx.permissions.includes(p)));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Welcome, {ctx.name.split(" ")[0]}</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          {ctx.departmentName ? `${ctx.departmentName} · ` : ""}
          {ctx.roles.map((r) => r.name).join(", ")}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {visible.map((link) => {
          const Icon = link.icon;
          return (
            <Link
              key={link.href}
              href={link.href}
              className="card-surface group flex items-start gap-3 p-4 transition-colors hover:border-accent/50"
            >
              <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-accent/10 text-accent">
                <Icon className="size-4.5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">{link.label}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">{link.description}</p>
              </div>
              <ArrowRight className="size-4 shrink-0 text-muted-foreground/50 transition-transform group-hover:translate-x-0.5" />
            </Link>
          );
        })}
        {visible.length === 0 && (
          <p className="text-sm text-muted-foreground">No modules are assigned to your role yet - ask an administrator to grant access.</p>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <NoticesCard />
        <EventsCalendar />
      </div>
    </div>
  );
}
