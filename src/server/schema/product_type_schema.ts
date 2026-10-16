export const PRODUCT_TYPE_SORT_FIELDS = [
  "id",
  "name",
  "key",
  "created_at",
  "updated_at",
] as const;

export interface ListProductTypeResponse {
  id: string;
  company_id: string | null;
  company: { id: string; name: string } | null;
  created_by: string | null;
  created_by_name: string | null;
  name: string;
  key: string;
  created_at: string;
  updated_at: string;
}

export interface CreateProductTypeInput {
  company_id?: string;
  name: string;
  key: string;
}

export interface UpdateProductTypeInput {
  id: string;
  name?: string;
  key?: string;
}
