"use client";
import { LockKeyhole, Pencil, ShieldCheck, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/common/data-table";
import type { TableSort } from "@/lib/table";
import type { RoleSummary } from "@/server/schema/roles_schema";

type Props = { roles: RoleSummary[]; onEdit: (role: RoleSummary) => void; onDelete: (role: RoleSummary) => void; disabled: boolean; loading?: boolean; sorting?: TableSort | null; onSortingChange?: (sorting: TableSort | null) => void };
function RoleActions({ role, onEdit, onDelete, disabled }: Omit<Props, "roles"> & { role: RoleSummary }) {
  const protectedRole = role.is_system || role.slug === "super_admin";
  return <div className="flex items-center justify-end gap-1"><Button variant="ghost" size="icon" aria-label={`Edit ${role.name}`} title={protectedRole ? "System roles are managed by the application" : "Edit role"} disabled={disabled || protectedRole} onClick={() => onEdit(role)}><Pencil className="size-4" /></Button><Button variant="ghost" size="icon" aria-label={`Delete ${role.name}`} title={protectedRole ? "System roles cannot be deleted" : role.assignment_count ? "Assigned roles cannot be deleted" : "Delete role"} disabled={disabled || protectedRole || role.assignment_count > 0} onClick={() => onDelete(role)}><Trash2 className="size-4 text-destructive" /></Button></div>;
}
function RoleLabels({ role }: { role: RoleSummary }) {
  return <div className="flex flex-wrap gap-1.5"><span className="rounded-full bg-primary/10 px-2 py-1 text-xs text-primary">{role.scope === "global" ? "Global" : "Company"}</span>{role.is_system && <span className="flex items-center gap-1 rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-600"><LockKeyhole className="size-3" aria-hidden="true" />System</span>}{role.is_default_role && <span className="rounded-full bg-emerald-50 px-2 py-1 text-xs text-emerald-700">Default</span>}</div>;
}
export function RolesTable(props: Props) {
  const protectedRole = (role: RoleSummary) => role.is_system || role.slug === "super_admin";
  return <DataTable data={props.roles} rowKey={role => role.id} caption="Role definitions and assignments"
    sortingMode={props.onSortingChange ? "server" : "client"} sorting={props.sorting} onSortingChange={props.onSortingChange} loading={props.loading} multipleFrozenColumns actionsDisabled={props.disabled}
    columns={[
      { id: "name", header: "Role", width: 250, sortable: true, freezable: true, value: role => role.name,
        cell: role => <><p className="font-medium">{role.name}</p><p className="mt-1 text-xs text-muted-foreground">{role.slug}</p></> },
      { id: "scope", header: "Scope / type", width: 220, sortable: true, freezable: true, value: role => role.scope, cell: role => <RoleLabels role={role} /> },
      { id: "access", header: "Access", width: 260, freezable: true, cell: role => role.slug === "super_admin" ? "Full dashboard access" : role.pages.length + " pages / " + role.permissions.length + " permissions" },
      { id: "assignment_count", header: "Assignments", width: 150, freezable: true, value: role => role.assignment_count },
    ]}
    actions={[
      { id: "edit", label: "Edit", icon: <Pencil />, disabled: protectedRole, onSelect: props.onEdit },
      { id: "delete", label: "Delete", icon: <Trash2 />, destructive: true, disabled: role => protectedRole(role) || role.assignment_count > 0,
        description: role => protectedRole(role) ? "System roles cannot be deleted" : role.assignment_count ? "Assigned roles cannot be deleted" : undefined, onSelect: props.onDelete },
    ]} />;
}
export function RolesCards(props: Props) {
  return <div className="grid gap-4 p-4 sm:grid-cols-2 sm:p-6 xl:grid-cols-3">{props.roles.map(role => <article key={role.id} className="rounded-xl border p-5"><div className="mb-4 flex items-center gap-3"><span className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary"><ShieldCheck className="size-5" aria-hidden="true" /></span><div className="min-w-0"><h2 className="truncate font-semibold">{role.name}</h2><p className="text-xs text-muted-foreground">{role.slug}</p></div></div><RoleLabels role={role} /><p className="mt-4 text-sm text-muted-foreground">{role.slug === "super_admin" ? "Full dashboard access" : `${role.pages.length} pages · ${role.permissions.length} permissions`}</p><div className="mt-4 flex items-center justify-between border-t pt-3"><span className="text-xs text-muted-foreground">{role.assignment_count} assignments</span><RoleActions {...props} role={role} /></div></article>)}</div>;
}
