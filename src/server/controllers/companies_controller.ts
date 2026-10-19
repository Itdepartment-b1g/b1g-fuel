import { parse_quick_filters, QuickFilterError } from "@/server/lib/quick-filters";
import { COMPANY_FILTER_OPTIONS } from "@/utils/management-filters";
import { parse_sort, SortingError } from "@/server/lib/sorting";
import { COMPANY_SORT_FIELDS } from "@/server/schema/companies_schema";
import type { Request, Response, NextFunction } from "express";
import * as companyService from "@/server/services/companies_service";
import { CompanyError } from "@/server/services/companies_service";
import { parsePagination, PaginationError } from "@/server/lib/pagination";
import type { CreateCompanyInput, UpdateCompanyInput } from "@/server/schema/companies_schema";

const company_id_pattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function list_company_members(req: Request, res: Response) {
  try {
    const id = req.query.id;
    if (typeof id !== "string" || !company_id_pattern.test(id))
      throw new CompanyError("invalid_input", "Provide a valid company ID.");
    res.json(await companyService.list_company_members(id.toLowerCase(), parsePagination(req.query), res.locals.access));
  } catch (error) {
    if (error instanceof PaginationError) {
      res.status(400).json({ error: error.message });
    } else if (error instanceof CompanyError) {
      res.status(error.code === "company_not_found" ? 404 : 400).json({ error: error.message });
    } else {
      console.error("Company members request failed:", error);
      res.status(500).json({ error: "Company members could not be loaded." });
    }
  }
}
const company_error_status: Partial<Record<CompanyError["code"], number>> = {
  invalid_input: 400, company_not_found: 404, company_has_members: 409,
};
const company_database_errors: Record<string, { status: number; message: string }> = {
  "23505": { status: 409, message: "This company code is already in use." },
  "23503": { status: 409, message: "This company is referenced by roles, memberships, supply links, or documents and cannot be deleted." },
};
const prisma_error_codes: Record<string, string> = { P2002: "23505", P2003: "23503", P2004: "23514" };

export async function create_company(req: Request, res: Response, _next?: NextFunction, service = companyService) {
  try {
    const value: unknown = req.body;
    const allowed = new Set(["name", "code", "location_name", "location_address"]);
    if (!value || typeof value !== "object" || Array.isArray(value) || Object.keys(value).some((key) => !allowed.has(key)))
      throw new CompanyError("invalid_input", "Provide company details using name and optional location fields.");
    const body = value as Record<string, unknown>;
    if (body.code !== undefined && (typeof body.code !== "string" || !/^[A-Z][A-Z0-9]{1,15}$/.test(body.code.trim().toUpperCase())))
      throw new CompanyError("invalid_input", "Company code must contain 2–16 letters or digits and start with a letter.");
    const name = body.name;
    if (typeof name !== "string" || !name.trim() || name.trim().length > 160)
      throw new CompanyError("invalid_input", "Provide a company name between 1 and 160 characters.");
    const location_name = body.location_name;
    const location_address = body.location_address;
    if (location_name !== undefined && (typeof location_name !== "string" || location_name.length > 160))
      throw new CompanyError("invalid_input", "Provide a warehouse name between 1 and 160 characters.");
    if (location_address !== undefined && (typeof location_address !== "string" || location_address.length > 160))
      throw new CompanyError("invalid_input", "Provide a warehouse address of at most 160 characters.");
    const input: CreateCompanyInput = {
      name: name.trim(),
      ...(typeof body.code === "string" ? { code: body.code.trim().toUpperCase() } : {}),
      ...(typeof location_name === "string" ? { location_name } : {}),
      ...(typeof location_address === "string" ? { location_address } : {}),
    };
    const result = await service.create_company(input, undefined, res.locals.user?.id);
    res.status(201).json({ company: result.company, location: result.location });
  } catch (error) {

    if (error instanceof PaginationError) {
      res.status(400).json({ error: error.message }); return;
    }
    if (error instanceof CompanyError && company_error_status[error.code]) {
      res.status(company_error_status[error.code]!).json({ error: error.message }); return;
    }
    const visited = new Set<unknown>();
    const pending = [error];
    let code = "";
    let fallback = "";
    while (pending.length) {
      const current = pending.pop();
      if (!current || typeof current !== "object" || visited.has(current)) continue;
      visited.add(current);
      if ("code" in current && typeof current.code === "string") {
        if (Object.hasOwn(prisma_error_codes, current.code)) { code = prisma_error_codes[current.code]; break; }
        if (/^[0-9A-Z]{5}$/.test(current.code) && !/^P\d{4}$/.test(current.code)) { code = current.code; break; }
        fallback ||= current.code;
      }
      if ("originalCode" in current && typeof current.originalCode === "string" && /^[0-9A-Z]{5}$/.test(current.originalCode)) { code = current.originalCode; break; }
      if ("cause" in current) pending.push(current.cause);
      if ("meta" in current) pending.push(current.meta);
      if ("driverAdapterError" in current) pending.push(current.driverAdapterError);
    }
    code ||= fallback;
    const databaseError = Object.hasOwn(company_database_errors, code) ? company_database_errors[code] : undefined;
    if (databaseError) {
      res.status(databaseError.status).json({ error: databaseError.message }); return;
    }
    console.error("Companies request failed:", error);
    res.status(500).json({ error: "The request could not be completed." });
  }
}

