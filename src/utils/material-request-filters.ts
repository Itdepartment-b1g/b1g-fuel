import type { ManagementFilterOptions } from "@/types/management-filters";

export const MATERIAL_REQUEST_FILTER_DEFAULTS = { status: "all" };
export const MATERIAL_REQUEST_FILTER_OPTIONS: ManagementFilterOptions = {
  fields: [
    { key: "request_no", label: "Request number", options: [] },
    { key: "hub", label: "Requesting hub", options: [] },
    { key: "supplier", label: "Supplying company", options: [] },
  ],
  statusOptions: [
    { value: "all", label: "All requests" },
    { value: "draft", label: "Draft" },
    { value: "submitted", label: "Awaiting review" },
    { value: "approved", label: "Approved" },
    { value: "rejected", label: "Rejected" },
    { value: "cancelled", label: "Cancelled" },
  ],
  additionalFilters: [],
};
