"use client";

import { useMemo, useState } from "react";
import { ShieldCheck, Users, ScrollText, ArrowRightLeft, Plus, Copy, Trash2, Loader2, User, KeyRound, Database, ArrowRight } from "lucide-react";
import { PageHeader } from "@/components/common/page-header";
import { LoadingBlock, ErrorBlock, EmptyState } from "@/components/common/state-blocks";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useApiGet } from "@/lib/client/use-api";
import { apiMutate } from "@/lib/client/api";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { listRoles, listUsersWithRoles, listDepartmentsForScopePicker, listLegacyRoleMappings, getAuditLog } from "@/lib/services/rbac-admin";
import type { PermissionDef } from "@/lib/rbac/permissions";

type RoleRow = Awaited<ReturnType<typeof listRoles>>[number];
type UserRow = Awaited<ReturnType<typeof listUsersWithRoles>>[number];
type DeptRow = Awaited<ReturnType<typeof listDepartmentsForScopePicker>>[number];
type LegacyRow = Awaited<ReturnType<typeof listLegacyRoleMappings>>[number];
type AuditRow = Awaited<ReturnType<typeof getAuditLog>>[number];

type Tab = "matrix" | "users" | "legacy" | "audit";
const TABS: { key: Tab; label: string; icon: typeof ShieldCheck }[] = [
  { key: "matrix", label: "Roles & Permissions", icon: KeyRound },
  { key: "users", label: "Users", icon: Users },
  { key: "legacy", label: "Legacy Import Mapping", icon: ArrowRightLeft },
  { key: "audit", label: "Audit Log", icon: ScrollText },
];

// ---------------------------------------------------------------------------
// USER -> ROLE -> PERMISSIONS -> DATA explainer
// ---------------------------------------------------------------------------

function RbacFlowDiagram() {
  const steps = [
    { icon: User, label: "USER", detail: "Signs in as a person" },
    { icon: Users, label: "ROLE(S)", detail: "One or more roles assigned" },
    { icon: KeyRound, label: "PERMISSIONS", detail: "Each role grants permission keys" },
    { icon: ShieldCheck, label: "SCOPE CHECK", detail: "authorize() matches resource" },
    { icon: Database, label: "DATA", detail: "Only the allowed record returns" },
  ];
  return (
    <div className="card-surface flex flex-wrap items-center gap-2 overflow-x-auto p-4">
      {steps.map((s, i) => {
        const Icon = s.icon;
        return (
          <div key={s.label} className="flex items-center gap-2">
            <div className="flex min-w-32 flex-col items-center gap-1 rounded-lg border border-border bg-muted/40 px-3 py-2.5 text-center">
              <Icon className="size-4 text-accent" />
              <p className="text-[11px] font-semibold tracking-wide">{s.label}</p>
              <p className="text-[10px] text-muted-foreground">{s.detail}</p>
            </div>
            {i < steps.length - 1 && <ArrowRight className="size-4 shrink-0 text-muted-foreground/50" />}
          </div>
        );
      })}
    </div>
  );
}

