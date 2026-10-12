"use client";

import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Pagination } from "@/components/common/pagination";
import { paginateItems } from "@/lib/pagination";
import { sortTableRows, type TableSort } from "@/lib/table";
import type { UserSummary } from "@/server/schema/users_schema";
import { UsersTable } from "./users-table";

/** Client-side integration example: pass a complete dataset, not one server page. */
export function PaginatedUsersTable({ users }: { users: UserSummary[] }) {
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<TableSort | null>(null);
  const records = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    const filtered = users.filter((user) => user.name.toLocaleLowerCase().includes(query) || (user.email ?? "").toLocaleLowerCase().includes(query));
    return sortTableRows(filtered, sort ?? { field: "created_at", direction: "desc" },
      user => sort?.field === "name" ? user.name : new Date(user.created_at), user => user.id);
  }, [users, search, sort]);
  const result = paginateItems(records, page, limit);
  // A guarded local update keeps parent-owned page state valid when supplied records shrink.
  if (page !== result.page) setPage(result.page);
  return <section className="overflow-hidden rounded-xl border bg-white">
    <div className="flex flex-wrap gap-3 border-b p-4"><Input type="search" aria-label="Search users" placeholder="Search users" value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} className="max-w-sm" />
    </div>
    <UsersTable users={result.items} sorting={sort} onSortingChange={next => { setSort(next); setPage(1); }} />
    <Pagination metadata={result} onPrev={() => setPage(result.page - 1)} onNext={() => setPage(result.page + 1)} onPage={setPage} onLimitChange={(value) => { setLimit(value); setPage(1); }} />
  </section>;
}
