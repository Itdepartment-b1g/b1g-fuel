"use client";

import { useRecordAccess } from "@/components/providers/access-provider";
import { canPerform } from "@/lib/auth/access-scope";
import {
  useToast,
  toastErrorMessage,
} from "@/components/providers/toast-provider";
import type { TableSort } from "@/lib/table";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Building2, LayoutGrid, List, LoaderCircle, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Pagination } from "@/components/common/pagination";
import { SearchFilterBar } from "@/components/common/search-filter-bar";
import { DeleteDialog } from "@/components/common/delete-dialog";
import { useAppDispatch, useAppSelector } from "@/lib/store/hooks";
import {
  listCompany,
  getCompanyFilterOption,
  deleteCompany,
  clearCompanyMutation,
  selectCompany,
} from "@/lib/store/companies-slice";
import { countActiveFilters, createQuickFilterState } from "@/lib/quick-filter";
import { COMPANY_FILTER_DEFAULTS } from "@/lib/management-filters";
import {
  DEFAULT_PAGE_SIZE,
  PAGE_SIZE_OPTIONS,
  paginationFromApi,
} from "@/lib/pagination";
import type { CompanySummary } from "@/types/companies";
import { CompanyDialog } from "./dialog/company-dialog";
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
  const [view, setView] = useState<"table" | "cards">("table");
  const [revision, setRevision] = useState(0);
  const [editor, setEditor] = useState<{ id: string | null } | null>(null);
  const [removing, setRemoving] = useState<CompanySummary | null>(null);
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
    setEditor({ id: company?.id ?? null });
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
    onEdit: openCompany,
    onDelete: (company: CompanySummary) => {
      dispatch(clearCompanyMutation());
      setRemoving(company);
    },
  };
  return (
    <>
      <section className="w-full space-y-6">
        <header className="flex flex-wrap items-center justify-between gap-4">
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
            <Button disabled={pending} onClick={() => openCompany()}>
              <Plus className="size-4" aria-hidden="true" />
              Add company
            </Button>
          )}
        </header>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <SearchFilterBar
            className="min-w-0 w-full flex-1"
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
          />
          <div
            className="flex w-fit shrink-0 self-end rounded-lg border p-1 sm:self-auto"
            role="group"
            aria-label="User display"
          >
            <button
              type="button"
              aria-label="Table view"
              aria-pressed={view === "table"}
              onClick={() => setView("table")}
              className={`inline-flex size-10 items-center justify-center rounded-md ${view === "table" ? "bg-gray-50" : "text-muted-foreground"}`}
            >
              <List className="size-4" />
            </button>
            <button
              type="button"
              aria-label="Card view"
              aria-pressed={view === "cards"}
              onClick={() => setView("cards")}
              className={`inline-flex size-10 items-center justify-center rounded-md ${view === "cards" ? "bg-gray-50" : "text-muted-foreground"}`}
            >
              <LayoutGrid className="size-4" />
            </button>
          </div>
        </div>
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
      {editor && (
        <CompanyDialog
          companyId={editor.id}
          onClose={() => setEditor(null)}
          onSaved={(company) => {
            toast.success(
              `${company.name} was ${editor.id ? "updated" : "created"} successfully.`,
            );
            if (!editor.id) setPage(1);
            setEditor(null);
            setRevision((value) => value + 1);
          }}
        />
      )}
      <DeleteDialog
        open={Boolean(removing)}
        onOpenChange={(open) => {
          if (!open) setRemoving(null);
        }}
        title="Delete company?"
        description={`Delete ${removing?.name ?? "this company"}? Only companies without members can be deleted. This cannot be undone.`}
        onConfirm={() => {
          void removeCompany();
        }}
        pending={pending}
        error={mutationError?.message}
      />
    </>
  );
}
