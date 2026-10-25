import type { TableColumn } from "@/components/common/table/table-view";
import type { MaterialRequest } from "@/types/material-requests";
import { formatDateTime } from "@/utils/date";
import { MATERIAL_REQUEST_PROGRESS_BADGE, MATERIAL_REQUEST_PROGRESS_LABEL } from "@/utils/material-request-progress";

export function materialRequestReviewer(row: MaterialRequest) {
  const reviewed = row.status === "submitted" ? null : row.status === "rejected" ? "rejected" : row.status === "approved" || row.status === "partially_dispatched" || row.status === "fully_dispatched" || row.status === "partially_received" || row.status === "received" || row.status === "closed" ? "approved" : undefined;
  return row.status === "submitted" ? "Awaiting review" : reviewed ? row.events.findLast((event) => event.kind === reviewed)?.created_by_name ?? "Unavailable user" : "—";
}

export function materialRequestNextAction(row: MaterialRequest) {
  if (row.status === "draft") return "Awaiting submission";
  if (row.status === "submitted") return "Awaiting approval";
  if (row.status === "rejected" || row.status === "cancelled" || row.status === "closed" || row.status === "received") return "—";
  const awaitingReceipt = (row.items ?? []).some((item) => Number(item.received_qty ?? 0) < Number(item.dispatched_qty ?? 0));
  return awaitingReceipt || row.status === "fully_dispatched" ? "Awaiting receipt" : "Awaiting dispatch";
}

export function materialRequestSkuCount(row: MaterialRequest) {
  return String(row.items?.length ?? 0);
}

export function materialRequestTotalQty(row: MaterialRequest) {
  const thousandths = (row.items ?? []).reduce((sum, item) => sum + Math.round(Number(item.requested_qty) * 1000), 0);
  return (thousandths / 1000).toLocaleString("en-US", { maximumFractionDigits: 3 });
}

export const MATERIAL_REQUEST_TABLE_COLUMNS: TableColumn<MaterialRequest>[] = [
  { id: "number", header: "Request number", sortField: "request_no", sortable: true, freezable: true, value: (row) => row.request_no ?? "Draft" },
  { id: "hub", header: "Requesting hub", sortField: "requesting_hub", sortable: true, freezable: true, cell: (row) => <div>{row.requesting_hub.name}<p className="text-xs text-muted-foreground">{row.requesting_company.name}</p></div> },
  { id: "supplier", header: "Supplier", sortField: "supplying_company", sortable: true, freezable: true, value: (row) => row.supplying_company.name },
  { id: "status", header: "Request Progress", sortField: "status", sortable: true, freezable: true, cell: (row) => <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${MATERIAL_REQUEST_PROGRESS_BADGE[row.status]}`}>{MATERIAL_REQUEST_PROGRESS_LABEL[row.status]}</span> },
  { id: "next_action", header: "Next action", freezable: true, value: materialRequestNextAction },
  { id: "skus", header: "Total SKUs", freezable: true, value: materialRequestSkuCount },
  { id: "qty", header: "Total Qty", freezable: true, value: materialRequestTotalQty },
  { id: "reviewed_by", header: "Reviewed by", freezable: true, value: materialRequestReviewer },
  { id: "created", header: "Created at", sortField: "created_at", sortable: true, freezable: true, value: (row) => formatDateTime(row.created_at) },
];
