"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Download, History } from "lucide-react";
import { useAppDispatch, useAppSelector } from "@/lib/store/hooks";
import { getInventoryHistory, exportInventoryHistory } from "@/lib/store/inventory-slice";
import { useRecordAccess } from "@/components/providers/access-provider";
import { useToast, toastErrorMessage } from "@/components/providers/toast-provider";
import { canPerform } from "@/lib/auth/access-scope";
import { SearchFilterBar } from "@/components/common/filter/search-filter-bar";
import { Pagination } from "@/components/common/pagination";
import { AsyncStatus } from "@/components/common/async-status";
import { Button } from "@/components/ui/button";
import { createQuickFilterState } from "@/utils/quick-filter";
import { DEFAULT_PAGE_SIZE, paginationFromApi } from "@/utils/pagination";
import { INVENTORY_HISTORY_FILTER_OPTIONS } from "@/utils/inventory-filters";
import type { InventoryMovement } from "@/types/inventory";
import type { TableSort } from "@/types/table-views";
import { HistoryTableView } from "./table-view/history-table-view";
import { MovementDetailsDialog } from "./dialog/movement-details-dialog";
import { formatQuantity, MovementQuantity } from "./quantity";

export default function InventoryHistoryList() {
  const { inventoryId } = useParams<{ inventoryId: string }>();
  const dispatch = useAppDispatch();
  const router = useRouter();
  const toast = useToast();
  const access = useRecordAccess();
  const canView = canPerform(access, "inventory", "view");
  const { history, exporting } = useAppSelector((state) => state.inventory);
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState(() => createQuickFilterState({ status: "all", additional: { transaction_type: "all" } }));
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(DEFAULT_PAGE_SIZE);
  const [revision, setRevision] = useState(0);
  const [sorting, setSorting] = useState<TableSort | null>(null);
  const [selected, setSelected] = useState<{ inventoryId: string; movement: InventoryMovement } | null>(null);
  useEffect(() => {
    if (!canView) return;
    let active = true;
    const request = dispatch(getInventoryHistory({ inventory_id: inventoryId, search, filters, page, page_size: pageSize, ...(sorting ? { sort_by: sorting.field, sort_order: sorting.direction } : {}) }));
    request.then((action) => {
      if (active && getInventoryHistory.fulfilled.match(action)) {
        const valid = paginationFromApi(action.payload).page;
        if (valid !== page) setPage(valid);
      }
    });
    return () => { active = false; request.abort(); };
  }, [dispatch, canView, access, inventoryId, search, filters, page, pageSize, sorting, revision]);
  useEffect(() => { if (history.error?.status === 401) router.replace("/login"); }, [router, history.error]);
  if (!canView) return <p className="text-muted-foreground">You do not have permission to view inventory history.</p>;
  const data = history.data?.inventory.id === inventoryId ? history.data : null;
  const record = data?.inventory;
  const unit = record ? `${record.product.base_unit.name} (${record.product.base_unit.symbol})` : "";
  const loading = history.loading || (!data && !history.error);
  const pagination = paginationFromApi(data ?? { page, page_size: pageSize, total: 0 });
  async function exportHistory() {
    try {
      await dispatch(exportInventoryHistory({ inventory_id: inventoryId, search, filters, ...(sorting ? { sort_by: sorting.field, sort_order: sorting.direction } : {}) })).unwrap();
      toast.success("Stock movement export downloaded.");
    } catch (error) {
      toast.error(toastErrorMessage(error, "Stock movement export failed. Please try again."));
      if (error && typeof error === "object" && "status" in error && error.status === 401) router.replace("/login");
    }
  }
  return <div className="space-y-6">
    <Link href="/inventory" className="inline-flex min-h-10 items-center gap-2 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="size-4" aria-hidden="true" />Back to inventory</Link>
    <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start"><div>
      <p className="text-sm text-muted-foreground">{record ? `${record.product.brand.name} · ${record.product.variant.name} · ${record.product.product_type.name}` : "Inventory"}</p>
      <h1 className="mt-1 flex items-center gap-2 text-2xl font-semibold"><History className="size-6 text-primary" aria-hidden="true" />Stock Movement History</h1>
      {record && <p className="mt-2 text-sm text-muted-foreground">{record.facility.name} · {record.company.name} · Unit of Measure: {unit}</p>}
    </div><Button variant="outline" onClick={exportHistory} disabled={loading || exporting || !data} title="Download all matching records as an Excel XML spreadsheet"><Download className="size-4" aria-hidden="true" />{exporting ? "Exporting…" : "Export to Excel"}</Button></header>
    <SearchFilterBar search={search} onSearch={(value) => { setSearch(value); setPage(1); }} filters={filters} onFiltersChange={(value) => { setFilters(value); setPage(1); }}
      fields={INVENTORY_HISTORY_FILTER_OPTIONS.fields} statusOptions={INVENTORY_HISTORY_FILTER_OPTIONS.statusOptions} additionalFilters={INVENTORY_HISTORY_FILTER_OPTIONS.additionalFilters}
      filterLabels={{ date: "Movement date", status: "Movement type" }} placeholder="Search reference number" searchLabel="Search stock movements" maxLength={160} loading={loading} />
    {history.error ? <div className="space-y-3"><AsyncStatus loading={false} error={history.error.message} /><Button variant="outline" onClick={() => setRevision((value) => value + 1)}>Try again</Button></div> : <>
      {data && <section aria-label="Period stock summary" className="space-y-4"><p className="text-xs text-muted-foreground">Period totals include all transactions in the selected dates. Other filters apply to the table and export.</p>
        <dl className="grid grid-cols-2 gap-x-6 gap-y-4 lg:grid-cols-4">{[["Stock In", data.summary.stock_in], ["Stock Out", data.summary.stock_out], ["Net Movement", data.summary.net_movement], ["Current Stock", data.summary.current_stock]].map(([label, value]) => <div key={label}><dt className="text-sm text-muted-foreground">{label}</dt><dd className="mt-1 text-xl font-semibold tabular-nums">{label === "Net Movement" ? <MovementQuantity value={value} unit={unit} /> : `${formatQuantity(value)} ${unit}`}</dd></div>)}</dl>
        <p className="text-sm text-muted-foreground">Beginning balance: {data.summary.beginning_balance === null ? "Unavailable" : `${formatQuantity(data.summary.beginning_balance)} ${unit}`}<span className="mx-3" aria-hidden="true">→</span>Ending balance: {data.summary.ending_balance === null ? "Unavailable" : `${formatQuantity(data.summary.ending_balance)} ${unit}`}</p>
        {(data.summary.beginning_balance === null || data.summary.ending_balance === null || data.movements.some((row) => row.balance_after === null)) && <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-900" role="note">Earlier stock records have incomplete balance history. Historical balances remain unavailable until reconciliation; recorded movements are still shown.</p>}
      </section>}
      <HistoryTableView movements={data?.movements ?? []} loading={loading} unit={unit} onView={(movement) => setSelected({ inventoryId, movement })} sorting={sorting} onSortingChange={(value) => { setSorting(value); setPage(1); }} />
      <Pagination metadata={pagination} onPrev={() => setPage((value) => Math.max(1, value - 1))} onNext={() => setPage((value) => value + 1)} onPage={setPage} onLimitChange={(value) => { setPageSize(value); setPage(1); }} disabled={loading} />
    </>}
    {selected?.inventoryId === inventoryId && record && <MovementDetailsDialog movement={selected.movement} inventory={record} onClose={() => setSelected(null)} />}
  </div>;
}
