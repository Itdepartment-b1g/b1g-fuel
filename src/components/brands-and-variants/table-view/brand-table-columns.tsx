import type { TableColumn } from "@/components/common/table/table-view";
import type { BrandSummary } from "@/types/brands";
import { formatDate } from "@/utils/date";

export const BRAND_TABLE_COLUMNS: TableColumn<BrandSummary>[] = [
  {
    id: "name",
    header: "Brand",
    sortable: true,
    freezable: true,
    value: (brand) => brand.name,
    className: "font-semibold",
  },
  {
    id: "supplier",
    header: "Supplier",
    freezable: true,
    value: (brand) => brand.supplier?.name ?? "—",
  },
  {
    id: "company",
    header: "Company",
    freezable: true,
    cell: (brand) => brand.company?.name ?? "All companies",
  },
  {
    id: "variants",
    header: "Variants",
    cell: (brand) => brand.variant_count,
  },
  {
    id: "created_by",
    header: "Created by",
    freezable: true,
    cell: (brand) => brand.created_by_name ?? "—",
  },
  {
    id: "created_at",
    header: "Created",
    sortable: true,
    freezable: true,
    cell: (brand) => (
      <time dateTime={brand.created_at}>{formatDate(brand.created_at)}</time>
    ),
  },
];
