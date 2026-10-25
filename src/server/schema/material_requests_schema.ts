export const MR_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const MR_SORT_FIELDS = ["request_no", "requesting_hub", "supplying_company", "status", "created_at"] as const;
export type RequestAction = "submit" | "approve" | "reject" | "cancel";
export type RequestInput = {
  requesting_hub_id: string;
  supplying_company_id: string;
  notes?: string;
  needed_at?: string | null;
  items: { product_id: string; requested_qty: string }[];
};
export type ActionInput = { id: string; action: RequestAction; note?: string; supplying_warehouse_id?: string };
export type ReceiveInput = { id: string; notes?: string; lines: { material_request_item_id: string; qty: string }[] };
export type DispatchInput = ReceiveInput;
export type CreateRequestInput = RequestInput & { submit?: boolean };
