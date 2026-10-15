export const BRAND_SORT_FIELDS = [
  "id",
  "name",
  "created_at",
  "updated_at",
] as const;

export interface BrandSummary {
  id: string;
  company_id: string | null;
  company: { id: string; name: string } | null;
  created_by: string | null;
  created_by_name: string | null;
  name: string;
  variant_count: number;
  created_at: string;
  updated_at: string;
}

export interface CreateBrandInput {
  company_id?: string | null;
  name: string;
}

export interface UpdateBrandInput {
  id: string;
  name?: string;
}
