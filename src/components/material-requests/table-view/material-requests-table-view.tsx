import { TableView, type TableColumn } from "@/components/common/table/table-view";
import type { MaterialRequest } from "@/types/material-requests";
import { formatDateTime } from "@/utils/date";
import { MaterialRequestDetails } from "./material-request-details";
const columns: TableColumn<MaterialRequest>[] = [
  { id: "number", header: "Request number", value: (row) => row.request_no ?? "Draft" },
  { id: "hub", header: "Requesting hub", cell: (row) => <div>{row.requesting_hub.name}<p className="text-xs text-muted-foreground">{row.requesting_company.name}</p></div> },
  { id: "supplier", header: "Supplier", value: (row) => row.supplying_company.name },
  { id: "status", header: "Status", cell: (row) => <span className="capitalize">{row.status}</span> },
  { id: "reviewed_by", header: "Reviewed by", value: (row) => row.status === "submitted" ? "Awaiting review" : row.status === "approved" || row.status === "rejected" ? row.events.findLast((event) => event.kind === row.status)?.created_by_name ?? "Unavailable user" : "—" },
  { id: "created", header: "Created at", value: (row) => formatDateTime(row.created_at) },
];
export function MaterialRequestsTableView({ rows, loading, onView, onApprove, onReject, onTimeline }: { rows: MaterialRequest[]; loading: boolean; onView: (row: MaterialRequest) => void; onApprove: (row: MaterialRequest) => void; onReject: (row: MaterialRequest) => void; onTimeline: (row: MaterialRequest) => void }) {
  return <TableView data={rows} columns={columns} rowKey={(row) => row.id} loading={loading} caption="Material requests" sortingMode="server" expandedRow={(row) => <MaterialRequestDetails record={row} />} emptyTitle="No material requests" emptyDescription="Create a draft or change your search." actions={(row) => [
    ...(row.permissions?.review ? [{ id: "approve", label: "Approve", onSelect: onApprove }, { id: "reject", label: "Reject", onSelect: onReject }] : []),
    { id: "view", label: row.status === "draft" ? "View draft" : "View", onSelect: onView },
    { id: "timeline", label: "Timeline", onSelect: onTimeline },
  ]} />;
}
