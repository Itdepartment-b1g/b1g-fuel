"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle, Plus, Truck } from "lucide-react";
import { useRecordAccess } from "@/components/providers/access-provider";
import { useToast, toastErrorMessage } from "@/components/providers/toast-provider";
import { Button } from "@/components/ui/button";
import { DeleteSupplierDialog } from "./dialog/delete-supplier-dialog";
import { Pagination } from "@/components/common/pagination";
import { SearchFilterBar, useListView } from "@/components/common/filter/search-filter-bar";
import { canPerform } from "@/lib/auth/access-scope";
import { countActiveFilters, createQuickFilterState } from "@/utils/quick-filter";
import { SUPPLIER_FILTER_DEFAULTS } from "@/utils/management-filters";
import { DEFAULT_PAGE_SIZE, PAGE_SIZE_OPTIONS, paginationFromApi } from "@/utils/pagination";
import type { TableSort } from "@/types/table-views";
import { useAppDispatch, useAppSelector } from "@/lib/store/hooks";
import { clearSupplierMutation, deleteSupplier, getSupplierFilterOption, listSupplier, selectSupplier } from "@/lib/store/suppliers-slice";
import type { SupplierSummary } from "@/types/suppliers";
import { CreateSupplierDialog } from "./dialog/create-supplier-dialog";
import { EditSupplierDialog } from "./dialog/edit-supplier-dialog";
import { SuppliersTableView } from "./table-view/suppliers-table-view";
import { SuppliersCards } from "./card-views/suppliers-cards";

