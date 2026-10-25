import type { Request, Response } from "express";
import * as service from "@/server/services/inventory_service";
import { InventoryError } from "@/server/services/inventory_service";
import { parsePagination, PaginationError } from "@/server/lib/pagination";
import { parse_sort, SortingError } from "@/server/lib/sorting";
import { parse_quick_filters, QuickFilterError } from "@/server/lib/quick-filters";
import { INVENTORY_UUID, INVENTORY_SORT_FIELDS, STOCK_MOVEMENT_SORT_FIELDS, INVENTORY_BRAND_SORT_FIELDS, INVENTORY_HISTORY_SORT_FIELDS } from "@/server/schema/inventory_schema";
import { INVENTORY_FILTER_OPTIONS, INVENTORY_HISTORY_FILTER_OPTIONS } from "@/utils/inventory-filters";

export async function list_inventory(req: Request, res: Response) {
  try {
    if (req.query.search !== undefined && (typeof req.query.search !== "string" || req.query.search.length > 160))
      throw new InventoryError("invalid_input", "Search must be a string of at most 160 characters.");
    const filters = parse_quick_filters(req.query.filters, INVENTORY_FILTER_OPTIONS);
    if (filters?.conditions.some((row) => row.field && row.value.trim() && !INVENTORY_UUID.test(row.value.trim())))
      throw new InventoryError("invalid_input", "Provide valid inventory filter IDs.");
    const sorting = parse_sort(req.query.sort_order !== undefined && req.query.sort_by === undefined ? { ...req.query, sort_by: "updated_at" } : req.query, INVENTORY_SORT_FIELDS);
    res.status(200).json(await service.list_inventory(parsePagination(req.query), typeof req.query.search === "string" ? req.query.search : "", sorting, filters, res.locals.access));
  } catch (error) {
    if (error instanceof InventoryError || error instanceof PaginationError || error instanceof SortingError || error instanceof QuickFilterError) {
      res.status(400).json({ error: error.message });
      return;
    }
    console.error("Inventory request failed:", error);
    res.status(500).json({ error: "Inventory could not be loaded." });
  }
}

export async function list_by_id_inventory(req: Request, res: Response) {
  try {
    if (typeof req.query.id !== "string" || !INVENTORY_UUID.test(req.query.id))
      throw new InventoryError("invalid_input", "Provide a valid inventory ID.");
    res.status(200).json({ inventory: await service.list_by_id_inventory(req.query.id, res.locals.access) });
  } catch (error) {
    if (error instanceof InventoryError) {
      res.status(error.code === "not_found" ? 404 : 400).json({ error: error.message });
      return;
    }
    console.error("Inventory detail request failed:", error);
    res.status(500).json({ error: "Inventory could not be loaded." });
  }
}

export async function list_stock_movement(req: Request, res: Response) {
  try {
    if (typeof req.query.inventory_id !== "string" || !INVENTORY_UUID.test(req.query.inventory_id))
      throw new InventoryError("invalid_input", "Provide a valid inventory ID.");
    res.status(200).json(await service.list_stock_movement(req.query.inventory_id, parsePagination(req.query), parse_sort(req.query, STOCK_MOVEMENT_SORT_FIELDS), res.locals.access));
  } catch (error) {
    if (error instanceof InventoryError || error instanceof PaginationError || error instanceof SortingError) {
      res.status(error instanceof InventoryError && error.code === "not_found" ? 404 : 400).json({ error: error.message });
      return;
    }
    console.error("Stock movement request failed:", error);
    res.status(500).json({ error: "Stock movements could not be loaded." });
  }
}

export async function get_inventory_filter_option(_req: Request, res: Response) {
  try {
    res.status(200).json(await service.get_inventory_filter_option(res.locals.access));
  } catch (error) {
    console.error("Inventory filter request failed:", error);
    res.status(500).json({ error: "Inventory filter choices could not be loaded." });
  }
}

