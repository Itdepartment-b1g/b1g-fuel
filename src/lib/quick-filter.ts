export type FilterOption = { value: string; label: string; count?: number };
export type FilterField = {
  key: string;
  label: string;
  options: FilterOption[];
};
export type AdditionalFilter = {
  key: string;
  label: string;
  options: FilterOption[];
};
export type ColumnCondition = { id: string; field: string; value: string };
export type DateFilter = { preset: string; from: string; to: string };
export type QuickFilterState = {
  date: DateFilter;
  conditions: ColumnCondition[];
  status: string;
  additional: Record<string, string>;
};
export type FilterDefaults = {
  date?: string;
  status: string;
  additional?: Record<string, string>;
};
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
