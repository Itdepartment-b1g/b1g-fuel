import type { CreateMeasurementInput, MeasurementFieldInput, MeasurementUnitInput, UpdateMeasurementInput } from "@/server/schema/measurements_schema";

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
function boolean(value: unknown, fallback: boolean) {
  if (value === undefined) return fallback;
  if (typeof value !== "boolean") invalid("Expected a boolean value.");
  return value;
}
function key(value: unknown) {
  const result = text(value, "Key", 64);
  if (!/^[a-z][a-z0-9_]*$/.test(result)) invalid("Keys must start with a lowercase letter and contain only lowercase letters, numbers, or underscores.");
  return result;
}
function position(value: unknown, fallback: number) {
  if (value === undefined) return fallback;
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0 || value > 1000) invalid("Position must be an integer between 0 and 1000.");
  return value;
}
function array<T extends { key: string }>(value: unknown, parse: (entry: unknown, index: number) => T): T[] {
  if (!Array.isArray(value) || !value.length || value.length > 30) invalid("Provide between 1 and 30 entries.");
  const result = value.map(parse);
  if (new Set(result.map((entry) => entry.key)).size !== result.length) invalid("Entry keys must be unique.");
  return result;
}
function fields(value: unknown): MeasurementFieldInput[] {
  return array(value, (entry, index) => {
    const row = object(entry, ["key", "label", "required", "is_active", "position"]);
    return { key: key(row.key), label: text(row.label, "Field label", 100), required: boolean(row.required, true), is_active: boolean(row.is_active, true), position: position(row.position, index) };
  });
}
function units(value: unknown): MeasurementUnitInput[] {
  const result = array(value, (entry, index) => {
    const row = object(entry, ["key", "name", "symbol", "is_active", "position"]);
    return { key: key(row.key), name: text(row.name, "Unit name", 100), symbol: text(row.symbol, "Unit symbol", 20), is_active: boolean(row.is_active, true), position: position(row.position, index) };
  });
  if (new Set(result.map((unit) => unit.symbol.toLowerCase())).size !== result.length) invalid("Unit symbols must be unique.");
  return result;
}
export function parse_create_measurement(value: unknown): CreateMeasurementInput {
  const row = object(value, ["company_id", "name", "fields", "units"]);
  const input = { company_id: measurement_id(row.company_id), name: text(row.name, "Measurement name", 160), fields: fields(row.fields), units: units(row.units) };
  if (!input.fields.some((field) => field.is_active) || !input.units.some((unit) => unit.is_active)) invalid("Provide at least one active field and one active unit.");
  return input;
}
export function parse_update_measurement(value: unknown): UpdateMeasurementInput {
  const row = object(value, ["id", "name", "is_active", "fields", "units"]);
  if (Object.keys(row).filter((key) => key !== "id").length === 0) invalid("Provide at least one change.");
  return {
    id: measurement_id(row.id),
    ...(row.name !== undefined ? { name: text(row.name, "Measurement name", 160) } : {}),
    ...(row.is_active !== undefined ? { is_active: boolean(row.is_active, true) } : {}),
    ...(row.fields !== undefined ? { fields: fields(row.fields) } : {}),
    ...(row.units !== undefined ? { units: units(row.units) } : {}),
  };
}
