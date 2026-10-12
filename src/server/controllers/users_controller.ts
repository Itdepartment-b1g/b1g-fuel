import type { Request, Response, NextFunction } from "express";
import * as userService from "@/server/services/users_service";
import { parsePagination, PaginationError } from "@/server/lib/pagination";
import type { CreateUserInput } from "@/server/schema/users_schema";
import {
  DATE_PRESETS,
  type QuickFilterState,
} from "@/lib/quick-filter";
import {
  USER_FILTER_FIELDS,
  USER_STATUS_OPTIONS,
  USER_ADDITIONAL_FILTERS,
} from "@/lib/users-filters";
import { resolveDateRange } from "@/server/lib/filter";
import { UserError } from "@/server/services/users_service";

const user_database_errors: Record<string, { status: number; message: string }> = {
  "23505": {
    status: 409,
    message: "An account with that email already exists.",
  },
  "23503": {
    status: 400,
    message: "Company or company roles are no longer available.",
  },
};
const user_error_status: Partial<Record<UserError["code"], number>> = {
  invalid_input: 400,
  company_required: 400,
  assignments_unavailable: 400,
  invalid_account_details: 400,
  email_exists: 409,
  auth_creation_failed: 502,
};
const prisma_error_codes: Record<string, string> = { P2002: "23505", P2003: "23503", P2004: "23514" };

export async function list_user(
  req: Request,
  res: Response,
  _next?: NextFunction,
  service = userService,
) {
  try {
    const pagination = parsePagination(req.query);
    const search = req.query.search ?? "";
    if (typeof search !== "string" || search.length > 254)
      throw new UserError("invalid_input", "Invalid search value.");
    let filters: QuickFilterState | undefined;
    if (req.query.filters !== undefined) {
      const value: unknown = req.query.filters;
if (typeof value !== "string" || value.length > 12000)
    throw new UserError("invalid_input", "Invalid quick filters.");
let parsed: unknown;
try {
    parsed = JSON.parse(value);
  } catch {
    throw new UserError("invalid_input", "Quick filters must be valid JSON.");
  }
if (!parsed || typeof parsed !== "object" || Array.isArray(parsed))
    throw new UserError("invalid_input", "Invalid quick filters.");
const { date, conditions, status, additional } = parsed as Record<
    string,
    unknown
  >;
if (
    Object.keys(parsed).some(
      (key) => !["date", "conditions", "status", "additional"].includes(key),
    )
  )
    throw new UserError("invalid_input", "Unknown quick filter.");
if (!date || typeof date !== "object" || Array.isArray(date))
    throw new UserError("invalid_input", "Invalid date filter.");
const range = date as Record<string, unknown>;
if (
    !DATE_PRESETS.some((preset) => preset.value === range.preset) ||
    typeof range.from !== "string" ||
    typeof range.to !== "string" ||
    range.from.length > 10 ||
    range.to.length > 10
  )
    throw new UserError("invalid_input", "Invalid date filter.");
if (
    !Array.isArray(conditions) ||
    !conditions.length ||
    conditions.length > 50
  )
    throw new UserError(
      "invalid_input",
      "Provide between 1 and 50 filter conditions.",
    );
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
      throw new UserError("invalid_input", "Invalid column condition.");
    ids.add(row.id);
    if (
      ["company", "role"].includes(row.field) &&
      row.value.trim() &&
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        row.value.trim(),
      )
    )
      throw new UserError(
        "invalid_input",
        "Provide a valid assignment filter ID.",
      );
  }
if (!USER_STATUS_OPTIONS.some((option) => option.value === status))
    throw new UserError("invalid_input", "Invalid role status filter.");
if (
    !additional ||
    typeof additional !== "object" ||
    Array.isArray(additional) ||
    Object.keys(additional).some((key) => key !== "membership")
  )
    throw new UserError("invalid_input", "Invalid additional filters.");
const membership =
    (additional as Record<string, unknown>).membership ?? "all";
if (
    !USER_ADDITIONAL_FILTERS[0].options.some(
      (option) => option.value === membership,
    )
  )
    throw new UserError("invalid_input", "Invalid company membership filter.");
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
      "invalid_input",
      error instanceof Error ? error.message : "Invalid date range.",
    );
  }
      filters = result;
    }
    res
      .status(200)
      .json(await service.list_user(pagination, search.trim(), filters));
  } catch (error) {
    if (error instanceof PaginationError) {
      res.status(400).json({ error: error.message });
      return;
    }
    if (error instanceof UserError && user_error_status[error.code]) {
      res.status(user_error_status[error.code]!).json({ error: error.message });
      return;
    }
    const visited = new Set<unknown>();
    const pending = [error];
    let code = "";
    let fallback = "";
    while (pending.length) {
      const current = pending.pop();
      if (!current || typeof current !== "object" || visited.has(current))
        continue;
      visited.add(current);
      if ("code" in current && typeof current.code === "string") {
        if (Object.hasOwn(prisma_error_codes, current.code)) {
          code = prisma_error_codes[current.code];
          break;
        }
        if (
          /^[0-9A-Z]{5}$/.test(current.code) &&
          !/^P\d{4}$/.test(current.code)
        ) {
          code = current.code;
          break;
        }
        fallback ||= current.code;
      }
      if (
        "originalCode" in current &&
        typeof current.originalCode === "string" &&
        /^[0-9A-Z]{5}$/.test(current.originalCode)
      ) {
        code = current.originalCode;
        break;
      }
      if ("cause" in current) pending.push(current.cause);
      if ("meta" in current) pending.push(current.meta);
      if ("driverAdapterError" in current)
        pending.push(current.driverAdapterError);
    }
    code ||= fallback;
    const databaseError = Object.hasOwn(user_database_errors, code)
      ? user_database_errors[code]
      : undefined;
    if (databaseError) {
      res.status(databaseError.status).json({ error: databaseError.message });
      return;
    }
    console.error("Users request failed:", error);
    res.status(500).json({ error: "The request could not be completed." });
  }
}