export default function ListSuppliers() {
  const dispatch = useAppDispatch();
  const router = useRouter();
  const access = useRecordAccess();
  const toast = useToast();
  const { suppliers, total, listStatus, listError, mutationStatus, mutationError, filterOptions, filterOptionsError } = useAppSelector(selectSupplier);
  const [filters, setFilters] = useState(() => createQuickFilterState(SUPPLIER_FILTER_DEFAULTS));
  const activeFilters = countActiveFilters(filters, SUPPLIER_FILTER_DEFAULTS);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(DEFAULT_PAGE_SIZE);
  const [search, setSearch] = useState("");
  const [sorting, setSorting] = useState<TableSort | null>(null);
  const [view, setView] = useListView();
  const [revision, setRevision] = useState(0);
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [removing, setRemoving] = useState<SupplierSummary | null>(null);
  const loading = listStatus === "idle" || listStatus === "loading";
  const pending = mutationStatus === "loading";
  const pagination = paginationFromApi({ page, page_size: pageSize, total });

  useEffect(() => {
    let current = true;
    const request = dispatch(listSupplier({
      page,
      page_size: pageSize,
      search,
      ...(sorting ? { sort_by: sorting.field, sort_order: sorting.direction } : {}),
      ...(activeFilters ? { filters } : {}),
    }));
    request.then((action) => {
      if (current && listSupplier.fulfilled.match(action)) {
        const valid = paginationFromApi(action.payload).page;
        if (valid !== page) setPage(valid);
      }
    });
    return () => {
      current = false;
      request.abort();
    };
  }, [dispatch, page, pageSize, search, sorting, filters, activeFilters, revision]);

  useEffect(() => {
    const request = dispatch(getSupplierFilterOption());
    return () => request.abort();
  }, [dispatch, revision]);

  useEffect(() => {
    if ([listError, mutationError].some((error) => error?.status === 401)) router.replace("/login");
  }, [listError, mutationError, router]);

  function openEditor(supplier?: SupplierSummary) {
    dispatch(clearSupplierMutation());
    if (supplier) setEditingId(supplier.id);
    else setCreating(true);
  }
  function refresh() {
    setRevision((value) => value + 1);
  }
  async function remove() {
    if (!removing || pending) return;
    try {
      await dispatch(deleteSupplier(removing.id)).unwrap();
      toast.success(`${removing.name} was deleted.`);
      setRemoving(null);
      refresh();
    } catch (error) {
      toast.error(toastErrorMessage(error, "Could not delete the supplier."));
    }
  }

  if (listError?.status === 403) {
    return (
      <section className="rounded-xl border p-6">
        <h1 className="text-xl font-semibold">Access restricted</h1>
        <p className="mt-2 text-muted-foreground">You do not have permission to view suppliers.</p>
      </section>
    );
  }

  const actions = {
    suppliers,
    disabled: pending || loading,
    onEdit: openEditor,
    onDelete: (supplier: SupplierSummary) => {
      dispatch(clearSupplierMutation());
      setRemoving(supplier);
    },
  };

  return (
    <>
      <section className="w-full space-y-6">
        <header className="flex flex-col gap-4 lg:flex-row lg:flex-wrap lg:items-center lg:justify-between">
          <div>
            <p className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">Procurement</p>
            <h1 className="text-3xl font-bold tracking-tight text-primary">Suppliers</h1>
            <p className="mt-2 text-sm text-muted-foreground">Keep the suppliers and contact details your company can use.</p>
          </div>
          {canPerform(access, "suppliers", "add") && (
            <Button className="w-full lg:w-auto" disabled={pending} onClick={() => openEditor()}>
              <Plus className="size-4" aria-hidden="true" /> Add supplier
            </Button>
          )}
        </header>
        <SearchFilterBar
            search={search}
            onSearch={(value) => { setSearch(value); setPage(1); }}
            filters={filters}
            onFiltersChange={(next) => { setFilters(next); setPage(1); }}
            fields={filterOptions.fields}
            statusOptions={filterOptions.statusOptions}
            additionalFilters={filterOptions.additionalFilters}
            filterLabels={{ date: "Creation date", status: "Ownership" }}
            maxConditions={50}
            loading={loading}
            searchLabel="Search suppliers"
            placeholder="Search name or contact"
            maxLength={160}
            quickFilterActive={activeFilters > 0}
            view={view}
            onViewChange={setView}
            viewLabel="Supplier display"
          />
        <div className="overflow-hidden rounded-[6px] border bg-white shadow-sm">
          {listError && (
            <div role="alert" className="flex items-center justify-between gap-3 border-b bg-red-50 px-6 py-4 text-sm text-destructive">
              <span>{listError.message}</span>
              <Button variant="outline" size="sm" onClick={refresh}>Try again</Button>
            </div>
          )}
          {filterOptionsError && (
            <div role="alert" className="flex items-center justify-between gap-2 px-6 py-2 text-xs text-destructive">
              <span>Filter choices could not be loaded.</span>
              <Button variant="ghost" size="sm" onClick={() => dispatch(getSupplierFilterOption())}>Retry</Button>
            </div>
          )}
          <div aria-busy={loading} className={loading && suppliers.length ? "opacity-60" : ""}>
            {view === "table" ? (
              <SuppliersTableView {...actions} loading={loading} sorting={sorting} onSortingChange={(next) => { setSorting(next); setPage(1); }} />
            ) : !suppliers.length && loading ? (
              <div role="status" className="flex items-center justify-center gap-2 py-20 text-sm text-muted-foreground">
                <LoaderCircle className="size-5 animate-spin" aria-hidden="true" />
                Loading suppliers…
              </div>
            ) : suppliers.length ? (
              <SuppliersCards {...actions} />
            ) : !listError ? (
              <div className="px-6 py-16 text-center">
                <Truck className="mx-auto mb-4 size-10 text-primary/40" aria-hidden="true" />
                <h3 className="font-semibold">{search || activeFilters ? "No matching suppliers" : "No suppliers yet"}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{search || activeFilters ? "Try another search or clear your filters." : "Add a supplier or adjust your search."}</p>
              </div>
            ) : null}
          </div>
        </div>
        <Pagination
          metadata={pagination}
          disabled={loading || pending}
          onPrev={() => setPage(pagination.page - 1)}
          onNext={() => setPage(pagination.page + 1)}
          onPage={setPage}
          onLimitChange={(size) => { setPageSize(size); setPage(1); }}
          limitOptions={PAGE_SIZE_OPTIONS}
        />
      </section>
      {creating && (
        <CreateSupplierDialog
          onClose={() => setCreating(false)}
          onSaved={() => {
            setPage(1);
            setCreating(false);
            refresh();
          }}
        />
      )}
      {editingId && (
        <EditSupplierDialog
          supplierId={editingId}
          onClose={() => setEditingId(null)}
          onSaved={() => {
            setEditingId(null);
            refresh();
          }}
        />
      )}
      {removing && (
        <DeleteSupplierDialog
          supplier={removing}
          pending={pending}
          error={mutationError?.message}
          onClose={() => setRemoving(null)}
          onConfirm={() => { void remove(); }}
        />
      )}
    </>
  );
}
