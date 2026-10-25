"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { TableView, type TableColumn } from "@/components/common/table/table-view";
import { Pagination } from "@/components/common/pagination";
import type { InventoryBrand } from "@/types/inventory";
import type { TableSort } from "@/types/table-views";
import { DEFAULT_PAGE_SIZE, PAGE_SIZE_OPTIONS, paginateItems } from "@/utils/pagination";
import { sortTableRows } from "@/utils/table-views";
import { formatQuantity, MovementQuantity } from "../quantity";

type Variant = InventoryBrand["variants"][number];
const variants: TableColumn<Variant>[] = [
  { id: "variant", header: "Variant", sortable: true, freezable: true, value: (row) => row.product.variant.name, cell: (row) => <div><p className="font-medium">{row.product.variant.name}</p><p className="mt-1 text-xs text-muted-foreground">{row.facility.name} · {row.company.name}</p></div> },
  { id: "type", header: "Product Type", sortable: true, freezable: true, value: (row) => row.product.product_type.name },
  { id: "unit", header: "Unit of Measure", sortable: true, freezable: true, value: (row) => `${row.product.base_unit.name} (${row.product.base_unit.symbol})` },
  { id: "qty", header: "Available Stock", sortable: true, freezable: true, align: "right", className: "text-right tabular-nums", value: (row) => Number(row.qty), compare: (left, right) => left.product.base_unit.id.localeCompare(right.product.base_unit.id) || Number(left.qty) - Number(right.qty), cell: (row) => formatQuantity(row.qty) },
  { id: "movement", header: "Stock Movement", sortable: true, freezable: true, align: "right", className: "text-right", value: (row) => Number(row.net_movement), compare: (left, right) => left.product.base_unit.id.localeCompare(right.product.base_unit.id) || Number(left.net_movement) - Number(right.net_movement), cell: (row) => <MovementQuantity value={row.net_movement} /> },
  { id: "history", header: "History", cell: (row) => <Link className="inline-flex min-h-10 items-center font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-primary" href={`/inventory/${row.id}/history`} aria-label={`View ${row.product.variant.name} ${row.product.product_type.name} history at ${row.facility.name}`}>View</Link> },
];

export function InventoryVariantsTable({ brand }: { brand: InventoryBrand }) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(DEFAULT_PAGE_SIZE);
  const [sorting, setSorting] = useState<TableSort | null>(null);
  const sorted = useMemo(() => {
    const active = sorting ?? { field: "variant", direction: "asc" as const };
    const column = variants.find((column) => column.id === active.field);
    return sortTableRows(brand.variants, active, column?.value ?? (() => null), (row) => row.id, column?.compare);
  }, [brand.variants, sorting]);
  const paginated = paginateItems(sorted, page, pageSize);
  return <div className="min-w-0">
    <h2 className="mb-3 text-sm font-medium">{brand.name} variants</h2>
    <TableView data={paginated.items} columns={variants} rowKey={(row) => row.id} caption={`${brand.name} variants by facility`}
      sortingMode="server" sorting={sorting} onSortingChange={(value) => { setSorting(value); setPage(1); }} defaultSorting={{ field: "variant", direction: "asc" }} />
    {brand.variants.length > 0 && <Pagination metadata={paginated} limitOptions={PAGE_SIZE_OPTIONS}
      onPrev={() => setPage(paginated.page - 1)} onNext={() => setPage(paginated.page + 1)} onPage={setPage}
      onLimitChange={(value) => { setPageSize(value); setPage(1); }} />}
  </div>;
}
