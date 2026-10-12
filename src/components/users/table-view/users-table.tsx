"use client";
import { DataTable, type DataTableColumn } from "@/components/common/data-table";
import type { TableSort } from "@/lib/table";
import type { UserSummary } from "@/server/schema/users_schema";
import { UserAssignments, UserAvatar } from "../user-details";
const columns: DataTableColumn<UserSummary>[] = [
  { id: "name", header: "User", width: 280, sortable: true, freezable: true, value: user => user.name,
    cell: user => <div className="flex items-center gap-3"><UserAvatar name={user.name} /><div><p className="font-medium">{user.name}</p><p className="mt-0.5 text-xs text-muted-foreground">{user.email ?? "No email"}</p></div></div> },
  { id: "company", header: "Company", width: 220, freezable: true,
    cell: user => user.companies.length ? user.companies.map(company => company.name).join(", ") : <span className="text-muted-foreground">Not assigned</span> },
  { id: "roles", header: "Roles", width: 260, freezable: true, cell: user => <UserAssignments user={user} /> },
  { id: "created_at", header: "Created", width: 170, sortable: true, freezable: true, value: user => new Date(user.created_at),
    cell: user => <time dateTime={user.created_at} className="text-muted-foreground">{new Date(user.created_at).toLocaleDateString("en-PH", { year: "numeric", month: "short", day: "numeric", timeZone: "Asia/Manila" })}</time> },
];
export function UsersTable({ users, sorting, onSortingChange, loading }: { users: UserSummary[]; sorting?: TableSort | null; onSortingChange?: (sorting: TableSort | null) => void; loading?: boolean }) {
  return <DataTable data={users} columns={columns} rowKey={user => user.id} caption="Organization users and their assignments"
    sortingMode={onSortingChange ? "server" : "client"} sorting={sorting} onSortingChange={onSortingChange} multipleFrozenColumns loading={loading} />;
}
