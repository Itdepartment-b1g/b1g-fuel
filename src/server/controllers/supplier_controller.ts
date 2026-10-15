import type { Request, Response } from "express";
import * as service from "@/server/services/supplier_service";
import { SupplierError } from "@/server/services/supplier_service";
import type { CreateSupplierInput, UpdateSupplierInput } from "@/server/schema/supplier_schema";

export async function list_suppliers(req: Request, res: Response) {
  try {
    res.json(await service.list_suppliers(
      { page: 1, page_size: 10, skip: 0, take: 10 },
      "",
      undefined,
      res.locals.access,
    ));
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