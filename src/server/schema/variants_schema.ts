export const VARIANT_SORT_FIELDS = ["id", "name", "created_at", "updated_at"] as const;

export interface VariantSummary {
  id: string;
  brand_id: string;
  brand: { id: string; name: string };
  company_id: string | null;
  company: { id: string; name: string } | null;
  created_by: string | null;
  created_by_name: string | null;
  name: string;
  created_at: string;
  updated_at: string;
}

export interface CreateVariantInput {
  brand_id: string;
  company_id?: string | null;
  name: string;
}

export interface UpdateVariantInput {
  id: string;
  name?: string;
}
