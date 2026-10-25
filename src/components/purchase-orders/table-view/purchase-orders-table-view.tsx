"use client";

import { useState } from "react";
import { CircleX, Eye, History, PackageCheck, Pencil } from "lucide-react";
import { useRecordAccess } from "@/components/providers/access-provider";
import { Pagination } from "@/components/common/pagination";
import { TableView, type TableAction } from "@/components/common/table/table-view";
import type { RecordAccess } from "@/lib/auth/access-scope";
import { canPerform } from "@/lib/auth/access-scope";
import type { SortValue, TableSort } from "@/types/table-views";
import { PURCHASE_ORDER_STATUS_LABEL, type PaymentMethod, type PurchaseOrderLine, type PurchaseOrderSummary } from "@/types/purchase-orders";
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

const fittedLineColumns = PURCHASE_ORDER_LINE_COLUMNS.map((column, index) => ({
  ...column,
  className: [["w-[18%]", "w-[24%]", "w-[16%]", "w-[14%]", "w-[14%]", "w-[14%]"][index], column.className].filter(Boolean).join(" "),
}));

function PurchaseOrderLines({ items, fit = false }: { items: PurchaseOrderLine[]; fit?: boolean }) {
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
    <section className="min-w-0 overflow-hidden rounded-xl border bg-muted/30">
      <div className="flex items-center justify-between gap-3 px-4 py-3">
        <h3 className="font-semibold">Ordered materials</h3>
        <p className="text-sm text-muted-foreground">{rows.length} {rows.length === 1 ? "line" : "lines"}</p>
      </div>
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
        fit={fit}
        emptyTitle="No lines yet"
        emptyDescription="This purchase order has no products."
        columns={fit ? fittedLineColumns : PURCHASE_ORDER_LINE_COLUMNS}
      />
      {rows.length > 0 && (
        <Pagination
          className="border-t bg-card px-4"
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
    </section>
  );
}

export function PurchaseOrderDetails({ order, fit = false }: { order: PurchaseOrderSummary; fit?: boolean }) {
  const received = fullyReceivedEvent(order);
  return (
    <div className="min-w-0 space-y-4">
      <dl className="grid gap-3 text-sm sm:grid-cols-2">
        <div className="min-w-0"><dt className="text-muted-foreground">PO no.</dt><dd className="break-words">{order.purchase_order_no}</dd></div>
        <div className="min-w-0"><dt className="text-muted-foreground">Supplier / warehouse</dt><dd className="break-words">{order.supplier.name} / {order.location.name}</dd></div>
        <div className="min-w-0"><dt className="text-muted-foreground">Company</dt><dd className="break-words">{order.company.name}</dd></div>
        <div><dt className="text-muted-foreground">Status</dt><dd>{PURCHASE_ORDER_STATUS_LABEL[order.status]}</dd></div>
        <div className="min-w-0"><dt className="text-muted-foreground">Payment terms</dt><dd className="break-words">{order.payment_terms || "—"}</dd></div>
        <div><dt className="text-muted-foreground">Payment method</dt><dd>{order.payment_method ? PAYMENT_LABEL[order.payment_method] : "—"}</dd></div>
        <div><dt className="text-muted-foreground">Needed date</dt><dd>{order.estimated_delivery_on ?? "Not specified"}</dd></div>
        <div><dt className="text-muted-foreground">Created by</dt><dd>{order.created_by_name || "—"}</dd></div>
        <div><dt className="text-muted-foreground">Created at</dt><dd>{when(order.created_at)}</dd></div>
        <div><dt className="text-muted-foreground">Fully received by</dt><dd>{received?.created_by_name || "—"}</dd></div>
        <div><dt className="text-muted-foreground">Fully received at</dt><dd>{when(received?.created_at ?? null)}</dd></div>
        <div className="min-w-0 sm:col-span-2"><dt className="text-muted-foreground">Warehouse address</dt><dd className="break-words">{order.location.address || "—"}</dd></div>
      </dl>
      {order.notes ? <div className="text-sm"><h2 className="font-medium">Notes</h2><p className="whitespace-pre-wrap break-words">{order.notes}</p></div> : null}
      <PurchaseOrderLines items={order.items} fit={fit} />
    </div>
  );
}

export type PurchaseOrderActionProps = {
  onView: (row: PurchaseOrderSummary) => void;
  onEdit: (row: PurchaseOrderSummary) => void;
  onCloseOrder: (row: PurchaseOrderSummary) => void;
  onReceive: (row: PurchaseOrderSummary) => void;
  onTimeline: (row: PurchaseOrderSummary) => void;
  disabled: boolean;
};

export function purchaseOrderActions(row: PurchaseOrderSummary, access: RecordAccess | null, props: PurchaseOrderActionProps): TableAction<PurchaseOrderSummary>[] {
  const openForReceipt = row.status === "awaiting_receipt" || row.status === "partially_received";
  return [
    ...(row.status === "draft" ? [{
      id: "edit",
      label: "Edit",
      inline: true,
      icon: <Pencil className="text-indigo-600" />,
      className: "border-indigo-200 text-indigo-700",
      disabled: !canPerform(access, "purchaseOrders", "edit", row),
      onSelect: props.onEdit,
    }] : []),
    ...(openForReceipt ? [
      {
        id: "receive",
        label: "Receive",
        inline: true,
        icon: <PackageCheck className="text-sky-600" />,
        className: "border-sky-200 text-sky-700",
        disabled: !canPerform(access, "receiving", "add", row),
        onSelect: props.onReceive,
      },
      {
        id: "close",
        label: "Close",
        inline: true,
        icon: <CircleX className="text-rose-600" />,
        className: "border-rose-200 text-rose-700",
        disabled: !canPerform(access, "purchaseOrders", "edit", row),
        onSelect: props.onCloseOrder,
      },
    ] : []),
    { id: "view", label: "View", icon: <Eye className="text-violet-600" />, onSelect: props.onView },
    {
      id: "timeline",
      label: "Timeline",
      icon: <History className="text-amber-600" />,
      disabled: !canPerform(access, "purchaseOrders", "view", row),
      onSelect: props.onTimeline,
    },
  ];
}

export function PurchaseOrdersTableView(props: PurchaseOrderActionProps & {
  purchaseOrders: PurchaseOrderSummary[];
  loading: boolean;
  sorting: TableSort | null;
  onSortingChange: (sorting: TableSort | null) => void;
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
      actionsMenu
      actionsLabel={(row) => `Actions for ${row.purchase_order_no}`}
      emptyTitle="No purchase orders found"
      emptyDescription="Create a draft order for a supplier warehouse delivery."
      columns={PURCHASE_ORDER_TABLE_COLUMNS}
      actions={(row) => purchaseOrderActions(row, access, props)}
    />
  );
}
