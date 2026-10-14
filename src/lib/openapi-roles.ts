import { ROLE_SORT_FIELDS } from "@/server/schema/roles_schema";
import { DEFAULT_PAGE_SIZE, PAGE_SIZE_OPTIONS } from "@/utils/pagination";
import { PAGE_CATALOG } from "./auth/catalog";
import { PERMISSION_CATALOG } from "./auth/permissions";

const error = {
  description: "Request failed",
  content: {
    "application/json": { schema: { $ref: "#/components/schemas/Error" } },
  },
};
const json = (schema: object) => ({
  content: { "application/json": { schema } },
});
const ref = (name: string) => ({ $ref: `#/components/schemas/${name}` });
const name = {
  type: "string",
  minLength: 1,
  maxLength: 100,
  example: "Branch Manager",
};
const pages = {
  type: "array",
  maxItems: 200,
  uniqueItems: true,
  items: { type: "string", enum: PAGE_CATALOG.map((page) => page.key) },
};
const permissions = {
  type: "array",
  maxItems: 200,
  uniqueItems: true,
  items: {
    type: "string",
    enum: PERMISSION_CATALOG.map((permission) => permission.key),
  },
};
const permissionScopes = {
  type: "object",
  additionalProperties: { type: "string", enum: ["all", "company", "own"] },
  description:
    "Access scope per selected View, Edit, or Delete permission; defaults to company. All covers every record. Create is enabled or disabled and has no scope.",
};
const editable = {
  permission_scopes: permissionScopes,
  company_id: {
    type: ["string", "null"],
    format: "uuid",
    description:
      "Company scope only. A role belongs to one company; assigned roles cannot change company.",
  },
  name,
  is_default_role: {
    type: "boolean",
    description:
      "Company scope only. Clear the previous default before selecting another.",
  },
  pages,
  permissions,
};
const idParameter = {
  name: "id",
  in: "query",
  required: true,
  schema: { type: "string", format: "uuid" },
};
const security = [{ session: [] }];
const mutationErrors = {
  "400": error,
  "401": error,
  "403": error,
  "404": error,
  "409": error,
  "429": error,
  "500": error,
};

export const roleSchemas = {
  Role: {
    type: "object",
    required: [
      "id",
      "name",
      "slug",
      "scope",
      "company_id",
      "company",
      "is_system",
      "is_default_role",
      "created_at",
      "updated_at",
      "pages",
      "permissions",
      "permission_scopes",
      "created_by",
      "assignment_count",
    ],
    properties: {
      id: { type: "string", format: "uuid" },
      name,
      slug: { type: "string", maxLength: 100 },
      scope: { type: "string", enum: ["global", "company"] },
      company_id: { type: ["string", "null"], format: "uuid" },
      company: {
        anyOf: [
          { type: "null" },
          {
            type: "object",
            required: ["id", "name"],
            properties: {
              id: { type: "string", format: "uuid" },
              name: { type: "string" },
            },
          },
        ],
      },
      is_system: { type: "boolean", readOnly: true },
      is_default_role: { type: "boolean" },
      created_at: { type: "string", format: "date-time" },
      updated_at: { type: "string", format: "date-time" },
      pages,
      permissions,
      permission_scopes: permissionScopes,
      created_by: {
        type: "string",
        format: "uuid",
        nullable: true,
        readOnly: true,
      },
      assignment_count: { type: "integer", minimum: 0, readOnly: true },
    },
  },
  RolesPage: {
    type: "object",
    required: ["roles", "total", "page", "page_size"],
    properties: {
      roles: { type: "array", items: ref("Role") },
      total: { type: "integer", minimum: 0 },
      page: { type: "integer", minimum: 1 },
      page_size: { type: "integer", enum: [...PAGE_SIZE_OPTIONS] },
    },
  },
  RoleResponse: {
    type: "object",
    required: ["role"],
    properties: { role: ref("Role") },
  },
  CreateRole: {
    type: "object",
    additionalProperties: false,
    required: ["name"],
    properties: {
      ...editable,
      slug: {
        type: "string",
        maxLength: 100,
        pattern: "^[a-z][a-z0-9]*(?:[_-][a-z0-9]+)*$",
        example: "branch_manager",
        description:
          "Optional; derived from the name when omitted. Trimmed/lowercased. Must be unique; super_admin is reserved.",
      },
      scope: {
        type: "string",
        enum: ["company", "global"],
        default: "company",
      },
    },
  },
  UpdateRole: {
    type: "object",
    additionalProperties: false,
    required: ["id"],
    minProperties: 2,
    properties: { id: { type: "string", format: "uuid" }, ...editable },
  },
  DeleteRoleResponse: {
    type: "object",
    required: ["id", "message"],
    properties: {
      id: { type: "string", format: "uuid" },
      message: { type: "string" },
    },
  },
  RoleOptions: {
    type: "object",
    required: ["companies", "scopes", "pages", "permissions"],
    properties: {
      companies: {
        type: "array",
        items: {
          type: "object",
          required: ["id", "name"],
          properties: {
            id: { type: "string", format: "uuid" },
            name: { type: "string" },
          },
        },
      },
      scopes: {
        type: "array",
        items: { type: "string", enum: ["company", "global"] },
      },
      pages: {
        type: "array",
        items: {
          type: "object",
          required: ["key", "label", "href"],
          properties: {
            key: { type: "string" },
            label: { type: "string" },
            href: { type: "string" },
          },
        },
      },
      permissions: {
        type: "array",
        items: {
          type: "object",
          required: ["key", "label", "page_key", "action"],
          properties: {
            key: { type: "string" },
            label: { type: "string" },
            page_key: { type: "string" },
            action: { type: "string", enum: ["view", "edit", "add", "delete"] },
          },
        },
      },
    },
  },
};

