import type { TableColumn } from "@/components/common/table/table-view";
import type { MaterialRequestReceipt } from "@/types/material-requests";
import { formatDateTime } from "@/utils/date";

export function materialRequestReceiptSkuCount(row: MaterialRequestReceipt) {
  return String(row.line_count);
}

export function materialRequestReceiptTotalQty(row: MaterialRequestReceipt) {
  const thousandths = Math.round(Number(row.qty) * 1000);
  return (thousandths / 1000).toLocaleString("en-US", { maximumFractionDigits: 3 });
}

export const MATERIAL_REQUEST_RECEIVING_COLUMNS: TableColumn<MaterialRequestReceipt>[] = [
  { id: "receiving_no", header: "Receiving no.", sortField: "receiving_no", sortable: true, freezable: true, value: (row) => row.receiving_no ?? "—", className: "font-semibold" },
  { id: "request_no", header: "Request number", sortField: "request_no", sortable: true, freezable: true, value: (row) => row.request_no ?? "—" },
  { id: "hub", header: "Requesting hub", sortField: "requesting_hub", sortable: true, freezable: true, cell: (row) => <div>{row.requesting_hub_name}<p className="text-xs text-muted-foreground">{row.requesting_company_name}</p></div> },
  { id: "supplier", header: "Supplier", sortField: "supplying_company", sortable: true, freezable: true, value: (row) => row.supplying_company_name },
  { id: "skus", header: "Total SKUs", freezable: true, value: materialRequestReceiptSkuCount },
  { id: "qty", header: "Total Qty", freezable: true, value: materialRequestReceiptTotalQty },
  { id: "posted_by", header: "Received by", freezable: true, value: (row) => row.posted_by_name ?? "—" },
  { id: "posted_at", header: "Received at", sortField: "posted_at", sortable: true, freezable: true, value: (row) => row.posted_at ? formatDateTime(row.posted_at) : "—" },
  { id: "created_at", header: "Created at", sortField: "created_at", sortable: true, freezable: true, value: (row) => formatDateTime(row.created_at) },
];
