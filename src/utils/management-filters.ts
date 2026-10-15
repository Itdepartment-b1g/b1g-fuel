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
