"use client";

import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Pagination } from "@/components/common/pagination";
import { paginateItems } from "@/lib/pagination";
import type { UserSummary } from "@/lib/users";
import { UsersTable } from "./users-table";

/** Client-side integration example: pass a complete dataset, not one server page. */
export function PaginatedUsersTable({ users }: { users: UserSummary[] }) {
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<"asc" | "desc">("asc");
  const records = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    return users.filter((user) => user.name.toLocaleLowerCase().includes(query) || (user.email ?? "").toLocaleLowerCase().includes(query))
      .sort((a, b) => (sort === "asc" ? 1 : -1) * (a.name.localeCompare(b.name) || a.id.localeCompare(b.id)));
  }, [users, search, sort]);
  const result = paginateItems(records, page, limit);
  // A guarded local update keeps parent-owned page state valid when supplied records shrink.
  if (page !== result.page) setPage(result.page);
  return <section className="overflow-hidden rounded-xl border bg-white">
    <div className="flex flex-wrap gap-3 border-b p-4"><Input type="search" aria-label="Search users" placeholder="Search users" value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} className="max-w-sm" />
      <select aria-label="Sort users by name" value={sort} onChange={(event) => { setSort(event.target.value as "asc" | "desc"); setPage(1); }} className="h-10 rounded-md border bg-white px-3 text-sm"><option value="asc">Name: A–Z</option><option value="desc">Name: Z–A</option></select>
    </div>
    {result.items.length ? <UsersTable users={result.items} /> : <p className="p-8 text-center text-sm text-muted-foreground">No matching users.</p>}
    <Pagination metadata={result} onPrev={() => setPage(result.page - 1)} onNext={() => setPage(result.page + 1)} onPage={setPage} onLimitChange={(value) => { setLimit(value); setPage(1); }} />
  </section>;
}
