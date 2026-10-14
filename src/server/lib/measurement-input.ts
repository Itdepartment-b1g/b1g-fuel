import type { CreateMeasurementInput, MeasurementUnitInput, UpdateMeasurementInput } from "@/server/schema/measurements_schema";

export class MeasurementError extends Error {
  constructor(public code: "invalid_input" | "not_found" | "forbidden" | "conflict", message: string) { super(message); }
}
function invalid(message: string): never { throw new MeasurementError("invalid_input", message); }
function object(value: unknown, allowed: string[]): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) invalid("Provide a JSON object.");
  const record = value as Record<string, unknown>;
  if (Object.keys(record).some((key) => !allowed.includes(key))) invalid("Unknown measurement field.");
  return record;
}
function text(value: unknown, label: string, max: number) {
  if (typeof value !== "string" || !value.trim() || value.trim().length > max) invalid(`${label} must contain between 1 and ${max} characters.`);
  return value.trim();
}
export function measurement_id(value: unknown) {
  if (typeof value !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)) invalid("Provide a valid ID.");
  return value.toLowerCase();
}
function key(value: unknown) {
  const result = text(value, "Key", 64);
  if (!/^[a-z][a-z0-9_]*$/.test(result)) invalid("Keys must start with a lowercase letter and contain only lowercase letters, numbers, or underscores.");
  return result;
}
function array<T extends { key: string }>(value: unknown, parse: (entry: unknown, index: number) => T): T[] {
  if (!Array.isArray(value) || !value.length || value.length > 30) invalid("Provide between 1 and 30 entries.");
  const result = value.map(parse);
  if (new Set(result.map((entry) => entry.key)).size !== result.length) invalid("Entry keys must be unique.");
  return result;
}
function units(value: unknown): MeasurementUnitInput[] {
  const result = array(value, (entry) => {
    const row = object(entry, ["key", "name", "symbol"]);
    return { key: key(row.key), name: text(row.name, "Unit name", 100), symbol: text(row.symbol, "Unit symbol", 20) };
  });
  if (new Set(result.map((unit) => unit.symbol.toLowerCase())).size !== result.length) invalid("Unit symbols must be unique.");
  return result;
}
function optional_company(value: unknown) {
  if (value === undefined || value === null || value === "") return undefined;
  return measurement_id(value);
}
export function parse_create_measurement(value: unknown): CreateMeasurementInput {
  const row = object(value, ["company_id", "name", "units"]);
  const company_id = optional_company(row.company_id);
  return { ...(company_id ? { company_id } : {}), name: text(row.name, "Measurement name", 160), units: units(row.units) };
}
export function parse_update_measurement(value: unknown): UpdateMeasurementInput {
  const row = object(value, ["id", "name", "units"]);
  if (Object.keys(row).filter((key) => key !== "id").length === 0) invalid("Provide at least one change.");
  return {
    id: measurement_id(row.id),
    ...(row.name !== undefined ? { name: text(row.name, "Measurement name", 160) } : {}),
    ...(row.units !== undefined ? { units: units(row.units) } : {}),
  };
}
