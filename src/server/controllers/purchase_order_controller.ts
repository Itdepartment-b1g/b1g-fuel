import type { Request, Response } from "express";
import { PURCHASE_ORDER_FILTER_OPTIONS } from "@/utils/management-filters";
import * as service from "@/server/services/purchase_order_service";
import { PurchaseOrderError } from "@/server/services/purchase_order_service";
import { parse_quick_filters, QuickFilterError } from "@/server/lib/quick-filters";
import { parsePagination, PaginationError } from "@/server/lib/pagination";
import { parse_sort, SortingError } from "@/server/lib/sorting";
import {
  PURCHASE_ORDER_SORT_FIELDS,
  type CreatePurchaseOrderInput,
  type UpdatePurchaseOrderInput,
} from "@/server/schema/purchase_order_schema";

function fail(res: Response, error: unknown) {
  if (
    error instanceof PaginationError ||
    error instanceof SortingError ||
    error instanceof QuickFilterError
  ) {
    res.status(400).json({ error: error.message });
    return;
  }
  if (error instanceof PurchaseOrderError) {
    const status = {
      invalid_input: 400,
      not_found: 404,
      forbidden: 403,
      conflict: 409,
    }[error.code];
    res.status(status).json({ error: error.message });
    return;
  }
  console.error("Purchase order request failed:", error);
  res.status(500).json({ error: "The purchase order request could not be completed." });
}

export async function list_purchase_orders(req: Request, res: Response) {
  try {
    const search = typeof req.query.search === "string" ? req.query.search : "";
    res.json(
      await service.list_purchase_orders(
        parsePagination(req.query),
        search,
        parse_sort(req.query, PURCHASE_ORDER_SORT_FIELDS),
        res.locals.access,
        parse_quick_filters(req.query.filters, PURCHASE_ORDER_FILTER_OPTIONS),
      ),
    );
  } catch (error) {
    fail(res, error);
  }
}

export async function get_purchase_order_filter_options(_req: Request, res: Response) {
  try {
    res.json(await service.get_purchase_order_filter_options(res.locals.access));
  } catch (error) {
    fail(res, error);
  }
}

export async function get_purchase_order_options(_req: Request, res: Response) {
  try {
    res.json(await service.get_purchase_order_options(res.locals.access));
  } catch (error) {
    fail(res, error);
  }
}

export async function list_by_id_purchase_order(req: Request, res: Response) {
  try {
    res.json({
      purchase_order: await service.list_by_id_purchase_order(
        String(req.query.id),
        res.locals.access,
      ),
    });
  } catch (error) {
    fail(res, error);
  }
}

export async function create_purchase_order(req: Request, res: Response) {
  try {
    res.status(201).json({
      purchase_order: await service.create_purchase_order(
        req.body as CreatePurchaseOrderInput,
        res.locals.access,
      ),
    });
  } catch (error) {
    fail(res, error);
  }
}

export async function update_purchase_order(req: Request, res: Response) {
  try {
    res.json({
      purchase_order: await service.update_purchase_order(
        req.body as UpdatePurchaseOrderInput,
        res.locals.access,
      ),
    });
  } catch (error) {
    fail(res, error);
  }
}

export async function confirm_purchase_order(req: Request, res: Response) {
  try {
    res.json({
      purchase_order: await service.confirm_purchase_order(
        String(req.body?.id),
        res.locals.access,
      ),
    });
  } catch (error) {
    fail(res, error);
  }
}

export async function close_purchase_order(req: Request, res: Response) {
  try {
    res.json({
      purchase_order: await service.close_purchase_order(
        String(req.body?.id),
        res.locals.access,
      ),
    });
  } catch (error) {
    fail(res, error);
  }
}

export async function delete_purchase_order(req: Request, res: Response) {
  try {
    const id = String(req.query.id);
    await service.delete_purchase_order(id, res.locals.access);
    res.json({ id, message: "Purchase order deleted." });
  } catch (error) {
    fail(res, error);
  }
}
