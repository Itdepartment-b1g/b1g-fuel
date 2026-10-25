import type { ManagementFilterOptions } from "@/types/management-filters";

export const INVENTORY_FILTER_OPTIONS: ManagementFilterOptions = {
  fields: [
    { key: "company", label: "Company", options: [] },
    { key: "facility", label: "Facility", options: [] },
    { key: "brand", label: "Brand", options: [] },
    { key: "variant", label: "Variant", options: [] },
    { key: "product_type", label: "Product type", options: [] },
  ],
  statusOptions: [
    { value: "all", label: "All balances" },
    { value: "positive", label: "In stock" },
    { value: "zero", label: "Zero stock" },
  ],
  additionalFilters: [{
    key: "facility_type", label: "Facility type", options: [
      { value: "all", label: "All facilities" },
      { value: "warehouse", label: "Warehouses" },
      { value: "hub", label: "Hubs" },
    ],
  }],
};

export const INVENTORY_HISTORY_FILTER_OPTIONS: ManagementFilterOptions = {
  fields: [],
  statusOptions: [{ value: "all", label: "All movements" }, { value: "in", label: "Stock In" }, { value: "out", label: "Stock Out" }],
  additionalFilters: [{ key: "transaction_type", label: "Transaction type", options: [
    { value: "all", label: "All transactions" },
    { value: "po_receive_in", label: "Supplier receipt" },
    { value: "dispatch_out", label: "Material dispatch" },
    { value: "receive_in", label: "Hub receipt" },
  ] }],
};
