import type { Request, Response } from "express";
import { BRAND_FILTER_OPTIONS } from "@/utils/management-filters";
import * as service from "@/server/services/brands_service";
import { BrandError } from "@/server/services/brands_service";
import { parsePagination, PaginationError } from "@/server/lib/pagination";
import { parse_quick_filters, QuickFilterError } from "@/server/lib/quick-filters";
import { parse_sort, SortingError } from "@/server/lib/sorting";
import { BRAND_SORT_FIELDS, type CreateBrandInput, type UpdateBrandInput } from "@/server/schema/brands_schema";

const id_pattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function invalid(message: string): never { throw new BrandError("invalid_input", message); }
function object(value: unknown, allowed: string[]) {
  if (!value || typeof value !== "object" || Array.isArray(value)) invalid("Provide a JSON object.");
  const record = value as Record<string, unknown>;
  if (Object.keys(record).some((key) => !allowed.includes(key))) invalid("Unknown brand field.");
  return record;
}
function text(value: unknown, label: string, max: number) {
  if (typeof value !== "string" || !value.trim() || value.trim().length > max) invalid(`${label} must contain between 1 and ${max} characters.`);
  return value.trim();
}
function brand_id(value: unknown) {
  if (typeof value !== "string" || !id_pattern.test(value)) invalid("Provide a valid ID.");
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

function failure(res: Response, error: unknown) {
  if (error instanceof BrandError) {
    const status = { invalid_input: 400, not_found: 404, forbidden: 403, conflict: 409 }[error.code];
    res.status(status).json({ error: error.message });
  } else if (error instanceof PaginationError || error instanceof SortingError || error instanceof QuickFilterError) {
    res.status(400).json({ error: error.message });
  } else if (error && typeof error === "object" && "code" in error && error.code === "P2002") {
    res.status(409).json({ error: "A brand name already exists." });
  } else if (error && typeof error === "object" && "code" in error && error.code === "P2003") {
    res.status(400).json({ error: "Company not found." });
  } else {
    console.error("Brand request failed:", error);
    res.status(500).json({ error: "The brand request could not be completed." });
  }
}
function search_of(value: unknown) {
  if (typeof value !== "string" || value.length > 160) throw new BrandError("invalid_input", "Search must contain at most 160 characters.");
  return value.trim();
}
function optional_id(value: unknown) {
  return value === undefined ? undefined : brand_id(value);
}

export async function list_brands(req: Request, res: Response) {
  try {
    if (req.query.id !== undefined) {
      res.json({ brand: await service.get_brand(brand_id(req.query.id), res.locals.access) });
      return;
    }
    res.json(await service.list_brands(
      parsePagination(req.query),
      search_of(req.query.search ?? ""),
      parse_sort(req.query, BRAND_SORT_FIELDS),
      res.locals.access,
      optional_id(req.query.company_id),
      parse_quick_filters(req.query.filters, BRAND_FILTER_OPTIONS),
    ));
  } catch (error) { failure(res, error); }
}
export async function create_brand(req: Request, res: Response) {
  try {
    res.status(201).json({ brand: await service.create_brand(parse_create_brand(req.body), res.locals.access) });
  } catch (error) { failure(res, error); }
}
export async function update_brand(req: Request, res: Response) {
  try {
    res.json({ brand: await service.update_brand(parse_update_brand(req.body), res.locals.access) });
  } catch (error) { failure(res, error); }
}
export async function delete_brand(req: Request, res: Response) {
  try {
    const id = brand_id(req.query.id);
    await service.delete_brand(id, res.locals.access);
    res.json({ id, message: "Brand deleted." });
  } catch (error) { failure(res, error); }
}
export async function get_brand_filter_options(_req: Request, res: Response) {
  try { res.json(await service.get_brand_filter_options(res.locals.access)); }
  catch (error) { failure(res, error); }
}
export async function get_brand_options(_req: Request, res: Response) {
  try { res.json(await service.get_brand_options(res.locals.access)); }
  catch (error) { failure(res, error); }
}
