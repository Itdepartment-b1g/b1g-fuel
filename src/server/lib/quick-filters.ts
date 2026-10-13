import { DATE_PRESETS, type QuickFilterState } from "@/lib/quick-filter";
import type { ManagementFilterOptions } from "@/lib/management-filters";
import { resolveDateRange } from "./filter";
import type { FilterOption } from "@/lib/quick-filter";

export class QuickFilterError extends Error {}

export function build_filter_options<T>(records: T[], definition: ManagementFilterOptions, value: (record: T, field: string) => { value: string; label: string } | null, status: (record: T, value: string) => boolean, additional: (record: T, key: string, value: string) => boolean = () => true): ManagementFilterOptions {
  return {
    fields: definition.fields.map((field) => {
      const options = new Map<string, FilterOption>();
      for (const record of records) {
        const choice = value(record, field.key);
        if (!choice) continue;
        const key = choice.value.toLocaleLowerCase();
        const existing = options.get(key);
        if (existing) existing.count = (existing.count ?? 0) + 1;
        else options.set(key, { ...choice, count: 1 });
      }
      return { ...field, options: [...options.values()].sort((left, right) => left.label.localeCompare(right.label)) };
    }),
    statusOptions: definition.statusOptions.map((option) => ({ ...option, count: option.value === "all" ? records.length : records.filter((record) => status(record, option.value)).length })),
    additionalFilters: definition.additionalFilters.map((filter) => ({ ...filter, options: filter.options.map((option) => ({ ...option, count: option.value === "all" ? records.length : records.filter((record) => additional(record, filter.key, option.value)).length })) })),
  };
}

export function parse_quick_filters(value: unknown, options: ManagementFilterOptions): QuickFilterState | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== "string" || value.length > 12000) throw new QuickFilterError("Invalid quick filters.");
  let parsed: unknown;
  try { parsed = JSON.parse(value); } catch { throw new QuickFilterError("Quick filters must be valid JSON."); }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new QuickFilterError("Invalid quick filters.");
  const record = parsed as Record<string, unknown>;
  if (Object.keys(record).some((key) => !["date", "conditions", "status", "additional"].includes(key))) throw new QuickFilterError("Unknown quick filter.");
  const { date, conditions, status, additional } = record;
  if (!date || typeof date !== "object" || Array.isArray(date)) throw new QuickFilterError("Invalid date filter.");
  const range = date as Record<string, unknown>;
  if (!DATE_PRESETS.some((preset) => preset.value === range.preset) || typeof range.from !== "string" || typeof range.to !== "string" || range.from.length > 10 || range.to.length > 10) throw new QuickFilterError("Invalid date filter.");
  if (!Array.isArray(conditions) || !conditions.length || conditions.length > 50) throw new QuickFilterError("Provide between 1 and 50 filter conditions.");
  const ids = new Set<string>();
  for (const row of conditions) {
    if (!row || typeof row !== "object" || typeof row.id !== "string" || !row.id || row.id.length > 64 || ids.has(row.id) || typeof row.field !== "string" || (row.field !== "" && !options.fields.some((field) => field.key === row.field)) || typeof row.value !== "string" || row.value.length > 160) throw new QuickFilterError("Invalid column condition.");
    if (row.field === "company" && row.value.trim() && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(row.value.trim())) throw new QuickFilterError("Provide a valid company filter ID.");
    ids.add(row.id);
  }
  if (!options.statusOptions.some((option) => option.value === status)) throw new QuickFilterError("Invalid status filter.");
  if (!additional || typeof additional !== "object" || Array.isArray(additional)) throw new QuickFilterError("Invalid additional filters.");
  const selected = additional as Record<string, unknown>;
  if (Object.keys(selected).some((key) => !options.additionalFilters.some((filter) => filter.key === key))) throw new QuickFilterError("Unknown additional filter.");
  const extras: Record<string, string> = {};
  for (const filter of options.additionalFilters) {
    const next = selected[filter.key] ?? "all";
    if (typeof next !== "string" || !filter.options.some((option) => option.value === next)) throw new QuickFilterError("Invalid additional filter.");
    extras[filter.key] = next;
  }
  const result: QuickFilterState = { date: { preset: range.preset as string, from: range.from, to: range.to }, conditions, status: status as string, additional: extras };
  try { resolveDateRange(result.date); } catch (error) { throw new QuickFilterError(error instanceof Error ? error.message : "Invalid date range."); }
  return result;
}
