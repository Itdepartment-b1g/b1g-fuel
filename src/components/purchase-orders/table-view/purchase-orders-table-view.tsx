"use client";

import { useState } from "react";
import { CircleX, History, PackageCheck, Pencil } from "lucide-react";
import { useRecordAccess } from "@/components/providers/access-provider";
import { Pagination } from "@/components/common/pagination";
import { TableView } from "@/components/common/table-view";
import { canPerform } from "@/lib/auth/access-scope";
import type { SortValue, TableSort } from "@/types/table-views";
import { type PaymentMethod, type PurchaseOrderLine, type PurchaseOrderSummary } from "@/types/purchase-orders";
import { formatDateTime } from "@/utils/date";
import { PAGE_SIZE_OPTIONS, paginationFromApi } from "@/utils/pagination";
import { sortTableRows } from "@/utils/table-views";
import {
  PURCHASE_ORDER_LINE_COLUMNS,
  PURCHASE_ORDER_TABLE_COLUMNS,
  type PurchaseOrderLineRow,
} from "./purchase-order-table-columns";

const PAYMENT_LABEL: Record<PaymentMethod, string> = {
  cash: "Cash",
  bank_transfer: "Bank transfer",
  gcash: "GCash",
  check: "Check",
};

function when(value: string | null) {
  return formatDateTime(value);
}

function fullyReceivedEvent(order: PurchaseOrderSummary) {
  return [...order.events]
    .reverse()
    .find((item) => item.kind === "receipt_posted" && item.status === "received") ?? null;
}

function lineValue(row: PurchaseOrderLineRow, field: string): SortValue {
  if (field === "brand") return row.brand;
  if (field === "variant") return row.variant;
  if (field === "type") return row.type;
  if (field === "ordered") return row.ordered;
  if (field === "received") return row.received;
  if (field === "pending") return row.pending;
  return null;
}

function PurchaseOrderLines({ items }: { items: PurchaseOrderLine[] }) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(PAGE_SIZE_OPTIONS[0]);
  const [sorting, setSorting] = useState<TableSort | null>(null);
  const rows: PurchaseOrderLineRow[] = items.map((line) => {
    const ordered = Number(line.ordered_qty);
    const received = Number(line.received_qty);
    return {
      id: line.id,
      brand: line.brand.name,
      variant: `${line.variant.name} (${line.unit.symbol})`,
      type: line.product_type.name,
      ordered,
      received,
      pending: Number.isFinite(ordered) && Number.isFinite(received) ? Math.max(0, ordered - received) : 0,
    };
  });
  const sorted = sorting
    ? sortTableRows(rows, sorting, (row) => lineValue(row, sorting.field), (row) => row.id)
    : rows;
  const pagination = paginationFromApi({ page, page_size: pageSize, total: sorted.length });
  const start = (pagination.page - 1) * pageSize;
  const visible = sorted.slice(start, start + pageSize);

  return (
    <div className="overflow-hidden rounded-lg border bg-white">
      <TableView
        data={visible}
        rowKey={(row) => row.id}
        caption="Purchase order lines"
        sortingMode="server"
        sorting={sorting}
        onSortingChange={(next) => {
          setSorting(next);
          setPage(1);
        }}
        defaultSorting={{ field: "brand", direction: "asc" }}
        multipleFrozenColumns
        emptyTitle="No lines yet"
        emptyDescription="This purchase order has no products."
        columns={PURCHASE_ORDER_LINE_COLUMNS}
      />
      {rows.length > 0 && (
        <Pagination
          className="border-t px-4"
          metadata={pagination}
          limitOptions={PAGE_SIZE_OPTIONS}
          onPrev={() => setPage(pagination.page - 1)}
          onNext={() => setPage(pagination.page + 1)}
          onPage={setPage}
          onLimitChange={(size) => {
            setPageSize(size);
            setPage(1);
          }}
        />
      )}
    </div>
  );
}

export function PurchaseOrderDetails({ order }: { order: PurchaseOrderSummary }) {
  const received = fullyReceivedEvent(order);
  return (
    <div className="space-y-4">
      <dl className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
        <div className="sm:col-span-2 lg:col-span-4">
          <dt className="text-muted-foreground">PO no.</dt>
          <dd className="mt-1 font-medium">{order.purchase_order_no}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Payment terms</dt>
          <dd className="mt-1 font-medium break-words">{order.payment_terms || "—"}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Payment method</dt>
          <dd className="mt-1 font-medium">{order.payment_method ? PAYMENT_LABEL[order.payment_method] : "—"}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Created by</dt>
          <dd className="mt-1 font-medium">{order.created_by_name || "—"}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Created at</dt>
          <dd className="mt-1 font-medium">{when(order.created_at)}</dd>
        </div>
        <div className="space-y-3">
          <div>
            <dt className="text-muted-foreground">Fully received at</dt>
            <dd className="mt-1 font-medium">{when(received?.created_at ?? null)}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Fully received by</dt>
            <dd className="mt-1 font-medium">{received?.created_by_name || "—"}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Warehouse address</dt>
            <dd className="mt-1 font-medium break-words">{order.location.address || "—"}</dd>
          </div>
        </div>
        <div className="sm:col-span-1 lg:col-span-3">
          <dt className="text-muted-foreground">Notes</dt>
          <dd className="mt-1 font-medium break-words">{order.notes || "—"}</dd>
        </div>
      </dl>
      <PurchaseOrderLines items={order.items} />
    </div>
  );
}

export function PurchaseOrdersTableView(props: {
  purchaseOrders: PurchaseOrderSummary[];
  loading: boolean;
  sorting: TableSort | null;
  onSortingChange: (sorting: TableSort | null) => void;
  onEdit: (row: PurchaseOrderSummary) => void;
  onCloseOrder: (row: PurchaseOrderSummary) => void;
  onReceive: (row: PurchaseOrderSummary) => void;
  onTimeline: (row: PurchaseOrderSummary) => void;
  disabled: boolean;
}) {
  const access = useRecordAccess();
  return (
    <TableView
      data={props.purchaseOrders}
      rowKey={(row) => row.id}
      caption="Purchase orders"
      expandedRow={(row) => <PurchaseOrderDetails order={row} />}
      loading={props.loading}
      sortingMode="server"
      sorting={props.sorting}
      onSortingChange={props.onSortingChange}
      multipleFrozenColumns
      actionsDisabled={props.disabled}
      emptyTitle="No purchase orders found"
      emptyDescription="Create a draft order for a supplier warehouse delivery."
      columns={PURCHASE_ORDER_TABLE_COLUMNS}
      actions={(row) => [
        ...(row.status === "draft"
          ? [{
              id: "edit",
              label: "Edit",
              icon: <Pencil />,
              disabled: !canPerform(access, "purchaseOrders", "edit", row),
              onSelect: props.onEdit,
            }]
          : []),
        ...(row.status === "awaiting_receipt" || row.status === "partially_received"
          ? [{
              id: "close",
              label: "Close",
              icon: <CircleX />,
              disabled: !canPerform(access, "purchaseOrders", "edit", row),
              onSelect: props.onCloseOrder,
            }]
          : []),
        ...(row.status === "awaiting_receipt" || row.status === "partially_received"
          ? [{
              id: "receive",
              label: "Receive",
              icon: <PackageCheck />,
              disabled: !canPerform(access, "receiving", "add", row),
              onSelect: props.onReceive,
            }]
          : []),
        {
          id: "timeline",
          label: "Timeline",
          icon: <History />,
          disabled: !canPerform(access, "purchaseOrders", "view", row),
          onSelect: props.onTimeline,
        },
      ]}
    />
  );
}
