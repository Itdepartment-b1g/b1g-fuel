import type { Request, Response } from "express";
import * as service from "@/server/services/variants_service";
import { VariantError } from "@/server/services/variants_service";
import { parsePagination, PaginationError } from "@/server/lib/pagination";
import { parse_sort, SortingError } from "@/server/lib/sorting";
import { VARIANT_SORT_FIELDS, type CreateVariantInput, type UpdateVariantInput } from "@/server/schema/variants_schema";

const id_pattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function invalid(message: string): never { throw new VariantError("invalid_input", message); }
function object(value: unknown, allowed: string[]) {
  if (!value || typeof value !== "object" || Array.isArray(value)) invalid("Provide a JSON object.");
  const record = value as Record<string, unknown>;
  if (Object.keys(record).some((key) => !allowed.includes(key))) invalid("Unknown variant field.");
  return record;
}
function text(value: unknown, label: string, max: number) {
  if (typeof value !== "string" || !value.trim() || value.trim().length > max) invalid(`${label} must contain between 1 and ${max} characters.`);
  return value.trim();
}
function variant_id(value: unknown) {
  if (typeof value !== "string" || !id_pattern.test(value)) invalid("Provide a valid ID.");
  return value.toLowerCase();
}
function optional_company(value: unknown) {
  if (value === undefined || value === null || value === "") return undefined;
  return variant_id(value);
}
export function parse_create_variant(value: unknown): CreateVariantInput {
  const row = object(value, ["brand_id", "company_id", "name"]);
  const company_id = optional_company(row.company_id);
  return { brand_id: variant_id(row.brand_id), ...(company_id ? { company_id } : {}), name: text(row.name, "Variant name", 160) };
}
export function parse_update_variant(value: unknown): UpdateVariantInput {
  const row = object(value, ["id", "name"]);
  if (row.name === undefined) invalid("Provide at least one change.");
  return { id: variant_id(row.id), name: text(row.name, "Variant name", 160) };
}

function failure(res: Response, error: unknown) {
  if (error instanceof VariantError) {
    const status = { invalid_input: 400, not_found: 404, forbidden: 403, conflict: 409 }[error.code];
    res.status(status).json({ error: error.message });
  } else if (error instanceof PaginationError || error instanceof SortingError) {
    res.status(400).json({ error: error.message });
  } else if (error && typeof error === "object" && "code" in error && error.code === "P2002") {
    res.status(409).json({ error: "A variant name already exists for this brand." });
  } else if (error && typeof error === "object" && "code" in error && error.code === "P2003") {
    res.status(400).json({ error: "Brand not found." });
  } else {
    console.error("Variant request failed:", error);
    res.status(500).json({ error: "The variant request could not be completed." });
  }
}
function search_of(value: unknown) {
  if (typeof value !== "string" || value.length > 160) throw new VariantError("invalid_input", "Search must contain at most 160 characters.");
  return value.trim();
}
function optional_id(value: unknown) {
  return value === undefined ? undefined : variant_id(value);
}

export async function list_variants(req: Request, res: Response) {
  try {
    if (req.query.id !== undefined) {
      res.json({ variant: await service.get_variant(variant_id(req.query.id), res.locals.access) });
      return;
    }
    res.json(await service.list_variants(
      parsePagination(req.query),
      search_of(req.query.search ?? ""),
      parse_sort(req.query, VARIANT_SORT_FIELDS),
      res.locals.access,
      optional_id(req.query.brand_id),
      optional_id(req.query.company_id),
    ));
  } catch (error) { failure(res, error); }
}
export async function create_variant(req: Request, res: Response) {
  try {
    res.status(201).json({ variant: await service.create_variant(parse_create_variant(req.body), res.locals.access) });
  } catch (error) { failure(res, error); }
}
export async function update_variant(req: Request, res: Response) {
  try {
    res.json({ variant: await service.update_variant(parse_update_variant(req.body), res.locals.access) });
  } catch (error) { failure(res, error); }
}
export async function delete_variant(req: Request, res: Response) {
  try {
    const id = variant_id(req.query.id);
    await service.delete_variant(id, res.locals.access);
    res.json({ id, message: "Variant deleted." });
  } catch (error) { failure(res, error); }
}
export async function get_variant_options(_req: Request, res: Response) {
  try { res.json(await service.get_variant_options(res.locals.access)); }
  catch (error) { failure(res, error); }
}
