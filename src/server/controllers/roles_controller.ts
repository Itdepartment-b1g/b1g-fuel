import { parse_sort, SortingError } from "@/server/lib/sorting";
import { ROLE_SORT_FIELDS } from "@/server/schema/roles_schema";
import type { Request, Response, NextFunction } from "express";
import * as roleService from "@/server/services/roles_service";
import { RoleError } from "@/server/services/roles_service";
import { parsePagination, PaginationError } from "@/server/lib/pagination";
import type {
  CreateRoleInput,
  UpdateRoleInput,
} from "@/server/schema/roles_schema";
import { PAGE_CATALOG } from "@/lib/auth/catalog";
import { PERMISSION_CATALOG } from "@/lib/auth/permissions";

const role_id_pattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const role_mapping_rules: ReadonlyArray<
  readonly ["pages" | "permissions", string, readonly string[]]
> = [
  ["pages", "page", PAGE_CATALOG.map((page) => page.key)],
  [
    "permissions",
    "permission",
    PERMISSION_CATALOG.map((permission) => permission.key),
  ],
];
const role_error_status: Partial<Record<RoleError["code"], number>> = {
  invalid_input: 400,
  role_not_found: 404,
  system_role: 403,
  company_default_required: 400,
  role_changed: 409,
  role_assigned: 409,
};
const role_database_errors: Record<
  string,
  { status: number; message: string }
> = {
  "23505": {
    status: 409,
    message:
      "The slug is already in use or a company role is already marked as default. Clear the existing default before choosing another.",
  },
  "23503": {
    status: 409,
    message: "This role is assigned to users and cannot be deleted.",
  },
  "23514": {
    status: 400,
    message: "Role details do not meet the database requirements.",
  },
};
const prisma_error_codes: Record<string, string> = {
  P2002: "23505",
  P2003: "23503",
  P2004: "23514",
};

export async function create_role(
  req: Request,
  res: Response,
  _next?: NextFunction,
  service = roleService,
) {
  try {
    const value: unknown = req.body;
    if (!value || typeof value !== "object" || Array.isArray(value))
      throw new RoleError("invalid_input", "Provide role details.");
    const body = value as Record<string, unknown>;
    if (
      Object.keys(body).some(
        (key) =>
          ![
            "name",
            "slug",
            "scope",
            "is_default_role",
            "pages",
            "permissions",
          ].includes(key),
      )
    )
      throw new RoleError("invalid_input", "Unknown or read-only role field.");
    if (
      typeof body.name !== "string" ||
      !body.name.trim() ||
      body.name.trim().length > 100
    )
      throw new RoleError(
        "invalid_input",
        "Provide a role name between 1 and 100 characters.",
      );
    const name = body.name.trim();
    const derived = name
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "");
    const slug =
      body.slug === undefined
        ? derived
        : typeof body.slug === "string"
          ? body.slug.trim().toLowerCase()
          : "";
    if (
      !slug ||
      slug.length > 100 ||
      !/^[a-z][a-z0-9]*(?:[_-][a-z0-9]+)*$/.test(slug)
    )
      throw new RoleError(
        "invalid_input",
        "Provide a slug of at most 100 characters using lowercase letters, numbers, underscores or hyphens, starting with a letter.",
      );
    const scope = body.scope === undefined ? "company" : body.scope;
    if (scope !== "company" && scope !== "global")
      throw new RoleError(
        "invalid_input",
        "Role scope must be company or global.",
      );
    const is_default_role =
      body.is_default_role === undefined ? false : body.is_default_role;
    if (typeof is_default_role !== "boolean")
      throw new RoleError(
        "invalid_input",
        "is_default_role must be a boolean.",
      );
    const mappings: Record<"pages" | "permissions", string[]> = {
      pages: [],
      permissions: [],
    };
    for (const [field, label, allowed] of role_mapping_rules) {
      const keys = body[field];
      if (keys === undefined) continue;
      if (
        !Array.isArray(keys) ||
        keys.length > 200 ||
        keys.some((key) => typeof key !== "string" || !allowed.includes(key)) ||
        new Set(keys).size !== keys.length
      )
        throw new RoleError(
          "invalid_input",
          "Provide distinct, registered " + label + " keys (maximum 200).",
        );
      mappings[field] = keys as string[];
    }
    const input: Required<CreateRoleInput> = {
      name,
      slug,
      scope,
      is_default_role,
      ...mappings,
    };
    res.status(201).json({ role: await service.create_role(input) });
  } catch (error) {
    if (error instanceof PaginationError) {
      res.status(400).json({ error: error.message });
      return;
    }
    if (error instanceof RoleError && role_error_status[error.code]) {
      res.status(role_error_status[error.code]!).json({ error: error.message });
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
    const databaseError = Object.hasOwn(role_database_errors, code)
      ? role_database_errors[code]
      : undefined;
    if (databaseError) {
      res.status(databaseError.status).json({ error: databaseError.message });
      return;
    }
    console.error("Roles request failed:", error);
    res.status(500).json({ error: "The request could not be completed." });
  }
}

