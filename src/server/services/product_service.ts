import type { QuickFilterState } from "@/types/quick-filter";
import { PRODUCT_FILTER_OPTIONS } from "@/utils/management-filters";
import type { RecordAccess } from "@/server/auth/record-access";
import { getDatabase } from "@/server/lib/database";
import { build_filter_options } from "@/server/lib/quick-filters";
import type { Pagination } from "@/server/lib/pagination";
import type { Sorting } from "@/server/lib/sorting";
import type {
  CreateProductInput,
  UpdateProductInput,
} from "@/server/schema/product_schema";
import * as repository from "@/server/repositories/product_repository";

export class ProductError extends Error {
  constructor(
    public code: "invalid_input" | "not_found" | "forbidden" | "conflict",
    message: string,
  ) {
    super(message);
  }
}

export function list_products(
  pagination: Pagination,
  search: string,
  sorting: Sorting | undefined,
  access: RecordAccess,
  companyId?: string,
  filters?: QuickFilterState,
) {
  return repository.list_products(
    pagination,
    search,
    sorting,
    access,
    companyId,
    filters,
  );
}

export async function list_by_id_product(id: string, access: RecordAccess) {
  const row = await repository.list_by_id_product(id, access);
  if (!row) throw new ProductError("not_found", "Product not found.");
  return row;
}

function can_create(access: RecordAccess, companyId: string) {
  return (
    access.superAdmin ||
    access.grants.some(
      (grant) =>
        grant.permission === "products.add" &&
        ((grant.scope === "all" && !grant.companyId) ||
          (grant.companyId
            ? grant.companyId === companyId
            : access.companyIds.includes(companyId))),
    )
  );
}

function product_company(access: RecordAccess, requested?: string) {
  if (access.superAdmin) {
    if (!requested)
      throw new ProductError("invalid_input", "Select a company.");
    return requested;
  }
  const unrestricted = access.grants.some(
    (grant) =>
      grant.permission === "products.add" &&
      grant.scope === "all" &&
      !grant.companyId,
  );
  const granted = [
    ...new Set(
      access.grants
        .filter((grant) => grant.permission === "products.add")
        .flatMap((grant) =>
          grant.companyId ? [grant.companyId] : access.companyIds,
        ),
    ),
  ];
  const choices = unrestricted ? access.companyIds : granted;
  if (choices.length === 1) {
    if (!can_create(access, choices[0]))
      throw new ProductError(
        "forbidden",
        "You cannot create products in this company.",
      );
    return choices[0];
  }
  if (!requested)
    throw new ProductError("invalid_input", "Select a company.");
  if (!can_create(access, requested))
    throw new ProductError(
      "forbidden",
      "You cannot create products in this company.",
    );
  return requested;
}

export async function create_product(
  input: CreateProductInput,
  access: RecordAccess,
) {
  if (!input.variant_id || !input.base_unit_id || !input.product_type_id)
    throw new ProductError(
      "invalid_input",
      "Select a variant, base unit, and product type.",
    );
  const note = input.note?.trim() ?? "";
  if (note.length > 160)
    throw new ProductError(
      "invalid_input",
      "Provide a note of at most 160 characters.",
    );
  const company_id = product_company(access, input.company_id);
  return repository.create_product(
    {
      company_id,
      variant_id: input.variant_id,
      base_unit_id: input.base_unit_id,
      product_type_id: input.product_type_id,
      note,
    },
    access.userId,
  );
}

export async function update_product(
  input: UpdateProductInput,
  access: RecordAccess,
) {
  if (input.note !== undefined && input.note.trim().length > 160)
    throw new ProductError(
      "invalid_input",
      "Provide a note of at most 160 characters.",
    );
  const row = await repository.update_product(
    {
      ...input,
      ...(input.note !== undefined ? { note: input.note.trim() } : {}),
    },
    access,
  );
  if (!row) throw new ProductError("not_found", "Product not found.");
  return row;
}

export async function delete_product(id: string, access: RecordAccess) {
  const result = await repository.delete_product(id, access);
  if (result === "not_found")
    throw new ProductError("not_found", "Product not found.");
}

export async function get_product_filter_options(access: RecordAccess) {
  const records = await repository.get_product_filter_data(access);
  return build_filter_options(
    records,
    PRODUCT_FILTER_OPTIONS,
    (row, field) =>
      field === "company"
        ? { value: row.company.id, label: row.company.name }
        : { value: row.product_type.id, label: row.product_type.name },
    () => true,
  );
}

export async function get_product_options(access: RecordAccess) {
  const all =
    access.superAdmin ||
    access.grants.some(
      (grant) =>
        grant.permission === "products.add" &&
        grant.scope === "all" &&
        !grant.companyId,
    );
  const ids = [
    ...new Set(
      access.grants
        .filter((grant) => grant.permission === "products.add")
        .flatMap((grant) =>
          grant.companyId ? [grant.companyId] : access.companyIds,
        ),
    ),
  ];
  const client = getDatabase();
  const companyWhere = all ? {} : { id: { in: ids } };
  const [companies, variants, units, product_types] = await Promise.all([
    client.company.findMany({
      where: companyWhere,
      select: { id: true, name: true },
      orderBy: [{ name: "asc" }, { id: "asc" }],
    }),
    client.variant.findMany({
      where: all
        ? {}
        : {
            OR: [{ company_id: null }, { company_id: { in: ids } }],
          },
      select: {
        id: true,
        name: true,
        company_id: true,
        brand: { select: { id: true, name: true } },
      },
      orderBy: [{ name: "asc" }, { id: "asc" }],
    }),
    client.measurement_unit.findMany({
      where: all
        ? {}
        : {
            measurement: {
              OR: [{ company_id: null }, { company_id: { in: ids } }],
            },
          },
      select: {
        id: true,
        name: true,
        symbol: true,
        key: true,
        measurement: {
          select: { id: true, name: true, company_id: true },
        },
      },
      orderBy: [{ name: "asc" }, { id: "asc" }],
    }),
    client.product_type.findMany({
      where: all
        ? {}
        : {
            OR: [{ company_id: null }, { company_id: { in: ids } }],
          },
      select: { id: true, name: true, key: true, company_id: true },
      orderBy: [{ name: "asc" }, { id: "asc" }],
    }),
  ]);
  return { companies, variants, units, product_types };
}
