import { TableView, type TableColumn } from "@/components/common/table/table-view";
import type { MaterialRequest } from "@/types/material-requests";
import { formatDateTime } from "@/utils/date";
const columns: TableColumn<MaterialRequest>[] = [
  { id: "number", header: "Request number", value: (row) => row.request_no ?? "Draft" },
  { id: "hub", header: "Requesting hub", cell: (row) => <div>{row.requesting_hub.name}<p className="text-xs text-muted-foreground">{row.requesting_company.name}</p></div> },
  { id: "supplier", header: "Supplier", value: (row) => row.supplying_company.name },
  { id: "status", header: "Status", cell: (row) => <span className="capitalize">{row.status}</span> },
  { id: "created", header: "Created at", value: (row) => formatDateTime(row.created_at) },
];
export function MaterialRequestsTableView({ rows, loading, onView }: { rows: MaterialRequest[]; loading: boolean; onView: (row: MaterialRequest) => void }) {
  return <TableView data={rows} columns={columns} rowKey={(row) => row.id} loading={loading} caption="Material requests" sortingMode="server" emptyTitle="No material requests" emptyDescription="Create a draft or change your search." actions={() => [{ id: "view", label: "View request", onSelect: onView }]} />;
}
