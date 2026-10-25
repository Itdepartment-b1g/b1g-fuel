import type { CompanyOption } from "./companies";

export interface Brand {
  // Unique identifier (UUID) of the brand.
  id: string;
  // UUID of the owning company. Null when a super admin shared the brand with every company.
  company_id: string | null;
  // Display information for the owning company. Null for a shared brand.
  company: CompanyOption | null;
  // UUID of the user who created the brand, when recorded.
  created_by: string | null;
  // Display name of the user who created the brand, when available.
  created_by_name: string | null;
  // Display name of the brand.
  name: string;
  // UUID of the supplier that sells this brand. Null until a supplier is assigned.
  supplier_id: string | null;
  // Supplier that sells this brand.
  supplier: { id: string; name: string } | null;
  // Number of variants that belong to this brand.
  variant_count: number;
  // ISO date string when the brand was created.
  created_at: string;
  // ISO date string when the brand was last updated.
  updated_at: string;
}

export type BrandSummary = Brand;

export interface CreateBrandInput {
  // UUID of the company that will own the brand. Omitted for a shared super-admin brand.
  company_id?: string | null;
  // UUID of the supplier that sells this brand.
  supplier_id: string;
  // Display name of the new brand.
  name: string;
}

export interface UpdateBrandInput {
  // UUID of the brand to update.
  id: string;
  // Updated display name, when supplied.
  name?: string;
  // UUID of the supplier that sells this brand.
  supplier_id?: string;
}

export interface BrandResponse {
  // Brand returned by a detail, create, or update request.
  brand: BrandSummary;
}

export interface BrandOptions {
  // Companies in which the user can create brands.
  companies: CompanyOption[];
  // Suppliers that can own a brand in those companies.
  suppliers: { id: string; name: string; company_id: string | null }[];
}

export interface BrandsPage {
  // Brands returned for the requested page.
  brands: BrandSummary[];
  // Total number of brands matching the query.
  total: number;
  // Current page number, starting at 1.
  page: number;
  // Maximum number of brands per page.
  page_size: number;
}

export interface DeleteBrandResponse {
  // UUID of the deleted brand.
  id: string;
  // Result message returned by the API.
  message: string;
}
