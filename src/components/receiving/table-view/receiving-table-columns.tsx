import type { TableColumn } from "@/components/common/table/table-view";
import type { ReceivingSummary } from "@/types/receiving";
import { formatDateTime } from "@/utils/date";

const STATUS_LABEL = { draft: "Draft", posted: "Posted" };

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
    id: "location",
    header: "Warehouse",
    value: (row) => row.location.name,
  },
  {
    id: "company",
    header: "Company",
    value: (row) => row.company.name,
  },
  {
    id: "status",
    header: "Status",
    sortable: true,
    value: (row) => STATUS_LABEL[row.status],
  },
  {
    id: "line_count",
    header: "Lines",
    value: (row) => String(row.line_count),
  },
  {
    id: "posted_at",
    header: "Posted",
    sortable: true,
    cell: (row) => formatDateTime(row.posted_at),
  },
];
