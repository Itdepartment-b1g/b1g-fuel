import type { Request, Response, NextFunction } from "express";
import * as userService from "@/server/services/users_service";
import { parsePagination } from "@/server/utils/pagination";
import { UserError } from "@/server/utils/errors";
import { validate_create_user, validate_user_filter, respond_user_error } from "@/server/utils/users_request";

export async function list_user(
  req: Request,
  res: Response,
  _next: NextFunction,
  service = userService,
) {
  try {
    const pagination = parsePagination(req.query);
    const search = req.query.search ?? "";
    if (typeof search !== "string" || search.length > 254)
      throw new UserError("invalid_input", "Invalid search value.");
    const filters =
      req.query.filters === undefined
        ? undefined
        : validate_user_filter(req.query.filters);
    res
      .status(200)
      .json(await service.list_user(pagination, search.trim(), filters));
  } catch (error) {
    respond_user_error(error, res);
  }
}
export async function get_user_filter_option(
  _req: Request,
  res: Response,
  _next: NextFunction,
  service = userService,
) {
  try {
    res.status(200).json(await service.get_user_filter_option());
  } catch (error) {
    respond_user_error(error, res);
  }
}
export async function get_user_option(
  _req: Request,
  res: Response,
  _next: NextFunction,
  service = userService,
) {
  try {
    res.status(200).json(await service.get_user_option());
  } catch (error) {
    respond_user_error(error, res);
  }
}
export async function create_user(
  req: Request,
  res: Response,
  _next: NextFunction,
  service = userService,
) {
  try {
    res
      .status(201)
      .json({
        user: await service.create_user(validate_create_user(req.body)),
      });
  } catch (error) {
    respond_user_error(error, res);
  }
}
