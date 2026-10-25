import type { TableColumn } from "@/components/common/table/table-view";
import type { InventoryBrand } from "@/types/inventory";
import { formatQuantity, MovementQuantity } from "../quantity";

export const INVENTORY_COLUMNS: TableColumn<InventoryBrand>[] = [
  { id: "brand", header: "Brand", sortable: true, freezable: true, value: (brand) => brand.name, cell: (brand) => <span className="font-medium">{brand.name}</span> },
  { id: "skus", header: "SKUs", sortable: true, freezable: true, align: "right", className: "text-right tabular-nums", value: (brand) => brand.sku_count },
  { id: "stock", header: "Total Stock", sortable: true, freezable: true, align: "right", className: "text-right", cell: (brand) => <div className="space-y-1 tabular-nums">{brand.totals.map((total, index) => <div key={index}>{formatQuantity(total.qty)}</div>)}</div> },
  { id: "movement", header: "Stock Movement", sortable: true, freezable: true, align: "right", className: "text-right", cell: (brand) => <div className="space-y-1">{brand.totals.map((total, index) => <div key={index}><MovementQuantity value={total.net_movement} /></div>)}</div> },
];
