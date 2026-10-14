// Planned client model for the brand catalog; brand API endpoints are not implemented yet.
export interface Brand {
  // Unique identifier (UUID) of the brand.
  id: string;
  // UUID of the company that owns the brand.
  company_id: string;
  // Display name of the brand.
  name: string;
  // UUID of the user who created the brand, when recorded.
  created_by: string | null;
  // Whether the brand is available for new variants.
  is_active: boolean;
  // ISO date string when the brand was created.
  created_at: string;
  // ISO date string when the brand was last updated.
  updated_at: string;
}

export interface CreateBrandInput {
  // UUID of the company that will own the brand.
  company_id: string;
  // Display name of the new brand.
  name: string;
}

export interface UpdateBrandInput {
  // UUID of the brand to update.
  id: string;
  // Updated display name, when supplied.
  name?: string;
  // Updated active/archived status.
  is_active?: boolean;
}

export interface BrandResponse {
  // Brand returned by a detail or mutation request.
  brand: Brand;
}

export interface BrandsPage {
  // Brands returned for the requested page.
  brands: Brand[];
  // Total number of brands matching the query.
  total: number;
  // Current page number, starting at 1.
  page: number;
  // Maximum number of brands per page.
  page_size: number;
}
