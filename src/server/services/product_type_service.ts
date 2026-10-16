import type { QuickFilterState } from "@/types/quick-filter";
import { PRODUCT_TYPE_FILTER_OPTIONS } from "@/utils/management-filters";
import type { RecordAccess } from "@/server/auth/record-access";
import { getDatabase } from "@/server/lib/database";
import { build_filter_options } from "@/server/lib/quick-filters";
import type { Pagination } from "@/server/lib/pagination";
import type { Sorting } from "@/server/lib/sorting";
import type {
  CreateProductTypeInput,
  UpdateProductTypeInput,
} from "@/server/schema/product_type_schema";
import * as repository from "@/server/repositories/product_type_repository";

export class ProductTypeError extends Error {
  constructor(
    public code: "invalid_input" | "not_found" | "forbidden" | "conflict",
    message: string,
  ) {
    super(message);
  }
}

function normalize_key(key: string) {
  return key
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

export function list_product_types(
  pagination: Pagination,
  search: string,
  sorting: Sorting | undefined,
  access: RecordAccess,
  companyId?: string,
  filters?: QuickFilterState,
) {
  return repository.list_product_types(
    pagination,
    search,
    sorting,
    access,
    companyId,
    filters,
  );
}

export async function list_by_id_product_type(id: string, access: RecordAccess) {
  const row = await repository.list_by_id_product_type(id, access);
  if (!row) throw new ProductTypeError("not_found", "Product type not found.");
  return row;
}

function can_create(access: RecordAccess, companyId: string) {
  return (
    access.superAdmin ||
    access.grants.some(
      (grant) =>
        grant.permission === "productTypes.add" &&
        ((grant.scope === "all" && !grant.companyId) ||
          (grant.companyId
            ? grant.companyId === companyId
            : access.companyIds.includes(companyId))),
    )
  );
}

function assigned_company(access: RecordAccess, requested?: string) {
  if (access.superAdmin) return null;
  const unrestricted = access.grants.some(
    (grant) =>
      grant.permission === "productTypes.add" &&
      grant.scope === "all" &&
      !grant.companyId,
  );
  const granted = [
    ...new Set(
      access.grants
        .filter((grant) => grant.permission === "productTypes.add")
        .flatMap((grant) =>
          grant.companyId ? [grant.companyId] : access.companyIds,
        ),
    ),
  ];
  const choices = unrestricted ? access.companyIds : granted;
  if (choices.length === 1) {
    if (!can_create(access, choices[0]))
      throw new ProductTypeError(
        "forbidden",
        "You cannot create product types in this company.",
      );
    return choices[0];
  }
  if (!requested)
    throw new ProductTypeError("invalid_input", "Select a company.");
  if (!can_create(access, requested))
    throw new ProductTypeError(
      "forbidden",
      "You cannot create product types in this company.",
    );
  return requested;
}

export async function create_product_type(
  input: CreateProductTypeInput,
  access: RecordAccess,
) {
  const name = input.name?.trim();
  const key = normalize_key(input.key || input.name || "");
  if (!name || name.length > 160)
    throw new ProductTypeError(
      "invalid_input",
      "Provide a product type name between 1 and 160 characters.",
    );
  if (!key || key.length > 64)
    throw new ProductTypeError(
      "invalid_input",
      "Provide a product type key between 1 and 64 characters.",
    );
  const company_id = assigned_company(access, input.company_id);
  return repository.create_product_type(
    { name, key, company_id: company_id ?? undefined },
    access.userId,
  );
}

export async function update_product_type(
  input: UpdateProductTypeInput,
  access: RecordAccess,
) {
  const data: UpdateProductTypeInput = { id: input.id };
  if (input.name !== undefined) {
    const name = input.name.trim();
    if (!name || name.length > 160)
      throw new ProductTypeError(
        "invalid_input",
        "Provide a product type name between 1 and 160 characters.",
      );
    data.name = name;
  }
  if (input.key !== undefined) {
    const key = normalize_key(input.key);
    if (!key || key.length > 64)
      throw new ProductTypeError(
        "invalid_input",
        "Provide a product type key between 1 and 64 characters.",
      );
    data.key = key;
  }
  const row = await repository.update_product_type(data, access);
  if (!row) throw new ProductTypeError("not_found", "Product type not found.");
  return row;
}

export async function delete_product_type(id: string, access: RecordAccess) {
  const result = await repository.delete_product_type(id, access);
  if (result === "not_found")
    throw new ProductTypeError("not_found", "Product type not found.");
}

export async function get_product_type_filter_options(access: RecordAccess) {
  const records = await repository.get_product_type_filter_data(access);
  return build_filter_options(
    records,
    PRODUCT_TYPE_FILTER_OPTIONS,
    (row, field) =>
      field === "company"
        ? row.company
          ? { value: row.company.id, label: row.company.name }
          : null
        : { value: row.name, label: row.name },
    (row, status) =>
      status === "all" || (row.company_id === null) === (status === "shared"),
  );
}

export async function get_product_type_options(access: RecordAccess) {
  const all =
    access.superAdmin ||
    access.grants.some(
      (grant) =>
        grant.permission === "productTypes.add" &&
        grant.scope === "all" &&
        !grant.companyId,
    );
  const ids = [
    ...new Set(
      access.grants
        .filter((grant) => grant.permission === "productTypes.add")
        .flatMap((grant) =>
          grant.companyId ? [grant.companyId] : access.companyIds,
        ),
    ),
  ];
  const companies = await getDatabase().company.findMany({
    where: all ? {} : { id: { in: ids } },
    select: { id: true, name: true },
    orderBy: [{ name: "asc" }, { id: "asc" }],
  });
  return { companies };
}
