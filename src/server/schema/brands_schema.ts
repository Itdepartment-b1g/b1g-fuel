export const BRAND_SORT_FIELDS = ["id", "name", "created_at", "updated_at"] as const;

export type {
  BrandSummary,
  CreateBrandInput,
  UpdateBrandInput,
  BrandResponse,
  BrandOptions,
  BrandsPage,
  DeleteBrandResponse,
} from "@/types/brands";
