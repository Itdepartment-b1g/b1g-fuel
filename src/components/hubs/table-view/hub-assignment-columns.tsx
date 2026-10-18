import type { TableColumn } from "@/components/common/table/table-view";
import type { HubAssignmentHistory } from "@/types/hubs";
import { formatDateTime } from "@/utils/date";

export const HUB_ASSIGNMENT_COLUMNS: TableColumn<HubAssignmentHistory>[] = [
  { id: "name", header: "Name", value: (row) => row.name, className: "font-medium" },
  { id: "email", header: "Email", cell: (row) => row.email ?? "—" },
  { id: "assigned_by", header: "Assigned by", cell: (row) => row.assigned_by_name ?? "Unavailable" },
  { id: "assigned_at", header: "Assigned at", cell: (row) => <time dateTime={row.assigned_at}>{formatDateTime(row.assigned_at)}</time> },
  { id: "unassigned_at", header: "Unassigned at", cell: (row) => row.unassigned_at ? <time dateTime={row.unassigned_at}>{formatDateTime(row.unassigned_at)}</time> : "—" },
];
