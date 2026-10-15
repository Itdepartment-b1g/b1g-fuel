import type { Request, Response } from "express";
import { BRAND_FILTER_OPTIONS } from "@/utils/management-filters";
import * as service from "@/server/services/brands_service";
import { BrandError } from "@/server/services/brands_service";
import { parsePagination, PaginationError } from "@/server/lib/pagination";
import { parse_quick_filters, QuickFilterError } from "@/server/lib/quick-filters";
import { parse_sort, SortingError } from "@/server/lib/sorting";
import { BRAND_SORT_FIELDS, type CreateBrandInput, type UpdateBrandInput } from "@/server/schema/brands_schema";

export async function list_brands(req: Request, res: Response) {
  try {
    if (req.query.id !== undefined) {
      res.json({ brand: await service.get_brand(String(req.query.id), res.locals.access) });
      return;
    }
    const search = typeof req.query.search === "string" ? req.query.search : "";
    res.json(await service.list_brands(
      parsePagination(req.query),
      search,
      parse_sort(req.query, BRAND_SORT_FIELDS),
      res.locals.access,
      typeof req.query.company_id === "string" ? req.query.company_id : undefined,
      parse_quick_filters(req.query.filters, BRAND_FILTER_OPTIONS),
    ));
  } catch (error) {
    if (error instanceof BrandError) {
      const status = { invalid_input: 400, not_found: 404, forbidden: 403, conflict: 409 }[error.code];
      res.status(status).json({ error: error.message });
      return;
    }
    if (error instanceof PaginationError || error instanceof SortingError || error instanceof QuickFilterError) {
      res.status(400).json({ error: error.message });
      return;
    }
    if (error && typeof error === "object" && "code" in error && error.code === "P2002") {
      res.status(409).json({ error: "A brand name already exists." });
      return;
    }
    if (error && typeof error === "object" && "code" in error && error.code === "P2003") {
      res.status(400).json({ error: "Company not found." });
      return;
    }
    console.error("Brand request failed:", error);
    res.status(500).json({ error: "The brand request could not be completed." });
  }
}
export async function create_brand(req: Request, res: Response) {
  try {
    res.status(201).json({ brand: await service.create_brand(req.body as CreateBrandInput, res.locals.access) });
  } catch (error) {
    if (error instanceof BrandError) {
      const status = { invalid_input: 400, not_found: 404, forbidden: 403, conflict: 409 }[error.code];
      res.status(status).json({ error: error.message });
      return;
    }
    if (error instanceof PaginationError || error instanceof SortingError || error instanceof QuickFilterError) {
      res.status(400).json({ error: error.message });
      return;
    }
    if (error && typeof error === "object" && "code" in error && error.code === "P2002") {
      res.status(409).json({ error: "A brand name already exists." });
      return;
    }
    if (error && typeof error === "object" && "code" in error && error.code === "P2003") {
      res.status(400).json({ error: "Company not found." });
      return;
    }
    console.error("Brand request failed:", error);
    res.status(500).json({ error: "The brand request could not be completed." });
  }
}
export async function update_brand(req: Request, res: Response) {
  try {
    res.json({ brand: await service.update_brand(req.body as UpdateBrandInput, res.locals.access) });
  } catch (error) {
    if (error instanceof BrandError) {
      const status = { invalid_input: 400, not_found: 404, forbidden: 403, conflict: 409 }[error.code];
      res.status(status).json({ error: error.message });
      return;
    }
    if (error instanceof PaginationError || error instanceof SortingError || error instanceof QuickFilterError) {
      res.status(400).json({ error: error.message });
      return;
    }
    if (error && typeof error === "object" && "code" in error && error.code === "P2002") {
      res.status(409).json({ error: "A brand name already exists." });
      return;
    }
    if (error && typeof error === "object" && "code" in error && error.code === "P2003") {
      res.status(400).json({ error: "Company not found." });
      return;
    }
    console.error("Brand request failed:", error);
    res.status(500).json({ error: "The brand request could not be completed." });
  }
}
export async function delete_brand(req: Request, res: Response) {
  try {
    const id = String(req.query.id);
    await service.delete_brand(id, res.locals.access);
    res.json({ id, message: "Brand deleted." });
  } catch (error) {
    if (error instanceof BrandError) {
      const status = { invalid_input: 400, not_found: 404, forbidden: 403, conflict: 409 }[error.code];
      res.status(status).json({ error: error.message });
      return;
    }
    if (error instanceof PaginationError || error instanceof SortingError || error instanceof QuickFilterError) {
      res.status(400).json({ error: error.message });
      return;
    }
    if (error && typeof error === "object" && "code" in error && error.code === "P2002") {
      res.status(409).json({ error: "A brand name already exists." });
      return;
    }
    if (error && typeof error === "object" && "code" in error && error.code === "P2003") {
      res.status(400).json({ error: "Company not found." });
      return;
    }
    console.error("Brand request failed:", error);
    res.status(500).json({ error: "The brand request could not be completed." });
  }
}
export async function get_brand_filter_options(_req: Request, res: Response) {
  try {
    res.json(await service.get_brand_filter_options(res.locals.access));
  } catch (error) {
    if (error instanceof BrandError) {
      const status = { invalid_input: 400, not_found: 404, forbidden: 403, conflict: 409 }[error.code];
      res.status(status).json({ error: error.message });
      return;
    }
    console.error("Brand request failed:", error);
    res.status(500).json({ error: "The brand request could not be completed." });
  }
}
export async function get_brand_options(_req: Request, res: Response) {
  try {
    res.json(await service.get_brand_options(res.locals.access));
  } catch (error) {
    if (error instanceof BrandError) {
      const status = { invalid_input: 400, not_found: 404, forbidden: 403, conflict: 409 }[error.code];
      res.status(status).json({ error: error.message });
      return;
    }
    console.error("Brand request failed:", error);
    res.status(500).json({ error: "The brand request could not be completed." });
  }
}
