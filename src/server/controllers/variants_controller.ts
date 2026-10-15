import type { Request, Response } from "express";
import * as service from "@/server/services/variants_service";
import { VariantError } from "@/server/services/variants_service";
import { parsePagination, PaginationError } from "@/server/lib/pagination";
import { parse_sort, SortingError } from "@/server/lib/sorting";
import { VARIANT_SORT_FIELDS, type CreateVariantInput, type UpdateVariantInput } from "@/server/schema/variants_schema";

export async function list_variants(req: Request, res: Response) {
  try {
    if (req.query.id !== undefined) {
      res.json({ variant: await service.get_variant(String(req.query.id), res.locals.access) });
      return;
    }
    const search = typeof req.query.search === "string" ? req.query.search : "";
    res.json(await service.list_variants(
      parsePagination(req.query),
      search,
      parse_sort(req.query, VARIANT_SORT_FIELDS),
      res.locals.access,
      typeof req.query.brand_id === "string" ? req.query.brand_id : undefined,
      typeof req.query.company_id === "string" ? req.query.company_id : undefined,
    ));
  } catch (error) {
    if (error instanceof VariantError) {
      const status = { invalid_input: 400, not_found: 404, forbidden: 403, conflict: 409 }[error.code];
      res.status(status).json({ error: error.message });
      return;
    }
    if (error instanceof PaginationError || error instanceof SortingError) {
      res.status(400).json({ error: error.message });
      return;
    }
    if (error && typeof error === "object" && "code" in error && error.code === "P2002") {
      res.status(409).json({ error: "A variant name already exists for this brand." });
      return;
    }
    if (error && typeof error === "object" && "code" in error && error.code === "P2003") {
      res.status(400).json({ error: "Brand not found." });
      return;
    }
    console.error("Variant request failed:", error);
    res.status(500).json({ error: "The variant request could not be completed." });
  }
}
export async function create_variant(req: Request, res: Response) {
  try {
    res.status(201).json({ variant: await service.create_variant(req.body as CreateVariantInput, res.locals.access) });
  } catch (error) {
    if (error instanceof VariantError) {
      const status = { invalid_input: 400, not_found: 404, forbidden: 403, conflict: 409 }[error.code];
      res.status(status).json({ error: error.message });
      return;
    }
    if (error instanceof PaginationError || error instanceof SortingError) {
      res.status(400).json({ error: error.message });
      return;
    }
    if (error && typeof error === "object" && "code" in error && error.code === "P2002") {
      res.status(409).json({ error: "A variant name already exists for this brand." });
      return;
    }
    if (error && typeof error === "object" && "code" in error && error.code === "P2003") {
      res.status(400).json({ error: "Brand not found." });
      return;
    }
    console.error("Variant request failed:", error);
    res.status(500).json({ error: "The variant request could not be completed." });
  }
}
export async function update_variant(req: Request, res: Response) {
  try {
    res.json({ variant: await service.update_variant(req.body as UpdateVariantInput, res.locals.access) });
  } catch (error) {
    if (error instanceof VariantError) {
      const status = { invalid_input: 400, not_found: 404, forbidden: 403, conflict: 409 }[error.code];
      res.status(status).json({ error: error.message });
      return;
    }
    if (error instanceof PaginationError || error instanceof SortingError) {
      res.status(400).json({ error: error.message });
      return;
    }
    if (error && typeof error === "object" && "code" in error && error.code === "P2002") {
      res.status(409).json({ error: "A variant name already exists for this brand." });
      return;
    }
    if (error && typeof error === "object" && "code" in error && error.code === "P2003") {
      res.status(400).json({ error: "Brand not found." });
      return;
    }
    console.error("Variant request failed:", error);
    res.status(500).json({ error: "The variant request could not be completed." });
  }
}
export async function delete_variant(req: Request, res: Response) {
  try {
    const id = String(req.query.id);
    await service.delete_variant(id, res.locals.access);
    res.json({ id, message: "Variant deleted." });
  } catch (error) {
    if (error instanceof VariantError) {
      const status = { invalid_input: 400, not_found: 404, forbidden: 403, conflict: 409 }[error.code];
      res.status(status).json({ error: error.message });
      return;
    }
    if (error instanceof PaginationError || error instanceof SortingError) {
      res.status(400).json({ error: error.message });
      return;
    }
    if (error && typeof error === "object" && "code" in error && error.code === "P2002") {
      res.status(409).json({ error: "A variant name already exists for this brand." });
      return;
    }
    if (error && typeof error === "object" && "code" in error && error.code === "P2003") {
      res.status(400).json({ error: "Brand not found." });
      return;
    }
    console.error("Variant request failed:", error);
    res.status(500).json({ error: "The variant request could not be completed." });
  }
}
export async function get_variant_options(_req: Request, res: Response) {
  try {
    res.json(await service.get_variant_options(res.locals.access));
  } catch (error) {
    if (error instanceof VariantError) {
      const status = { invalid_input: 400, not_found: 404, forbidden: 403, conflict: 409 }[error.code];
      res.status(status).json({ error: error.message });
      return;
    }
    console.error("Variant request failed:", error);
    res.status(500).json({ error: "The variant request could not be completed." });
  }
}
