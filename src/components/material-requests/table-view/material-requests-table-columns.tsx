import type { TableColumn } from "@/components/common/table/table-view";
import type { MaterialRequest } from "@/types/material-requests";
import { formatDateTime } from "@/utils/date";

export function materialRequestReviewer(row: MaterialRequest) {
  return row.status === "submitted" ? "Awaiting review" : row.status === "approved" || row.status === "rejected" ? row.events.findLast((event) => event.kind === row.status)?.created_by_name ?? "Unavailable user" : "—";
}

export const MATERIAL_REQUEST_TABLE_COLUMNS: TableColumn<MaterialRequest>[] = [
  { id: "number", header: "Request number", sortField: "request_no", sortable: true, freezable: true, value: (row) => row.request_no ?? "Draft" },
  { id: "hub", header: "Requesting hub", sortField: "requesting_hub", sortable: true, freezable: true, cell: (row) => <div>{row.requesting_hub.name}<p className="text-xs text-muted-foreground">{row.requesting_company.name}</p></div> },
  { id: "supplier", header: "Supplier", sortField: "supplying_company", sortable: true, freezable: true, value: (row) => row.supplying_company.name },
  { id: "status", header: "Status", sortable: true, freezable: true, cell: (row) => <span className="capitalize">{row.status}</span> },
  { id: "reviewed_by", header: "Reviewed by", freezable: true, value: materialRequestReviewer },
  { id: "created", header: "Created at", sortField: "created_at", sortable: true, freezable: true, value: (row) => formatDateTime(row.created_at) },
];
