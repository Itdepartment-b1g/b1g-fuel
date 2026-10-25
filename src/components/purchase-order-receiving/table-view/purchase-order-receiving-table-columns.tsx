import type { TableColumn } from "@/components/common/table/table-view";
import type { ReceivingSummary } from "@/types/receiving";
import { formatDateTime } from "@/utils/date";

const STATUS_LABEL = { draft: "Draft", posted: "Posted" };

export function purchaseOrderReceiptSkuCount(row: ReceivingSummary) {
  return String(row.line_count);
}

export function purchaseOrderReceiptTotalQty(row: ReceivingSummary) {
  const thousandths = row.items.reduce((sum, item) => sum + Math.round(Number(item.qty) * 1000), 0);
  return (thousandths / 1000).toLocaleString("en-US", { maximumFractionDigits: 3 });
}

export const RECEIVING_TABLE_COLUMNS: TableColumn<ReceivingSummary>[] = [
  {
    id: "receiving_no",
    header: "Receiving no.",
    sortable: true,
    freezable: true,
    value: (row) => row.receiving_no ?? "—",
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
    id: "facility",
    header: "Warehouse",
    freezable: true,
    value: (row) => row.facility.name,
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
    value: (row) => STATUS_LABEL[row.status],
  },
  {
    id: "skus",
    header: "Total SKUs",
    freezable: true,
    value: purchaseOrderReceiptSkuCount,
  },
  {
    id: "qty",
    header: "Total Qty",
    freezable: true,
    value: purchaseOrderReceiptTotalQty,
  },
  {
    id: "posted_at",
    header: "Posted",
    sortable: true,
    freezable: true,
    sortField: "posted_at",
    cell: (row) => formatDateTime(row.posted_at),
  },
  {
    id: "created_at",
    header: "Created at",
    sortable: true,
    freezable: true,
    sortField: "created_at",
    value: (row) => formatDateTime(row.created_at),
  },
];
