import type {
  MeasurementFieldInput,
  MeasurementUnitInput,
} from "@/types/measurements";

/** Preserve saved keys; generate unique keys for new definitions from their visible names. */
export function prepareMeasurementEntries<
  T extends MeasurementFieldInput | MeasurementUnitInput,
>(entries: T[]): T[] {
  const used = new Set(
    entries.filter((entry) => entry.key).map((entry) => entry.key),
  );
  return entries.map((entry, position) => {
    let key = entry.key;
    if (!key) {
      const label = "label" in entry ? entry.label : entry.name;
      const stem = label
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "_")
        .replace(/^_+|_+$/g, "");
      const base = (
        /^[a-z]/.test(stem) ? stem : `entry_${stem || position}`
      ).slice(0, 55);
      key = base;
      let suffix = 2;
      while (used.has(key)) key = `${base}_${suffix++}`;
      used.add(key);
    }
    return { ...entry, key, position };
  });
}
export function moveMeasurementEntry<T>(
  entries: T[],
  index: number,
  direction: -1 | 1,
): T[] {
  const target = index + direction;
  if (target < 0 || target >= entries.length) return entries;
  const result = [...entries];
  [result[index], result[target]] = [result[target], result[index]];
  return result;
}
