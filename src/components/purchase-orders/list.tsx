"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ClipboardList, Plus } from "lucide-react";
import { useRecordAccess } from "@/components/providers/access-provider";
import { useToast, toastErrorMessage } from "@/components/providers/toast-provider";
import { Button } from "@/components/ui/button";
import { Pagination } from "@/components/common/pagination";
import { SearchFilterBar, useListView } from "@/components/common/filter/search-filter-bar";
import { canPerform } from "@/lib/auth/access-scope";
import { countActiveFilters, createQuickFilterState } from "@/utils/quick-filter";
import { PURCHASE_ORDER_FILTER_DEFAULTS } from "@/utils/management-filters";
import { DEFAULT_PAGE_SIZE, PAGE_SIZE_OPTIONS, paginationFromApi } from "@/utils/pagination";
import type { TableSort } from "@/types/table-views";
import { useAppDispatch, useAppSelector } from "@/lib/store/hooks";
import {
  clearPurchaseOrderMutation,
  closePurchaseOrder,
  getPurchaseOrderFilterOption,
  listPurchaseOrder,
  selectPurchaseOrder,
} from "@/lib/store/purchase-orders-slice";
import type { PurchaseOrderSummary } from "@/types/purchase-orders";
import { CreatePurchaseOrderDialog } from "./dialog/create-purchase-order-dialog";
import { EditPurchaseOrderDialog } from "./dialog/edit-purchase-order-dialog";
import { ReceivePurchaseOrderDialog } from "./dialog/receive-purchase-order-dialog";
import { TimelinePurchaseOrderDialog } from "./dialog/timeline-purchase-order-dialog";
import { ViewPurchaseOrderDialog } from "./dialog/view-purchase-order-dialog";
import { PurchaseOrderCards } from "./card-views/purchase-order-cards";
import { PurchaseOrdersTableView } from "./table-view/purchase-orders-table-view";

