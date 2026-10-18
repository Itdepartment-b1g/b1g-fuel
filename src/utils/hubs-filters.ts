import type { ManagementFilterOptions } from "@/types/management-filters";
export const HUB_FILTER_DEFAULTS = { status: "all" };
export const HUB_FILTER_OPTIONS: ManagementFilterOptions = {
  fields: [
    { key: "name", label: "Hub name", options: [] },
    { key: "company", label: "Company", options: [] },
  ],
  statusOptions: [
    { value: "all", label: "All hubs" },
    { value: "active", label: "Active" },
    { value: "inactive", label: "Inactive" },
  ],
  additionalFilters: [],
};
