import { ChevronRight } from "lucide-react";
import type { InventoryBrand } from "@/types/inventory";
import { formatQuantity, MovementQuantity } from "../quantity";
import { InventoryVariantsTable } from "./inventory-variants-table-view";

export function InventoryMobile({ brands, loading }: { brands: InventoryBrand[]; loading: boolean }) {
  if (loading) return <p role="status" className="py-6 text-sm text-muted-foreground">Loading inventory…</p>;
  if (!brands.length) return <p className="py-6 text-sm text-muted-foreground">No inventory matches the selected filters.</p>;
  return <div className="divide-y">{brands.map((brand) => <details key={brand.id} className="group">
    <summary className="cursor-pointer list-none py-4 [&::-webkit-details-marker]:hidden">
      <div className="flex items-center gap-2"><ChevronRight className="size-4 shrink-0 transition-transform group-open:rotate-90" aria-hidden="true" /><span className="min-w-0 flex-1 break-words font-medium">{brand.name}</span><span className="shrink-0 text-xs text-muted-foreground">{brand.sku_count} {brand.sku_count === 1 ? "SKU" : "SKUs"}</span></div>
      <div className="mt-3 grid grid-cols-2 gap-3 pl-6 text-sm"><div><p className="mb-1 text-xs text-muted-foreground">Total Stock</p>{brand.totals.map((total, index) => <p key={index} className="tabular-nums">{formatQuantity(total.qty)} {total.unit}</p>)}</div><div className="text-right"><p className="mb-1 text-xs text-muted-foreground">Stock Movement</p>{brand.totals.map((total, index) => <p key={index}><MovementQuantity value={total.net_movement} unit={total.unit} /></p>)}</div></div>
    </summary>
    <div className="min-w-0 bg-blue-50/60 p-4"><InventoryVariantsTable brand={brand} /></div>
  </details>)}</div>;
}
