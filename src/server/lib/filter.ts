import {
  isActiveCondition,
  type ColumnCondition,
  type DateFilter,
  type FilterDefaults,
  type QuickFilterState,
} from "@/lib/quick-filter";

export function groupActiveConditions(
  conditions: ColumnCondition[],
): Map<string, string[]> {
  const groups = new Map<string, string[]>();
  for (const condition of conditions) {
    if (!isActiveCondition(condition)) continue;
    const field = condition.field.trim();
    const value = condition.value.trim();
    const values = groups.get(field) ?? [];
    if (!values.includes(value)) values.push(value);
    groups.set(field, values);
  }
  return groups;
}
export function matchesColumnConditions<T>(
  record: T,
  conditions: ColumnCondition[],
  match: (record: T, field: string, value: string) => boolean,
) {
  return [...groupActiveConditions(conditions)].every(([field, values]) =>
    values.some((value) => match(record, field, value)),
  );
}
export type RecordFilterConfig<T> = {
  defaults: FilterDefaults;
  match: (record: T, field: string, value: string) => boolean;
  matchDate: (record: T, date: DateFilter) => boolean;
  matchStatus: (record: T, status: string) => boolean;
  matchAdditional?: (record: T, key: string, value: string) => boolean;
};
export function matchesQuickFilters<T>(
  record: T,
  state: QuickFilterState,
  config: RecordFilterConfig<T>,
) {
  return (
    matchesColumnConditions(record, state.conditions, config.match) &&
    (state.date.preset === (config.defaults.date ?? "all") ||
      config.matchDate(record, state.date)) &&
    (state.status === config.defaults.status ||
      config.matchStatus(record, state.status)) &&
    Object.entries(config.defaults.additional ?? {}).every(
      ([key, fallback]) => {
        const value = state.additional[key] ?? fallback;
        return (
          value === fallback ||
          Boolean(config.matchAdditional?.(record, key, value))
        );
      },
    )
  );
}
export function filterRecords<T>(
  records: T[],
  state: QuickFilterState,
  config: RecordFilterConfig<T>,
) {
  // Build column groups once for the dataset, preserving OR within fields and AND between fields.
  const groups = groupActiveConditions(state.conditions);
  return records.filter(
    (record) =>
      [...groups].every(([field, values]) =>
        values.some((value) => config.match(record, field, value)),
      ) && matchesQuickFilters(record, { ...state, conditions: [] }, config),
  );
}

/** Inclusive calendar days become [from, toExclusive); offset defaults to the project's Manila time. */
export function resolveDateRange(
  date: DateFilter,
  now = new Date(),
  offsetMinutes = 480,
): { from?: Date; toExclusive?: Date } {
  const dayMs = 86_400_000;
  const offset = offsetMinutes * 60_000;
  if (date.preset === "all") return {};
  const day = (value: string) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value))
      throw new RangeError("Provide a valid calendar date.");
    const parsed = new Date(`${value}T00:00:00Z`);
    if (
      !Number.isFinite(parsed.getTime()) ||
      parsed.toISOString().slice(0, 10) !== value
    )
      throw new RangeError("Provide a valid calendar date.");
    return parsed.getTime() - offset;
  };
  if (date.preset === "custom") {
    const from = date.from ? day(date.from) : undefined;
    const end = date.to ? day(date.to) : undefined;
    if (from !== undefined && end !== undefined && from > end)
      throw new RangeError("The start date must be before the end date.");
    return {
      ...(from !== undefined ? { from: new Date(from) } : {}),
      ...(end !== undefined ? { toExclusive: new Date(end + dayMs) } : {}),
    };
  }
  const days = { today: 1, last7: 7, last30: 30 }[date.preset];
  if (!days) throw new RangeError("Unknown date preset.");
  const today = Math.floor((now.getTime() + offset) / dayMs) * dayMs - offset;
  return {
    from: new Date(today - (days - 1) * dayMs),
    toExclusive: new Date(today + dayMs),
  };
}
export function matchesDate(
  value: string | Date,
  date: DateFilter,
  now = new Date(),
  offsetMinutes = 480,
) {
  const range = resolveDateRange(date, now, offsetMinutes);
  if (!range.from && !range.toExclusive) return true;
  const timestamp = new Date(value).getTime();
  return (
    Number.isFinite(timestamp) &&
    (!range.from || timestamp >= range.from.getTime()) &&
    (!range.toExclusive || timestamp < range.toExclusive.getTime())
  );
}

type TextFilter = { contains: string; mode: "insensitive" };
type DateRangeFilter = { gte?: Date; lt?: Date };
type FilterHandler<Where> = (values: string[]) => Where;

export type FilterConfig<Where> = {
  fields?: Record<string, FilterHandler<Where>>;
  search?: { value: string; fields: ((filter: TextFilter) => Where)[] };
  date?: (range: DateRangeFilter) => Where;
  status?: Record<string, Where>;
  additional?: Record<string, Record<string, Where>>;
  where?: Where;
};

/** Compose validated filters; repositories supply their own typed Prisma predicates. */
export function build_filter<Where extends { OR?: Where[] }>(
  filters: QuickFilterState | undefined,
  config: FilterConfig<Where>,
  now = new Date(),
): { AND?: (Where | { OR: Where[] })[] } {
  const clauses: (Where | { OR: Where[] })[] = [];
  if (config.where) clauses.push(config.where);
  if (config.search?.value && config.search.fields.length) {
    // Prisma contains uses LIKE: escape wildcards for literal substring searches.
    const filter: TextFilter = {
      contains: config.search.value.replace(/[\\%_]/g, "\\$&"),
      mode: "insensitive",
    };
    clauses.push({ OR: config.search.fields.map((field) => field(filter)) });
  }
  if (filters) {
    for (const [field, values] of groupActiveConditions(filters.conditions)) {
      if (config.fields && Object.hasOwn(config.fields, field))
        clauses.push(config.fields[field](values));
    }
    if (config.date) {
      const range = resolveDateRange(filters.date, now);
      if (range.from || range.toExclusive)
        clauses.push(config.date({
          ...(range.from ? { gte: range.from } : {}),
          ...(range.toExclusive ? { lt: range.toExclusive } : {}),
        }));
    }
    if (config.status && Object.hasOwn(config.status, filters.status))
      clauses.push(config.status[filters.status]);
    for (const [key, options] of Object.entries(config.additional ?? {})) {
      const value = filters.additional[key];
      if (Object.hasOwn(options, value)) clauses.push(options[value]);
    }
  }
  return clauses.length ? { AND: clauses } : {};
}
