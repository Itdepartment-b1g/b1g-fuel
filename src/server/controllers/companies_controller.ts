import type { Request, Response, NextFunction } from "express";
import * as companyService from "@/server/services/companies_service";
import { parsePagination } from "@/server/utils/pagination";
import { CompanyError } from "@/server/utils/errors";
import {
  validate_company_id,
  validate_create_company,
  validate_update_company,
  respond_company_error,
} from "@/server/utils/companies_request";

export async function list_company(
  req: Request,
  res: Response,
  _next?: NextFunction,
  service = companyService,
) {
  try {
    const search = req.query.search ?? "";
    if (typeof search !== "string" || search.length > 160)
      throw new CompanyError(
        "invalid_input",
        "Search must contain at most 160 characters.",
      );
    res
      .status(200)
      .json(
        await service.list_company(parsePagination(req.query), search.trim()),
      );
  } catch (error) {
    respond_company_error(error, res);
  }
}
export async function edit_company(
  req: Request,
  res: Response,
  _next?: NextFunction,
  service = companyService,
) {
  try {
    res.status(200).json({
      company: await service.edit_company(validate_company_id(req.query.id)),
    });
  } catch (error) {
    respond_company_error(error, res);
  }
}
export async function create_company(
  req: Request,
  res: Response,
  _next?: NextFunction,
  service = companyService,
) {
  try {
    res.status(201).json({
      company: await service.create_company(validate_create_company(req.body)),
    });
  } catch (error) {
    respond_company_error(error, res);
  }
}
export async function update_company(
  req: Request,
  res: Response,
  _next?: NextFunction,
  service = companyService,
) {
  try {
    res.status(200).json({
      company: await service.update_company(validate_update_company(req.body)),
    });
  } catch (error) {
    respond_company_error(error, res);
  }
}
export async function delete_company(
  req: Request,
  res: Response,
  _next?: NextFunction,
  service = companyService,
) {
  try {
    res
      .status(200)
      .json(await service.delete_company(validate_company_id(req.query.id)));
  } catch (error) {
    respond_company_error(error, res);
  }
}
