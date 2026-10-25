export const INVENTORY_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const INVENTORY_SORT_FIELDS = ["id", "company", "facility", "brand", "variant", "product_type", "qty", "updated_at"] as const;
export const STOCK_MOVEMENT_SORT_FIELDS = ["id", "created_at", "qty", "direction", "type"] as const;
export const INVENTORY_BRAND_SORT_FIELDS = ["brand", "skus", "stock", "movement"] as const;
export const INVENTORY_HISTORY_SORT_FIELDS = ["created_at", "qty", "direction", "balance_after"] as const;

export interface InventoryRecord {
  id: string;
  company: { id: string; name: string };
  facility: { id: string; name: string; type: "warehouse" | "hub"; is_active: boolean };
  product: {
    id: string;
    brand: { id: string; name: string };
    variant: { id: string; name: string };
    product_type: { id: string; name: string };
    base_unit: { id: string; name: string; symbol: string };
  };
  qty: string;
  updated_at: string;
}

export interface StockMovementRecord {
  id: string;
  qty: string;
  direction: "in" | "out";
  type: "po_receive_in" | "dispatch_out" | "receive_in";
  source_line_id: string;
  created_by: string;
  created_by_name: string | null;
  created_at: string;
}

export interface InventoryBrand {
  id: string;
  name: string;
  sku_count: number;
  totals: { unit: string; qty: string; net_movement: string }[];
  variants: (InventoryRecord & { net_movement: string })[];
}

export interface InventoryHistoryMovement extends StockMovementRecord {
  balance_before: string | null;
  balance_after: string | null;
  reference_no: string;
  remarks: string;
  source_href: string | null;
}
