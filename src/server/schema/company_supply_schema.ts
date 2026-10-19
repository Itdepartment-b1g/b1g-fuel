export const SUPPLY_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export type SupplyDirection = "requesting" | "supplying";
export type SupplyStatus = "all" | "active" | "inactive";
export interface CompanySupplyRecord {
  id: string;
  requesting_company_id: string;
  supplying_company_id: string;
  requesting_company: { id: string; name: string };
  supplying_company: { id: string; name: string };
  is_active: boolean;
  created_by: string;
  created_by_name: string | null;
  created_at: string;
  updated_at: string;
}
export interface CreateCompanySupplyInput { requesting_company_id: string; supplying_company_id: string }
export interface UpdateCompanySupplyInput { id: string; is_active: boolean }
