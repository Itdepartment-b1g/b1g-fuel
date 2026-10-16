export const PRODUCT_SORT_FIELDS = [
  "id",
  "created_at",
  "updated_at",
] as const;

export interface ListProductResponse {
  id: string;
  company_id: string;
  company: { id: string; name: string };
  variant_id: string;
  variant: { id: string; name: string; brand: { id: string; name: string } };
  base_unit_id: string;
  base_unit: { id: string; name: string; symbol: string; key: string };
  product_type_id: string;
  product_type: { id: string; name: string; key: string };
  /** Composed label: brand variant · type */
  display_name: string;
  note: string;
  created_by: string | null;
  created_by_name: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateProductInput {
  company_id: string;
  variant_id: string;
  base_unit_id: string;
  product_type_id: string;
  note?: string;
}

export interface UpdateProductInput {
  id: string;
  variant_id?: string;
  base_unit_id?: string;
  product_type_id?: string;
  note?: string;
}
