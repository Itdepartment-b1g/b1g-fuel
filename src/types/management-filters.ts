import type { AdditionalFilter, FilterField, FilterOption } from "@/types/quick-filter";

export interface ManagementFilterOptions {
  // Fields available for column-based filtering.
  fields: FilterField[];
  // Available status choices and their matching record counts.
  statusOptions: FilterOption[];
  // Additional filter groups specific to the management screen.
  additionalFilters: AdditionalFilter[];
}
