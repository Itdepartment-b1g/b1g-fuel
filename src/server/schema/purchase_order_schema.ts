export const PURCHASE_ORDER_SORT_FIELDS = [
  "id",
  "created_at",
  "updated_at",
  "status",
  "estimated_delivery_at",
] as const;

export const PAYMENT_METHODS = [
  "cash",
  "bank_transfer",
  "gcash",
  "check",
] as const;

export type PaymentMethod = (typeof PAYMENT_METHODS)[number];
export type PurchaseOrderStatus = "draft" | "open" | "closed";

export interface PurchaseOrderLineInput {
  variant_id: string;
  product_type_id: string;
  base_unit_id: string;
  ordered_qty: string;
}

export interface PurchaseOrderLineResponse {
  id: string;
  product_id: string;
  variant_id: string;
  product_type_id: string;
  base_unit_id: string;
  unit_id: string;
  ordered_qty: string;
  received_qty: string;
  display_name: string;
  unit: { id: string; name: string; symbol: string; key: string };
  product_type: { id: string; name: string; key: string };
}

export interface ListPurchaseOrderResponse {
  id: string;
  company_id: string;
  company: { id: string; name: string };
  location_id: string;
  location: { id: string; name: string; address: string };
  supplier_id: string;
  supplier: { id: string; name: string };
  status: PurchaseOrderStatus;
  payment_terms: string;
  payment_method: PaymentMethod | null;
  estimated_delivery_on: string | null;
  notes: string;
  line_count: number;
  items: PurchaseOrderLineResponse[];
  created_by: string | null;
  created_by_name: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreatePurchaseOrderInput {
  company_id?: string;
  supplier_id: string;
  payment_terms?: string;
  payment_method?: string | null;
  estimated_delivery_on?: string | null;
  notes?: string;
  lines: PurchaseOrderLineInput[];
}

export interface UpdatePurchaseOrderInput extends CreatePurchaseOrderInput {
  id: string;
}
