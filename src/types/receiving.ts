export type ReceivingStatus = "draft" | "posted";

export interface ReceivingLine {
  id: string;
  purchase_order_item_id: string;
  product_id: string;
  display_name: string;
  unit: { id: string; name: string; symbol: string; key: string };
  ordered_qty: string;
  received_qty: string;
  outstanding_qty: string;
  qty: string;
  content_per_unit: string;
  base_qty: string;
}

export interface ReceivingSummary {
  id: string;
  company_id: string;
  company: { id: string; name: string };
  purchase_order_id: string;
  purchase_order_status: string;
  supplier: { id: string; name: string };
  location_id: string;
  location: { id: string; name: string; address: string };
  status: ReceivingStatus;
  receiving_no: string | null;
  notes: string;
  line_count: number;
  items: ReceivingLine[];
  created_by: string | null;
  created_by_name: string | null;
  posted_by: string | null;
  posted_by_name: string | null;
  posted_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ReceivableOrderItem {
  id: string;
  product_id: string;
  display_name: string;
  unit: { id: string; name: string; symbol: string; key: string };
  ordered_qty: string;
  received_qty: string;
  outstanding_qty: string;
}

export interface ReceivableOrder {
  id: string;
  status: "awaiting_receipt" | "partially_received";
  supplier: { id: string; name: string };
  location: { id: string; name: string; address: string };
  items: ReceivableOrderItem[];
}

export interface ReceivingOptions {
  purchase_orders: ReceivableOrder[];
}

export interface ReceivingLineInput {
  purchase_order_item_id: string;
  qty: string;
}

export interface CreateReceivingInput {
  purchase_order_id: string;
  notes?: string;
  lines: ReceivingLineInput[];
}

export interface UpdateReceivingInput extends CreateReceivingInput {
  id: string;
}

export interface ReceivingsPage {
  receivings: ReceivingSummary[];
  total: number;
  page: number;
  page_size: number;
}

export interface ReceivingResponse {
  receiving: ReceivingSummary;
}

export interface DeleteReceivingResponse {
  id: string;
  message: string;
}