export async function update_company(req: Request, res: Response, _next?: NextFunction, service = companyService) {
  try {
    const value: unknown = req.body;
    if (!value || typeof value !== "object" || Array.isArray(value) || Object.keys(value).some((key) => !["id", "name", "code"].includes(key)))
      throw new CompanyError("invalid_input", "Provide company ID and name.");
    const { id, name } = value as Record<string, unknown>;
    if (typeof id !== "string" || !company_id_pattern.test(id))
      throw new CompanyError("invalid_input", "Provide a valid company ID.");
    if (typeof name !== "string" || !name.trim() || name.trim().length > 160)
      throw new CompanyError("invalid_input", "Provide a company name between 1 and 160 characters.");
    const input: UpdateCompanyInput = { id: id.toLowerCase(), name: name.trim() };
    const code = (value as Record<string, unknown>).code;
    if (code !== undefined) {
      if (typeof code !== "string" || !/^[A-Z][A-Z0-9]{1,15}$/.test(code.trim().toUpperCase()))
        throw new CompanyError("invalid_input", "Company code must contain 2–16 letters or digits and start with a letter.");
      input.code = code.trim().toUpperCase();
    }
    res.status(200).json({ company: await service.update_company(input, undefined, res.locals.access) });
  } catch (error) {

    if (error instanceof PaginationError) {
      res.status(400).json({ error: error.message }); return;
    }
    if (error instanceof CompanyError && company_error_status[error.code]) {
      res.status(company_error_status[error.code]!).json({ error: error.message }); return;
    }
    const visited = new Set<unknown>();
    const pending = [error];
    let code = "";
    let fallback = "";
    while (pending.length) {
      const current = pending.pop();
      if (!current || typeof current !== "object" || visited.has(current)) continue;
      visited.add(current);
      if ("code" in current && typeof current.code === "string") {
        if (Object.hasOwn(prisma_error_codes, current.code)) { code = prisma_error_codes[current.code]; break; }
        if (/^[0-9A-Z]{5}$/.test(current.code) && !/^P\d{4}$/.test(current.code)) { code = current.code; break; }
        fallback ||= current.code;
      }
      if ("originalCode" in current && typeof current.originalCode === "string" && /^[0-9A-Z]{5}$/.test(current.originalCode)) { code = current.originalCode; break; }
      if ("cause" in current) pending.push(current.cause);
      if ("meta" in current) pending.push(current.meta);
      if ("driverAdapterError" in current) pending.push(current.driverAdapterError);
    }
    code ||= fallback;
    const databaseError = Object.hasOwn(company_database_errors, code) ? company_database_errors[code] : undefined;
    if (databaseError) {
      res.status(databaseError.status).json({ error: databaseError.message }); return;
    }
    console.error("Companies request failed:", error);
    res.status(500).json({ error: "The request could not be completed." });
  }
}

export async function delete_company(req: Request, res: Response, _next?: NextFunction, service = companyService) {
  try {
    const id = req.query.id;
    if (typeof id !== "string" || !company_id_pattern.test(id))
      throw new CompanyError("invalid_input", "Provide a valid company ID.");
    res.status(200).json(await service.delete_company(id.toLowerCase(), undefined, res.locals.access));
  } catch (error) {

    if (error instanceof PaginationError) {
      res.status(400).json({ error: error.message }); return;
    }
    if (error instanceof CompanyError && company_error_status[error.code]) {
      res.status(company_error_status[error.code]!).json({ error: error.message }); return;
    }
    const visited = new Set<unknown>();
    const pending = [error];
    let code = "";
    let fallback = "";
    while (pending.length) {
      const current = pending.pop();
      if (!current || typeof current !== "object" || visited.has(current)) continue;
      visited.add(current);
      if ("code" in current && typeof current.code === "string") {
        if (Object.hasOwn(prisma_error_codes, current.code)) { code = prisma_error_codes[current.code]; break; }
        if (/^[0-9A-Z]{5}$/.test(current.code) && !/^P\d{4}$/.test(current.code)) { code = current.code; break; }
        fallback ||= current.code;
      }
      if ("originalCode" in current && typeof current.originalCode === "string" && /^[0-9A-Z]{5}$/.test(current.originalCode)) { code = current.originalCode; break; }
      if ("cause" in current) pending.push(current.cause);
      if ("meta" in current) pending.push(current.meta);
      if ("driverAdapterError" in current) pending.push(current.driverAdapterError);
    }
    code ||= fallback;
    const databaseError = Object.hasOwn(company_database_errors, code) ? company_database_errors[code] : undefined;
    if (databaseError) {
      res.status(databaseError.status).json({ error: databaseError.message }); return;
    }
    console.error("Companies request failed:", error);
    res.status(500).json({ error: "The request could not be completed." });
  }
}

