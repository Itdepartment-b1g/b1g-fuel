import type { Request, Response } from "express";
import { PRODUCT_TYPE_FILTER_OPTIONS } from "@/utils/management-filters";
import * as service from "@/server/services/product_type_service";
import { ProductTypeError } from "@/server/services/product_type_service";
import { parse_quick_filters, QuickFilterError } from "@/server/lib/quick-filters";
import { parsePagination, PaginationError } from "@/server/lib/pagination";
import { parse_sort, SortingError } from "@/server/lib/sorting";
import {
  PRODUCT_TYPE_SORT_FIELDS,
  type CreateProductTypeInput,
  type UpdateProductTypeInput,
} from "@/server/schema/product_type_schema";

export async function list_product_types(req: Request, res: Response) {
  try {
    const search = typeof req.query.search === "string" ? req.query.search : "";
    res.json(
      await service.list_product_types(
        parsePagination(req.query),
        search,
        parse_sort(req.query, PRODUCT_TYPE_SORT_FIELDS),
        res.locals.access,
        typeof req.query.company_id === "string"
          ? req.query.company_id
          : undefined,
        parse_quick_filters(req.query.filters, PRODUCT_TYPE_FILTER_OPTIONS),
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
    console.error("Product type request failed:", error);
    res.status(500).json({ error: "The product type request could not be completed." });
  }
}

export async function get_product_type_filter_options(_req: Request, res: Response) {
  try {
    res.json(await service.get_product_type_filter_options(res.locals.access));
  } catch (error) {
    console.error("Product type request failed:", error);
    res.status(500).json({ error: "The product type request could not be completed." });
  }
}

export async function get_product_type_options(_req: Request, res: Response) {
  try {
    res.json(await service.get_product_type_options(res.locals.access));
  } catch (error) {
    console.error("Product type request failed:", error);
    res.status(500).json({ error: "The product type request could not be completed." });
  }
}

export async function list_by_id_product_type(req: Request, res: Response) {
  try {
    res.json({
      product_type: await service.list_by_id_product_type(
        String(req.query.id),
        res.locals.access,
      ),
    });
  } catch (error) {
    if (error instanceof ProductTypeError && error.code === "not_found") {
      res.status(404).json({ error: error.message });
      return;
    }
    console.error("Product type request failed:", error);
    res.status(500).json({ error: "The product type request could not be completed." });
  }
}

export async function create_product_type(req: Request, res: Response) {
  try {
    res.status(201).json({
      product_type: await service.create_product_type(
        req.body as CreateProductTypeInput,
        res.locals.access,
      ),
    });
  } catch (error) {
    if (error instanceof ProductTypeError) {
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
      res.status(409).json({ error: "A product type name or key already exists." });
      return;
    }
    console.error("Product type request failed:", error);
    res.status(500).json({ error: "The product type request could not be completed." });
  }
}

export async function update_product_type(req: Request, res: Response) {
  try {
    res.json({
      product_type: await service.update_product_type(
        req.body as UpdateProductTypeInput,
        res.locals.access,
      ),
    });
  } catch (error) {
    if (error instanceof ProductTypeError) {
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
      res.status(409).json({ error: "A product type name or key already exists." });
      return;
    }
    console.error("Product type request failed:", error);
    res.status(500).json({ error: "The product type request could not be completed." });
  }
}

export async function delete_product_type(req: Request, res: Response) {
  try {
    const id = String(req.query.id);
    await service.delete_product_type(id, res.locals.access);
    res.json({ id, message: "Product type deleted." });
  } catch (error) {
    if (error instanceof ProductTypeError && error.code === "not_found") {
      res.status(404).json({ error: error.message });
      return;
    }
    if (error && typeof error === "object" && "code" in error && error.code === "P2003") {
      res.status(409).json({ error: "This product type is used by products and cannot be deleted." });
      return;
    }
    console.error("Product type request failed:", error);
    res.status(500).json({ error: "The product type request could not be completed." });
  }
}