export default function ListPurchaseOrders({ initialSearch = "" }: { initialSearch?: string } = {}) {
  const dispatch = useAppDispatch();
  const router = useRouter();
  const access = useRecordAccess();
  const toast = useToast();
  const {
    purchase_orders,
    total,
    listStatus,
    listError,
    mutationStatus,
    mutationError,
    filterOptions,
    filterOptionsError,
  } = useAppSelector(selectPurchaseOrder);
  const [filters, setFilters] = useState(() =>
    createQuickFilterState(PURCHASE_ORDER_FILTER_DEFAULTS),
  );
  const activeFilters = countActiveFilters(filters, PURCHASE_ORDER_FILTER_DEFAULTS);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(DEFAULT_PAGE_SIZE);
  const [search, setSearch] = useState(initialSearch);
  const [sorting, setSorting] = useState<TableSort | null>(null);
  const [view, setView] = useListView();
  const [revision, setRevision] = useState(0);
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [receiving, setReceiving] = useState<PurchaseOrderSummary | null>(null);
  const [viewing, setViewing] = useState<PurchaseOrderSummary | null>(null);
  const [timelineId, setTimelineId] = useState<string | null>(null);
  const loading = listStatus === "idle" || listStatus === "loading";
  const pending = mutationStatus === "loading";
  const pagination = paginationFromApi({ page, page_size: pageSize, total });

  useEffect(() => {
    let current = true;
    const request = dispatch(
      listPurchaseOrder({
        page,
        page_size: pageSize,
        search,
        ...(sorting ? { sort_by: sorting.field, sort_order: sorting.direction } : {}),
        ...(activeFilters ? { filters } : {}),
      }),
    );
    request.then((action) => {
      if (current && listPurchaseOrder.fulfilled.match(action)) {
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
    const request = dispatch(getPurchaseOrderFilterOption());
    return () => request.abort();
  }, [dispatch, revision]);

  useEffect(() => {
    if ([listError, mutationError].some((error) => error?.status === 401))
      router.replace("/login");
  }, [listError, mutationError, router]);

  function closeOrder(row: PurchaseOrderSummary) {
    if (pending) return;
    void dispatch(closePurchaseOrder(row.id))
      .unwrap()
      .then(() => {
        toast.success("Purchase order was closed.");
        setViewing(null);
        setRevision((value) => value + 1);
      })
      .catch((error) => {
        toast.error(toastErrorMessage(error, "Could not close the purchase order."));
      });
  }

  if (listError?.status === 403) {
    return (
      <section className="rounded-xl border p-6">
        <h1 className="text-xl font-semibold">Access restricted</h1>
        <p className="mt-2 text-muted-foreground">
          You do not have permission to view purchase orders.
        </p>
      </section>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:flex-wrap lg:items-start lg:justify-between">
        <div>
          <p className="text-sm font-medium text-muted-foreground">Procurement</p>
          <h1 className="mt-1 flex items-center gap-2 text-2xl font-semibold">
            <ClipboardList className="size-7 text-primary" aria-hidden="true" />
            Purchase orders
          </h1>
        </div>
        {canPerform(access, "purchaseOrders", "add") && (
          <Button
            className="w-full lg:w-auto"
            onClick={() => {
              dispatch(clearPurchaseOrderMutation());
              setCreating(true);
            }}
          >
            <Plus className="size-4" aria-hidden="true" />
            Add purchase order
          </Button>
        )}
      </div>
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
        filterLabels={{ date: "Creation date", status: "Status" }}
        loading={loading}
        placeholder="Search PO no., supplier, warehouse, or notes"
        searchLabel="Search purchase orders"
        maxLength={160}
        quickFilterActive={Boolean(activeFilters)}
        view={view}
        onViewChange={setView}
        viewLabel="Purchase order display"
      />
      {filterOptionsError && (
        <p role="alert" className="text-sm text-destructive">
          Filter choices could not be loaded.
        </p>
      )}
      <div className="overflow-hidden rounded-[6px] border bg-white shadow-sm">
        {view === "table" ? (
          <PurchaseOrdersTableView
            purchaseOrders={purchase_orders}
            loading={loading}
            sorting={sorting}
            onSortingChange={(next) => {
              setSorting(next);
              setPage(1);
            }}
            onView={setViewing}
            onEdit={(row) => {
              dispatch(clearPurchaseOrderMutation());
              setEditingId(row.id);
            }}
            onCloseOrder={closeOrder}
            onReceive={setReceiving}
            onTimeline={(row) => setTimelineId(row.id)}
            disabled={pending}
          />
        ) : (
          <PurchaseOrderCards
            purchaseOrders={purchase_orders}
            loading={loading}
            disabled={pending}
            onView={setViewing}
            onEdit={(row) => {
              dispatch(clearPurchaseOrderMutation());
              setEditingId(row.id);
            }}
            onCloseOrder={closeOrder}
            onReceive={setReceiving}
            onTimeline={(row) => setTimelineId(row.id)}
          />
        )}
      </div>
      <Pagination
        metadata={pagination}
        disabled={loading || pending}
        onPrev={() => setPage(pagination.page - 1)}
        onNext={() => setPage(pagination.page + 1)}
        onPage={setPage}
        onLimitChange={(size) => {
          setPageSize(size);
          setPage(1);
        }}
        limitOptions={PAGE_SIZE_OPTIONS}
      />
      {viewing && (
        <ViewPurchaseOrderDialog
          order={viewing}
          disabled={pending}
          onClose={() => setViewing(null)}
          onEdit={() => {
            dispatch(clearPurchaseOrderMutation());
            setEditingId(viewing.id);
            setViewing(null);
          }}
          onReceive={() => {
            setReceiving(viewing);
            setViewing(null);
          }}
          onCloseOrder={() => closeOrder(viewing)}
        />
      )}
      {receiving && (
        <ReceivePurchaseOrderDialog
          order={receiving}
          onClose={() => setReceiving(null)}
          onSaved={() => {
            setReceiving(null);
            setRevision((value) => value + 1);
          }}
        />
      )}
      {timelineId && (
        <TimelinePurchaseOrderDialog purchaseOrderId={timelineId} onClose={() => setTimelineId(null)} />
      )}
      {creating && (
        <CreatePurchaseOrderDialog
          onClose={() => setCreating(false)}
          onSaved={() => {
            setPage(1);
            setCreating(false);
            setRevision((value) => value + 1);
          }}
        />
      )}
      {editingId && (
        <EditPurchaseOrderDialog
          purchaseOrderId={editingId}
          onClose={() => setEditingId(null)}
          onSaved={() => {
            setEditingId(null);
            setRevision((value) => value + 1);
          }}
        />
      )}
    </div>
  );
}
