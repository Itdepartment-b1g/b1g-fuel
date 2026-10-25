import type { Request, Response } from "express";
import { RECEIVING_FILTER_OPTIONS } from "@/utils/management-filters";
import * as service from "@/server/services/receiving_service";
import { ReceivingError } from "@/server/services/receiving_service";
import { parse_quick_filters, QuickFilterError } from "@/server/lib/quick-filters";
import { parsePagination, PaginationError } from "@/server/lib/pagination";
import { parse_sort, SortingError } from "@/server/lib/sorting";
import { RECEIVING_UUID, RECEIVING_SORT_FIELDS, type CreateReceivingInput, type UpdateReceivingInput } from "@/server/schema/receiving_schema";

function fail(res: Response, error: unknown) {
  if (error instanceof PaginationError || error instanceof SortingError || error instanceof QuickFilterError) {
    res.status(400).json({ error: error.message });
    return;
  }
  if (error instanceof ReceivingError) {
    const status = { invalid_input: 400, not_found: 404, forbidden: 403, conflict: 409 }[error.code];
    res.status(status).json({ error: error.message });
    return;
  }
  console.error("Receiving request failed:", error);
  res.status(500).json({ error: "The receiving request could not be completed." });
}

export async function list_receivings(req: Request, res: Response) {
  try {
    const search = typeof req.query.search === "string" ? req.query.search : "";
    res.json(
      await service.list_receivings(
        parsePagination(req.query),
        search,
        parse_sort(req.query, RECEIVING_SORT_FIELDS),
        res.locals.access,
        parse_quick_filters(req.query.filters, RECEIVING_FILTER_OPTIONS),
      ),
    );
  } catch (error) {
    fail(res, error);
  }
}

export async function get_receiving_filter_options(_req: Request, res: Response) {
  try {
    res.json(await service.get_receiving_filter_options(res.locals.access));
  } catch (error) {
    fail(res, error);
  }
}

export async function get_receivable_orders(_req: Request, res: Response) {
  try {
    res.json({ purchase_orders: await service.get_receivable_orders(res.locals.access) });
  } catch (error) {
    fail(res, error);
  }
}

export async function list_by_id_receiving(req: Request, res: Response) {
  try {
    res.json({ receiving: await service.list_by_id_receiving(String(req.query.id), res.locals.access) });
  } catch (error) {
    fail(res, error);
  }
}

export async function create_receiving(req: Request, res: Response) {
  try {
    if (!req.body || typeof req.body.purchase_order_id !== "string" || !RECEIVING_UUID.test(req.body.purchase_order_id))
      throw new ReceivingError("invalid_input", "Provide a valid purchase order ID.");
    res.status(201).json({ receiving: await service.create_receiving(req.body as CreateReceivingInput, res.locals.access) });
  } catch (error) {
    fail(res, error);
  }
}

export async function update_receiving(req: Request, res: Response) {
  try {
    if (!req.body || typeof req.body.id !== "string" || !RECEIVING_UUID.test(req.body.id))
      throw new ReceivingError("invalid_input", "Provide a valid receipt ID.");
    res.json({ receiving: await service.update_receiving(req.body as UpdateReceivingInput, res.locals.access) });
  } catch (error) {
    fail(res, error);
  }
}

export async function post_receiving(req: Request, res: Response) {
  try {
    const id = typeof req.body?.id === "string" ? req.body.id : "";
    if (!RECEIVING_UUID.test(id)) throw new ReceivingError("invalid_input", "Provide a valid receipt ID.");
    res.json({ receiving: await service.post_receiving(id, res.locals.access) });
  } catch (error) {
    fail(res, error);
  }
}

export async function delete_receiving(req: Request, res: Response) {
  try {
    if (typeof req.query.id !== "string" || !RECEIVING_UUID.test(req.query.id))
      throw new ReceivingError("invalid_input", "Provide a valid receipt ID.");
    await service.delete_receiving(String(req.query.id), res.locals.access);
    res.json({ id: String(req.query.id), message: "Receipt deleted." });
  } catch (error) {
    fail(res, error);
  }
}
