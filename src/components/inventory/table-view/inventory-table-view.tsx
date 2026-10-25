"use client";

import { TableView } from "@/components/common/table/table-view";
import type { InventoryBrand } from "@/types/inventory";
import type { TableSort } from "@/types/table-views";
import { INVENTORY_COLUMNS } from "./inventory-table-columns";
import { InventoryMobile } from "./inventory-mobile";
import { InventoryVariantsTable } from "./inventory-variants-table-view";

export { InventoryVariantsTable } from "./inventory-variants-table-view";

export function InventoryTableView({ brands, loading, sorting, onSortingChange }: { brands: InventoryBrand[]; loading: boolean; sorting?: TableSort | null; onSortingChange?: (sorting: TableSort | null) => void }) {
  return <><div className="sm:hidden"><InventoryMobile brands={brands} loading={loading} /></div><div className="hidden sm:block"><TableView data={brands} columns={INVENTORY_COLUMNS} rowKey={(brand) => brand.id} caption="Inventory by brand" loading={loading}
    sortingMode="server" sorting={sorting} onSortingChange={onSortingChange} defaultSorting={{ field: "brand", direction: "asc" }} expansionMode="multiple" emptyTitle="No inventory found" emptyDescription="Try another search or filter. Stock appears after receiving is posted."
    expandedRow={(brand) => <InventoryVariantsTable brand={brand} />} /></div></>;
}

