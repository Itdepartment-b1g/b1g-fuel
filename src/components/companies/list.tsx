"use client";

import { useRecordAccess } from "@/components/providers/access-provider";
import { CompanySupplyLinksDialog } from "./dialog/company-supply-links-dialog";
import { clearCompanySupplyMutation } from "@/lib/store/company-supply-slice";
import { canPerform } from "@/lib/auth/access-scope";
import {
  useToast,
  toastErrorMessage,
} from "@/components/providers/toast-provider";
import type { TableSort } from "@/types/table-views";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Building2, LoaderCircle, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Pagination } from "@/components/common/pagination";
import { SearchFilterBar, useListView } from "@/components/common/filter/search-filter-bar";
import { DeleteCompanyDialog } from "./dialog/delete-company-dialog";
import { useAppDispatch, useAppSelector } from "@/lib/store/hooks";
import {
  listCompany,
  getCompanyFilterOption,
  deleteCompany,
  clearCompanyMutation,
  selectCompany,
} from "@/lib/store/companies-slice";
import { countActiveFilters, createQuickFilterState } from "@/utils/quick-filter";
import { COMPANY_FILTER_DEFAULTS } from "@/utils/management-filters";
import { DEFAULT_PAGE_SIZE, PAGE_SIZE_OPTIONS, paginationFromApi } from "@/utils/pagination";
import type { CompanySummary } from "@/types/companies";
import { CreateCompanyDialog } from "./dialog/create-company-dialog";
import { EditCompanyDialog } from "./dialog/edit-company-dialog";
import { CompaniesTableView } from "./table-view/companies-table-view";
import { CompaniesCards } from "./card-views/companies-cards";

