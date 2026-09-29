import type { LucideIcon } from "lucide-react";
import {
  Home,
  CalendarCheck,
  CalendarDays,
  Wallet,
  FileText,
  Building2,
  Bus,
  LifeBuoy,
  Sparkles,
  Users,
  GraduationCap,
  UploadCloud,
  ClipboardList,
  BookOpen,
  Award,
  Landmark,
  UserCog,
  ShieldCheck,
  ClipboardCheck,
  Briefcase,
} from "lucide-react";
import type { ClientContext } from "@/lib/types";

export type NavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  /** Nav visibility only (UX) - shown if the user holds ANY of these
   * permissions. The server independently re-authorizes every request this
   * link leads to; hiding a link is never itself a security boundary. */
  anyOf: string[];
};
export type NavGroup = { label?: string; items: NavItem[]; separatorAfter?: boolean };

const ALWAYS = ["profile.view", "attendance.view", "class.view", "student.view", "employee.view"]; // "Home" is visible to anyone with a real account

const GROUPS: NavGroup[] = [
  {
    items: [
      { label: "Home", href: "/", icon: Home, anyOf: ALWAYS },
      { label: "Academics", href: "/academics", icon: GraduationCap, anyOf: ["exam.schedule.view", "marks.view"] },
      { label: "My Classes", href: "/faculty/classes", icon: ClipboardList, anyOf: ["class.view"] },
      { label: "Attendance", href: "/attendance", icon: CalendarCheck, anyOf: ["attendance.view"] },
      { label: "Timetable", href: "/timetable", icon: CalendarDays, anyOf: ["timetable.view"] },
      { label: "Documents", href: "/documents", icon: FileText, anyOf: ["documents.view"] },
    ],
  },
  {
    label: "Campus services",
    items: [
      { label: "Fees", href: "/fees", icon: Wallet, anyOf: ["fees.status.view"] },
      { label: "Scholarships", href: "/scholarships", icon: Award, anyOf: ["scholarship.status.view"] },
      { label: "Library", href: "/library", icon: BookOpen, anyOf: ["library.loan.view", "library.catalog.view"] },
      { label: "Hostel", href: "/hostel", icon: Building2, anyOf: ["hostel.view"] },
      { label: "Transport", href: "/transport", icon: Bus, anyOf: ["transport.view"] },
      { label: "Helpdesk", href: "/helpdesk", icon: LifeBuoy, anyOf: ["helpdesk.ticket.view", "helpdesk.ticket.create"] },
    ],
    separatorAfter: true,
  },
  {
    label: "Management",
    items: [
      { label: "Students", href: "/admin/students", icon: Users, anyOf: ["student.manage", "student.view"] },
      { label: "Employees", href: "/admin/employees", icon: UserCog, anyOf: ["employee.view", "employee.manage"] },
      { label: "Admissions", href: "/admin/admissions", icon: ClipboardCheck, anyOf: ["admission.application.view"] },
      { label: "Examinations", href: "/admin/examinations", icon: Briefcase, anyOf: ["exam.results.manage", "exam.results.publish"] },
      { label: "Finance", href: "/admin/finance", icon: Landmark, anyOf: ["finance.fees.view", "finance.fees.collect"] },
      { label: "Library Desk", href: "/admin/library", icon: BookOpen, anyOf: ["library.book.manage"] },
      { label: "Scholarship Desk", href: "/admin/scholarships", icon: Award, anyOf: ["scholarship.application.view"] },
      { label: "Data Import", href: "/admin/import", icon: UploadCloud, anyOf: ["data.import"] },
    ],
    separatorAfter: true,
  },
  {
    label: "System",
    items: [
      { label: "Access Control", href: "/admin/rbac", icon: ShieldCheck, anyOf: ["role.manage", "user.manage", "audit.view"] },
    ],
    separatorAfter: true,
  },
  { items: [{ label: "AI", href: "/ai", icon: Sparkles, anyOf: [...ALWAYS, "notice.view"] }] },
];

/** Permission-aware navigation: every module is filtered by the caller's
 * actual permission grants, never by their role label. A brand-new role
 * (e.g. "Placement Coordinator") only needs the right permissions to light
 * up the matching nav entries - no nav-config edit required as long as it
 * reuses an existing module's permission keys. */
export function getNavGroups(ctx: Pick<ClientContext, "permissions">): NavGroup[] {
  const has = new Set(ctx.permissions);
  return GROUPS.map((group) => ({ ...group, items: group.items.filter((item) => item.anyOf.some((p) => has.has(p))) })).filter(
    (group) => group.items.length > 0,
  );
}
