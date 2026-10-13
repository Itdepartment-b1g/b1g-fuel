"use client";

import { useState } from "react";
import {
  fromDateMenuValue,
  toDateMenuValue,
  type AdditionalFilter,
  type FilterField,
  type FilterOption,
  type QuickFilterState,
} from "@/lib/quick-filter";
import { cn } from "@/lib/utils";
import { DateRangeMenu } from "./date-range-menu";
import { SearchQuickFilter } from "./search-quick-filter";

type FilterLabels = {
  button?: string;
  title?: string;
  date?: string;
  conditions?: string;
  status?: string;
  allColumns?: string;
  any?: string;
};

export type SearchFilterBarProps = {
  search: string;
  onSearch: (value: string) => void;
  filters: QuickFilterState;
  onFiltersChange: (value: QuickFilterState) => void;
  fields: FilterField[];
  statusOptions: FilterOption[];
  additionalFilters?: AdditionalFilter[];
  filterLabels?: FilterLabels;
  maxConditions?: number;
  loading?: boolean;
  disabled?: boolean;
  placeholder?: string;
  searchLabel?: string;
  maxLength?: number;
  quickFilterActive?: boolean;
  className?: string;
};

/** Card around the shared search toolbar and existing Quick Filter panel. The draft stays inside this component. */
export function SearchFilterBar({
  search,
  onSearch,
  filters,
  onFiltersChange,
  fields,
  statusOptions,
  additionalFilters,
  filterLabels,
  maxConditions,
  loading,
  disabled,
  placeholder,
  searchLabel,
  maxLength,
  quickFilterActive,
  className,
}: SearchFilterBarProps) {
  const [draft, setDraft] = useState(search);
  return (
    <div
      className={cn(
        className,
      )}
    >
      <SearchQuickFilter
        searchValue={draft}
        onSearchValueChange={setDraft}
        searchLabel={searchLabel}
        placeholder={placeholder}
        maxLength={maxLength}
        loading={loading}
        disabled={disabled}
        onSearch={onSearch}
        canClearSearch={Boolean(search)}
        onClearSearch={() => onSearch("")}
        quickFilterActive={quickFilterActive}
        trailingContent={
          <DateRangeMenu
            value={toDateMenuValue(filters.date)}
            onChange={(next) =>
              onFiltersChange({ ...filters, date: fromDateMenuValue(next) })
            }
            align="end"
            disabled={disabled}
          />
        }
        filter={{
          value: filters,
          onChange: onFiltersChange,
          fields,
          statusOptions,
          additionalFilters,
          labels: filterLabels,
          maxConditions,
        }}
      />
    </div>
  );
}
