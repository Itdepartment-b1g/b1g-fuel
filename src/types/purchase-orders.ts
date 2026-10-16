export type PurchaseOrderStatus = "draft" | "open" | "closed";
export type PaymentMethod = "cash" | "bank_transfer" | "gcash" | "check";

export interface PurchaseOrderLine {
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

export interface PurchaseOrderSummary {
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
  items: PurchaseOrderLine[];
  created_by: string | null;
  created_by_name: string | null;
  created_at: string;
  updated_at: string;
}

export interface PurchaseOrderLineInput {
  variant_id: string;
  product_type_id: string;
  base_unit_id: string;
  ordered_qty: string;
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

export interface PurchaseOrdersPage {
  purchase_orders: PurchaseOrderSummary[];
  total: number;
  page: number;
  page_size: number;
}

export interface PurchaseOrderResponse {
  purchase_order: PurchaseOrderSummary;
}

export interface DeletePurchaseOrderResponse {
  id: string;
  message: string;
}

export interface PurchaseOrderOptions {
  companies: { id: string; name: string }[];
  suppliers: { id: string; name: string; company_id: string | null }[];
  locations: { id: string; name: string; address: string; company_id: string }[];
  variants: {
    id: string;
    name: string;
    company_id: string | null;
    brand: { id: string; name: string };
  }[];
  product_types: {
    id: string;
    name: string;
    key: string;
    company_id: string | null;
  }[];
  units: { id: string; name: string; symbol: string; key: string }[];
}
