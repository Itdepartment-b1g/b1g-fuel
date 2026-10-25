export const RECEIVING_SORT_FIELDS = ["id", "created_at", "updated_at", "status", "posted_at", "receiving_no"] as const;
export const RECEIVING_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const RECEIVABLE_STATUSES = ["awaiting_receipt", "partially_received"] as const;

export type ReceivingStatus = "draft" | "posted";

export interface ReceivingLineInput {
  purchase_order_item_id: string;
  qty: string;
}

export interface ReceivingLineResponse {
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

export interface ListReceivingResponse {
  id: string;
  company_id: string;
  company: { id: string; name: string };
  purchase_order_id: string;
  purchase_order_status: "awaiting_receipt" | "partially_received" | "received" | "closed" | "draft";
  supplier: { id: string; name: string };
  facility_id: string;
  facility: { id: string; name: string; address: string };
  status: ReceivingStatus;
  receiving_no: string | null;
  notes: string;
  line_count: number;
  items: ReceivingLineResponse[];
  created_by: string | null;
  created_by_name: string | null;
  posted_by: string | null;
  posted_by_name: string | null;
  posted_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateReceivingInput {
  purchase_order_id: string;
  notes?: string;
  lines: ReceivingLineInput[];
}

export interface UpdateReceivingInput extends CreateReceivingInput {
  id: string;
}

export interface ReceivableOrder {
  id: string;
  status: "awaiting_receipt" | "partially_received";
  supplier: { id: string; name: string };
  facility: { id: string; name: string; address: string };
  items: {
    id: string;
    product_id: string;
    display_name: string;
    unit: { id: string; name: string; symbol: string; key: string };
    ordered_qty: string;
    received_qty: string;
    outstanding_qty: string;
  }[];
}