export async function get_user_filter_option(
  _req: Request,
  res: Response,
  _next?: NextFunction,
  service = userService,
) {
  try {
    res.status(200).json(await service.get_user_filter_option());
  } catch (error) {
    if (error instanceof PaginationError) {
      res.status(400).json({ error: error.message });
      return;
    }
    if (error instanceof UserError && user_error_status[error.code]) {
      res.status(user_error_status[error.code]!).json({ error: error.message });
      return;
    }
    const visited = new Set<unknown>();
    const pending = [error];
    let code = "";
    let fallback = "";
    while (pending.length) {
      const current = pending.pop();
      if (!current || typeof current !== "object" || visited.has(current))
        continue;
      visited.add(current);
      if ("code" in current && typeof current.code === "string") {
        if (Object.hasOwn(prisma_error_codes, current.code)) {
          code = prisma_error_codes[current.code];
          break;
        }
        if (
          /^[0-9A-Z]{5}$/.test(current.code) &&
          !/^P\d{4}$/.test(current.code)
        ) {
          code = current.code;
          break;
        }
        fallback ||= current.code;
      }
      if (
        "originalCode" in current &&
        typeof current.originalCode === "string" &&
        /^[0-9A-Z]{5}$/.test(current.originalCode)
      ) {
        code = current.originalCode;
        break;
      }
      if ("cause" in current) pending.push(current.cause);
      if ("meta" in current) pending.push(current.meta);
      if ("driverAdapterError" in current)
        pending.push(current.driverAdapterError);
    }
    code ||= fallback;
    const databaseError = Object.hasOwn(user_database_errors, code)
      ? user_database_errors[code]
      : undefined;
    if (databaseError) {
      res.status(databaseError.status).json({ error: databaseError.message });
      return;
    }
    console.error("Users request failed:", error);
    res.status(500).json({ error: "The request could not be completed." });
  }
}

export async function get_user_option(
  _req: Request,
  res: Response,
  _next?: NextFunction,
  service = userService,
) {
  try {
    res.status(200).json(await service.get_user_option());
  } catch (error) {
    if (error instanceof PaginationError) {
      res.status(400).json({ error: error.message });
      return;
    }
    if (error instanceof UserError && user_error_status[error.code]) {
      res.status(user_error_status[error.code]!).json({ error: error.message });
      return;
    }
    const visited = new Set<unknown>();
    const pending = [error];
    let code = "";
    let fallback = "";
    while (pending.length) {
      const current = pending.pop();
      if (!current || typeof current !== "object" || visited.has(current))
        continue;
      visited.add(current);
      if ("code" in current && typeof current.code === "string") {
        if (Object.hasOwn(prisma_error_codes, current.code)) {
          code = prisma_error_codes[current.code];
          break;
        }
        if (
          /^[0-9A-Z]{5}$/.test(current.code) &&
          !/^P\d{4}$/.test(current.code)
        ) {
          code = current.code;
          break;
        }
        fallback ||= current.code;
      }
      if (
        "originalCode" in current &&
        typeof current.originalCode === "string" &&
        /^[0-9A-Z]{5}$/.test(current.originalCode)
      ) {
        code = current.originalCode;
        break;
      }
      if ("cause" in current) pending.push(current.cause);
      if ("meta" in current) pending.push(current.meta);
      if ("driverAdapterError" in current)
        pending.push(current.driverAdapterError);
    }
    code ||= fallback;
    const databaseError = Object.hasOwn(user_database_errors, code)
      ? user_database_errors[code]
      : undefined;
    if (databaseError) {
      res.status(databaseError.status).json({ error: databaseError.message });
      return;
    }
    console.error("Users request failed:", error);
    res.status(500).json({ error: "The request could not be completed." });
  }
}

