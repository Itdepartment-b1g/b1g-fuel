import type { Prisma } from "@/generated/prisma/client";
import type { RecordAccess } from "@/server/auth/record-access";
import { record_where } from "@/server/auth/record-access";
import { getDatabase, type DatabaseExecutor } from "@/server/lib/database";
import { build_filter } from "@/server/lib/filter";
import { build_sort, type Sorting } from "@/server/lib/sorting";
import { paginationMetadata, type Pagination } from "@/server/lib/pagination";
import type { QuickFilterState } from "@/types/quick-filter";
import type {
  InventoryRecord,
  StockMovementRecord,
} from "@/server/schema/inventory_schema";

const include = {
  facility: {
    select: {
      id: true,
      name: true,
      type: true,
      is_active: true,
      company: { select: { id: true, name: true } },
    },
  },
  product: {
    select: {
      id: true,
      variant: {
        select: {
          id: true,
          name: true,
          brand: { select: { id: true, name: true } },
        },
      },
      product_type: { select: { id: true, name: true } },
      base_unit: { select: { id: true, name: true, symbol: true } },
    },
  },
} satisfies Prisma.inventoryInclude;

function serialize_inventory(
  row: Prisma.inventoryGetPayload<{ include: typeof include }>,
): InventoryRecord {
  const { company, ...facility } = row.facility;
  const { brand, ...variant } = row.product.variant;
  return {
    id: row.id,
    company,
    facility,
    product: { ...row.product, brand, variant },
    qty: row.qty.toString(),
    updated_at: row.updated_at.toISOString(),
  };
}

export function list_inventory(
  pagination: Pagination,
  search: string,
  sorting: Sorting | undefined,
  filters: QuickFilterState | undefined,
  access: RecordAccess,
) {
  const where = build_filter<Prisma.inventoryWhereInput>(filters, {
    where: record_where(access, "inventory"),
    fields: {
      company: (values) => ({ facility: { company_id: { in: values } } }),
      facility: (values) => ({ facility_id: { in: values } }),
      brand: (values) => ({
        product: { variant: { brand_id: { in: values } } },
      }),
      variant: (values) => ({ product: { variant_id: { in: values } } }),
      product_type: (values) => ({
        product: { product_type_id: { in: values } },
      }),
    },
    date: (range) => ({ updated_at: range }),
    status: { positive: { qty: { gt: 0 } }, zero: { qty: 0 } },
    additional: {
      facility_type: {
        warehouse: { facility: { type: "warehouse" } },
        hub: { facility: { type: "hub" } },
      },
    },
    search: {
      value: search,
      fields: [
        (filter) => ({ facility: { name: filter } }),
        (filter) => ({ facility: { company: { name: filter } } }),
        (filter) => ({ product: { variant: { name: filter } } }),
        (filter) => ({ product: { variant: { brand: { name: filter } } } }),
        (filter) => ({ product: { product_type: { name: filter } } }),
      ],
    },
  });
  const orderBy = build_sort<Prisma.inventoryOrderByWithRelationInput>(
    sorting,
    {
      fields: {
        id: (direction) => ({ id: direction }),
        qty: (direction) => ({ qty: direction }),
        updated_at: (direction) => ({ updated_at: direction }),
        company: (direction) => ({
          facility: { company: { name: direction } },
        }),
        facility: (direction) => ({ facility: { name: direction } }),
        brand: (direction) => ({
          product: { variant: { brand: { name: direction } } },
        }),
        variant: (direction) => ({ product: { variant: { name: direction } } }),
        product_type: (direction) => ({
          product: { product_type: { name: direction } },
        }),
      },
      default: { field: "updated_at", direction: "desc" },
      tieBreaker: { field: "id", order: { id: "asc" } },
    },
  );
  return getDatabase().$transaction(
    async (tx) => ({
      inventories: (
        await tx.inventory.findMany({
          where,
          include,
          orderBy,
          skip: pagination.skip,
          take: pagination.take,
        })
      ).map(serialize_inventory),
      ...paginationMetadata(await tx.inventory.count({ where }), pagination),
    }),
    { isolationLevel: "RepeatableRead" },
  );
}

export async function list_by_id_inventory(
  id: string,
  access: RecordAccess,
  client: DatabaseExecutor = getDatabase(),
) {
  const row = await client.inventory.findFirst({
    where: { AND: [{ id }, record_where(access, "inventory")] },
    include,
  });
  return row ? serialize_inventory(row) : null;
}

