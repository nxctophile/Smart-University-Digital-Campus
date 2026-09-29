/**
 * Scope model: a permission grant applies either everywhere ({all:true}) or
 * is restricted to specific resource ids. `ResourceNeed` describes the
 * resource a caller is trying to reach; `Scope` describes what a grant
 * covers. `scopeAllows` is the only place the two get compared.
 */

export type Scope = {
  all?: boolean;
  studentId?: number;
  studentIds?: number[];
  courseIds?: number[];
  departmentId?: number;
  employeeId?: number;
};

export type ResourceNeed = {
  studentId?: number;
  courseId?: number;
  departmentId?: number;
  employeeId?: number;
};

export function scopeAllows(scope: Scope | null | undefined, need?: ResourceNeed): boolean {
  if (!need) return true; // presence-only permission check - no specific resource to gate.
  if (!scope) return false;
  if (scope.all) return true;

  if (need.studentId !== undefined) {
    if (scope.studentId === need.studentId) return true;
    if (scope.studentIds?.includes(need.studentId)) return true;
  }
  if (need.courseId !== undefined && scope.courseIds?.includes(need.courseId)) return true;
  if (need.departmentId !== undefined && scope.departmentId === need.departmentId) return true;
  if (need.employeeId !== undefined && scope.employeeId === need.employeeId) return true;

  return false;
}

export function parseScope(raw: string | null | undefined): Scope | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    return typeof parsed === "object" && parsed !== null ? (parsed as Scope) : null;
  } catch {
    return null;
  }
}
