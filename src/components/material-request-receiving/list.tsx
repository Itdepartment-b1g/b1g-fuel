"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { PackageCheck } from "lucide-react";
import { Pagination } from "@/components/common/pagination";
import { SearchFilterBar, useListView } from "@/components/common/filter/search-filter-bar";
import { useRecordAccess } from "@/components/providers/access-provider";
import { canPerform } from "@/lib/auth/access-scope";
import { useAppDispatch, useAppSelector } from "@/lib/store/hooks";
import { listMaterialRequestReceipts, selectMaterialRequestReceipts } from "@/lib/store/material-request-receivings-slice";
import type { MaterialRequestReceipt } from "@/types/material-requests";
import type { TableSort } from "@/types/table-views";
import { DEFAULT_PAGE_SIZE, PAGE_SIZE_OPTIONS, paginationFromApi } from "@/utils/pagination";
import { createQuickFilterState } from "@/utils/quick-filter";
import { TimelineMaterialRequestReceivingDialog } from "./dialog/timeline-material-request-receiving-dialog";
import { MaterialRequestReceivingCards } from "./card-views/material-request-receiving-cards";
import { MaterialRequestReceivingTableView } from "./table-view/material-request-receiving-table-view";

const FILTERS = createQuickFilterState({ status: "all" });

export default function MaterialRequestReceivingList() {
  const dispatch = useAppDispatch();
  const router = useRouter();
  const access = useRecordAccess();
  const { receipts, total, loading, error } = useAppSelector(selectMaterialRequestReceipts);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(DEFAULT_PAGE_SIZE);
  const [search, setSearch] = useState("");
  const [sorting, setSorting] = useState<TableSort | null>(null);
  const [view, setView] = useListView();
  const [timeline, setTimeline] = useState<MaterialRequestReceipt | null>(null);
  useEffect(() => {
    let current = true;
    const request = dispatch(listMaterialRequestReceipts({ page, page_size: pageSize, search, ...(sorting ? { sort_by: sorting.field, sort_order: sorting.direction } : {}) }));
    request.then((action) => {
      if (current && listMaterialRequestReceipts.fulfilled.match(action)) {
        const valid = paginationFromApi(action.payload).page;
        if (valid !== page) setPage(valid);
      }
    });
    return () => {
      current = false;
      request.abort();
    };
  }, [dispatch, page, pageSize, search, sorting]);
  useEffect(() => {
    if (error?.status === 401) router.replace("/login");
  }, [error, router]);

  if ((access && !canPerform(access, "materialRequestReceiving", "view")) || error?.status === 403) {
    return <section className="rounded-xl border p-6"><h1 className="text-xl font-semibold">Access restricted</h1><p className="mt-2 text-muted-foreground">You do not have permission to view material request receiving.</p></section>;
  }

  const pagination = paginationFromApi({ page, page_size: pageSize, total });
  return <div className="space-y-6">
    <div>
      <p className="text-sm font-medium text-muted-foreground">Material requests</p>
      <h1 className="mt-1 flex items-center gap-2 text-2xl font-semibold"><PackageCheck className="size-7 text-primary" aria-hidden="true" />Material request receiving</h1>
    </div>
    <SearchFilterBar search={search} onSearch={(value) => { setSearch(value); setPage(1); }} filters={FILTERS} onFiltersChange={() => {}} fields={[]} statusOptions={[{ value: "all", label: "All receipts" }]} loading={loading} placeholder="Search receiving no., request no., hub, or supplier" searchLabel="Search material request receipts" maxLength={160} view={view} onViewChange={setView} viewLabel="Receipt display" />
    {error && <p role="alert" className="text-sm text-destructive">{error.message}</p>}
    <div className="overflow-hidden rounded-[6px] border bg-white shadow-sm">
      {view === "table" ? <MaterialRequestReceivingTableView receipts={receipts} loading={loading} sorting={sorting} onSortingChange={(next) => { setSorting(next); setPage(1); }} onTimeline={setTimeline} /> : <MaterialRequestReceivingCards receipts={receipts} onTimeline={setTimeline} />}
    </div>
    <Pagination metadata={pagination} limitOptions={PAGE_SIZE_OPTIONS} onPrev={() => setPage(pagination.page - 1)} onNext={() => setPage(pagination.page + 1)} onPage={setPage} onLimitChange={(size) => { setPageSize(size); setPage(1); }} />
    {timeline && <TimelineMaterialRequestReceivingDialog receipt={timeline} onClose={() => setTimeline(null)} />}
  </div>;
}
