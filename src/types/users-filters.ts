import type { AdditionalFilter, FilterField, FilterOption, QuickFilterState } from "./quick-filter";

export interface UserFilterOptions {
  // Fields available for filtering users.
  fields: FilterField[];
  // Choices for filtering users by role-assignment status.
  statusOptions: FilterOption[];
  // Additional filter groups, such as company membership.
  additionalFilters: AdditionalFilter[];
}

export type UserFilters = QuickFilterState;
