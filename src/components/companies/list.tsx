"use client";
import { SearchFilterBar } from "@/components/common/search-filter-bar";
import { countActiveFilters, createQuickFilterState } from "@/lib/quick-filter";
import { COMPANY_FILTER_DEFAULTS } from "@/lib/management-filters";
import { useRecordAccess } from "@/components/providers/access-provider";
import { canPerform } from "@/lib/auth/access-scope";
import { useToast, toastErrorMessage } from "@/components/providers/toast-provider";
import type { TableSort } from "@/lib/table";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ManagementList, ListPlaceholder } from "@/components/common/management-list";
import { DeleteDialog } from "@/components/common/delete-dialog";
import { useAppDispatch, useAppSelector } from "@/lib/store/hooks";
import { listCompany, getCompanyFilterOption, deleteCompany, clearCompanyMutation, selectCompany } from "@/lib/store/companies-slice";
import { DEFAULT_PAGE_SIZE, paginationFromApi } from "@/lib/pagination";
import type { CompanySummary } from "@/server/schema/companies_schema";
import { CompanyDialog } from "./dialog/company-dialog";
import { CompaniesTableView } from "./table-view/companies-table-view";
import { CompaniesCards } from "./card-views/companies-cards";

export default function CompaniesList() {
  const dispatch = useAppDispatch();
  const access = useRecordAccess();
  const toast = useToast(); const router = useRouter();
  const { companies, total, listStatus, listError, mutationStatus, mutationError, filterOptions, filterOptionsError } = useAppSelector(selectCompany);
  const [page, setPage] = useState(1); const [limit, setLimit] = useState<number>(DEFAULT_PAGE_SIZE); const [search, setSearch] = useState(""); const [filters, setFilters] = useState(() => createQuickFilterState(COMPANY_FILTER_DEFAULTS));
  const activeFilters = countActiveFilters(filters, COMPANY_FILTER_DEFAULTS);
  const [sorting, setSorting] = useState<TableSort | null>(null);
  const [view, setView] = useState<"table" | "cards">("table"); const [revision, setRevision] = useState(0);
  const [editor, setEditor] = useState<{ id: string | null } | null>(null); const [removing, setRemoving] = useState<CompanySummary | null>(null);
  const loading = listStatus === "loading" || listStatus === "idle"; const pending = mutationStatus === "loading"; const metadata = paginationFromApi({ page, page_size: limit, total });
  useEffect(() => {
    let current = true; const request = dispatch(listCompany({ page, page_size: limit, search, ...(activeFilters ? { filters } : {}), ...(sorting ? { sort_by: sorting.field, sort_order: sorting.direction } : {}) }));
    request.then(action => { if (current && listCompany.fulfilled.match(action)) { const valid = paginationFromApi(action.payload).page; if (valid !== page) setPage(valid); } });
    return () => { current = false; request.abort(); };
  }, [dispatch, page, limit, search, filters, activeFilters, revision, sorting]);
  useEffect(() => { if ([listError, mutationError].some(error => error?.status === 401)) router.replace("/login"); }, [listError, mutationError, router]);
  useEffect(() => {
    const request = dispatch(getCompanyFilterOption());
    return () => request.abort();
  }, [dispatch, revision]);
  function openCompany(company?: CompanySummary) { dispatch(clearCompanyMutation()); setEditor({ id: company?.id ?? null }); }
  async function removeCompany() { if (!removing) return; try { await dispatch(deleteCompany(removing.id)).unwrap(); toast.success(`${removing.name} was deleted.`); setRemoving(null); setRevision(value => value + 1); } catch (error) { toast.error(toastErrorMessage(error, "Could not delete the company.")); } }
  if (listError?.status === 403) return <section className="rounded-xl border p-6"><h1 className="text-xl font-semibold">Access restricted</h1><p className="mt-2 text-muted-foreground">You do not have permission to view companies.</p></section>;
  const actions = { companies, sorting, loading, onSortingChange: (next: TableSort | null) => { setSorting(next); setPage(1); }, disabled: pending || loading, onEdit: openCompany, onDelete: (company: CompanySummary) => { dispatch(clearCompanyMutation()); setRemoving(company); } };
  return <>
    <ManagementList title="Companies" description="Organize your companies and view their team memberships." total={total} action={canPerform(access, "companies", "add") ? <Button disabled={pending} onClick={() => openCompany()}><Plus className="size-4" aria-hidden="true" />Add company</Button> : null}
        filterBar={
          <>
            <SearchFilterBar
              search={search}
              onSearch={(value) => { setSearch(value); setPage(1); }}
              filters={filters}
              onFiltersChange={(next) => { setFilters(next); setPage(1); }}
              fields={filterOptions.fields}
              statusOptions={filterOptions.statusOptions}
              additionalFilters={filterOptions.additionalFilters}
              filterLabels={{ date: "Creation date", status: "Membership status" }}
              maxConditions={50}
              loading={loading}
              searchLabel="Search companies by name"
              placeholder="Search companies"
              maxLength={160}
              quickFilterActive={activeFilters > 0}
            />
            {filterOptionsError && <div role="alert" className="flex items-center justify-between gap-2 text-xs text-destructive"><span>Filter choices could not be loaded.</span><Button variant="ghost" size="sm" onClick={() => dispatch(getCompanyFilterOption())}>Retry</Button></div>}
          </>
        }
      view={view} onView={setView} loading={loading} error={listError?.message} onRefresh={() => setRevision(value => value + 1)} metadata={metadata} onPage={setPage} onLimitChange={value => { setLimit(value); setPage(1); }}>
      {view === "table" ? <CompaniesTableView {...actions} /> : !companies.length ? <ListPlaceholder loading={loading} title={search || activeFilters ? "No matching companies" : "No companies yet"} description={search || activeFilters ? "Try another search or clear your filters." : "Add your first company to organize memberships."} /> : <CompaniesCards {...actions} />}
    </ManagementList>
    {editor && <CompanyDialog companyId={editor.id} onClose={() => setEditor(null)} onSaved={company => { toast.success(`${company.name} was ${editor.id ? "updated" : "created"} successfully.`); if (!editor.id) setPage(1); setEditor(null); setRevision(value => value + 1); }} />}
    <DeleteDialog open={Boolean(removing)} onOpenChange={open => { if (!open) setRemoving(null); }} title="Delete company?" description={`Delete ${removing?.name ?? "this company"}? Only companies without members can be deleted. This cannot be undone.`} onConfirm={() => { void removeCompany(); }} pending={pending} error={mutationError?.message} />
  </>;
}