export default function RbacAdminPage() {
  const [tab, setTab] = useState<Tab>("matrix");

  return (
    <div className="space-y-6">
      <PageHeader title="Access Control" description="Manage roles, permissions, scopes, and review the security audit trail." />
      <RbacFlowDiagram />

      <div className="flex gap-1 overflow-x-auto rounded-lg bg-muted p-0.5 text-xs">
        {TABS.map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={cn(
                "flex shrink-0 items-center gap-1.5 rounded-md px-3 py-1.5 font-medium transition-colors",
                tab === t.key ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Icon className="size-3.5" />
              {t.label}
            </button>
          );
        })}
      </div>

      {tab === "matrix" && <RolesMatrixTab />}
      {tab === "users" && <UsersTab />}
      {tab === "legacy" && <LegacyMappingTab />}
      {tab === "audit" && <AuditLogTab />}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Roles & permission matrix
// ---------------------------------------------------------------------------

function RolesMatrixTab() {
  const { data, loading, error, reload } = useApiGet<{ roles: RoleRow[] }>("/api/admin/rbac/roles");
  const { data: permData } = useApiGet<{ permissions: PermissionDef[] }>("/api/admin/rbac/permissions");
  const [expanded, setExpanded] = useState<number | null>(null);
  const [pending, setPending] = useState<Set<string>>(new Set());
  const [busyRoleId, setBusyRoleId] = useState<number | null>(null);
  const [newRoleName, setNewRoleName] = useState("");
  const [showCreate, setShowCreate] = useState(false);

  const roles = data?.roles ?? [];
  const grouped = useMemo(() => {
    const byGroup = new Map<string, PermissionDef[]>();
    for (const p of permData?.permissions ?? []) byGroup.set(p.group, [...(byGroup.get(p.group) ?? []), p]);
    return Array.from(byGroup.entries());
  }, [permData]);

  function openRole(role: RoleRow) {
    if (expanded === role.id) {
      setExpanded(null);
      return;
    }
    setExpanded(role.id);
    setPending(new Set(role.permissions));
  }

  function togglePermission(key: string) {
    setPending((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  async function savePermissions(roleId: number) {
    setBusyRoleId(roleId);
    try {
      await apiMutate(`/api/admin/rbac/roles/${roleId}/permissions`, { method: "PUT", body: { permissions: Array.from(pending) } });
      toast.success("Permissions updated.");
      reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update permissions");
    } finally {
      setBusyRoleId(null);
    }
  }

  async function duplicateRole(role: RoleRow) {
    setBusyRoleId(role.id);
    try {
      await apiMutate(`/api/admin/rbac/roles/${role.id}/duplicate`, { method: "POST", body: { name: `${role.name} (Copy)` } });
      toast.success(`Duplicated "${role.name}".`);
      reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to duplicate role");
    } finally {
      setBusyRoleId(null);
    }
  }

  async function deleteRole(role: RoleRow) {
    setBusyRoleId(role.id);
    try {
      await apiMutate(`/api/admin/rbac/roles/${role.id}`, { method: "DELETE" });
      toast.success(`Deleted "${role.name}".`);
      reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete role");
    } finally {
      setBusyRoleId(null);
    }
  }

  async function createRole() {
    if (!newRoleName.trim()) return;
    setBusyRoleId(-1);
    try {
      await apiMutate("/api/admin/rbac/roles", {
        method: "POST",
        body: { key: newRoleName, name: newRoleName, category: "employee", permissions: [] },
      });
      toast.success(`Created role "${newRoleName}".`);
      setNewRoleName("");
      setShowCreate(false);
      reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create role");
    } finally {
      setBusyRoleId(null);
    }
  }

  return (
    <div className="space-y-3">
      {loading && <LoadingBlock rows={4} />}
      {error && <ErrorBlock message={error} onRetry={reload} />}

      <div className="flex justify-end">
        {!showCreate ? (
          <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setShowCreate(true)}>
            <Plus className="size-3.5" /> New role
          </Button>
        ) : (
          <div className="flex items-center gap-2">
            <input
              autoFocus
              placeholder="Role name, e.g. Placement Coordinator"
              value={newRoleName}
              onChange={(e) => setNewRoleName(e.target.value)}
              className="rounded-md border border-input bg-background px-2 py-1 text-sm"
            />
            <Button size="sm" onClick={createRole} disabled={busyRoleId === -1}>
              {busyRoleId === -1 ? <Loader2 className="size-3.5 animate-spin" /> : "Create"}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setShowCreate(false)}>
              Cancel
            </Button>
          </div>
        )}
      </div>

      {roles.map((role) => {
        const isOpen = expanded === role.id;
        return (
          <div key={role.id} className="card-surface overflow-hidden">
            <button className="flex w-full items-start justify-between gap-3 px-4 py-3 text-left" onClick={() => openRole(role)}>
              <div>
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium">{role.name}</p>
                  <Badge variant="secondary" className="capitalize">
                    {role.category}
                  </Badge>
                  {role.isSystem && <Badge variant="default">System</Badge>}
                </div>
                <p className="mt-0.5 text-xs text-muted-foreground">{role.description}</p>
              </div>
              <span className="shrink-0 text-xs text-muted-foreground">{role.permissions.length} permissions</span>
            </button>

            {isOpen && (
              <div className="border-t border-border p-4">
                <div className="mb-3 flex items-center justify-end gap-2">
                  <Button size="sm" variant="outline" className="gap-1.5" disabled={busyRoleId === role.id} onClick={() => duplicateRole(role)}>
                    <Copy className="size-3.5" /> Duplicate
                  </Button>
                  {!role.isSystem && (
                    <Button size="sm" variant="outline" className="gap-1.5 text-destructive" disabled={busyRoleId === role.id} onClick={() => deleteRole(role)}>
                      <Trash2 className="size-3.5" /> Delete
                    </Button>
                  )}
                  <Button size="sm" disabled={busyRoleId === role.id} onClick={() => savePermissions(role.id)} className="gap-1.5">
                    {busyRoleId === role.id && <Loader2 className="size-3.5 animate-spin" />}
                    Save permissions
                  </Button>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {grouped.map(([group, perms]) => (
                    <div key={group}>
                      <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{group}</p>
                      <div className="space-y-1">
                        {perms.map((p) => (
                          <label key={p.key} className="flex cursor-pointer items-start gap-2 rounded-md px-1.5 py-1 text-xs hover:bg-secondary">
                            <input
                              type="checkbox"
                              checked={pending.has(p.key)}
                              onChange={() => togglePermission(p.key)}
                              className="mt-0.5"
                            />
                            <span>
                              {p.label}
                              {p.sensitive && <span className="ml-1 text-warning">•</span>}
                            </span>
                          </label>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Users & role assignments
// ---------------------------------------------------------------------------

function UsersTab() {
  const { data, loading, error, reload } = useApiGet<{ users: UserRow[]; departments: DeptRow[] }>("/api/admin/rbac/users");
  const { data: roleData } = useApiGet<{ roles: RoleRow[] }>("/api/admin/rbac/roles");
  const [selectedUser, setSelectedUser] = useState<number | "">("");
  const [selectedRole, setSelectedRole] = useState<number | "">("");
  const [scopeChoice, setScopeChoice] = useState<string>("own");
  const [assigning, setAssigning] = useState(false);

  const users = data?.users ?? [];
  const roles = roleData?.roles ?? [];
  const departments = data?.departments ?? [];

  async function assign() {
    if (!selectedUser || !selectedRole) return;
    setAssigning(true);
    try {
      const scope = scopeChoice === "all" ? { all: true } : scopeChoice === "own" ? null : { departmentId: Number(scopeChoice) };
      await apiMutate("/api/admin/rbac/users", { method: "POST", body: { userId: selectedUser, roleId: selectedRole, scope } });
      toast.success("Role assigned.");
      reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to assign role");
    } finally {
      setAssigning(false);
    }
  }

  async function removeAssignment(id: number) {
    try {
      await apiMutate(`/api/admin/rbac/user-roles/${id}`, { method: "DELETE" });
      toast.success("Role removed.");
      reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to remove role");
    }
  }

  return (
    <div className="space-y-4">
      {loading && <LoadingBlock rows={4} />}
      {error && <ErrorBlock message={error} onRetry={reload} />}

      <div className="card-surface flex flex-wrap items-center gap-2 p-4">
        <select value={selectedUser} onChange={(e) => setSelectedUser(Number(e.target.value))} className="rounded-md border border-input bg-background px-2 py-1.5 text-sm">
          <option value="">Select user</option>
          {users.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name} ({u.email})
            </option>
          ))}
        </select>
        <select value={selectedRole} onChange={(e) => setSelectedRole(Number(e.target.value))} className="rounded-md border border-input bg-background px-2 py-1.5 text-sm">
          <option value="">Select role</option>
          {roles.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
        </select>
        <select value={scopeChoice} onChange={(e) => setScopeChoice(e.target.value)} className="rounded-md border border-input bg-background px-2 py-1.5 text-sm">
          <option value="own">Own record (default, resolved dynamically)</option>
          <option value="all">All (unrestricted)</option>
          {departments.map((d) => (
            <option key={d.id} value={d.id}>
              Department: {d.name}
            </option>
          ))}
        </select>
        <Button size="sm" onClick={assign} disabled={assigning || !selectedUser || !selectedRole} className="gap-1.5">
          {assigning && <Loader2 className="size-3.5 animate-spin" />}
          Assign role
        </Button>
      </div>

      {data && users.length === 0 && <EmptyState icon={Users} title="No users" />}
      <div className="space-y-2">
        {users.map((u) => (
          <div key={u.id} className="card-surface p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">{u.name}</p>
                <p className="text-xs text-muted-foreground">
                  {u.email} · primary: {u.role}
                </p>
              </div>
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {u.assignments.length === 0 && <span className="text-xs text-muted-foreground">No roles assigned</span>}
              {u.assignments.map((a) => (
                <Badge key={a.id} variant="secondary" className="gap-1.5 pr-1">
                  {a.roleName}
                  <button onClick={() => removeAssignment(a.id)} className="rounded-full px-1 text-muted-foreground hover:text-destructive">
                    ×
                  </button>
                </Badge>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Legacy import role mapping
// ---------------------------------------------------------------------------

function LegacyMappingTab() {
  const { data, loading, error, reload } = useApiGet<{ mappings: LegacyRow[] }>("/api/admin/rbac/legacy-mapping");
  const { data: roleData } = useApiGet<{ roles: RoleRow[] }>("/api/admin/rbac/roles");
  const [newLegacy, setNewLegacy] = useState("");
  const [newMapped, setNewMapped] = useState("");

  const mappings = data?.mappings ?? [];
  const roles = roleData?.roles ?? [];

  async function save(legacyRole: string, mappedRoleKey: string) {
    try {
      await apiMutate("/api/admin/rbac/legacy-mapping", { method: "POST", body: { legacyRole, mappedRoleKey } });
      toast.success(`Mapped "${legacyRole}" -> role updated.`);
      reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save mapping");
    }
  }

  async function addMapping() {
    if (!newLegacy.trim() || !newMapped) return;
    await save(newLegacy.trim(), newMapped);
    setNewLegacy("");
    setNewMapped("");
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        When a legacy database is imported, its free-text role labels are reconciled against the roles below before any account is created.
      </p>
      {loading && <LoadingBlock rows={3} />}
      {error && <ErrorBlock message={error} onRetry={reload} />}

      <div className="overflow-hidden card-surface">
        <table className="w-full text-left text-sm">
          <thead className="bg-muted/50 text-xs font-medium text-muted-foreground">
            <tr>
              <th className="px-4 py-2 font-medium">Legacy role</th>
              <th className="px-4 py-2 font-medium">Maps to</th>
              <th className="px-4 py-2 font-medium">Notes</th>
            </tr>
          </thead>
          <tbody>
            {mappings.map((m) => (
              <tr key={m.legacyRole} className="border-t border-border">
                <td className="px-4 py-2 font-medium">{m.legacyRole}</td>
                <td className="px-4 py-2">
                  <select
                    defaultValue={m.mappedRoleKey}
                    onChange={(e) => save(m.legacyRole, e.target.value)}
                    className="rounded-md border border-input bg-background px-2 py-1 text-sm"
                  >
                    {roles.map((r) => (
                      <option key={r.key} value={r.key}>
                        {r.name}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="px-4 py-2 text-xs text-muted-foreground">{m.notes ?? "—"}</td>
              </tr>
            ))}
            <tr className="border-t border-border">
              <td className="px-4 py-2">
                <input
                  placeholder="e.g. Registrar"
                  value={newLegacy}
                  onChange={(e) => setNewLegacy(e.target.value)}
                  className="w-full rounded-md border border-input bg-background px-2 py-1 text-sm"
                />
              </td>
              <td className="px-4 py-2">
                <select value={newMapped} onChange={(e) => setNewMapped(e.target.value)} className="rounded-md border border-input bg-background px-2 py-1 text-sm">
                  <option value="">Select role</option>
                  {roles.map((r) => (
                    <option key={r.key} value={r.key}>
                      {r.name}
                    </option>
                  ))}
                </select>
              </td>
              <td className="px-4 py-2">
                <Button size="sm" variant="outline" onClick={addMapping} className="gap-1.5">
                  <Plus className="size-3.5" /> Add
                </Button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Audit log
// ---------------------------------------------------------------------------

function AuditLogTab() {
  const [resultFilter, setResultFilter] = useState<"all" | "success" | "denied">("all");
  const { data, loading, error, reload } = useApiGet<{ logs: AuditRow[] }>(
    `/api/admin/audit-log${resultFilter !== "all" ? `?result=${resultFilter}` : ""}`,
  );
  const logs = data?.logs ?? [];

  return (
    <div className="space-y-3">
      <div className="flex gap-1.5">
        {(["all", "success", "denied"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setResultFilter(f)}
            className={cn(
              "rounded-full border px-3 py-1 text-xs capitalize transition-colors",
              resultFilter === f ? "border-primary bg-primary text-primary-foreground" : "border-input text-muted-foreground hover:bg-secondary",
            )}
          >
            {f}
          </button>
        ))}
      </div>

      {loading && <LoadingBlock rows={5} />}
      {error && <ErrorBlock message={error} onRetry={reload} />}
      {data && logs.length === 0 && <EmptyState icon={ScrollText} title="No matching audit entries" />}

      {logs.length > 0 && (
        <div className="overflow-hidden card-surface">
          <table className="w-full text-left text-sm">
            <thead className="bg-muted/50 text-xs font-medium text-muted-foreground">
              <tr>
                <th className="px-4 py-2 font-medium">When</th>
                <th className="px-4 py-2 font-medium">Who</th>
                <th className="px-4 py-2 font-medium">Action</th>
                <th className="px-4 py-2 font-medium">Target</th>
                <th className="px-4 py-2 font-medium">Result</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((l) => (
                <tr key={l.id} className="border-t border-border transition-colors hover:bg-muted/30">
                  <td className="px-4 py-2 text-xs text-muted-foreground">{new Date(l.createdAt).toLocaleString()}</td>
                  <td className="px-4 py-2">
                    {l.userName} <span className="text-xs text-muted-foreground capitalize">({l.userRole})</span>
                  </td>
                  <td className="px-4 py-2 font-mono text-xs">{l.action}</td>
                  <td className="px-4 py-2 font-mono text-xs text-muted-foreground">{l.resource ?? "—"}</td>
                  <td className="px-4 py-2">
                    <Badge variant={l.result === "denied" ? "destructive" : "secondary"} className="capitalize">
                      {l.result}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
