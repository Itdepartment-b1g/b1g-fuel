export const PURCHASE_ORDER_SORT_FIELDS = [
  "id",
  "created_at",
  "updated_at",
  "status",
  "estimated_delivery_at",
  "purchase_order_no",
] as const;

export const PAYMENT_METHODS = [
  "cash",
  "bank_transfer",
  "gcash",
  "check",
] as const;

export type PaymentMethod = (typeof PAYMENT_METHODS)[number];
export const PURCHASE_ORDER_STATUSES = [
  "draft",
  "awaiting_receipt",
  "partially_received",
  "received",
  "closed",
] as const;

export type PurchaseOrderStatus = (typeof PURCHASE_ORDER_STATUSES)[number];
export type PurchaseOrderEventKind = "created" | "confirmed" | "receipt_posted" | "closed";

export interface PurchaseOrderEventLineResponse {
  purchase_order_item_id: string;
  display_name: string;
  qty: string;
  unit: string;
}

export interface PurchaseOrderEventResponse {
  id: string;
  kind: PurchaseOrderEventKind;
  status: PurchaseOrderStatus;
  note: string;
  receiving_id: string | null;
  receiving_no: string | null;
  created_by: string | null;
  created_by_name: string | null;
  created_at: string;
  lines: PurchaseOrderEventLineResponse[];
}

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
  brand: { name: string };
  variant: { name: string };
  unit: { id: string; name: string; symbol: string; key: string };
  product_type: { id: string; name: string; key: string };
}

export interface ListPurchaseOrderResponse {
  id: string;
  company_id: string;
  company: { id: string; name: string };
  facility_id: string;
  facility: { id: string; name: string; address: string };
  supplier_id: string;
  supplier: { id: string; name: string };
  purchase_order_no: string;
  status: PurchaseOrderStatus;
  payment_terms: string;
  payment_method: PaymentMethod | null;
  estimated_delivery_on: string | null;
  notes: string;
  line_count: number;
  items: PurchaseOrderLineResponse[];
  events: PurchaseOrderEventResponse[];
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
