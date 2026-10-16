import type { ManagementFilterOptions } from "@/types/management-filters";

export const COMPANY_FILTER_OPTIONS: ManagementFilterOptions = {
  fields: [{ key: "name", label: "Company name", options: [] }],
  statusOptions: [
    { value: "all", label: "All companies" },
    { value: "assigned", label: "With members" },
    { value: "unassigned", label: "Without members" },
  ],
  additionalFilters: [],
};
export const COMPANY_FILTER_DEFAULTS = { status: "all" };
export const BRAND_FILTER_OPTIONS: ManagementFilterOptions = {
  fields: [
    { key: "name", label: "Brand name", options: [] },
    { key: "company", label: "Company", options: [] },
  ],
  statusOptions: [
    { value: "all", label: "All brands" },
    { value: "with_variants", label: "With variants" },
    { value: "without_variants", label: "Without variants" },
  ],
  additionalFilters: [],
};
export const BRAND_FILTER_DEFAULTS = { status: "all" };
export const MEASUREMENT_FILTER_OPTIONS: ManagementFilterOptions = {
  fields: [
    { key: "name", label: "Measurement name", options: [] },
    { key: "company", label: "Company", options: [] },
  ],
  statusOptions: [
    { value: "all", label: "All measurements" },
    { value: "shared", label: "Shared" },
    { value: "company", label: "Company" },
  ],
  additionalFilters: [],
};
export const MEASUREMENT_FILTER_DEFAULTS = { status: "all" };
export const SUPPLIER_FILTER_OPTIONS: ManagementFilterOptions = {
  fields: [
    { key: "name", label: "Supplier name", options: [] },
    { key: "company", label: "Company", options: [] },
  ],
  statusOptions: [
    { value: "all", label: "All suppliers" },
    { value: "shared", label: "Shared" },
    { value: "company", label: "Company" },
  ],
  additionalFilters: [],
};
export const SUPPLIER_FILTER_DEFAULTS = { status: "all" };
export const PRODUCT_TYPE_FILTER_OPTIONS: ManagementFilterOptions = {
  fields: [
    { key: "name", label: "Type name", options: [] },
    { key: "company", label: "Company", options: [] },
  ],
  statusOptions: [
    { value: "all", label: "All types" },
    { value: "shared", label: "Shared" },
    { value: "company", label: "Company" },
  ],
  additionalFilters: [],
};
export const PRODUCT_TYPE_FILTER_DEFAULTS = { status: "all" };
export const PRODUCT_FILTER_OPTIONS: ManagementFilterOptions = {
  fields: [
    { key: "company", label: "Company", options: [] },
    { key: "product_type", label: "Product type", options: [] },
  ],
  statusOptions: [{ value: "all", label: "All products" }],
  additionalFilters: [],
};
export const PRODUCT_FILTER_DEFAULTS = { status: "all" };
export const PURCHASE_ORDER_FILTER_OPTIONS: ManagementFilterOptions = {
  fields: [
    { key: "company", label: "Company", options: [] },
    { key: "supplier", label: "Supplier", options: [] },
    { key: "location", label: "Warehouse", options: [] },
  ],
  statusOptions: [
    { value: "all", label: "All orders" },
    { value: "draft", label: "Draft" },
    { value: "awaiting_receipt", label: "Awaiting receipt" },
    { value: "partially_received", label: "Partially received" },
    { value: "received", label: "Received" },
    { value: "closed", label: "Closed" },
  ],
  additionalFilters: [],
};
export const PURCHASE_ORDER_FILTER_DEFAULTS = { status: "all" };
export const RECEIVING_FILTER_OPTIONS: ManagementFilterOptions = {
  fields: [
    { key: "company", label: "Company", options: [] },
    { key: "supplier", label: "Supplier", options: [] },
    { key: "location", label: "Warehouse", options: [] },
  ],
  statusOptions: [
    { value: "all", label: "All receipts" },
    { value: "draft", label: "Draft" },
    { value: "posted", label: "Posted" },
  ],
  additionalFilters: [],
};
export const RECEIVING_FILTER_DEFAULTS = { status: "all" };
export const ROLE_FILTER_OPTIONS: ManagementFilterOptions = {
  fields: [
    { key: "name", label: "Role name", options: [] },
    { key: "slug", label: "Slug", options: [] },
    { key: "company", label: "Company", options: [] },
  ],
  statusOptions: [
    { value: "all", label: "All roles" },
    { value: "assigned", label: "Assigned to users" },
    { value: "unassigned", label: "Not assigned to users" },
  ],
  additionalFilters: [
    {
      key: "scope",
      label: "Role scope",
      options: [
        { value: "all", label: "All scopes" },
        { value: "company", label: "Company" },
        { value: "global", label: "Global" },
      ],
    },
    {
      key: "type",
      label: "Role type",
      options: [
        { value: "all", label: "All types" },
        { value: "system", label: "System" },
        { value: "custom", label: "Custom" },
      ],
    },
    {
      key: "default",
      label: "Company default",
      options: [
        { value: "all", label: "All settings" },
        { value: "default", label: "Default roles" },
        { value: "other", label: "Other roles" },
      ],
    },
  ],
};
export const ROLE_FILTER_DEFAULTS = {
  status: "all",
  additional: { scope: "all", type: "all", default: "all" },
};
