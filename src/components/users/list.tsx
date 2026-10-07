"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, LayoutGrid, List, LoaderCircle, RefreshCw, Search, UsersRound, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Pagination } from "@/components/common/pagination";
import { useAppDispatch, useAppSelector } from "@/lib/store/hooks";
import { listUser, getUserFilterOption, selectUser } from "@/lib/store/users-slice";
import { QuickFilter } from "@/components/common/quick-filter";
import { countActiveFilters, createQuickFilterState } from "@/lib/quick-filter";
import { USER_FILTER_DEFAULTS } from "@/lib/users-filters";
import { DEFAULT_PAGE_SIZE, PAGE_SIZE_OPTIONS, paginationFromApi } from "@/lib/pagination";
import { CreateUserDialog } from "./dialog/create-user-dialog";
import { UsersTable } from "./table-view/users-table";
import { UsersCards } from "./card-views/users-cards";

export default function UsersList() {
  const dispatch = useAppDispatch();
  const router = useRouter();
  const { users, total, listStatus, listError, filterOptions, filterOptionsError, filterOptionsStatus } = useAppSelector(selectUser);
  const [filters, setFilters] = useState(() => createQuickFilterState(USER_FILTER_DEFAULTS));
  const activeFilters = countActiveFilters(filters, USER_FILTER_DEFAULTS);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(DEFAULT_PAGE_SIZE);
  const [searchDraft, setSearchDraft] = useState("");
  const [search, setSearch] = useState("");
  const [view, setView] = useState<"table" | "cards">("table");
  const [revision, setRevision] = useState(0);
  const [success, setSuccess] = useState<string | null>(null);
  const loading = listStatus === "loading" || listStatus === "idle";
  const pagination = paginationFromApi({ page, page_size: pageSize, total });
  useEffect(() => {
    let current = true;
    const request = dispatch(listUser({ page, page_size: pageSize, search, ...(activeFilters ? { filters } : {}) }));
    request.then((action) => {
      if (current && listUser.fulfilled.match(action)) {
        const validPage = paginationFromApi(action.payload).page;
        if (validPage !== page) setPage(validPage);
      }
    });
    return () => { current = false; request.abort(); };
  }, [dispatch, page, pageSize, search, revision, filters, activeFilters]);
  useEffect(() => {
    const request = dispatch(getUserFilterOption());
    return () => request.abort();
  }, [dispatch, revision]);
  useEffect(() => { if (listError?.status === 401) router.replace("/login"); }, [listError, router]);
  function applySearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSearch(searchDraft.trim()); setPage(1);
  }
  if (listError?.status === 403) return <section className="rounded-xl border p-6"><h1 className="text-xl font-semibold">Access restricted</h1><p className="mt-2 text-muted-foreground">User management is available to super-admins.</p><Button variant="outline" className="mt-4" onClick={() => router.replace("/dashboard")}>Back to dashboard</Button></section>;
  return <section className="mx-auto max-w-7xl space-y-6">
    <header className="flex flex-wrap items-center justify-between gap-4"><div><p className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">Organization</p><h1 className="text-3xl font-bold tracking-tight text-primary">Users</h1><p className="mt-2 text-sm text-muted-foreground">Create accounts and view company and role assignments.</p></div><CreateUserDialog onCreated={(user) => { setSuccess(`${user.name} was created successfully.`); setPage(1); setRevision((value) => value + 1); }} /></header>
    {success && <div role="status" className="flex items-center gap-3 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800"><CheckCircle2 className="size-5 shrink-0" aria-hidden="true" /><span className="flex-1">{success}</span><button type="button" aria-label="Dismiss success message" onClick={() => setSuccess(null)} className="rounded p-1"><X className="size-4" /></button></div>}
    <div className="overflow-hidden rounded-xl border bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b px-4 py-5 sm:px-6"><div className="flex items-center gap-2"><h2 className="font-semibold">All users</h2><span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">{total}</span></div><div className="flex items-center gap-2"><Button variant="ghost" size="icon" aria-label="Refresh users" disabled={loading} onClick={() => setRevision((value) => value + 1)}><RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} /></Button><div className="flex rounded-lg border p-1" role="group" aria-label="User display"><button type="button" aria-label="Table view" aria-pressed={view === "table"} onClick={() => setView("table")} className={`rounded-md p-2 ${view === "table" ? "bg-primary/10 text-primary" : "text-muted-foreground"}`}><List className="size-4" /></button><button type="button" aria-label="Card view" aria-pressed={view === "cards"} onClick={() => setView("cards")} className={`rounded-md p-2 ${view === "cards" ? "bg-primary/10 text-primary" : "text-muted-foreground"}`}><LayoutGrid className="size-4" /></button></div></div></div>
      <form onSubmit={applySearch} className="flex flex-wrap items-center gap-2 border-b px-4 py-4 sm:px-6"><div className="relative min-w-0 flex-1 sm:max-w-sm"><Search className="absolute left-3 top-3 size-4 text-muted-foreground" aria-hidden="true" /><Input type="search" aria-label="Search users by name or email" placeholder="Search by name or email" value={searchDraft} maxLength={254} onChange={(event) => setSearchDraft(event.target.value)} className="pl-9" /></div><Button type="submit" variant="outline">Search</Button>{search && <Button type="button" variant="ghost" onClick={() => { setSearchDraft(""); setSearch(""); setPage(1); }}>Clear</Button>}</form>
      {listError && <div role="alert" className="flex flex-wrap items-center justify-between gap-3 border-b bg-red-50 px-6 py-4 text-sm text-destructive"><span>{listError.message}</span><Button variant="outline" size="sm" onClick={() => setRevision((value) => value + 1)}>Try again</Button></div>}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3 sm:px-6"><span className="text-xs text-muted-foreground">{activeFilters ? `${activeFilters} active filters` : "Filter by creation date, columns, and assignments"}</span><QuickFilter value={filters} onChange={(next) => { setFilters(next); setPage(1); }} fields={filterOptions.fields} statusOptions={filterOptions.statusOptions} additionalFilters={filterOptions.additionalFilters} labels={{ date: "Creation date", status: "Role status" }} maxConditions={50} /></div>
      {filterOptionsStatus === "loading" && <p role="status" className="px-6 py-2 text-xs text-muted-foreground">Loading filter choices…</p>}
      {filterOptionsError && <div role="alert" className="flex items-center justify-between gap-2 px-6 py-2 text-xs text-destructive"><span>Filter choices could not be loaded.</span><Button variant="ghost" size="sm" onClick={() => dispatch(getUserFilterOption())}>Retry</Button></div>}
      <div aria-busy={loading} className={loading && users.length ? "opacity-60" : ""}>
        {!users.length && loading ? <div role="status" className="flex items-center justify-center gap-2 py-20 text-sm text-muted-foreground"><LoaderCircle className="size-5 animate-spin" aria-hidden="true" />Loading users…</div> : !users.length && !listError ? <div className="px-6 py-16 text-center"><UsersRound className="mx-auto mb-4 size-10 text-primary/40" aria-hidden="true" /><h3 className="font-semibold">{search || activeFilters ? "No matching users" : "No users yet"}</h3><p className="mt-2 text-sm text-muted-foreground">{search || activeFilters ? "Try another search or clear your filters." : "Add your first user to get started."}</p></div> : users.length ? view === "table" ? <UsersTable users={users} /> : <UsersCards users={users} /> : null}
      </div>
      <Pagination metadata={pagination} disabled={loading} onPrev={() => setPage(pagination.page - 1)} onNext={() => setPage(pagination.page + 1)} onPage={setPage} onLimitChange={(size) => { setPageSize(size); setPage(1); }} limitOptions={PAGE_SIZE_OPTIONS} />
    </div>
  </section>;
}
