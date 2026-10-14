import {
  formatDateForInput,
  parseDateFromInput,
} from "@/utils/dateRangePresets";
import type { DatePreset, DateRangeFilterValue } from "@/types/date-range";
import type { ColumnCondition, DateFilter, FilterDefaults, FilterOption, QuickFilterState } from "@/types/quick-filter";

export const DATE_PRESETS: FilterOption[] = [
  { value: "all", label: "All Time" },
  { value: "this_month", label: "This Month" },
  { value: "last_month", label: "Last Month" },
  { value: "last_3_months", label: "Last 3 Months" },
  { value: "last_6_months", label: "Last 6 Months" },
  { value: "this_year", label: "This Year" },
  { value: "last_year", label: "Last Year" },
  { value: "custom", label: "Custom range" },
];
const datePresetValues = new Set<string>(DATE_PRESETS.map((preset) => preset.value));

export function toDateMenuValue(date: DateFilter): DateRangeFilterValue {
  return {
    preset: datePresetValues.has(date.preset) ? (date.preset as DatePreset) : "all",
    customStart: parseDateFromInput(date.from),
    customEnd: parseDateFromInput(date.to),
  };
}

export function fromDateMenuValue(value: DateRangeFilterValue): DateFilter {
  return {
    preset: value.preset,
    from: formatDateForInput(value.customStart),
    to: formatDateForInput(value.customEnd),
  };
}

export function emptyCondition(field = ""): ColumnCondition {
  return { id: crypto.randomUUID(), field, value: "" };
}
export function createQuickFilterState(
  defaults: FilterDefaults,
): QuickFilterState {
  return {
    date: { preset: defaults.date ?? "all", from: "", to: "" },
    conditions: [emptyCondition()],
    status: defaults.status,
    additional: { ...defaults.additional },
  };
}
export function isActiveCondition(condition: ColumnCondition) {
  return Boolean(condition.field.trim() && condition.value.trim());
}
export function addCondition(conditions: ColumnCondition[]) {
  const last = conditions.at(-1);
  return last && isActiveCondition(last)
    ? [...conditions, emptyCondition(last.field)]
    : conditions.length
      ? conditions
      : [emptyCondition()];
}
export function changeConditionField(
  conditions: ColumnCondition[],
  id: string,
  field: string,
) {
  return conditions.map((condition) =>
    condition.id === id ? { ...condition, field, value: "" } : condition,
  );
}
export function removeCondition(conditions: ColumnCondition[], id: string) {
  const remaining = conditions.filter((condition) => condition.id !== id);
  return remaining.length ? remaining : [emptyCondition()];
}
export function countActiveFilters(
  state: QuickFilterState,
  defaults: FilterDefaults,
) {
  return (
    state.conditions.filter(isActiveCondition).length +
    Number(state.date.preset !== (defaults.date ?? "all")) +
    Number(state.status !== defaults.status) +
    Object.entries(defaults.additional ?? {}).filter(
      ([key, value]) => (state.additional[key] ?? value) !== value,
    ).length
  );
}
export function searchFilterOptions(options: FilterOption[], search: string) {
  const query = search.trim().toLocaleLowerCase();
  return options.filter(
    (option) =>
      option.label.toLocaleLowerCase().includes(query) ||
      option.value.toLocaleLowerCase().includes(query),
  );
}
