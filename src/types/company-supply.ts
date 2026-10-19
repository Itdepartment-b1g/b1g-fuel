import type { ApiPaginationMetadata } from "./pagination";
import type { CompanyOption } from "./companies";

export type SupplyDirection = "requesting" | "supplying";
export type SupplyStatus = "all" | "active" | "inactive";
export interface CompanySupplyRelationship {
  id: string;
  requesting_company_id: string;
  supplying_company_id: string;
  requesting_company: CompanyOption;
  supplying_company: CompanyOption;
  is_active: boolean;
  created_by: string;
  created_by_name: string | null;
  created_at: string;
  updated_at: string;
}
export interface CompanySupplyPage extends ApiPaginationMetadata { relationships: CompanySupplyRelationship[] }
export interface CompanySupplyOptions extends ApiPaginationMetadata { companies: CompanyOption[] }
export interface CompanySupplyResponse { relationship: CompanySupplyRelationship }
export interface CreateCompanySupplyInput { requesting_company_id: string; supplying_company_id: string }
export interface UpdateCompanySupplyInput { id: string; is_active: boolean }
