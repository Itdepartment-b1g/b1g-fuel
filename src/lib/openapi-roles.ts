import { DEFAULT_PAGE_SIZE, PAGE_SIZE_OPTIONS } from "./pagination";
import { PAGE_CATALOG } from "./auth/catalog";
import { PERMISSION_CATALOG } from "./auth/permissions";

const error = { description: "Request failed", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } };
const json = (schema: object) => ({ content: { "application/json": { schema } } });
const ref = (name: string) => ({ $ref: `#/components/schemas/${name}` });
const name = { type: "string", minLength: 1, maxLength: 100, example: "Branch Manager" };
const pages = { type: "array", maxItems: 200, uniqueItems: true, items: { type: "string", enum: PAGE_CATALOG.map((page) => page.key) } };
const permissions = { type: "array", maxItems: 200, uniqueItems: true, items: { type: "string", enum: PERMISSION_CATALOG.map((permission) => permission.key) } };
const editable = { name, is_default_role: { type: "boolean", description: "Company scope only. Clear the previous default before selecting another." }, pages, permissions };
const idParameter = { name: "id", in: "query", required: true, schema: { type: "string", format: "uuid" } };
const security = [{ session: [] }];
const mutationErrors = { "400": error, "401": error, "403": error, "404": error, "409": error, "429": error, "500": error };

export const roleSchemas = {
  Role: { type: "object", required: ["id", "name", "slug", "scope", "is_system", "is_default_role", "created_at", "updated_at", "pages", "permissions", "assignment_count"], properties: {
    id: { type: "string", format: "uuid" }, name, slug: { type: "string", maxLength: 100 }, scope: { type: "string", enum: ["global", "company"] },
    is_system: { type: "boolean", readOnly: true }, is_default_role: { type: "boolean" }, created_at: { type: "string", format: "date-time" }, updated_at: { type: "string", format: "date-time" },
    pages, permissions, assignment_count: { type: "integer", minimum: 0, readOnly: true },
  } },
  RolesPage: { type: "object", required: ["roles", "total", "page", "page_size"], properties: {
    roles: { type: "array", items: ref("Role") }, total: { type: "integer", minimum: 0 }, page: { type: "integer", minimum: 1 }, page_size: { type: "integer", enum: [...PAGE_SIZE_OPTIONS] },
  } },
  RoleResponse: { type: "object", required: ["role"], properties: { role: ref("Role") } },
  CreateRole: { type: "object", additionalProperties: false, required: ["name"], properties: {
    ...editable,
    slug: { type: "string", maxLength: 100, pattern: "^[a-z][a-z0-9]*(?:[_-][a-z0-9]+)*$", example: "branch_manager", description: "Optional; derived from the name when omitted. Trimmed/lowercased. Must be unique; super_admin is reserved." },
    scope: { type: "string", enum: ["company", "global"], default: "company" },
  } },
  UpdateRole: { type: "object", additionalProperties: false, required: ["id"], minProperties: 2, properties: { id: { type: "string", format: "uuid" }, ...editable } },
  DeleteRoleResponse: { type: "object", required: ["id", "message"], properties: { id: { type: "string", format: "uuid" }, message: { type: "string" } } },
  RoleOptions: { type: "object", required: ["scopes", "pages", "permissions"], properties: {
    scopes: { type: "array", items: { type: "string", enum: ["company", "global"] } },
    pages: { type: "array", items: { type: "object", required: ["key", "label", "href"], properties: { key: { type: "string" }, label: { type: "string" }, href: { type: "string" } } } },
    permissions: { type: "array", items: { type: "object", required: ["key", "label"], properties: { key: { type: "string" }, label: { type: "string" } } } },
  } },
};

export const rolePaths = {
  "/api/roles": {
    get: { tags: ["Roles"], security, summary: "List roles or get a role by ID (super_admin only)", parameters: [
      { ...idParameter, required: false, description: "When supplied, returns one role and ignores list filters." },
      { name: "page", in: "query", schema: { type: "integer", minimum: 1, maximum: 1000000, default: 1 } },
      { name: "page_size", in: "query", schema: { type: "integer", enum: [...PAGE_SIZE_OPTIONS], default: DEFAULT_PAGE_SIZE } },
      { name: "search", in: "query", description: "Case-insensitive name/slug search", schema: { type: "string", maxLength: 100 } },
      { name: "scope", in: "query", schema: { type: "string", enum: ["company", "global"] } },
    ], responses: { "200": { description: "Paginated roles, or one role when id is supplied", ...json({ oneOf: [ref("RolesPage"), ref("RoleResponse")] }) }, "400": error, "401": error, "403": error, "404": error, "500": error } },
    post: { tags: ["Roles"], security, summary: "Create a custom role (super_admin only)", description: "Requires APP_ORIGIN. is_system is server-managed. Page/permission mappings are optional; storing them does not implement company authorization or assign users.", requestBody: { required: true, ...json(ref("CreateRole")) }, responses: { "201": { description: "Role created", ...json(ref("RoleResponse")) }, ...mutationErrors } },
    patch: { tags: ["Roles"], security, summary: "Update a custom role (super_admin only)", description: "Requires APP_ORIGIN. Slug/scope are immutable. System roles cannot be edited. Omitted mappings are preserved; empty arrays clear them atomically.", requestBody: { required: true, ...json(ref("UpdateRole")) }, responses: { "200": { description: "Role updated", ...json(ref("RoleResponse")) }, ...mutationErrors } },
    delete: { tags: ["Roles"], security, summary: "Delete an unassigned custom role (super_admin only)", description: "Requires APP_ORIGIN. System roles cannot be deleted. Assigned roles return 409. Deletion cascades to page/permission mappings.", parameters: [idParameter], responses: { "200": { description: "Role deleted", ...json(ref("DeleteRoleResponse")) }, ...mutationErrors } },
  },
  "/api/roles/options": { get: { tags: ["Roles"], security, summary: "Get registered scopes, page and permission choices (super_admin only)", responses: {
    "200": { description: "Role form options", ...json(ref("RoleOptions")) }, "401": error, "403": error, "500": error,
  } } },
};
