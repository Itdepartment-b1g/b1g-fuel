"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Boxes } from "lucide-react";
import { useAppDispatch, useAppSelector } from "@/lib/store/hooks";
import { getInventoryFilters, listInventoryBrands } from "@/lib/store/inventory-slice";
import { useRecordAccess } from "@/components/providers/access-provider";
import { canPerform } from "@/lib/auth/access-scope";
import { SearchFilterBar } from "@/components/common/filter/search-filter-bar";
import { Pagination } from "@/components/common/pagination";
import { AsyncStatus } from "@/components/common/async-status";
import { Button } from "@/components/ui/button";
import { createQuickFilterState } from "@/utils/quick-filter";
import { DEFAULT_PAGE_SIZE, paginationFromApi } from "@/utils/pagination";
import { INVENTORY_FILTER_OPTIONS } from "@/utils/inventory-filters";
import { InventoryTableView } from "./table-view/inventory-table-view";
import type { TableSort } from "@/types/table-views";

export default function InventoryList() {
  const dispatch = useAppDispatch();
  const router = useRouter();
  const access = useRecordAccess();
  const canView = canPerform(access, "inventory", "view");
  const state = useAppSelector((state) => state.inventory);
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState(() => createQuickFilterState({ status: "all", additional: { facility_type: "all" } }));
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(DEFAULT_PAGE_SIZE);
  const [revision, setRevision] = useState(0);
  const [sorting, setSorting] = useState<TableSort | null>(null);
  useEffect(() => {
    if (!canView) return;
    let active = true;
    const request = dispatch(listInventoryBrands({ search, filters, page, page_size: pageSize, ...(sorting ? { sort_by: sorting.field, sort_order: sorting.direction } : {}) }));
    request.then((action) => {
      if (active && listInventoryBrands.fulfilled.match(action)) {
        const valid = paginationFromApi(action.payload).page;
        if (valid !== page) setPage(valid);
      }
    });
    return () => { active = false; request.abort(); };
  }, [dispatch, canView, access, search, filters, page, pageSize, sorting, revision]);
  useEffect(() => {
    if (!canView) return;
    const request = dispatch(getInventoryFilters());
    return () => request.abort();
  }, [dispatch, canView, access, revision]);
  useEffect(() => {
    if (state.brands.error?.status === 401 || state.filters.error?.status === 401) router.replace("/login");
  }, [router, state.brands.error, state.filters.error]);
  if (!canView) return <p className="text-muted-foreground">You do not have permission to view inventory.</p>;
  const choices = state.filters.data ?? INVENTORY_FILTER_OPTIONS;
  const data = state.brands.data;
  const loading = state.brands.loading || (!data && !state.brands.error);
  const pagination = paginationFromApi(data ?? { page, page_size: pageSize, total: 0 });
  return <div className="space-y-6">
    <header><p className="text-sm text-muted-foreground">Inventory</p><h1 className="mt-1 flex items-center gap-2 text-2xl font-semibold"><Boxes className="size-7 text-primary" aria-hidden="true" />Stock overview</h1><p className="mt-2 text-sm text-muted-foreground">Current stock by brand. Expand a brand to see variants and their facilities.</p></header>
    <SearchFilterBar search={search} onSearch={(value) => { setSearch(value); setPage(1); }} filters={filters} onFiltersChange={(value) => { setFilters(value); setPage(1); }}
      fields={choices.fields} statusOptions={choices.statusOptions} additionalFilters={choices.additionalFilters} loading={loading} maxLength={160}
      placeholder="Search brand or variant" searchLabel="Search inventory" filterLabels={{ date: "Movement date", status: "Stock status" }} />
    <p className="text-xs text-muted-foreground">Stock movement uses the selected dates. Available stock is current; different units are shown separately.</p>
    {state.filters.error && <p role="alert" className="text-sm text-destructive">{state.filters.error.message} <button className="underline" onClick={() => setRevision((value) => value + 1)}>Retry filters</button></p>}
    {state.brands.error ? <div className="space-y-3"><AsyncStatus loading={false} error={state.brands.error.message} /><Button variant="outline" onClick={() => setRevision((value) => value + 1)}>Try again</Button></div>
      : <InventoryTableView brands={data?.brands ?? []} loading={loading} sorting={sorting} onSortingChange={(value) => { setSorting(value); setPage(1); }} />}
    <Pagination metadata={pagination} onPrev={() => setPage((value) => Math.max(1, value - 1))} onNext={() => setPage((value) => value + 1)} onPage={setPage} onLimitChange={(value) => { setPageSize(value); setPage(1); }} disabled={loading} />
  </div>;
}
