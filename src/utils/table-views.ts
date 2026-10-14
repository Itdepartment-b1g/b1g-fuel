import type { SortValue, TableSort } from "@/types/table-views";

/** Compare supported cell values; missing and invalid values stay last in either direction. */
export function compareTableValues(a: SortValue, b: SortValue, direction: TableSort["direction"]) {
  const normalize = (value: SortValue) => value instanceof Date ? value.getTime() : value;
  const left = normalize(a), right = normalize(b);
  const missing = (value: ReturnType<typeof normalize>) => value == null || (typeof value === "number" && !Number.isFinite(value));
  if (missing(left) || missing(right)) return missing(left) === missing(right) ? 0 : missing(left) ? 1 : -1;
  const result = typeof left === "number" && typeof right === "number" ? left - right
    : typeof left === "boolean" && typeof right === "boolean" ? Number(left) - Number(right)
    : String(left).localeCompare(String(right), "en", { numeric: true, sensitivity: "base" });
  return direction === "asc" ? result : -result;
}

/** Sort a complete local dataset without mutation, using a stable row ID to break ties. */
export function sortTableRows<T>(rows: readonly T[], sorting: TableSort, value: (row: T) => SortValue,
  rowKey: (row: T) => string, compare?: (a: T, b: T) => number) {
  return [...rows].sort((a, b) => {
    const result = compare ? compare(a, b) * (sorting.direction === "asc" ? 1 : -1)
      : compareTableValues(value(a), value(b), sorting.direction);
    return result || rowKey(a).localeCompare(rowKey(b));
  });
}
