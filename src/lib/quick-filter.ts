export type FilterOption = { value: string; label: string; count?: number };
export type FilterField = { key: string; label: string; options: FilterOption[] };
export type AdditionalFilter = { key: string; label: string; options: FilterOption[] };
export type ColumnCondition = { id: string; field: string; value: string };
export type DateFilter = { preset: string; from: string; to: string };
export type QuickFilterState = { date: DateFilter; conditions: ColumnCondition[]; status: string; additional: Record<string, string> };
export type FilterDefaults = { date?: string; status: string; additional?: Record<string, string> };
export const DATE_PRESETS: FilterOption[] = [
  { value: "all", label: "All dates" }, { value: "today", label: "Today" },
  { value: "last7", label: "Last 7 days" }, { value: "last30", label: "Last 30 days" }, { value: "custom", label: "Custom range" },
];
export function emptyCondition(field = ""): ColumnCondition { return { id: crypto.randomUUID(), field, value: "" }; }
export function createQuickFilterState(defaults: FilterDefaults): QuickFilterState {
  return { date: { preset: defaults.date ?? "all", from: "", to: "" }, conditions: [emptyCondition()], status: defaults.status, additional: { ...defaults.additional } };
}
export function isActiveCondition(condition: ColumnCondition) { return Boolean(condition.field.trim() && condition.value.trim()); }
export function groupActiveConditions(conditions: ColumnCondition[]): Map<string, string[]> {
  const groups = new Map<string, string[]>();
  for (const condition of conditions) {
    if (!isActiveCondition(condition)) continue;
    const field = condition.field.trim(); const value = condition.value.trim();
    const values = groups.get(field) ?? [];
    if (!values.includes(value)) values.push(value);
    groups.set(field, values);
  }
  return groups;
}
export function matchesColumnConditions<T>(record: T, conditions: ColumnCondition[], match: (record: T, field: string, value: string) => boolean) {
  return [...groupActiveConditions(conditions)].every(([field, values]) => values.some((value) => match(record, field, value)));
}
export function addCondition(conditions: ColumnCondition[]) {
  const last = conditions.at(-1);
  return last && isActiveCondition(last) ? [...conditions, emptyCondition(last.field)] : conditions.length ? conditions : [emptyCondition()];
}
export function changeConditionField(conditions: ColumnCondition[], id: string, field: string) {
  return conditions.map((condition) => condition.id === id ? { ...condition, field, value: "" } : condition);
}
export function removeCondition(conditions: ColumnCondition[], id: string) {
  const remaining = conditions.filter((condition) => condition.id !== id);
  return remaining.length ? remaining : [emptyCondition()];
}
export function countActiveFilters(state: QuickFilterState, defaults: FilterDefaults) {
  return state.conditions.filter(isActiveCondition).length
    + Number(state.date.preset !== (defaults.date ?? "all"))
    + Number(state.status !== defaults.status)
    + Object.entries(defaults.additional ?? {}).filter(([key, value]) => (state.additional[key] ?? value) !== value).length;
}
export function searchFilterOptions(options: FilterOption[], search: string) {
  const query = search.trim().toLocaleLowerCase();
  return options.filter((option) => option.label.toLocaleLowerCase().includes(query) || option.value.toLocaleLowerCase().includes(query));
}
export type RecordFilterConfig<T> = {
  defaults: FilterDefaults;
  match: (record: T, field: string, value: string) => boolean;
  matchDate: (record: T, date: DateFilter) => boolean;
  matchStatus: (record: T, status: string) => boolean;
  matchAdditional?: (record: T, key: string, value: string) => boolean;
};
export function matchesQuickFilters<T>(record: T, state: QuickFilterState, config: RecordFilterConfig<T>) {
  return matchesColumnConditions(record, state.conditions, config.match)
    && (state.date.preset === (config.defaults.date ?? "all") || config.matchDate(record, state.date))
    && (state.status === config.defaults.status || config.matchStatus(record, state.status))
    && Object.entries(config.defaults.additional ?? {}).every(([key, fallback]) => {
      const value = state.additional[key] ?? fallback;
      return value === fallback || Boolean(config.matchAdditional?.(record, key, value));
    });
}
export function filterRecords<T>(records: T[], state: QuickFilterState, config: RecordFilterConfig<T>) {
  // Build column groups once for the dataset, preserving OR within fields and AND between fields.
  const groups = groupActiveConditions(state.conditions);
  return records.filter((record) => [...groups].every(([field, values]) => values.some((value) => config.match(record, field, value)))
    && matchesQuickFilters(record, { ...state, conditions: [] }, config));
}

/** Inclusive calendar days become [from, toExclusive); offset defaults to the project's Manila time. */
export function resolveDateRange(date: DateFilter, now = new Date(), offsetMinutes = 480): { from?: Date; toExclusive?: Date } {
  const dayMs = 86_400_000; const offset = offsetMinutes * 60_000;
  if (date.preset === "all") return {};
  const day = (value: string) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new RangeError("Provide a valid calendar date.");
    const parsed = new Date(`${value}T00:00:00Z`);
    if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) throw new RangeError("Provide a valid calendar date.");
    return parsed.getTime() - offset;
  };
  if (date.preset === "custom") {
    const from = date.from ? day(date.from) : undefined;
    const end = date.to ? day(date.to) : undefined;
    if (from !== undefined && end !== undefined && from > end) throw new RangeError("The start date must be before the end date.");
    return { ...(from !== undefined ? { from: new Date(from) } : {}), ...(end !== undefined ? { toExclusive: new Date(end + dayMs) } : {}) };
  }
  const days = { today: 1, last7: 7, last30: 30 }[date.preset];
  if (!days) throw new RangeError("Unknown date preset.");
  const today = Math.floor((now.getTime() + offset) / dayMs) * dayMs - offset;
  return { from: new Date(today - (days - 1) * dayMs), toExclusive: new Date(today + dayMs) };
}
export function matchesDate(value: string | Date, date: DateFilter, now = new Date(), offsetMinutes = 480) {
  const range = resolveDateRange(date, now, offsetMinutes);
  if (!range.from && !range.toExclusive) return true;
  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) && (!range.from || timestamp >= range.from.getTime()) && (!range.toExclusive || timestamp < range.toExclusive.getTime());
}