export async function create_user(
  req: Request,
  res: Response,
  _next?: NextFunction,
  service = userService,
) {
  try {
    const body: unknown = req.body;
if (!body || typeof body !== "object" || Array.isArray(body))
    throw new UserError("invalid_input", "Provide user details.");
const { name, email, password, company_id, role_ids } = body as Record<
    string,
    unknown
  >;
const uuid =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
if (typeof name !== "string" || !name.trim() || name.trim().length > 250)
    throw new UserError(
      "invalid_input",
      "Provide a name between 1 and 250 characters.",
    );
if (
    typeof email !== "string" ||
    email.trim().length > 254 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
  )
    throw new UserError("invalid_input", "Provide a valid email.");
if (
    typeof password !== "string" ||
    password.length < 8 ||
    password.length > 128
  )
    throw new UserError(
      "invalid_input",
      "Provide a password between 8 and 128 characters.",
    );
if (
    company_id !== undefined &&
    (typeof company_id !== "string" || !uuid.test(company_id))
  )
    throw new UserError(
      "invalid_input",
      "Select a valid company or omit company_id.",
    );
const roleIds = role_ids === undefined ? [] : role_ids;
if (
    !Array.isArray(roleIds) ||
    roleIds.length > 50 ||
    roleIds.some((id) => typeof id !== "string" || !uuid.test(id)) ||
    new Set(roleIds).size !== roleIds.length
  )
    throw new UserError(
      "invalid_input",
      "Provide distinct company roles (maximum 50) or omit role_ids.",
    );
if (
    Object.keys(body).some(
      (key) =>
        !["name", "email", "password", "company_id", "role_ids"].includes(key),
    )
  )
    throw new UserError("invalid_input", "Unknown user field.");
    const input: CreateUserInput = {
    name: name.trim(),
    email: email.trim().toLowerCase(),
    password,
    company_id,
    role_ids: roleIds,
  };
    res.status(201).json({ user: await service.create_user(input) });
  } catch (error) {
    if (error instanceof PaginationError) {
      res.status(400).json({ error: error.message });
      return;
    }
    if (error instanceof UserError && user_error_status[error.code]) {
      res.status(user_error_status[error.code]!).json({ error: error.message });
      return;
    }
    const visited = new Set<unknown>();
    const pending = [error];
    let code = "";
    let fallback = "";
    while (pending.length) {
      const current = pending.pop();
      if (!current || typeof current !== "object" || visited.has(current))
        continue;
      visited.add(current);
      if ("code" in current && typeof current.code === "string") {
        if (Object.hasOwn(prisma_error_codes, current.code)) {
          code = prisma_error_codes[current.code];
          break;
        }
        if (
          /^[0-9A-Z]{5}$/.test(current.code) &&
          !/^P\d{4}$/.test(current.code)
        ) {
          code = current.code;
          break;
        }
        fallback ||= current.code;
      }
      if (
        "originalCode" in current &&
        typeof current.originalCode === "string" &&
        /^[0-9A-Z]{5}$/.test(current.originalCode)
      ) {
        code = current.originalCode;
        break;
      }
      if ("cause" in current) pending.push(current.cause);
      if ("meta" in current) pending.push(current.meta);
      if ("driverAdapterError" in current)
        pending.push(current.driverAdapterError);
    }
    code ||= fallback;
    const databaseError = Object.hasOwn(user_database_errors, code)
      ? user_database_errors[code]
      : undefined;
    if (databaseError) {
      res.status(databaseError.status).json({ error: databaseError.message });
      return;
    }
    console.error("Users request failed:", error);
    res.status(500).json({ error: "The request could not be completed." });
  }
}
