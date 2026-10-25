import type { TableColumn } from "@/components/common/table/table-view";
import {
  PURCHASE_ORDER_STATUS_LABEL,
  type PurchaseOrderSummary,
} from "@/types/purchase-orders";
import { formatDate } from "@/utils/date";

export type PurchaseOrderLineRow = {
  id: string;
  brand: string;
  variant: string;
  type: string;
  ordered: number;
  received: number;
  pending: number;
};

function qty(value: string) {
  const number = Number(value);
  return Number.isFinite(number)
    ? number.toLocaleString("en-US", { maximumFractionDigits: 3 })
    : value;
}

export const PURCHASE_ORDER_TABLE_COLUMNS: TableColumn<PurchaseOrderSummary>[] = [
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
    header: "Needed date",
    sortable: true,
    cell: (row) => row.estimated_delivery_on ?? "—",
  },
  {
    id: "created_at",
    header: "Created",
    sortable: true,
    cell: (row) => formatDate(row.created_at),
  },
];

export const PURCHASE_ORDER_LINE_COLUMNS: TableColumn<PurchaseOrderLineRow>[] = [
  {
    id: "brand",
    header: "Brand",
    sortable: true,
    freezable: true,
    value: (row) => row.brand,
    className: "font-semibold",
  },
  {
    id: "variant",
    header: "Variant",
    sortable: true,
    freezable: true,
    value: (row) => row.variant,
  },
  {
    id: "type",
    header: "Type",
    sortable: true,
    freezable: true,
    value: (row) => row.type,
    cell: (row) => (
      <span className="rounded-full bg-sky-100 px-2.5 py-1 text-xs font-medium text-sky-700">
        {row.type}
      </span>
    ),
  },
  {
    id: "ordered",
    header: "Total Qty",
    sortable: true,
    freezable: true,
    value: (row) => row.ordered,
    cell: (row) => qty(String(row.ordered)),
  },
  {
    id: "received",
    header: "Received",
    sortable: true,
    freezable: true,
    value: (row) => row.received,
    cell: (row) => qty(String(row.received)),
  },
  {
    id: "pending",
    header: "Remaining",
    sortable: true,
    freezable: true,
    value: (row) => row.pending,
    cell: (row) => qty(String(row.pending)),
    className: "font-semibold",
  },
];
