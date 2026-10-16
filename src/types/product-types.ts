import type { CompanyOption } from "./companies";

export interface ProductTypeSummary {
  id: string;
  company_id: string | null;
  company: CompanyOption | null;
  created_by: string | null;
  created_by_name: string | null;
  name: string;
  key: string;
  created_at: string;
  updated_at: string;
}

export interface ProductTypesPage {
  product_types: ProductTypeSummary[];
  total: number;
  page: number;
  page_size: number;
}

export interface ProductTypeResponse {
  product_type: ProductTypeSummary;
}

export interface ProductTypeOptions {
  companies: CompanyOption[];
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

export interface DeleteProductTypeResponse {
  id: string;
  message: string;
}
