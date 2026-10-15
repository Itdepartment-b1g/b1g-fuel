export const SUPPLIER_SORT_FIELDS = [
    "id",
    "name",
    "created_at",
    "updated_at"
] as const;

export interface ListSupplierResponse {
    id: string;
    company_id: string | null;
    company: { id: string; name: string } | null;
    created_by: string | null;
    name: string;
    contact_person: string;
    contact_email: string;
    contact_phone: string;
    contact_address: string;
    created_at: string;
    updated_at: string;
}


export interface CreateSupplierInput {
    company_id?: string;
    name: string;
    contact_person: string;
    contact_email: string;
    contact_phone?: string;
    contact_address?: string;
}

export interface UpdateSupplierInput {
    id: string;
    name?: string;
    contact_person?: string;
    contact_email?: string;
    contact_phone?: string;
    contact_address?: string;
}
