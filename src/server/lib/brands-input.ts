import type { CreateBrandInput, UpdateBrandInput } from "@/server/schema/brands_schema";

export class BrandError extends Error {
  constructor(public code: "invalid_input" | "not_found" | "forbidden" | "conflict", message: string) { super(message); }
}
function invalid(message: string): never { throw new BrandError("invalid_input", message); }
function object(value: unknown, allowed: string[]): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) invalid("Provide a JSON object.");
  const record = value as Record<string, unknown>;
  if (Object.keys(record).some((key) => !allowed.includes(key))) invalid("Unknown brand field.");
  return record;
}
function text(value: unknown, label: string, max: number) {
  if (typeof value !== "string" || !value.trim() || value.trim().length > max) invalid(`${label} must contain between 1 and ${max} characters.`);
  return value.trim();
}
export function brand_id(value: unknown) {
  if (typeof value !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)) invalid("Provide a valid ID.");
  return value.toLowerCase();
}
function optional_company(value: unknown) {
  if (value === undefined || value === null || value === "") return undefined;
  return brand_id(value);
}
export function parse_create_brand(value: unknown): CreateBrandInput {
  const row = object(value, ["company_id", "name"]);
  const company_id = optional_company(row.company_id);
  return { ...(company_id ? { company_id } : {}), name: text(row.name, "Brand name", 160) };
}
export function parse_update_brand(value: unknown): UpdateBrandInput {
  const row = object(value, ["id", "name"]);
  if (row.name === undefined) invalid("Provide at least one change.");
  return { id: brand_id(row.id), name: text(row.name, "Brand name", 160) };
}
