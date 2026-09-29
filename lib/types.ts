// Client-safe shared types. Nothing here may import server-only modules
// (db client, node:fs, etc.) since this file is imported from client
// components.

export type Role = "student" | "faculty" | "parent" | "admin" | "employee";

export type RoleLabel = { key: string; name: string };

export type ClientContext = {
  userId: number;
  /** Primary/display role bucket - drives which top-level persona icon and
   * demo-switcher grouping to show. Authorization never branches on this;
   * it always goes through `permissions` + server-side scope checks. */
  role: Role;
  name: string;
  studentId: number | null;
  facultyId: number | null;
  parentId: number | null;
  employeeId: number | null;
  departmentId: number | null;
  departmentName: string | null;
  /** Every role assignment this user holds (e.g. Faculty + Class Mentor). */
  roles: RoleLabel[];
  /** Flattened permission keys, presence-only (no scope). UI/nav hints ONLY
   * - never trust this for a security decision, the server re-checks scope
   * on every request. */
  permissions: string[];
};

export type NetworkMode = "online" | "slow" | "offline";

export const DAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
