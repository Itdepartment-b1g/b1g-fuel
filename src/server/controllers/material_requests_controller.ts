import type { Request, Response } from "express";
import * as service from "@/server/services/material_requests_service";
import { MaterialRequestError } from "@/server/services/material_requests_service";
import { parsePagination, PaginationError } from "@/server/lib/pagination";
import type { RequestInput, CreateRequestInput, ActionInput, ReceiveInput, DispatchInput } from "@/server/schema/material_requests_schema";
import { MR_SORT_FIELDS } from "@/server/schema/material_requests_schema";
import { parse_sort, SortingError } from "@/server/lib/sorting";
import { parse_quick_filters, QuickFilterError } from "@/server/lib/quick-filters";
import { MATERIAL_REQUEST_FILTER_OPTIONS } from "@/utils/material-request-filters";

export async function list_material_request(req: Request, res: Response) {
  try { res.status(200).json(await service.list_material_request(typeof req.query.search === "string" ? req.query.search : "", typeof req.query.status === "string" ? req.query.status : "", parsePagination(req.query), res.locals.access, parse_sort(req.query, MR_SORT_FIELDS), parse_quick_filters(req.query.filters, MATERIAL_REQUEST_FILTER_OPTIONS))); }
  catch (error) {
    if (error instanceof MaterialRequestError) { res.status(error.status).json({ error: error.message }); return; }
    if (error instanceof PaginationError || error instanceof SortingError || error instanceof QuickFilterError) { res.status(400).json({ error: error.message }); return; }
    if (error && typeof error === "object" && "code" in error && ["P2002", "P2003", "P2034"].includes(String(error.code))) {
      res.status(409).json({ error: "Related records changed or the request was updated concurrently. Refresh and try again." }); return;
    }
    console.error("Material request failed:", error);
    res.status(500).json({ error: "The material request could not be completed." });
  }
}
export async function get_material_request_filter_option(_req: Request, res: Response) {
  try { res.status(200).json(await service.get_material_request_filter_option(res.locals.access)); }
  catch (error) {
    console.error("Material request filter options failed:", error);
    res.status(500).json({ error: "Material request filter choices could not be loaded." });
  }
}

export async function list_by_id_material_request(req: Request, res: Response) {
  try { res.status(200).json({ request: await service.list_by_id_material_request(String(req.query.id), res.locals.access) }); }
  catch (error) {
    if (error instanceof MaterialRequestError) { res.status(error.status).json({ error: error.message }); return; }
    if (error instanceof PaginationError) { res.status(400).json({ error: error.message }); return; }
    if (error && typeof error === "object" && "code" in error && ["P2002", "P2003", "P2034"].includes(String(error.code))) {
      res.status(409).json({ error: "Related records changed or the request was updated concurrently. Refresh and try again." }); return;
    }
    console.error("Material request failed:", error);
    res.status(500).json({ error: "The material request could not be completed." });
  }
}

export async function create_material_request(req: Request, res: Response) {
  try { res.status(201).json({ request: await service.create_material_request(req.body as CreateRequestInput, res.locals.access) }); }
  catch (error) {
    if (error instanceof MaterialRequestError) { res.status(error.status).json({ error: error.message }); return; }
    if (error instanceof PaginationError) { res.status(400).json({ error: error.message }); return; }
    if (error && typeof error === "object" && "code" in error && ["P2002", "P2003", "P2034"].includes(String(error.code))) {
      res.status(409).json({ error: "Related records changed or the request was updated concurrently. Refresh and try again." }); return;
    }
    console.error("Material request failed:", error);
    res.status(500).json({ error: "The material request could not be completed." });
  }
}

export async function update_material_request(req: Request, res: Response) {
  try { res.status(200).json({ request: await service.update_material_request(String(req.query.id), req.body as RequestInput, res.locals.access) }); }
  catch (error) {
    if (error instanceof MaterialRequestError) { res.status(error.status).json({ error: error.message }); return; }
    if (error instanceof PaginationError) { res.status(400).json({ error: error.message }); return; }
    if (error && typeof error === "object" && "code" in error && ["P2002", "P2003", "P2034"].includes(String(error.code))) {
      res.status(409).json({ error: "Related records changed or the request was updated concurrently. Refresh and try again." }); return;
    }
    console.error("Material request failed:", error);
    res.status(500).json({ error: "The material request could not be completed." });
  }
}

