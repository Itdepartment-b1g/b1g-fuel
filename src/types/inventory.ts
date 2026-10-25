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

export interface InventoryBrand {
  id: string;
  name: string;
  sku_count: number;
  totals: { unit: string; qty: string; net_movement: string }[];
  variants: (InventoryRecord & { net_movement: string })[];
}

export interface InventoryMovement {
  id: string;
  qty: string;
  direction: "in" | "out";
  type: "po_receive_in" | "dispatch_out" | "receive_in";
  source_line_id: string;
  balance_before: string | null;
  balance_after: string | null;
  reference_no: string;
  remarks: string;
  source_href: string | null;
  created_by: string;
  created_by_name: string | null;
  created_at: string;
}

export interface InventoryBrandsPage {
  brands: InventoryBrand[];
  total: number;
  page: number;
  page_size: number;
}

export interface InventoryHistoryPage {
  inventory: InventoryRecord;
  movements: InventoryMovement[];
  summary: { stock_in: string; stock_out: string; net_movement: string; current_stock: string; beginning_balance: string | null; ending_balance: string | null };
  total: number;
  page: number;
  page_size: number;
}
