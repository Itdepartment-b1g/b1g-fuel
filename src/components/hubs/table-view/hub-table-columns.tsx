import type { TableColumn } from "@/components/common/table/table-view";
import type { HubSummary } from "@/types/hubs";
import { formatDate } from "@/utils/date";
import { HubStatus } from "../hub-details";

export const HUB_TABLE_COLUMNS: TableColumn<HubSummary>[] = [
  { id: "name", header: "Hub", sortable: true, freezable: true, value: (hub) => hub.name, className: "font-semibold" },
  { id: "company", header: "Company", freezable: true, value: (hub) => hub.company.name },
  { id: "address", header: "Address", sortable: true, cell: (hub) => hub.address || "—" },
  { id: "is_active", header: "Status", sortable: true, cell: (hub) => <HubStatus active={hub.is_active} /> },
  { id: "staff_count", header: "Staff", cell: (hub) => hub.staff_count },
  { id: "created_by", header: "Created by", freezable: true, cell: (hub) => hub.created_by_name ?? "—" },
  { id: "created_at", header: "Created", sortable: true, freezable: true, cell: (hub) => <time dateTime={hub.created_at}>{formatDate(hub.created_at)}</time> },
];
