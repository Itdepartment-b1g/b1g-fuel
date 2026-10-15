import type { Request, Response } from "express";
import { MEASUREMENT_FILTER_OPTIONS } from "@/utils/management-filters";
import * as service from "@/server/services/measurements_service";
import { MeasurementError } from "@/server/services/measurements_service";
import { parse_quick_filters, QuickFilterError } from "@/server/lib/quick-filters";
import { parsePagination, PaginationError } from "@/server/lib/pagination";
import { parse_sort, SortingError } from "@/server/lib/sorting";
import {
  MEASUREMENT_SORT_FIELDS,
  type CreateMeasurementInput,
  type MeasurementUnitInput,
  type UpdateMeasurementInput,
} from "@/server/schema/measurements_schema";

const id_pattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function invalid(message: string): never { throw new MeasurementError("invalid_input", message); }
function object(value: unknown, allowed: string[]) {
  if (!value || typeof value !== "object" || Array.isArray(value)) invalid("Provide a JSON object.");
  const record = value as Record<string, unknown>;
  if (Object.keys(record).some((key) => !allowed.includes(key))) invalid("Unknown measurement field.");
  return record;
}
function text(value: unknown, label: string, max: number) {
  if (typeof value !== "string" || !value.trim() || value.trim().length > max) invalid(`${label} must contain between 1 and ${max} characters.`);
  return value.trim();
}
function measurement_id(value: unknown) {
  if (typeof value !== "string" || !id_pattern.test(value)) invalid("Provide a valid ID.");
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

function failure(res: Response, error: unknown) {
  if (error instanceof MeasurementError) {
    const status = {
      invalid_input: 400,
      not_found: 404,
      forbidden: 403,
      conflict: 409,
    }[error.code];
    res.status(status).json({ error: error.message });
  } else if (
    error instanceof PaginationError ||
    error instanceof SortingError ||
    error instanceof QuickFilterError
  ) {
    res.status(400).json({ error: error.message });
  } else if (
    error &&
    typeof error === "object" &&
    "code" in error &&
    error.code === "P2002"
  ) {
    res
      .status(409)
      .json({
        error: "A measurement name or unit symbol already exists.",
      });
  } else if (
    error &&
    typeof error === "object" &&
    "code" in error &&
    error.code === "P2003"
  ) {
    res.status(400).json({ error: "Company not found." });
  } else {
    console.error("Measurements request failed:", error);
    res
      .status(500)
      .json({ error: "The measurement request could not be completed." });
  }
}
export async function list_measurements(req: Request, res: Response) {
  try {
    if (req.query.id !== undefined) {
      res.json({
        measurement: await service.get_measurement(
          measurement_id(req.query.id),
          res.locals.access,
        ),
      });
      return;
    }
    const search = req.query.search ?? "";
    if (typeof search !== "string" || search.length > 160)
      throw new MeasurementError(
        "invalid_input",
        "Search must contain at most 160 characters.",
      );
    res.json(
      await service.list_measurements(
        parsePagination(req.query),
        search.trim(),
        parse_sort(req.query, MEASUREMENT_SORT_FIELDS),
        res.locals.access,
        req.query.company_id === undefined
          ? undefined
          : measurement_id(req.query.company_id),
        parse_quick_filters(req.query.filters, MEASUREMENT_FILTER_OPTIONS),
      ),
    );
  } catch (error) {
    failure(res, error);
  }
}
export async function get_measurement_filter_options(_req: Request, res: Response) {
  try {
    res.json(await service.get_measurement_filter_options(res.locals.access));
  } catch (error) {
    failure(res, error);
  }
}
export async function create_measurement(req: Request, res: Response) {
  try {
    res
      .status(201)
      .json({
        measurement: await service.create_measurement(
          parse_create_measurement(req.body),
          res.locals.access,
        ),
      });
  } catch (error) {
    failure(res, error);
  }
}
export async function update_measurement(req: Request, res: Response) {
  try {
    res.json({
      measurement: await service.update_measurement(
        parse_update_measurement(req.body),
        res.locals.access,
      ),
    });
  } catch (error) {
    failure(res, error);
  }
}
export async function delete_measurement(req: Request, res: Response) {
  try {
    const id = measurement_id(req.query.id);
    await service.delete_measurement(id, res.locals.access);
    res.json({ id, message: "Measurement deleted." });
  } catch (error) {
    failure(res, error);
  }
}

export async function get_measurement_options(_req: Request, res: Response) {
  try { res.json(await service.get_measurement_options(res.locals.access)); }
  catch (error) { failure(res, error); }
}
