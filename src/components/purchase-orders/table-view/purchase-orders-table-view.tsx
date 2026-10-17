"use client";

import { useState } from "react";
import { CircleX, History, PackageCheck, Pencil } from "lucide-react";
import { useRecordAccess } from "@/components/providers/access-provider";
import { Pagination } from "@/components/common/pagination";
import { TableView } from "@/components/common/table-view";
import { canPerform } from "@/lib/auth/access-scope";
import type { SortValue, TableSort } from "@/types/table-views";
import { PURCHASE_ORDER_STATUS_LABEL, type PaymentMethod, type PurchaseOrderLine, type PurchaseOrderSummary } from "@/types/purchase-orders";
import { formatDate, formatDateTime } from "@/utils/date";
import { PAGE_SIZE_OPTIONS, paginationFromApi } from "@/utils/pagination";
import { sortTableRows } from "@/utils/table-views";

const PAYMENT_LABEL: Record<PaymentMethod, string> = {
  cash: "Cash",
  bank_transfer: "Bank transfer",
  gcash: "GCash",
  check: "Check",
};

function qty(value: string) {
  const number = Number(value);
  return Number.isFinite(number) ? number.toLocaleString("en-US", { maximumFractionDigits: 3 }) : value;
}

function when(value: string | null) {
  return formatDateTime(value);
}

function fullyReceivedAt(order: PurchaseOrderSummary) {
  const event = [...order.events].reverse().find((item) => item.kind === "receipt_posted" && item.status === "received");
  return event?.created_at ?? null;
}

type LineRow = {
  id: string;
  brand: string;
  variant: string;
  type: string;
  ordered: number;
  received: number;
  pending: number;
};

function lineValue(row: LineRow, field: string): SortValue {
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
  const rows: LineRow[] = items.map((line) => {
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
        columns={[
          { id: "brand", header: "Brand", sortable: true, freezable: true, value: (row) => row.brand, className: "font-semibold" },
          { id: "variant", header: "Variant", sortable: true, freezable: true, value: (row) => row.variant },
          {
            id: "type",
            header: "Type",
            sortable: true,
            freezable: true,
            value: (row) => row.type,
            cell: (row) => <span className="rounded-full bg-sky-100 px-2.5 py-1 text-xs font-medium text-sky-700">{row.type}</span>,
          },
          { id: "ordered", header: "Total Qty", sortable: true, freezable: true, value: (row) => row.ordered, cell: (row) => qty(String(row.ordered)) },
          { id: "received", header: "Received", sortable: true, freezable: true, value: (row) => row.received, cell: (row) => qty(String(row.received)) },
          { id: "pending", header: "Remaining", sortable: true, freezable: true, value: (row) => row.pending, cell: (row) => qty(String(row.pending)), className: "font-semibold" },
        ]}
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

function PurchaseOrderDetails({ order }: { order: PurchaseOrderSummary }) {
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
            <dd className="mt-1 font-medium">{when(fullyReceivedAt(order))}</dd>
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
      columns={[
        {
          id: "purchase_order_no",
          header: "PO no.",
          sortable: true,
          freezable: true,
          value: (row) => row.purchase_order_no,
          className: "font-semibold",
        },
        {
          id: "supplier",
          header: "Supplier",
          freezable: true,
          value: (row) => row.supplier.name,
          className: "font-semibold",
        },
        {
          id: "location",
          header: "Warehouse",
          freezable: true,
          value: (row) => row.location.name,
        },
        {
          id: "company",
          header: "Company",
          freezable: true,
          value: (row) => row.company.name,
        },
        {
          id: "status",
          header: "Status",
          sortable: true,
          freezable: true,
          value: (row) => PURCHASE_ORDER_STATUS_LABEL[row.status],
        },
        {
          id: "line_count",
          header: "Lines",
          value: (row) => String(row.line_count),
        },
        {
          id: "estimated_delivery_at",
          header: "Expected",
          sortable: true,
          cell: (row) => row.estimated_delivery_on ?? "—",
        },
        {
          id: "created_at",
          header: "Created",
          sortable: true,
          cell: (row) => formatDate(row.created_at),
        },
      ]}
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
