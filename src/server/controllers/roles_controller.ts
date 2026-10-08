import type { Request, Response, NextFunction } from "express";
import * as roleService from "@/server/services/roles_service";
import { parsePagination } from "@/server/utils/pagination";
import { RoleError } from "@/server/utils/errors";
import {
  validate_role_id,
  validate_role_scope,
  validate_create_role,
  validate_update_role,
  respond_role_error,
} from "@/server/utils/roles_request";

export async function list_role(
  req: Request,
  res: Response,
  _next?: NextFunction,
  service = roleService,
) {
  try {
    const pagination = parsePagination(req.query);
    const search = req.query.search ?? "";
    if (typeof search !== "string" || search.length > 100)
      throw new RoleError(
        "invalid_input",
        "Search must contain at most 100 characters.",
      );
    const scope =
      req.query.scope === undefined
        ? undefined
        : validate_role_scope(req.query.scope);
    res
      .status(200)
      .json(await service.list_role(pagination, search.trim(), scope));
  } catch (error) {
    respond_role_error(error, res);
  }
}

export async function edit_role(
  req: Request,
  res: Response,
  _next?: NextFunction,
  service = roleService,
) {
  try {
    res
      .status(200)
      .json({ role: await service.edit_role(validate_role_id(req.query.id)) });
  } catch (error) {
    respond_role_error(error, res);
  }
}

export async function get_role_option(
  _req: Request,
  res: Response,
  _next?: NextFunction,
  service = roleService,
) {
  try {
    res.status(200).json(await service.get_role_option());
  } catch (error) {
    respond_role_error(error, res);
  }
}

export async function create_role(
  req: Request,
  res: Response,
  _next?: NextFunction,
  service = roleService,
) {
  try {
    res
      .status(201)
      .json({
        role: await service.create_role(validate_create_role(req.body)),
      });
  } catch (error) {
    respond_role_error(error, res);
  }
}

export async function update_role(
  req: Request,
  res: Response,
  _next?: NextFunction,
  service = roleService,
) {
  try {
    res
      .status(200)
      .json({
        role: await service.update_role(validate_update_role(req.body)),
      });
  } catch (error) {
    respond_role_error(error, res);
  }
}

export async function delete_role(
  req: Request,
  res: Response,
  _next?: NextFunction,
  service = roleService,
) {
  try {
    res
      .status(200)
      .json(await service.delete_role(validate_role_id(req.query.id)));
  } catch (error) {
    respond_role_error(error, res);
  }
}
