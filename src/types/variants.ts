import type { CompanyOption } from "./companies";

export interface VariantBrand {
  // Unique identifier (UUID) of the parent brand.
  id: string;
  // Display name of the parent brand.
  name: string;
}

export interface Variant {
  // Unique identifier (UUID) of the variant.
  id: string;
  // UUID of the brand this variant belongs to.
  brand_id: string;
  // Display information for the parent brand.
  brand: VariantBrand;
  // UUID of the owning company. Null when a super admin shared the variant.
  company_id: string | null;
  // Display information for the owning company. Null for a shared variant.
  company: CompanyOption | null;
  // UUID of the user who created the variant, when recorded.
  created_by: string | null;
  // Display name of the user who created the variant, when available.
  created_by_name: string | null;
  // Display name of the variant.
  name: string;
  // ISO date string when the variant was created.
  created_at: string;
  // ISO date string when the variant was last updated.
  updated_at: string;
}

export type VariantSummary = Variant;

export interface CreateVariantInput {
  // UUID of the brand under which to create the variant.
  brand_id: string;
  // UUID of the company that will own the variant. Omitted for a shared super-admin variant.
  company_id?: string | null;
  // Display name of the new variant.
  name: string;
}

export interface UpdateVariantInput {
  // UUID of the variant to update.
  id: string;
  // Updated display name, when supplied.
  name?: string;
}

export interface VariantResponse {
  // Variant returned by a detail, create, or update request.
  variant: VariantSummary;
}

export interface VariantOptions {
  // Brands under which the user can create variants.
  brands: Array<VariantBrand & { company_id: string | null; company: CompanyOption | null }>;
  // Companies in which the user can create variants.
  companies: CompanyOption[];
}

export interface VariantsPage {
  // Variants returned for the requested page.
  variants: VariantSummary[];
  // Total number of variants matching the query.
  total: number;
  // Current page number, starting at 1.
  page: number;
  // Maximum number of variants per page.
  page_size: number;
}

export interface DeleteVariantResponse {
  // UUID of the deleted variant.
  id: string;
  // Result message returned by the API.
  message: string;
}
