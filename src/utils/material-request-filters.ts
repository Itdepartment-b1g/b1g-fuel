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
    { value: "submitted", label: "Pending" },
    { value: "approved", label: "Approved" },
    { value: "partially_dispatched", label: "Partially Dispatched" },
    { value: "fully_dispatched", label: "Fully Dispatched" },
    { value: "partially_received", label: "Partially Received" },
    { value: "received", label: "Completed" },
    { value: "closed", label: "Closed" },
    { value: "rejected", label: "Rejected" },
    { value: "cancelled", label: "Cancelled" },
  ],
  additionalFilters: [],
};
