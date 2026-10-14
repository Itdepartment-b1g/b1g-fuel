export interface FilterOption {
  // Value submitted when this option is selected.
  value: string;
  // Display label of the option.
  label: string;
  // Optional number of matching records.
  count?: number;
}

export interface FilterField {
  // Machine-readable key of the filterable field.
  key: string;
  // Display label of the field.
  label: string;
  // Available values for this field.
  options: FilterOption[];
}

export interface AdditionalFilter {
  // Machine-readable key of the additional filter group.
  key: string;
  // Display label of the filter group.
  label: string;
  // Available choices for this group.
  options: FilterOption[];
}

export interface ColumnCondition {
  // Unique identifier used when editing or removing this condition.
  id: string;
  // Key of the field selected for filtering.
  field: string;
  // Value selected for this condition.
  value: string;
}

export interface DateFilter {
  // Selected date preset; unrecognized values fall back to all time in the UI.
  preset: string;
  // Custom starting date in YYYY-MM-DD format, or an empty string.
  from: string;
  // Custom ending date in YYYY-MM-DD format, or an empty string.
  to: string;
}

export interface QuickFilterState {
  // Current date-range selection.
  date: DateFilter;
  // Field-and-value conditions selected by the user.
  conditions: ColumnCondition[];
  // Current status-filter value.
  status: string;
  // Selected values indexed by additional filter-group key.
  additional: Record<string, string>;
}

export interface FilterDefaults {
  // Default date preset; all time is used when omitted.
  date?: string;
  // Default status-filter value.
  status: string;
  // Default values indexed by additional filter-group key.
  additional?: Record<string, string>;
}
