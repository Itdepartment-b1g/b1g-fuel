import type { CompanyOption } from "./companies";

export interface Supplier {
  id: string;
  company_id: string | null;
  company: CompanyOption | null;
  created_by: string | null;
  name: string;
  contact_person: string;
  contact_email: string;
  contact_phone: string;
  contact_address: string;
  created_at: string;
  updated_at: string;
}

export type SupplierSummary = Supplier;

export interface CreateSupplierInput {
  company_id?: string;
  name: string;
  contact_person: string;
  contact_email: string;
  contact_phone: string;
  contact_address: string;
}

export interface UpdateSupplierInput {
  id: string;
  name?: string;
  contact_person?: string;
  contact_email?: string;
  contact_phone?: string;
  contact_address?: string;
}

export interface SupplierResponse {
  supplier: SupplierSummary;
}

export interface SuppliersPage {
  suppliers: SupplierSummary[];
  total: number;
  page: number;
  page_size: number;
}

export interface SupplierOptions {
  companies: CompanyOption[];
}

export interface DeleteSupplierResponse {
  id: string;
  message: string;
}