export async function update_role(
  req: Request,
  res: Response,
  _next?: NextFunction,
  service = roleService,
) {
  try {
    const value: unknown = req.body;
    if (!value || typeof value !== "object" || Array.isArray(value))
      throw new RoleError("invalid_input", "Provide role details.");
    const body = value as Record<string, unknown>;
    if (
      Object.keys(body).some(
        (key) =>
          !["id", "name", "is_default_role", "pages", "permissions"].includes(
            key,
          ),
      )
    )
      throw new RoleError("invalid_input", "Unknown or read-only role field.");
    if (!Object.keys(body).some((key) => key !== "id"))
      throw new RoleError(
        "invalid_input",
        "Provide at least one editable role field.",
      );
    if (typeof body.id !== "string" || !role_id_pattern.test(body.id))
      throw new RoleError("invalid_input", "Provide a valid role ID.");
    const input: UpdateRoleInput = { id: body.id.toLowerCase() };
    if (body.name !== undefined) {
      if (
        typeof body.name !== "string" ||
        !body.name.trim() ||
        body.name.trim().length > 100
      )
        throw new RoleError(
          "invalid_input",
          "Provide a role name between 1 and 100 characters.",
        );
      input.name = body.name.trim();
    }
    if (body.is_default_role !== undefined) {
      if (typeof body.is_default_role !== "boolean")
        throw new RoleError(
          "invalid_input",
          "is_default_role must be a boolean.",
        );
      input.is_default_role = body.is_default_role;
    }
    for (const [field, label, allowed] of role_mapping_rules) {
      const keys = body[field];
      if (keys === undefined) continue;
      if (
        !Array.isArray(keys) ||
        keys.length > 200 ||
        keys.some((key) => typeof key !== "string" || !allowed.includes(key)) ||
        new Set(keys).size !== keys.length
      )
        throw new RoleError(
          "invalid_input",
          "Provide distinct, registered " + label + " keys (maximum 200).",
        );
      input[field] = keys as string[];
    }
    res.status(200).json({ role: await service.update_role(input) });
  } catch (error) {
    if (error instanceof PaginationError) {
      res.status(400).json({ error: error.message });
      return;
    }
    if (error instanceof RoleError && role_error_status[error.code]) {
      res.status(role_error_status[error.code]!).json({ error: error.message });
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
    const databaseError = Object.hasOwn(role_database_errors, code)
      ? role_database_errors[code]
      : undefined;
    if (databaseError) {
      res.status(databaseError.status).json({ error: databaseError.message });
      return;
    }
    console.error("Roles request failed:", error);
    res.status(500).json({ error: "The request could not be completed." });
  }
}

export async function delete_role(
  req: Request,
  res: Response,
  _next?: NextFunction,
  service = roleService,
) {
  try {
    const id = req.query.id;
    if (typeof id !== "string" || !role_id_pattern.test(id))
      throw new RoleError("invalid_input", "Provide a valid role ID.");
    res.status(200).json(await service.delete_role(id.toLowerCase()));
  } catch (error) {
    if (error instanceof PaginationError) {
      res.status(400).json({ error: error.message });
      return;
    }
    if (error instanceof RoleError && role_error_status[error.code]) {
      res.status(role_error_status[error.code]!).json({ error: error.message });
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
    const databaseError = Object.hasOwn(role_database_errors, code)
      ? role_database_errors[code]
      : undefined;
    if (databaseError) {
      res.status(databaseError.status).json({ error: databaseError.message });
      return;
    }
    console.error("Roles request failed:", error);
    res.status(500).json({ error: "The request could not be completed." });
  }
}

export async function list_by_id_role(
  req: Request,
  res: Response,
  _next?: NextFunction,
  service = roleService,
) {
  try {
    const id = req.query.id;
    if (typeof id !== "string" || !role_id_pattern.test(id))
      throw new RoleError("invalid_input", "Provide a valid role ID.");
    res
      .status(200)
      .json({ role: await service.list_by_id_role(id.toLowerCase()) });
  } catch (error) {
    if (error instanceof PaginationError) {
      res.status(400).json({ error: error.message });
      return;
    }
    if (error instanceof RoleError && role_error_status[error.code]) {
      res.status(role_error_status[error.code]!).json({ error: error.message });
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
    const databaseError = Object.hasOwn(role_database_errors, code)
      ? role_database_errors[code]
      : undefined;
    if (databaseError) {
      res.status(databaseError.status).json({ error: databaseError.message });
      return;
    }
    console.error("Roles request failed:", error);
    res.status(500).json({ error: "The request could not be completed." });
  }
}

export async function list_role(
  req: Request,
  res: Response,
  _next?: NextFunction,
  service = roleService,
) {
  try {
    const sorting = parse_sort(req.query, ROLE_SORT_FIELDS);
    const pagination = parsePagination(req.query);
    const search = req.query.search ?? "";
    if (typeof search !== "string" || search.length > 100)
      throw new RoleError(
        "invalid_input",
        "Search must contain at most 100 characters.",
      );
    const scope = req.query.scope;
    if (scope !== undefined && scope !== "company" && scope !== "global")
      throw new RoleError(
        "invalid_input",
        "Role scope must be company or global.",
      );
    res
      .status(200)
      .json(await service.list_role(pagination, search.trim(), scope, sorting));
  } catch (error) {
    if (error instanceof PaginationError || error instanceof SortingError) {
      res.status(400).json({ error: error.message });
      return;
    }
    if (error instanceof RoleError && role_error_status[error.code]) {
      res.status(role_error_status[error.code]!).json({ error: error.message });
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
    const databaseError = Object.hasOwn(role_database_errors, code)
      ? role_database_errors[code]
      : undefined;
    if (databaseError) {
      res.status(databaseError.status).json({ error: databaseError.message });
      return;
    }
    console.error("Roles request failed:", error);
    res.status(500).json({ error: "The request could not be completed." });
  }
}
