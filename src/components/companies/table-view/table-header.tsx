import type { TableColumn } from "@/components/common/table-view";
import type { CompanySummary } from "@/types/companies";
import { formatDate } from "@/utils/date";

export const TOGGLE_COLUMNS = [
  { id: "member_count", label: "Members" },
  { id: "is_warehouse", label: "Warehouse" },
  { id: "warehouse_name", label: "Warehouse name" },
  { id: "warehouse_address", label: "Warehouse address" },
] as const;

export type ToggleColumnId = (typeof TOGGLE_COLUMNS)[number]["id"];

function countLabel(count: number, singular: string, plural: string) {
  if (count <= 0) return "—";
  return `${count} ${count === 1 ? singular : plural}`;
}

export const COMPANY_COLUMNS: TableColumn<CompanySummary>[] = [
  {
    id: "name",
    header: "Company",
    className: "font-semibold",
    sortable: true,
    freezable: true,
    value: (company) => company.name,
    cell: (company) => company.name,
  },
  {
    id: "member_count",
    header: "Members",
    freezable: true,
    value: (company) => company.member_count,
    cell: (company) => countLabel(company.member_count, "member", "members"),
  },
  {
    id: "is_warehouse",
    header: "Warehouse",
    freezable: true,
    value: (company) => (company.is_warehouse ? "Yes" : "No"),
    cell: (company) => (company.is_warehouse ? "Yes" : "No"),
  },
  {
    id: "warehouse_name",
    header: "Warehouse name",
    freezable: true,
    value: (company) => company.warehouse_name ?? "",
    cell: (company) => company.warehouse_name || "—",
  },
  {
    id: "warehouse_address",
    header: "Warehouse address",
    freezable: true,
    value: (company) => company.warehouse_address ?? "",
    cell: (company) => company.warehouse_address || "—",
  },
  {
    id: "created_at",
    header: "Created",
    sortable: true,
    freezable: true,
    cell: (company) => formatDate(company.created_at),
  },
];
