import type { RequestHandler, Response } from "express";
import { companyService } from "@/server/services/companies_service";
import { CompanyError, getDatabaseErrorCode, type ApplicationErrorCode } from "@/server/utils/errors";
import { parsePagination, PaginationError } from "@/server/utils/pagination";
import type { CreateCompanyInput, UpdateCompanyInput } from "@/server/schema/companies_schema";

export function validate_company_id(value: unknown): string {
  if (
    typeof value !== "string" ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      value,
    )
  )
    throw new CompanyError("invalid_input", "Provide a valid company ID.");
  return value.toLowerCase();
}
export function validate_create_company(value: unknown): CreateCompanyInput {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    Object.keys(value).some((key) => key !== "name")
  )
    throw new CompanyError("invalid_input",
      "Provide company details using only the name field.",
    );
  const name = (value as Record<string, unknown>).name;
  if (typeof name !== "string" || !name.trim() || name.trim().length > 160)
    throw new CompanyError("invalid_input",
      "Provide a company name between 1 and 160 characters.",
    );
  return { name: name.trim() };
}
export function validate_update_company(value: unknown): UpdateCompanyInput {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    Object.keys(value).some((key) => !["id", "name"].includes(key))
  )
    throw new CompanyError("invalid_input", "Provide company ID and name.");
  const body = value as Record<string, unknown>;
  return {
    id: validate_company_id(body.id),
    ...validate_create_company({ name: body.name }),
  };
}
const companyDatabaseErrors = {
  "23503": {
    status: 409,
    message: "Company memberships changed. Refresh and try again.",
  },
};
const companyErrorStatus: Partial<Record<ApplicationErrorCode, number>> = {
  invalid_input: 400,
  company_not_found: 404,
  company_has_members: 409,
};
function respond_company_error(error: unknown, res: Response) {
  if (error instanceof PaginationError) {
    res.status(400).json({ error: error.message });
    return;
  }
  if (error instanceof CompanyError && companyErrorStatus[error.code]) {
    res.status(companyErrorStatus[error.code]!).json({ error: error.message });
    return;
  }
  const code = getDatabaseErrorCode(error);
  const databaseError = Object.hasOwn(companyDatabaseErrors, code)
    ? companyDatabaseErrors[code as keyof typeof companyDatabaseErrors] : undefined;
  if (databaseError) {
    res.status(databaseError.status).json({ error: databaseError.message });
    return;
  }
  console.error("Companies request failed:", error);
  res.status(500).json({ error: "The request could not be completed." });
}
export const list_company: RequestHandler = async (req, res) => {
  try {
    const search = req.query.search ?? "";
    if (typeof search !== "string" || search.length > 160)
      throw new CompanyError("invalid_input", "Search must contain at most 160 characters.");
    res.status(200).json(
      await companyService.list_company(parsePagination(req.query), search.trim()),
    );
  } catch (error) {
    respond_company_error(error, res);
  }
};
export const edit_company: RequestHandler = async (req, res) => {
  try {
    res.status(200).json({
      company: await companyService.edit_company(validate_company_id(req.query.id)),
    });
  } catch (error) {
    respond_company_error(error, res);
  }
};
export const create_company: RequestHandler = async (req, res) => {
  try {
    res
      .status(201)
      .json({
        company: await companyService.create_company(
          validate_create_company(req.body),
        ),
      });
  } catch (error) {
    respond_company_error(error, res);
  }
};
export const update_company: RequestHandler = async (req, res) => {
  try {
    res.status(200).json({
      company: await companyService.update_company(
        validate_update_company(req.body),
      ),
    });
  } catch (error) {
    respond_company_error(error, res);
  }
};
export const delete_company: RequestHandler = async (req, res) => {
  try {
    res.status(200).json(await companyService.delete_company(validate_company_id(req.query.id)));
  } catch (error) {
    respond_company_error(error, res);
  }
};
