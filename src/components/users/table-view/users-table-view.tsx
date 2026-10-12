"use client";

import { useMemo, useState } from "react";
import {
  DataTable,
  type DataTableColumn,
} from "@/components/common/data-table";
import { Pagination } from "@/components/common/pagination";
import { Input } from "@/components/ui/input";
import { paginateItems } from "@/lib/pagination";
import { sortTableRows, type TableSort } from "@/lib/table";
import type { UserSummary } from "@/server/schema/users_schema";
import { UserAssignments, UserAvatar } from "../user-details";

const columns: DataTableColumn<UserSummary>[] = [
  {
    id: "name",
    header: "User",
    width: 280,
    sortable: true,
    freezable: true,
    value: (user) => user.name,
    cell: (user) => (
      <div className="flex items-center gap-3">
        <UserAvatar name={user.name} />
        <div>
          <p className="font-medium">{user.name}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {user.email ?? "No email"}
          </p>
        </div>
      </div>
    ),
  },
  {
    id: "company",
    header: "Company",
    width: 220,
    freezable: true,
    cell: (user) =>
      user.companies.length ? (
        user.companies.map((company) => company.name).join(", ")
      ) : (
        <span className="text-muted-foreground">Not assigned</span>
      ),
  },
  {
    id: "roles",
    header: "Roles",
    width: 260,
    freezable: true,
    cell: (user) => <UserAssignments user={user} />,
  },
  {
    id: "created_at",
    header: "Created",
    width: 170,
    sortable: true,
    freezable: true,
    value: (user) => new Date(user.created_at),
    cell: (user) => (
      <time dateTime={user.created_at} className="text-muted-foreground">
        {new Date(user.created_at).toLocaleDateString("en-PH", {
          year: "numeric",
          month: "short",
          day: "numeric",
          timeZone: "Asia/Manila",
        })}
      </time>
    ),
  },
];

export function UsersTable({
  users,
  sorting,
  onSortingChange,
  loading,
}: {
  users: UserSummary[];
  sorting?: TableSort | null;
  onSortingChange?: (sorting: TableSort | null) => void;
  loading?: boolean;
}) {
  return (
    <DataTable
      data={users}
      columns={columns}
      rowKey={(user) => user.id}
      caption="Organization users and their assignments"
      sortingMode={onSortingChange ? "server" : "client"}
      sorting={sorting}
      onSortingChange={onSortingChange}
      multipleFrozenColumns
      loading={loading}
    />
  );
}

/** Client-side integration example: pass a complete dataset, not one server page. */
export function PaginatedUsersTable({ users }: { users: UserSummary[] }) {
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<TableSort | null>(null);
  const records = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    const filtered = users.filter(
      (user) =>
        user.name.toLocaleLowerCase().includes(query) ||
        (user.email ?? "").toLocaleLowerCase().includes(query),
    );
    return sortTableRows(
      filtered,
      sort ?? { field: "created_at", direction: "desc" },
      (user) =>
        sort?.field === "name" ? user.name : new Date(user.created_at),
      (user) => user.id,
    );
  }, [users, search, sort]);
  const result = paginateItems(records, page, limit);
  if (page !== result.page) setPage(result.page);
  return (
    <section className="overflow-hidden rounded-xl border bg-white">
      <div className="flex flex-wrap gap-3 border-b p-4">
        <Input
          type="search"
          aria-label="Search users"
          placeholder="Search users"
          value={search}
          onChange={(event) => {
            setSearch(event.target.value);
            setPage(1);
          }}
          className="max-w-sm"
        />
      </div>
      <UsersTable
        users={result.items}
        sorting={sort}
        onSortingChange={(next) => {
          setSort(next);
          setPage(1);
        }}
      />
      <Pagination
        metadata={result}
        onPrev={() => setPage(result.page - 1)}
        onNext={() => setPage(result.page + 1)}
        onPage={setPage}
        onLimitChange={(value) => {
          setLimit(value);
          setPage(1);
        }}
      />
    </section>
  );
}