export async function list_inventory_brand(req: Request, res: Response) {
  try {
    if (req.query.search !== undefined && (typeof req.query.search !== "string" || req.query.search.length > 160))
      throw new InventoryError("invalid_input", "Search must be a string of at most 160 characters.");
    const filters = parse_quick_filters(req.query.filters, INVENTORY_FILTER_OPTIONS);
    if (filters?.conditions.some((row) => row.field && row.value.trim() && !INVENTORY_UUID.test(row.value.trim())))
      throw new InventoryError("invalid_input", "Provide valid inventory filter IDs.");
    const sorting = parse_sort({ ...req.query, sort_by: req.query.sort_by ?? "brand", sort_order: req.query.sort_order ?? "asc" }, INVENTORY_BRAND_SORT_FIELDS);
    res.status(200).json(await service.list_inventory_brand(parsePagination(req.query), typeof req.query.search === "string" ? req.query.search : "", filters, res.locals.access, sorting));
  } catch (error) {
    if (error instanceof InventoryError || error instanceof PaginationError || error instanceof QuickFilterError || error instanceof SortingError) {
      res.status(400).json({ error: error.message });
      return;
    }
    console.error("Inventory brand request failed:", error);
    res.status(500).json({ error: "Inventory brands could not be loaded." });
  }
}

export async function get_inventory_history(req: Request, res: Response) {
  try {
    if (typeof req.query.inventory_id !== "string" || !INVENTORY_UUID.test(req.query.inventory_id))
      throw new InventoryError("invalid_input", "Provide a valid inventory ID.");
    if (req.query.search !== undefined && (typeof req.query.search !== "string" || req.query.search.length > 160))
      throw new InventoryError("invalid_input", "Search must be a string of at most 160 characters.");
    res.status(200).json(await service.get_inventory_history(req.query.inventory_id, parsePagination(req.query), typeof req.query.search === "string" ? req.query.search : "", parse_quick_filters(req.query.filters, INVENTORY_HISTORY_FILTER_OPTIONS), res.locals.access, parse_sort(req.query, INVENTORY_HISTORY_SORT_FIELDS)));
  } catch (error) {
    if (error instanceof InventoryError || error instanceof PaginationError || error instanceof QuickFilterError || error instanceof SortingError) {
      res.status(error instanceof InventoryError && error.code === "not_found" ? 404 : 400).json({ error: error.message });
      return;
    }
    console.error("Inventory history request failed:", error);
    res.status(500).json({ error: "Inventory history could not be loaded." });
  }
}

export async function export_inventory_history(req: Request, res: Response) {
  try {
    if (typeof req.query.inventory_id !== "string" || !INVENTORY_UUID.test(req.query.inventory_id))
      throw new InventoryError("invalid_input", "Provide a valid inventory ID.");
    if (req.query.search !== undefined && (typeof req.query.search !== "string" || req.query.search.length > 160))
      throw new InventoryError("invalid_input", "Search must be a string of at most 160 characters.");
    const content = await service.export_inventory_history(req.query.inventory_id, typeof req.query.search === "string" ? req.query.search : "", parse_quick_filters(req.query.filters, INVENTORY_HISTORY_FILTER_OPTIONS), res.locals.access, parse_sort(req.query, INVENTORY_HISTORY_SORT_FIELDS));
    res.status(200).set({ "Content-Type": "application/vnd.ms-excel; charset=utf-8", "Content-Disposition": 'attachment; filename="stock-movements.xml"' }).send(content);
  } catch (error) {
    if (error instanceof InventoryError || error instanceof QuickFilterError || error instanceof SortingError) {
      res.status(error instanceof InventoryError && error.code === "not_found" ? 404 : 400).json({ error: error.message });
      return;
    }
    console.error("Inventory export request failed:", error);
    res.status(500).json({ error: "Inventory history could not be exported." });
  }
}
