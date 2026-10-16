import type { Request, Response } from "express";
import { PRODUCT_FILTER_OPTIONS } from "@/utils/management-filters";
import * as service from "@/server/services/product_service";
import { ProductError } from "@/server/services/product_service";
import { parse_quick_filters, QuickFilterError } from "@/server/lib/quick-filters";
import { parsePagination, PaginationError } from "@/server/lib/pagination";
import { parse_sort, SortingError } from "@/server/lib/sorting";
import {
  PRODUCT_SORT_FIELDS,
  type CreateProductInput,
  type UpdateProductInput,
} from "@/server/schema/product_schema";

export async function list_products(req: Request, res: Response) {
  try {
    const search = typeof req.query.search === "string" ? req.query.search : "";
    res.json(
      await service.list_products(
        parsePagination(req.query),
        search,
        parse_sort(req.query, PRODUCT_SORT_FIELDS),
        res.locals.access,
        typeof req.query.company_id === "string"
          ? req.query.company_id
          : undefined,
        parse_quick_filters(req.query.filters, PRODUCT_FILTER_OPTIONS),
      ),
    );
  } catch (error) {
    if (
      error instanceof PaginationError ||
      error instanceof SortingError ||
      error instanceof QuickFilterError
    ) {
      res.status(400).json({ error: error.message });
      return;
    }
    console.error("Product request failed:", error);
    res.status(500).json({ error: "The product request could not be completed." });
  }
}

export async function get_product_filter_options(_req: Request, res: Response) {
  try {
    res.json(await service.get_product_filter_options(res.locals.access));
  } catch (error) {
    console.error("Product request failed:", error);
    res.status(500).json({ error: "The product request could not be completed." });
  }
}

export async function get_product_options(_req: Request, res: Response) {
  try {
    res.json(await service.get_product_options(res.locals.access));
  } catch (error) {
    console.error("Product request failed:", error);
    res.status(500).json({ error: "The product request could not be completed." });
  }
}

export async function list_by_id_product(req: Request, res: Response) {
  try {
    res.json({
      product: await service.list_by_id_product(
        String(req.query.id),
        res.locals.access,
      ),
    });
  } catch (error) {
    if (error instanceof ProductError && error.code === "not_found") {
      res.status(404).json({ error: error.message });
      return;
    }
    console.error("Product request failed:", error);
    res.status(500).json({ error: "The product request could not be completed." });
  }
}

export async function create_product(req: Request, res: Response) {
  try {
    res.status(201).json({
      product: await service.create_product(
        req.body as CreateProductInput,
        res.locals.access,
      ),
    });
  } catch (error) {
    if (error instanceof ProductError) {
      const status = {
        invalid_input: 400,
        not_found: 404,
        forbidden: 403,
        conflict: 409,
      }[error.code];
      res.status(status).json({ error: error.message });
      return;
    }
    if (error && typeof error === "object" && "code" in error && error.code === "P2002") {
      res.status(409).json({
        error: "A product with this variant and type already exists for the company.",
      });
      return;
    }
    if (error && typeof error === "object" && "code" in error && error.code === "P2003") {
      res.status(400).json({ error: "A related company, variant, unit, or type is missing." });
      return;
    }
    console.error("Product request failed:", error);
    res.status(500).json({ error: "The product request could not be completed." });
  }
}

export async function update_product(req: Request, res: Response) {
  try {
    res.json({
      product: await service.update_product(
        req.body as UpdateProductInput,
        res.locals.access,
      ),
    });
  } catch (error) {
    if (error instanceof ProductError) {
      const status = {
        invalid_input: 400,
        not_found: 404,
        forbidden: 403,
        conflict: 409,
      }[error.code];
      res.status(status).json({ error: error.message });
      return;
    }
    if (error && typeof error === "object" && "code" in error && error.code === "P2002") {
      res.status(409).json({
        error: "A product with this variant and type already exists for the company.",
      });
      return;
    }
    console.error("Product request failed:", error);
    res.status(500).json({ error: "The product request could not be completed." });
  }
}

export async function delete_product(req: Request, res: Response) {
  try {
    const id = String(req.query.id);
    await service.delete_product(id, res.locals.access);
    res.json({ id, message: "Product deleted." });
  } catch (error) {
    if (error instanceof ProductError && error.code === "not_found") {
      res.status(404).json({ error: error.message });
      return;
    }
    console.error("Product request failed:", error);
    res.status(500).json({ error: "The product request could not be completed." });
  }
}