export default function CompaniesList() {
  const dispatch = useAppDispatch();
  const access = useRecordAccess();
  const toast = useToast();
  const router = useRouter();
  const {
    companies,
    total,
    listStatus,
    listError,
    mutationStatus,
    mutationError,
    filterOptions,
    filterOptionsError,
  } = useAppSelector(selectCompany);
  const [filters, setFilters] = useState(() =>
    createQuickFilterState(COMPANY_FILTER_DEFAULTS),
  );
  const activeFilters = countActiveFilters(filters, COMPANY_FILTER_DEFAULTS);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(DEFAULT_PAGE_SIZE);
  const [search, setSearch] = useState("");
  const [sorting, setSorting] = useState<TableSort | null>(null);
  const [view, setView] = useListView();
  const [revision, setRevision] = useState(0);
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [removing, setRemoving] = useState<CompanySummary | null>(null);
  const [linking, setLinking] = useState<CompanySummary | null>(null);
  const loading = listStatus === "loading" || listStatus === "idle";
  const pending = mutationStatus === "loading";
  const pagination = paginationFromApi({ page, page_size: pageSize, total });
  useEffect(() => {
    let current = true;
    const request = dispatch(
      listCompany({
        page,
        page_size: pageSize,
        search,
        ...(sorting
          ? { sort_by: sorting.field, sort_order: sorting.direction }
          : {}),
        ...(activeFilters ? { filters } : {}),
      }),
    );
    request.then((action) => {
      if (current && listCompany.fulfilled.match(action)) {
        const validPage = paginationFromApi(action.payload).page;
        if (validPage !== page) setPage(validPage);
      }
    });
    return () => {
      current = false;
      request.abort();
    };
  }, [
    dispatch,
    page,
    pageSize,
    search,
    revision,
    filters,
    activeFilters,
    sorting,
  ]);
  useEffect(() => {
    const request = dispatch(getCompanyFilterOption());
    return () => request.abort();
  }, [dispatch, revision]);
  useEffect(() => {
    if ([listError, mutationError].some((error) => error?.status === 401))
      router.replace("/login");
  }, [listError, mutationError, router]);
  function openCompany(company?: CompanySummary) {
    dispatch(clearCompanyMutation());
    if (company) setEditingId(company.id);
    else setCreating(true);
  }
  async function removeCompany() {
    if (!removing) return;
    try {
      await dispatch(deleteCompany(removing.id)).unwrap();
      toast.success(`${removing.name} was deleted.`);
      setRemoving(null);
      setRevision((value) => value + 1);
    } catch (error) {
      toast.error(toastErrorMessage(error, "Could not delete the company."));
    }
  }
  if (listError?.status === 403)
    return (
      <section className="rounded-xl border p-6">
        <h1 className="text-xl font-semibold">Access restricted</h1>
        <p className="mt-2 text-muted-foreground">
          You do not have permission to view companies.
        </p>
      </section>
    );
  const actions = {
    companies,
    sorting,
    loading,
    onSortingChange: (next: TableSort | null) => {
      setSorting(next);
      setPage(1);
    },
    disabled: pending || loading,
    onSupplyLinks: (company: CompanySummary) => {
      if (!access?.superAdmin) return;
      dispatch(clearCompanySupplyMutation());
      setLinking(company);
    },
    onEdit: openCompany,
    onDelete: (company: CompanySummary) => {
      dispatch(clearCompanyMutation());
      setRemoving(company);
    },
  };
  return (
    <>
      <section className="w-full space-y-6">
        <header className="flex flex-col gap-4 lg:flex-row lg:flex-wrap lg:items-center lg:justify-between">
          <div>
            <p className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Organization
            </p>
            <h1 className="text-3xl font-bold tracking-tight text-primary">
              Companies
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Organize your companies and view their team memberships.
            </p>
          </div>
          {canPerform(access, "companies", "add") && (
            <Button className="w-full lg:w-auto" disabled={pending} onClick={() => openCompany()}>
              <Plus className="size-4" aria-hidden="true" />
              Add company
            </Button>
          )}
        </header>
        <SearchFilterBar
            search={search}
            onSearch={(value) => {
              setSearch(value);
              setPage(1);
            }}
            filters={filters}
            onFiltersChange={(next) => {
              setFilters(next);
              setPage(1);
            }}
            fields={filterOptions.fields}
            statusOptions={filterOptions.statusOptions}
            additionalFilters={filterOptions.additionalFilters}
            filterLabels={{ date: "Creation date", status: "Role status" }}
            maxConditions={50}
            loading={loading}
            searchLabel="Search users by name or email"
            placeholder="Search by name or email"
            maxLength={254}
            quickFilterActive={activeFilters > 0}
            view={view}
            onViewChange={setView}
            viewLabel="Company display"
          />
        <div className="overflow-hidden rounded-[6px] border bg-white shadow-sm">
          {listError && (
            <div
              role="alert"
              className="flex flex-wrap items-center justify-between gap-3 border-b bg-red-50 px-6 py-4 text-sm text-destructive"
            >
              <span>{listError.message}</span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setRevision((value) => value + 1)}
              >
                Try again
              </Button>
            </div>
          )}
          {filterOptionsError && (
            <div
              role="alert"
              className="flex items-center justify-between gap-2 px-6 py-2 text-xs text-destructive"
            >
              <span>Filter choices could not be loaded.</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => dispatch(getCompanyFilterOption())}
              >
                Retry
              </Button>
            </div>
          )}
          <div
            aria-busy={loading}
            className={loading && companies.length ? "opacity-60" : ""}
          >
            {view === "table" ? (
              <CompaniesTableView {...actions} />
            ) : !companies.length && loading ? (
              <div
                role="status"
                className="flex items-center justify-center gap-2 py-20 text-sm text-muted-foreground"
              >
                <LoaderCircle
                  className="size-5 animate-spin"
                  aria-hidden="true"
                />
                Loading companies…
              </div>
            ) : !companies.length && !listError ? (
              <div className="px-6 py-16 text-center">
                <Building2
                  className="mx-auto mb-4 size-10 text-primary/40"
                  aria-hidden="true"
                />
                <h3 className="font-semibold">
                  {search || activeFilters
                    ? "No matching companies"
                    : "No companies yet"}
                </h3>
                <p className="mt-2 text-sm text-muted-foreground">
                  {search || activeFilters
                    ? "Try another search or clear your filters."
                    : "Add your first company to organize memberships."}
                </p>
              </div>
            ) : companies.length ? (
              <CompaniesCards {...actions} />
            ) : null}
          </div>
        </div>
        <Pagination
          metadata={pagination}
          disabled={loading}
          onPrev={() => setPage(pagination.page - 1)}
          onNext={() => setPage(pagination.page + 1)}
          onPage={setPage}
          onLimitChange={(size) => {
            setPageSize(size);
            setPage(1);
          }}
          limitOptions={PAGE_SIZE_OPTIONS}
        />
      </section>
      {creating && (
        <CreateCompanyDialog
          onClose={() => setCreating(false)}
          onSaved={(company, detail) => {
            const warehouse = detail?.facilityName
              ? ` Default warehouse “${detail.facilityName}” was created.`
              : "";
            toast.success(`${company.name} was created successfully.${warehouse}`);
            setPage(1);
            setCreating(false);
            setRevision((value) => value + 1);
          }}
        />
      )}
      {editingId && (
        <EditCompanyDialog
          companyId={editingId}
          onClose={() => setEditingId(null)}
          onSaved={(company) => {
            toast.success(`${company.name} was updated successfully.`);
            setEditingId(null);
            setRevision((value) => value + 1);
          }}
        />
      )}
      {removing && (
        <DeleteCompanyDialog
          company={removing}
          pending={pending}
          error={mutationError?.message}
          onClose={() => setRemoving(null)}
          onConfirm={() => { void removeCompany(); }}
        />
      )}
      {linking && <CompanySupplyLinksDialog key={linking.id} company={linking} onClose={() => setLinking(null)} />}
    </>
  );
}
