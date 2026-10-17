import type { TableColumn } from "@/components/common/table-view";
import type { ProductTypeSummary } from "@/types/product-types";
import { formatDate } from "@/utils/date";

export const PRODUCT_TYPE_TABLE_COLUMNS: TableColumn<ProductTypeSummary>[] = [
  {
    id: "name",
    header: "Name",
    sortable: true,
    freezable: true,
    value: (row) => row.name,
    className: "font-semibold",
  },
  {
    id: "key",
    header: "Key",
    sortable: true,
    freezable: true,
    value: (row) => row.key,
  },
  {
    id: "company",
    header: "Company",
    freezable: true,
    cell: (row) => row.company?.name ?? "All companies",
  },
  {
    id: "created_at",
    header: "Created",
    sortable: true,
    freezable: true,
    cell: (row) => formatDate(row.created_at),
  },
];
