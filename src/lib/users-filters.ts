import type { AdditionalFilter, FilterField, FilterOption, QuickFilterState } from "./quick-filter";
export const USER_FILTER_FIELDS: FilterField[] = [
  { key: "name", label: "Name", options: [] }, { key: "email", label: "Email", options: [] },
  { key: "company", label: "Company", options: [] }, { key: "role", label: "Role", options: [] },
];
export const USER_STATUS_OPTIONS: FilterOption[] = [
  { value: "all", label: "All users" }, { value: "assigned", label: "Roles assigned" }, { value: "unassigned", label: "No roles assigned" },
];
export const USER_ADDITIONAL_FILTERS: AdditionalFilter[] = [{ key: "membership", label: "Company membership", options: [
  { value: "all", label: "All memberships" }, { value: "assigned", label: "With a company" }, { value: "unassigned", label: "Without a company" },
] }];
export const USER_FILTER_DEFAULTS = { status: "all", additional: { membership: "all" } };
export type UserFilterOptions = { fields: FilterField[]; statusOptions: FilterOption[]; additionalFilters: AdditionalFilter[] };
export type UserFilters = QuickFilterState;
