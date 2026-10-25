export type MaterialRequestStatus = "draft" | "submitted" | "approved" | "rejected" | "cancelled";
export type RequestItem = { id: string; product_id: string; unit_id: string; product_label: string; unit_label: string; requested_qty: string; approved_qty: string | null };
export type RequestEvent = { id: string; kind: string; from_status: MaterialRequestStatus | null; to_status: MaterialRequestStatus; note: string; created_by: string; created_by_name: string | null; created_at: string };
export type MaterialRequest = {
  permissions?: { edit: boolean; submit: boolean; cancel: boolean; review: boolean };
  id: string; request_no: string | null; requesting_company_id: string; supplying_company_id: string;
  requesting_hub_id: string; supplying_warehouse_id: string | null; status: MaterialRequestStatus;
  requesting_company: { id: string; name: string }; supplying_company: { id: string; name: string };
  requesting_hub: { id: string; name: string }; supplying_warehouse: { id: string; name: string } | null;
  notes: string; needed_at: string | null; created_by: string; created_by_name: string | null;
  created_at: string; updated_at: string; submitted_at: string | null; items: RequestItem[]; events: RequestEvent[];
};
export type MaterialRequestInput = { requesting_hub_id: string; supplying_company_id: string; notes?: string; needed_at?: string | null; items: { product_id: string; requested_qty: string }[] };
export type MaterialRequestAction = { id: string; action: "submit" | "approve" | "reject" | "cancel"; note?: string; supplying_warehouse_id?: string };
export type CreateMaterialRequestInput = MaterialRequestInput & { submit?: boolean };
export type RequestOptions = { hubs: { id: string; name: string; company_id: string; company: { name: string } }[]; suppliers: { id: string; name: string }[]; warehouses: { id: string; name: string }[] };
export type CatalogProduct = { id: string; label: string; unit_id: string; unit_label: string };
export type RequestCatalog = { products: CatalogProduct[]; total: number; page: number; page_size: number };
export type MaterialRequestsPage = { requests: MaterialRequest[]; total: number; page: number; page_size: number };