export const rolePaths = {
  "/api/roles": {
    get: {
      tags: ["Roles"],
      security,
      summary: "List roles or get a role within its granted view scope",
      parameters: [
        {
          ...idParameter,
          required: false,
          description:
            "When supplied, returns one role and ignores list filters.",
        },
        {
          name: "page",
          in: "query",
          schema: { type: "integer", minimum: 1, maximum: 1000000, default: 1 },
        },
        {
          name: "sort_by",
          in: "query",
          description: "Sort before pagination; defaults to created_at.",
          schema: { type: "string", enum: [...ROLE_SORT_FIELDS] },
        },
        {
          name: "sort_order",
          in: "query",
          description:
            "asc or desc; defaults to desc for created_at and asc for other fields.",
          schema: { type: "string", enum: ["asc", "desc"] },
        },
        {
          name: "page_size",
          in: "query",
          schema: {
            type: "integer",
            enum: [...PAGE_SIZE_OPTIONS],
            default: DEFAULT_PAGE_SIZE,
          },
        },
        {
          name: "search",
          in: "query",
          description: "Case-insensitive name/slug search",
          schema: { type: "string", maxLength: 100 },
        },
        {
          name: "scope",
          in: "query",
          schema: { type: "string", enum: ["company", "global"] },
        },
      ],
      responses: {
        "200": {
          description: "Paginated roles, or one role when id is supplied",
          ...json({ oneOf: [ref("RolesPage"), ref("RoleResponse")] }),
        },
        "400": error,
        "401": error,
        "403": error,
        "404": error,
        "500": error,
      },
    },
    post: {
      tags: ["Roles"],
      security,
      summary: "Create a custom role (super_admin only)",
      description:
        "Requires APP_ORIGIN. is_system is server-managed. Page permissions enforce record access scopes. Company role assignments remain administrator-managed.",
      requestBody: { required: true, ...json(ref("CreateRole")) },
      responses: {
        "201": { description: "Role created", ...json(ref("RoleResponse")) },
        ...mutationErrors,
      },
    },
    patch: {
      tags: ["Roles"],
      security,
      summary: "Update a custom role (super_admin only)",
      description:
        "Requires APP_ORIGIN. Slug/scope are immutable. System roles cannot be edited. Omitted mappings are preserved; empty arrays clear them atomically.",
      requestBody: { required: true, ...json(ref("UpdateRole")) },
      responses: {
        "200": { description: "Role updated", ...json(ref("RoleResponse")) },
        ...mutationErrors,
      },
    },
    delete: {
      tags: ["Roles"],
      security,
      summary: "Delete an unassigned custom role (super_admin only)",
      description:
        "Requires APP_ORIGIN. System roles cannot be deleted. Assigned roles return 409. Deletion cascades to page/permission mappings.",
      parameters: [idParameter],
      responses: {
        "200": {
          description: "Role deleted",
          ...json(ref("DeleteRoleResponse")),
        },
        ...mutationErrors,
      },
    },
  },
  "/api/roles/options": {
    get: {
      tags: ["Roles"],
      security,
      summary:
        "Get registered scopes, page and permission choices (super_admin only)",
      responses: {
        "200": {
          description: "Role form options",
          ...json(ref("RoleOptions")),
        },
        "401": error,
        "403": error,
        "500": error,
      },
    },
  },
};