export async function list_by_id_company(req: Request, res: Response, _next?: NextFunction, service = companyService) {
  try {
    const id = req.query.id;
    if (typeof id !== "string" || !company_id_pattern.test(id))
      throw new CompanyError("invalid_input", "Provide a valid company ID.");
    res.status(200).json({ company: await service.list_by_id_company(id.toLowerCase(), undefined, res.locals.access) });
  } catch (error) {

    if (error instanceof PaginationError) {
      res.status(400).json({ error: error.message }); return;
    }
    if (error instanceof CompanyError && company_error_status[error.code]) {
      res.status(company_error_status[error.code]!).json({ error: error.message }); return;
    }
    const visited = new Set<unknown>();
    const pending = [error];
    let code = "";
    let fallback = "";
    while (pending.length) {
      const current = pending.pop();
      if (!current || typeof current !== "object" || visited.has(current)) continue;
      visited.add(current);
      if ("code" in current && typeof current.code === "string") {
        if (Object.hasOwn(prisma_error_codes, current.code)) { code = prisma_error_codes[current.code]; break; }
        if (/^[0-9A-Z]{5}$/.test(current.code) && !/^P\d{4}$/.test(current.code)) { code = current.code; break; }
        fallback ||= current.code;
      }
      if ("originalCode" in current && typeof current.originalCode === "string" && /^[0-9A-Z]{5}$/.test(current.originalCode)) { code = current.originalCode; break; }
      if ("cause" in current) pending.push(current.cause);
      if ("meta" in current) pending.push(current.meta);
      if ("driverAdapterError" in current) pending.push(current.driverAdapterError);
    }
    code ||= fallback;
    const databaseError = Object.hasOwn(company_database_errors, code) ? company_database_errors[code] : undefined;
    if (databaseError) {
      res.status(databaseError.status).json({ error: databaseError.message }); return;
    }
    console.error("Companies request failed:", error);
    res.status(500).json({ error: "The request could not be completed." });
  }
}

export async function list_company(req: Request, res: Response, _next?: NextFunction, service = companyService) {
  try {
    const sorting = parse_sort(req.query, COMPANY_SORT_FIELDS);
    const filters = parse_quick_filters(req.query.filters, COMPANY_FILTER_OPTIONS);
    const search = req.query.search ?? "";
    if (typeof search !== "string" || search.length > 160)
      throw new CompanyError("invalid_input", "Search must contain at most 160 characters.");
    res.status(200).json(await service.list_company(parsePagination(req.query), search.trim(), sorting, undefined, res.locals.access, filters));
  } catch (error) {

    if (error instanceof PaginationError || error instanceof SortingError || error instanceof QuickFilterError) {
      res.status(400).json({ error: error.message }); return;
    }
    if (error instanceof CompanyError && company_error_status[error.code]) {
      res.status(company_error_status[error.code]!).json({ error: error.message }); return;
    }
    const visited = new Set<unknown>();
    const pending = [error];
    let code = "";
    let fallback = "";
    while (pending.length) {
      const current = pending.pop();
      if (!current || typeof current !== "object" || visited.has(current)) continue;
      visited.add(current);
      if ("code" in current && typeof current.code === "string") {
        if (Object.hasOwn(prisma_error_codes, current.code)) { code = prisma_error_codes[current.code]; break; }
        if (/^[0-9A-Z]{5}$/.test(current.code) && !/^P\d{4}$/.test(current.code)) { code = current.code; break; }
        fallback ||= current.code;
      }
      if ("originalCode" in current && typeof current.originalCode === "string" && /^[0-9A-Z]{5}$/.test(current.originalCode)) { code = current.originalCode; break; }
      if ("cause" in current) pending.push(current.cause);
      if ("meta" in current) pending.push(current.meta);
      if ("driverAdapterError" in current) pending.push(current.driverAdapterError);
    }
    code ||= fallback;
    const databaseError = Object.hasOwn(company_database_errors, code) ? company_database_errors[code] : undefined;
    if (databaseError) {
      res.status(databaseError.status).json({ error: databaseError.message }); return;
    }
    console.error("Companies request failed:", error);
    res.status(500).json({ error: "The request could not be completed." });
  }
}

export async function get_company_filter_option(_req: Request, res: Response) {
  try { res.status(200).json(await companyService.get_company_filter_option(undefined, res.locals.access)); }
  catch { res.status(500).json({ error: "Filter choices could not be loaded." }); }
}
