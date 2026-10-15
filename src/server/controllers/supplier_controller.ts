import type { Request, Response } from "express";
import { SUPPLIER_FILTER_OPTIONS } from "@/utils/management-filters";
import * as service from "@/server/services/supplier_service";
import { SupplierError } from "@/server/services/supplier_service";
import { parse_quick_filters, QuickFilterError } from "@/server/lib/quick-filters";
import { parsePagination, PaginationError } from "@/server/lib/pagination";
import { parse_sort, SortingError } from "@/server/lib/sorting";
import { SUPPLIER_SORT_FIELDS, type CreateSupplierInput, type UpdateSupplierInput } from "@/server/schema/supplier_schema";

export async function list_suppliers(req: Request, res: Response) {
  try {
    const search = typeof req.query.search === "string" ? req.query.search : "";
    res.json(await service.list_suppliers(
      parsePagination(req.query),
      search,
      parse_sort(req.query, SUPPLIER_SORT_FIELDS),
      res.locals.access,
      typeof req.query.company_id === "string" ? req.query.company_id : undefined,
      parse_quick_filters(req.query.filters, SUPPLIER_FILTER_OPTIONS),
    ));
  } catch (error) {
    if (error instanceof PaginationError || error instanceof SortingError || error instanceof QuickFilterError) {
      res.status(400).json({ error: error.message });
      return;
    }
    console.error("Supplier request failed:", error);
    res.status(500).json({ error: "The supplier request could not be completed." });
  }
}

export async function get_supplier_filter_options(_req: Request, res: Response) {
  try {
    res.json(await service.get_supplier_filter_options(res.locals.access));
  } catch (error) {
    console.error("Supplier request failed:", error);
    res.status(500).json({ error: "The supplier request could not be completed." });
  }
}

export async function get_supplier_options(_req: Request, res: Response) {
  try {
    res.json(await service.get_supplier_options(res.locals.access));
  } catch (error) {
    console.error("Supplier request failed:", error);
    res.status(500).json({ error: "The supplier request could not be completed." });
  }
}

export async function list_by_id_supplier(req: Request, res: Response) {
  try {
    res.json({ supplier: await service.list_by_id_supplier(String(req.query.id), res.locals.access) });
  } catch (error) {
    if (error instanceof SupplierError && error.code === "not_found") {
      res.status(404).json({ error: error.message });
      return;
    }
    console.error("Supplier request failed:", error);
    res.status(500).json({ error: "The supplier request could not be completed." });
  }
}

export async function create_supplier(req: Request, res: Response) {
  try {
    res.status(201).json({ supplier: await service.create_supplier(req.body as CreateSupplierInput, res.locals.access) });
  } catch (error) {
    if (error instanceof SupplierError) {
      const status = { invalid_input: 400, not_found: 404, forbidden: 403, conflict: 409 }[error.code];
      res.status(status).json({ error: error.message });
      return;
    }
    if (error && typeof error === "object" && "code" in error && error.code === "P2002") {
      res.status(409).json({ error: "A supplier name already exists." });
      return;
    }
    console.error("Supplier request failed:", error);
    res.status(500).json({ error: "The supplier request could not be completed." });
  }
}

export async function update_supplier(req: Request, res: Response) {
  try {
    res.json({ supplier: await service.update_supplier(req.body as UpdateSupplierInput, res.locals.access) });
  } catch (error) {
    if (error instanceof SupplierError && error.code === "not_found") {
      res.status(404).json({ error: error.message });
      return;
    }
    if (error && typeof error === "object" && "code" in error && error.code === "P2002") {
      res.status(409).json({ error: "A supplier name already exists." });
      return;
    }
    console.error("Supplier request failed:", error);
    res.status(500).json({ error: "The supplier request could not be completed." });
  }
}

export async function delete_supplier(req: Request, res: Response) {
  try {
    const id = String(req.query.id);
    await service.delete_supplier(id, res.locals.access);
    res.json({ id, message: "Supplier deleted." });
  } catch (error) {
    if (error instanceof SupplierError && error.code === "not_found") {
      res.status(404).json({ error: error.message });
      return;
    }
    console.error("Supplier request failed:", error);
    res.status(500).json({ error: "The supplier request could not be completed." });
  }
}