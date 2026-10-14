import type { Request, Response } from "express";
import * as service from "@/server/services/measurements_service";
import {
  MeasurementError,
  measurement_id,
  parse_create_measurement,
  parse_update_measurement,
} from "@/server/lib/measurement-input";
import { parsePagination, PaginationError } from "@/server/lib/pagination";
import { parse_sort, SortingError } from "@/server/lib/sorting";
import { MEASUREMENT_SORT_FIELDS } from "@/server/schema/measurements_schema";

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
    error instanceof SortingError
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
        error: "A measurement name, field key, or unit symbol already exists.",
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
    const active = req.query.is_active;
    if (active !== undefined && active !== "true" && active !== "false")
      throw new MeasurementError(
        "invalid_input",
        "is_active must be true or false.",
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
        active === undefined ? undefined : active === "true",
      ),
    );
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
export async function archive_measurement(req: Request, res: Response) {
  try {
    const id = measurement_id(req.query.id);
    await service.archive_measurement(id, res.locals.access);
    res.json({ id, message: "Measurement archived." });
  } catch (error) {
    failure(res, error);
  }
}

export async function get_measurement_options(_req: Request, res: Response) {
  try { res.json(await service.get_measurement_options(res.locals.access)); }
  catch (error) { failure(res, error); }
}
