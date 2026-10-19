import type { Request, Response } from "express";
import * as service from "@/server/services/company_supply_service";
import { CompanySupplyError } from "@/server/services/company_supply_service";
import { PaginationError, parsePagination } from "@/server/lib/pagination";
import { SUPPLY_UUID, type CreateCompanySupplyInput, type UpdateCompanySupplyInput } from "@/server/schema/company_supply_schema";

export async function list_company_supply(req: Request, res: Response) {
  try {
    if (typeof req.query.company_id !== "string" || !SUPPLY_UUID.test(req.query.company_id))
      throw new CompanySupplyError("invalid_input", "Provide a valid company ID.");
    const direction = req.query.direction ?? "requesting";
    if (direction !== "requesting" && direction !== "supplying")
      throw new CompanySupplyError("invalid_input", "Choose requesting or supplying direction.");
    if (req.query.search !== undefined && (typeof req.query.search !== "string" || req.query.search.length > 160))
      throw new CompanySupplyError("invalid_input", "Search must contain at most 160 characters.");
    const status = req.query.status ?? "all";
    if (status !== "all" && status !== "active" && status !== "inactive")
      throw new CompanySupplyError("invalid_input", "Choose all, active, or inactive links.");
    res.status(200).json(await service.list_company_supply(req.query.company_id.toLowerCase(), direction, status,
      typeof req.query.search === "string" ? req.query.search : "", parsePagination(req.query), res.locals.access));
  } catch (error) {
    if (error instanceof CompanySupplyError) {
      res.status({ invalid_input: 400, not_found: 404, forbidden: 403, conflict: 409 }[error.code]).json({ error: error.message });
      return;
    }
    if (error instanceof PaginationError) {
      res.status(400).json({ error: error.message });
      return;
    }
    if (error && typeof error === "object" && "code" in error) {
      if (error.code === "P2002") {
        res.status(409).json({ error: "This supply link already exists. Reactivate it if it is inactive." });
        return;
      }
      if (error.code === "P2003") {
        res.status(400).json({ error: "One of the selected companies no longer exists." });
        return;
      }
    }
    console.error("Company supply request failed:", error);
    res.status(500).json({ error: "The company supply request could not be completed." });
  }
}

export async function get_company_supply_option(req: Request, res: Response) {
  try {
    if (typeof req.query.company_id !== "string" || !SUPPLY_UUID.test(req.query.company_id))
      throw new CompanySupplyError("invalid_input", "Provide a valid company ID.");
    const direction = req.query.direction ?? "requesting";
    if (direction !== "requesting" && direction !== "supplying")
      throw new CompanySupplyError("invalid_input", "Choose requesting or supplying direction.");
    if (req.query.search !== undefined && (typeof req.query.search !== "string" || req.query.search.length > 160))
      throw new CompanySupplyError("invalid_input", "Search must contain at most 160 characters.");
    res.status(200).json(await service.get_company_supply_option(req.query.company_id.toLowerCase(), direction,
      typeof req.query.search === "string" ? req.query.search : "", parsePagination(req.query), res.locals.access));
  } catch (error) {
    if (error instanceof CompanySupplyError) {
      res.status({ invalid_input: 400, not_found: 404, forbidden: 403, conflict: 409 }[error.code]).json({ error: error.message });
      return;
    }
    if (error instanceof PaginationError) {
      res.status(400).json({ error: error.message });
      return;
    }
    if (error && typeof error === "object" && "code" in error) {
      if (error.code === "P2002") {
        res.status(409).json({ error: "This supply link already exists. Reactivate it if it is inactive." });
        return;
      }
      if (error.code === "P2003") {
        res.status(400).json({ error: "One of the selected companies no longer exists." });
        return;
      }
    }
    console.error("Company supply request failed:", error);
    res.status(500).json({ error: "The company supply request could not be completed." });
  }
}

export async function create_company_supply(req: Request, res: Response) {
  try {
    const input = req.body as CreateCompanySupplyInput;
    if (!input || typeof input !== "object" || Array.isArray(input) || Object.keys(input).some((key) => !["requesting_company_id", "supplying_company_id"].includes(key)))
      throw new CompanySupplyError("invalid_input", "Provide only requesting_company_id and supplying_company_id.");
    if (typeof input.requesting_company_id !== "string" || !SUPPLY_UUID.test(input.requesting_company_id) ||
        typeof input.supplying_company_id !== "string" || !SUPPLY_UUID.test(input.supplying_company_id))
      throw new CompanySupplyError("invalid_input", "Provide valid requesting and supplying company IDs.");
    res.status(201).json({ relationship: await service.create_company_supply({
      requesting_company_id: input.requesting_company_id.toLowerCase(), supplying_company_id: input.supplying_company_id.toLowerCase(),
    }, res.locals.access) });
  } catch (error) {
    if (error instanceof CompanySupplyError) {
      res.status({ invalid_input: 400, not_found: 404, forbidden: 403, conflict: 409 }[error.code]).json({ error: error.message });
      return;
    }
    if (error instanceof PaginationError) {
      res.status(400).json({ error: error.message });
      return;
    }
    if (error && typeof error === "object" && "code" in error) {
      if (error.code === "P2002") {
        res.status(409).json({ error: "This supply link already exists. Reactivate it if it is inactive." });
        return;
      }
      if (error.code === "P2003") {
        res.status(400).json({ error: "One of the selected companies no longer exists." });
        return;
      }
    }
    console.error("Company supply request failed:", error);
    res.status(500).json({ error: "The company supply request could not be completed." });
  }
}

export async function update_company_supply(req: Request, res: Response) {
  try {
    const input = req.body as UpdateCompanySupplyInput;
    if (!input || typeof input !== "object" || Array.isArray(input) || Object.keys(input).some((key) => !["id", "is_active"].includes(key)))
      throw new CompanySupplyError("invalid_input", "Provide only id and is_active. Companies and creator cannot be changed.");
    if (typeof input.id !== "string" || !SUPPLY_UUID.test(input.id) || typeof input.is_active !== "boolean")
      throw new CompanySupplyError("invalid_input", "Provide a valid link ID and boolean is_active.");
    res.status(200).json({ relationship: await service.update_company_supply({ id: input.id.toLowerCase(), is_active: input.is_active }, res.locals.access) });
  } catch (error) {
    if (error instanceof CompanySupplyError) {
      res.status({ invalid_input: 400, not_found: 404, forbidden: 403, conflict: 409 }[error.code]).json({ error: error.message });
      return;
    }
    if (error instanceof PaginationError) {
      res.status(400).json({ error: error.message });
      return;
    }
    if (error && typeof error === "object" && "code" in error) {
      if (error.code === "P2002") {
        res.status(409).json({ error: "This supply link already exists. Reactivate it if it is inactive." });
        return;
      }
      if (error.code === "P2003") {
        res.status(400).json({ error: "One of the selected companies no longer exists." });
        return;
      }
    }
    console.error("Company supply request failed:", error);
    res.status(500).json({ error: "The company supply request could not be completed." });
  }
}