export function get_inventory_filter_data(access: RecordAccess) {
  return getDatabase().inventory.findMany({
    where: record_where(access, "inventory"),
    include,
  });
}

export function list_stock_movement(
  inventoryId: string,
  pagination: Pagination,
  sorting: Sorting | undefined,
  access: RecordAccess,
) {
  return getDatabase().$transaction(
    async (tx) => {
      const balance = await tx.inventory.findFirst({
        where: {
          AND: [{ id: inventoryId }, record_where(access, "inventory")],
        },
        select: { facility_id: true, product_id: true },
      });
      if (!balance) return null;
      const where = {
        facility_id: balance.facility_id,
        product_id: balance.product_id,
      };
      const orderBy = build_sort<Prisma.stock_movementOrderByWithRelationInput>(
        sorting,
        {
          fields: {
            id: (direction) => ({ id: direction }),
            created_at: (direction) => ({ created_at: direction }),
            qty: (direction) => ({ qty: direction }),
            direction: (direction) => ({ direction }),
            type: (direction) => ({ type: direction }),
          },
          default: { field: "created_at", direction: "desc" },
          tieBreaker: { field: "id", order: { id: "asc" } },
        },
      );
      const rows = await tx.stock_movement.findMany({
        where,
        orderBy,
        skip: pagination.skip,
        take: pagination.take,
      });
      const users = await tx.user.findMany({
        where: { id: { in: [...new Set(rows.map((row) => row.created_by))] } },
        select: { id: true, name: true },
      });
      const names = new Map(users.map((user) => [user.id, user.name]));
      const movements: StockMovementRecord[] = rows.map((row) => ({
        id: row.id,
        qty: row.qty.toString(),
        direction: row.direction,
        type: row.type,
        source_line_id: (row.po_receiving_item_id ??
          row.material_request_dispatch_item_id ??
          row.material_request_receiving_item_id)!,
        created_by: row.created_by,
        created_by_name: names.get(row.created_by) ?? null,
        created_at: row.created_at.toISOString(),
      }));
      return {
        movements,
        ...paginationMetadata(
          await tx.stock_movement.count({ where }),
          pagination,
        ),
      };
    },
    { isolationLevel: "RepeatableRead" },
  );
}

export function list_facility_stock(
  facilityId: string,
  productIds: string[],
  tx: DatabaseExecutor,
) {
  return tx.inventory.findMany({
    where: { facility_id: facilityId, product_id: { in: productIds } },
    select: { product_id: true, qty: true },
  });
}

export async function take_stock(
  facilityId: string,
  productId: string,
  qty: Prisma.Decimal,
  dispatchItemId: string,
  userId: string,
  tx: DatabaseExecutor,
) {
  await tx.$queryRaw`SELECT id FROM inventory WHERE facility_id = ${facilityId}::uuid AND product_id = ${productId}::uuid FOR UPDATE`;
  const updated = await tx.inventory.updateMany({
    where: {
      facility_id: facilityId,
      product_id: productId,
      qty: { gte: qty },
    },
    data: { qty: { decrement: qty } },
  });
  if (updated.count !== 1) return false;
  await tx.stock_movement.create({
    data: {
      facility_id: facilityId,
      product_id: productId,
      qty,
      direction: "out",
      type: "dispatch_out",
      material_request_dispatch_item_id: dispatchItemId,
      created_by: userId,
    },
  });
  return true;
}

export async function give_stock(
  facilityId: string,
  productId: string,
  qty: Prisma.Decimal,
  source:
    | { type: "po_receive_in"; po_receiving_item_id: string }
    | { type: "receive_in"; material_request_receiving_item_id: string },
  userId: string,
  tx: DatabaseExecutor,
) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`${facilityId}:${productId}`})::bigint)`;
  await tx.inventory.upsert({
    where: {
      facility_id_product_id: {
        facility_id: facilityId,
        product_id: productId,
      },
    },
    create: { facility_id: facilityId, product_id: productId, qty },
    update: { qty: { increment: qty } },
  });
  await tx.stock_movement.create({
    data: {
      facility_id: facilityId,
      product_id: productId,
      qty,
      direction: "in",
      ...source,
      created_by: userId,
    },
  });
}
