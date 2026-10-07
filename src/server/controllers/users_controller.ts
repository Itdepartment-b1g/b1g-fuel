import type { CreateUserInput } from "@/lib/users";
import {
  DATE_PRESETS,
  resolveDateRange,
  type QuickFilterState,
} from "@/lib/quick-filter";
import {
  USER_FILTER_FIELDS,
  USER_STATUS_OPTIONS,
  USER_ADDITIONAL_FILTERS,
} from "@/lib/users-filters";
import type { RequestHandler } from "express";
import { rateLimit } from "express-rate-limit";
import { userService } from "@/server/services/users_service";
import { parsePagination } from "@/server/utils/pagination";
import { UserError } from "@/server/utils/errors";
import { handleController } from "./error_handler";

export const createUserLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  handler: (_req, res) => {
    res
      .status(429)
      .json({ error: "Too many user creation attempts. Try again later." });
  },
});
const userDatabaseErrors = {
  P2002: { status: 409, message: "An account with that email already exists." },
  P2003: {
    status: 400,
    message: "Company or company roles are no longer available.",
  },
};
export const listUser: RequestHandler = handleController(async (req, res) => {
  const pagination = parsePagination(req.query);
  const search = req.query.search ?? "";
  if (typeof search !== "string" || search.length > 254)
    throw new UserError(400, "Invalid search value.");
  const filters =
    req.query.filters === undefined
      ? undefined
      : validateUserFilter(req.query.filters);
  res.json(await userService.listUser(pagination, search.trim(), filters));
});
export const getUserFilterOption = handleController(async (_req, res) => {
  res.json(await userService.getUserFilterOption());
});
export const getUserOption = handleController(async (_req, res) => {
  res.json(await userService.getUserOption());
});
export const createUser = handleController(async (req, res) => {
  res
    .status(201)
    .json({ user: await userService.createUser(validateCreateUser(req.body)) });
}, userDatabaseErrors);

export function validateCreateUser(body: unknown): CreateUserInput {
  if (!body || typeof body !== "object" || Array.isArray(body))
    throw new UserError(400, "Provide user details.");
  const { name, email, password, company_id, role_ids } = body as Record<
    string,
    unknown
  >;
  const uuid =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (typeof name !== "string" || !name.trim() || name.trim().length > 250)
    throw new UserError(400, "Provide a name between 1 and 250 characters.");
  if (
    typeof email !== "string" ||
    email.trim().length > 254 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
  )
    throw new UserError(400, "Provide a valid email.");
  if (
    typeof password !== "string" ||
    password.length < 8 ||
    password.length > 128
  )
    throw new UserError(
      400,
      "Provide a password between 8 and 128 characters.",
    );
  if (
    company_id !== undefined &&
    (typeof company_id !== "string" || !uuid.test(company_id))
  )
    throw new UserError(400, "Select a valid company or omit company_id.");
  const roleIds = role_ids === undefined ? [] : role_ids;
  if (
    !Array.isArray(roleIds) ||
    roleIds.length > 50 ||
    roleIds.some((id) => typeof id !== "string" || !uuid.test(id)) ||
    new Set(roleIds).size !== roleIds.length
  )
    throw new UserError(
      400,
      "Provide distinct company roles (maximum 50) or omit role_ids.",
    );
  if (
    Object.keys(body).some(
      (key) =>
        !["name", "email", "password", "company_id", "role_ids"].includes(key),
    )
  )
    throw new UserError(400, "Unknown user field.");
  return {
    name: name.trim(),
    email: email.trim().toLowerCase(),
    password,
    company_id,
    role_ids: roleIds,
  };
}
export function validateUserFilter(value: unknown): QuickFilterState {
  if (typeof value !== "string" || value.length > 12000)
    throw new UserError(400, "Invalid quick filters.");
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    throw new UserError(400, "Quick filters must be valid JSON.");
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed))
    throw new UserError(400, "Invalid quick filters.");
  const { date, conditions, status, additional } = parsed as Record<
    string,
    unknown
  >;
  if (
    Object.keys(parsed).some(
      (key) => !["date", "conditions", "status", "additional"].includes(key),
    )
  )
    throw new UserError(400, "Unknown quick filter.");
  if (!date || typeof date !== "object" || Array.isArray(date))
    throw new UserError(400, "Invalid date filter.");
  const range = date as Record<string, unknown>;
  if (
    !DATE_PRESETS.some((preset) => preset.value === range.preset) ||
    typeof range.from !== "string" ||
    typeof range.to !== "string" ||
    range.from.length > 10 ||
    range.to.length > 10
  )
    throw new UserError(400, "Invalid date filter.");
  if (
    !Array.isArray(conditions) ||
    !conditions.length ||
    conditions.length > 50
  )
    throw new UserError(400, "Provide between 1 and 50 filter conditions.");
  const ids = new Set<string>();
  for (const row of conditions) {
    if (
      !row ||
      typeof row !== "object" ||
      typeof row.id !== "string" ||
      !row.id ||
      row.id.length > 64 ||
      ids.has(row.id) ||
      typeof row.field !== "string" ||
      (row.field !== "" &&
        !USER_FILTER_FIELDS.some((field) => field.key === row.field)) ||
      typeof row.value !== "string" ||
      row.value.length > 254
    )
      throw new UserError(400, "Invalid column condition.");
    ids.add(row.id);
    if (
      ["company", "role"].includes(row.field) &&
      row.value.trim() &&
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        row.value.trim(),
      )
    )
      throw new UserError(400, "Provide a valid assignment filter ID.");
  }
  if (!USER_STATUS_OPTIONS.some((option) => option.value === status))
    throw new UserError(400, "Invalid role status filter.");
  if (
    !additional ||
    typeof additional !== "object" ||
    Array.isArray(additional) ||
    Object.keys(additional).some((key) => key !== "membership")
  )
    throw new UserError(400, "Invalid additional filters.");
  const membership =
    (additional as Record<string, unknown>).membership ?? "all";
  if (
    !USER_ADDITIONAL_FILTERS[0].options.some(
      (option) => option.value === membership,
    )
  )
    throw new UserError(400, "Invalid company membership filter.");
  const result: QuickFilterState = {
    date: { preset: range.preset as string, from: range.from, to: range.to },
    conditions,
    status: status as string,
    additional: { membership: membership as string },
  };
  try {
    resolveDateRange(result.date);
  } catch (error) {
    throw new UserError(
      400,
      error instanceof Error ? error.message : "Invalid date range.",
    );
  }
  return result;
}
