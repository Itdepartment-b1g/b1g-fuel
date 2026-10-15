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
  type UpdateMeasurementInput,
} from "@/server/schema/measurements_schema";

export async function list_measurements(req: Request, res: Response) {
  try {
    if (req.query.id !== undefined) {
      res.json({
        measurement: await service.get_measurement(
          String(req.query.id),
          res.locals.access,
        ),
      });
      return;
    }
    const search = typeof req.query.search === "string" ? req.query.search : "";
    res.json(
      await service.list_measurements(
        parsePagination(req.query),
        search,
        parse_sort(req.query, MEASUREMENT_SORT_FIELDS),
        res.locals.access,
        typeof req.query.company_id === "string" ? req.query.company_id : undefined,
        parse_quick_filters(req.query.filters, MEASUREMENT_FILTER_OPTIONS),
      ),
    );
  } catch (error) {
    if (error instanceof MeasurementError) {
      const status = { invalid_input: 400, not_found: 404, forbidden: 403, conflict: 409 }[error.code];
      res.status(status).json({ error: error.message });
      return;
    }
    if (error instanceof PaginationError || error instanceof SortingError || error instanceof QuickFilterError) {
      res.status(400).json({ error: error.message });
      return;
    }
    if (error && typeof error === "object" && "code" in error && error.code === "P2002") {
      res.status(409).json({ error: "A measurement name or unit symbol already exists." });
      return;
    }
    if (error && typeof error === "object" && "code" in error && error.code === "P2003") {
      res.status(400).json({ error: "Company not found." });
      return;
    }
    console.error("Measurements request failed:", error);
    res.status(500).json({ error: "The measurement request could not be completed." });
  }
}
export async function get_measurement_filter_options(_req: Request, res: Response) {
  try {
    res.json(await service.get_measurement_filter_options(res.locals.access));
  } catch (error) {
    if (error instanceof MeasurementError) {
      const status = { invalid_input: 400, not_found: 404, forbidden: 403, conflict: 409 }[error.code];
      res.status(status).json({ error: error.message });
      return;
    }
    if (error instanceof PaginationError || error instanceof SortingError || error instanceof QuickFilterError) {
      res.status(400).json({ error: error.message });
      return;
    }
    if (error && typeof error === "object" && "code" in error && error.code === "P2002") {
      res.status(409).json({ error: "A measurement name or unit symbol already exists." });
      return;
    }
    if (error && typeof error === "object" && "code" in error && error.code === "P2003") {
      res.status(400).json({ error: "Company not found." });
      return;
    }
    console.error("Measurements request failed:", error);
    res.status(500).json({ error: "The measurement request could not be completed." });
  }
}
export async function create_measurement(req: Request, res: Response) {
  try {
    res
      .status(201)
      .json({
        measurement: await service.create_measurement(
          req.body as CreateMeasurementInput,
          res.locals.access,
        ),
      });
  } catch (error) {
    if (error instanceof MeasurementError) {
      const status = { invalid_input: 400, not_found: 404, forbidden: 403, conflict: 409 }[error.code];
      res.status(status).json({ error: error.message });
      return;
    }
    if (error instanceof PaginationError || error instanceof SortingError || error instanceof QuickFilterError) {
      res.status(400).json({ error: error.message });
      return;
    }
    if (error && typeof error === "object" && "code" in error && error.code === "P2002") {
      res.status(409).json({ error: "A measurement name or unit symbol already exists." });
      return;
    }
    if (error && typeof error === "object" && "code" in error && error.code === "P2003") {
      res.status(400).json({ error: "Company not found." });
      return;
    }
    console.error("Measurements request failed:", error);
    res.status(500).json({ error: "The measurement request could not be completed." });
  }
}
export async function update_measurement(req: Request, res: Response) {
  try {
    res.json({
      measurement: await service.update_measurement(
        req.body as UpdateMeasurementInput,
        res.locals.access,
      ),
    });
  } catch (error) {
    if (error instanceof MeasurementError) {
      const status = { invalid_input: 400, not_found: 404, forbidden: 403, conflict: 409 }[error.code];
      res.status(status).json({ error: error.message });
      return;
    }
    if (error instanceof PaginationError || error instanceof SortingError || error instanceof QuickFilterError) {
      res.status(400).json({ error: error.message });
      return;
    }
    if (error && typeof error === "object" && "code" in error && error.code === "P2002") {
      res.status(409).json({ error: "A measurement name or unit symbol already exists." });
      return;
    }
    if (error && typeof error === "object" && "code" in error && error.code === "P2003") {
      res.status(400).json({ error: "Company not found." });
      return;
    }
    console.error("Measurements request failed:", error);
    res.status(500).json({ error: "The measurement request could not be completed." });
  }
}
export async function delete_measurement(req: Request, res: Response) {
  try {
    const id = String(req.query.id);
    await service.delete_measurement(id, res.locals.access);
    res.json({ id, message: "Measurement deleted." });
  } catch (error) {
    if (error instanceof MeasurementError) {
      const status = { invalid_input: 400, not_found: 404, forbidden: 403, conflict: 409 }[error.code];
      res.status(status).json({ error: error.message });
      return;
    }
    if (error instanceof PaginationError || error instanceof SortingError || error instanceof QuickFilterError) {
      res.status(400).json({ error: error.message });
      return;
    }
    if (error && typeof error === "object" && "code" in error && error.code === "P2002") {
      res.status(409).json({ error: "A measurement name or unit symbol already exists." });
      return;
    }
    if (error && typeof error === "object" && "code" in error && error.code === "P2003") {
      res.status(400).json({ error: "Company not found." });
      return;
    }
    console.error("Measurements request failed:", error);
    res.status(500).json({ error: "The measurement request could not be completed." });
  }
}

export async function get_measurement_options(_req: Request, res: Response) {
  try {
    res.json(await service.get_measurement_options(res.locals.access));
  } catch (error) {
    if (error instanceof MeasurementError) {
      const status = { invalid_input: 400, not_found: 404, forbidden: 403, conflict: 409 }[error.code];
      res.status(status).json({ error: error.message });
      return;
    }
    console.error("Measurements request failed:", error);
    res.status(500).json({ error: "The measurement request could not be completed." });
  }
}