export async function action_material_request(req: Request, res: Response) {
  try { res.status(200).json({ request: await service.action_material_request(req.body as ActionInput, res.locals.access) }); }
  catch (error) {
    if (error instanceof MaterialRequestError) { res.status(error.status).json({ error: error.message }); return; }
    if (error instanceof PaginationError) { res.status(400).json({ error: error.message }); return; }
    if (error && typeof error === "object" && "code" in error && ["P2002", "P2003", "P2034"].includes(String(error.code))) {
      res.status(409).json({ error: "Related records changed or the request was updated concurrently. Refresh and try again." }); return;
    }
    console.error("Material request failed:", error);
    res.status(500).json({ error: "The material request could not be completed." });
  }
}

export async function dispatch_material_request(req: Request, res: Response) {
  try { res.status(200).json({ request: await service.dispatch_material_request(req.body as DispatchInput, res.locals.access) }); }
  catch (error) {
    if (error instanceof MaterialRequestError) { res.status(error.status).json({ error: error.message }); return; }
    if (error instanceof PaginationError) { res.status(400).json({ error: error.message }); return; }
    if (error && typeof error === "object" && "code" in error && ["P2002", "P2003", "P2034"].includes(String(error.code))) {
      res.status(409).json({ error: "Related records changed or the request was updated concurrently. Refresh and try again." }); return;
    }
    console.error("Material request failed:", error);
    res.status(500).json({ error: "The material request could not be completed." });
  }
}

export async function receive_material_request(req: Request, res: Response) {
  try { res.status(200).json({ request: await service.receive_material_request(req.body as ReceiveInput, res.locals.access) }); }
  catch (error) {
    if (error instanceof MaterialRequestError) { res.status(error.status).json({ error: error.message }); return; }
    if (error instanceof PaginationError) { res.status(400).json({ error: error.message }); return; }
    if (error && typeof error === "object" && "code" in error && ["P2002", "P2003", "P2034"].includes(String(error.code))) {
      res.status(409).json({ error: "Related records changed or the request was updated concurrently. Refresh and try again." }); return;
    }
    console.error("Material request failed:", error);
    res.status(500).json({ error: "The material request could not be completed." });
  }
}

export async function get_material_request_options(req: Request, res: Response) {
  try { res.status(200).json(await service.get_material_request_options(typeof req.query.hub_id === "string" ? req.query.hub_id : undefined, typeof req.query.supplier_id === "string" ? req.query.supplier_id : undefined, res.locals.access)); }
  catch (error) {
    if (error instanceof MaterialRequestError) { res.status(error.status).json({ error: error.message }); return; }
    if (error instanceof PaginationError) { res.status(400).json({ error: error.message }); return; }
    if (error && typeof error === "object" && "code" in error && ["P2002", "P2003", "P2034"].includes(String(error.code))) {
      res.status(409).json({ error: "Related records changed or the request was updated concurrently. Refresh and try again." }); return;
    }
    console.error("Material request failed:", error);
    res.status(500).json({ error: "The material request could not be completed." });
  }
}

export async function get_material_request_catalog(req: Request, res: Response) {
  try { res.status(200).json(await service.get_material_request_catalog(String(req.query.hub_id), String(req.query.supplier_id), typeof req.query.search === "string" ? req.query.search : "", parsePagination(req.query), res.locals.access)); }
  catch (error) {
    if (error instanceof MaterialRequestError) { res.status(error.status).json({ error: error.message }); return; }
    if (error instanceof PaginationError) { res.status(400).json({ error: error.message }); return; }
    if (error && typeof error === "object" && "code" in error && ["P2002", "P2003", "P2034"].includes(String(error.code))) {
      res.status(409).json({ error: "Related records changed or the request was updated concurrently. Refresh and try again." }); return;
    }
    console.error("Material request failed:", error);
    res.status(500).json({ error: "The material request could not be completed." });
  }
}
