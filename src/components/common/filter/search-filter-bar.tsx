"use client";

import { useEffect, useRef, useState } from "react";
import { LayoutGrid, List } from "lucide-react";
import { fromDateMenuValue, toDateMenuValue } from "@/utils/quick-filter";
import type { AdditionalFilter, FilterField, FilterOption, QuickFilterState } from "@/types/quick-filter";
import { DateRangeMenu } from "./date-range-menu";
import { SearchQuickFilter } from "./search-quick-filter";

export type ListView = "table" | "cards";

const DESKTOP_VIEW = "(min-width: 1024px)";

/** Cards by default (mobile), table on desktop, until the user picks a view. */
export function useListView() {
  const [view, setView] = useState<ListView>("cards");
  const chosen = useRef(false);
  useEffect(() => {
    const desktop = window.matchMedia(DESKTOP_VIEW);
    const sync = () => {
      if (chosen.current) return;
      setView(desktop.matches ? "table" : "cards");
    };
    sync();
    desktop.addEventListener("change", sync);
    return () => desktop.removeEventListener("change", sync);
  }, []);
  function changeView(next: ListView) {
    chosen.current = true;
    setView(next);
  }
  return [view, changeView] as const;
}

export function ViewToggle({
  view,
  onViewChange,
  label = "Display",
}: {
  view: ListView;
  onViewChange: (view: ListView) => void;
  label?: string;
}) {
  return (
    <div className="flex w-fit shrink-0 rounded-lg border p-1" role="group" aria-label={label}>
      <button
        type="button"
        aria-label="Table view"
        aria-pressed={view === "table"}
        onClick={() => onViewChange("table")}
        className={`inline-flex size-10 items-center justify-center rounded-md ${view === "table" ? "bg-gray-50" : "text-muted-foreground"}`}
      >
        <List className="size-4" />
      </button>
      <button
        type="button"
        aria-label="Card view"
        aria-pressed={view === "cards"}
        onClick={() => onViewChange("cards")}
        className={`inline-flex size-10 items-center justify-center rounded-md ${view === "cards" ? "bg-gray-50" : "text-muted-foreground"}`}
      >
        <LayoutGrid className="size-4" />
      </button>
    </div>
  );
}

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
  view?: ListView;
  onViewChange?: (view: ListView) => void;
  viewLabel?: string;
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
  view,
  onViewChange,
  viewLabel,
  className,
}: SearchFilterBarProps) {
  const [draft, setDraft] = useState(search);
  return (
    <div className={className}>
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
          <>
            <DateRangeMenu
              value={toDateMenuValue(filters.date)}
              onChange={(next) =>
                onFiltersChange({ ...filters, date: fromDateMenuValue(next) })
              }
              align="end"
              disabled={disabled}
              triggerClassName="min-w-0 w-auto flex-1 sm:flex-none sm:w-[220px]"
              contentClassName="w-[min(360px,calc(100vw-1.5rem))]"
            />
            {view && onViewChange && (
              <ViewToggle view={view} onViewChange={onViewChange} label={viewLabel} />
            )}
          </>
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
