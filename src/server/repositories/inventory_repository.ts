import { Prisma } from "@/generated/prisma/client";
import type { RecordAccess } from "@/server/auth/record-access";
import { record_where } from "@/server/auth/record-access";
import { getDatabase, type DatabaseExecutor } from "@/server/lib/database";
import { build_filter, resolveDateRange } from "@/server/lib/filter";
import { build_sort, SortingError, type Sorting } from "@/server/lib/sorting";
import { paginationMetadata, type Pagination } from "@/server/lib/pagination";
import type { QuickFilterState } from "@/types/quick-filter";
import { INVENTORY_UUID, INVENTORY_BRAND_SORT_FIELDS, type InventoryBrand, type InventoryHistoryMovement, type InventoryRecord, type StockMovementRecord } from "@/server/schema/inventory_schema";

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

function inventory_where(search: string, filters: QuickFilterState | undefined, access: RecordAccess, filterDate = true) {
  return build_filter<Prisma.inventoryWhereInput>(filters, {
    where: record_where(access, "inventory"),
    fields: {
      company: (values) => ({ facility: { company_id: { in: values } } }),
      facility: (values) => ({ facility_id: { in: values } }),
      brand: (values) => ({ product: { variant: { brand_id: { in: values } } } }),
      variant: (values) => ({ product: { variant_id: { in: values } } }),
      product_type: (values) => ({ product: { product_type_id: { in: values } } }),
    },
    ...(filterDate ? { date: (range: { gte?: Date; lt?: Date }) => ({ updated_at: range }) } : {}),
    status: { positive: { qty: { gt: 0 } }, zero: { qty: 0 } },
    additional: { facility_type: { warehouse: { facility: { type: "warehouse" } }, hub: { facility: { type: "hub" } } } },
    search: { value: search, fields: [
      ...(INVENTORY_UUID.test(search) ? [() => ({ product_id: search })] : []),
      (filter) => ({ facility: { name: filter } }),
      (filter) => ({ facility: { company: { name: filter } } }),
      (filter) => ({ product: { variant: { name: filter } } }),
      (filter) => ({ product: { variant: { brand: { name: filter } } } }),
      (filter) => ({ product: { product_type: { name: filter } } }),
    ] },
  });
}

export function list_inventory(
  pagination: Pagination,
  search: string,
  sorting: Sorting | undefined,
  filters: QuickFilterState | undefined,
  access: RecordAccess,
) {
  const where = inventory_where(search, filters, access);
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

export function list_inventory_brand(pagination: Pagination, search: string, filters: QuickFilterState | undefined, access: RecordAccess, sorting?: Sorting) {
  if (sorting && !(INVENTORY_BRAND_SORT_FIELDS as readonly string[]).includes(sorting.field)) throw new SortingError();
  const where = inventory_where(search, filters, access, false);
  const brands: Prisma.brandWhereInput = { variants: { some: { products: { some: { inventories: { some: where } } } } } };
  const range = filters ? resolveDateRange(filters.date) : {};
  const date = { ...(range.from ? { gte: range.from } : {}), ...(range.toExclusive ? { lt: range.toExclusive } : {}) };
  return getDatabase().$transaction(async (tx) => {
    const matchingBrands = await tx.brand.findMany({ where: brands, select: { id: true, name: true }, orderBy: [{ name: "asc" }, { id: "asc" }] });
    const rows = matchingBrands.length ? await tx.inventory.findMany({ where, include, orderBy: [{ product: { variant: { name: "asc" } } }, { product: { product_type: { name: "asc" } } }, { facility: { name: "asc" } }, { id: "asc" }] }) : [];
    const brandRows = new Map<string, typeof rows>();
    for (const row of rows) {
      const key = row.product.variant.brand.id;
      const group = brandRows.get(key) ?? [];
      group.push(row);
      brandRows.set(key, group);
    }
    const flows = rows.length ? await tx.stock_movement.groupBy({ by: ["facility_id", "product_id", "direction"], where: { facility_id: { in: [...new Set(rows.map((row) => row.facility_id))] }, product_id: { in: [...new Set(rows.map((row) => row.product_id))] }, created_at: date }, _sum: { qty: true } }) : [];
    const net = new Map<string, Prisma.Decimal>();
    for (const flow of flows) {
      const key = `${flow.facility_id}:${flow.product_id}`;
      net.set(key, (net.get(key) ?? new Prisma.Decimal(0)).plus((flow._sum.qty ?? new Prisma.Decimal(0)).times(flow.direction === "in" ? 1 : -1)));
    }
    const unitTotals = new Map<string, Map<string, { unit: string; qty: Prisma.Decimal; net_movement: Prisma.Decimal }>>();
    const result: InventoryBrand[] = matchingBrands.map((brand) => {
      const variants = (brandRows.get(brand.id) ?? []).map((row) => ({ ...serialize_inventory(row), net_movement: (net.get(`${row.facility_id}:${row.product_id}`) ?? new Prisma.Decimal(0)).toString() }));
      const totals = new Map<string, { unit: string; qty: Prisma.Decimal; net_movement: Prisma.Decimal }>();
      for (const row of variants) {
        const unit = row.product.base_unit;
        const total = totals.get(unit.id) ?? { unit: `${unit.name} (${unit.symbol})`, qty: new Prisma.Decimal(0), net_movement: new Prisma.Decimal(0) };
        total.qty = total.qty.plus(row.qty);
        total.net_movement = total.net_movement.plus(row.net_movement);
        totals.set(unit.id, total);
      }
      unitTotals.set(brand.id, totals);
      return { ...brand, sku_count: new Set(variants.map((row) => row.product.id)).size, totals: [...totals.values()].map((total) => ({ unit: total.unit, qty: total.qty.toString(), net_movement: total.net_movement.toString() })), variants };
    });
    const selected = sorting ?? { field: "brand", direction: "asc" };
    // shortcut: brand aggregates sort in memory; move aggregation to SQL if balance volumes outgrow memory.
    result.sort((left, right) => {
      let comparison = 0;
      if (selected.field === "brand") comparison = left.name.localeCompare(right.name);
      else if (selected.field === "skus") comparison = left.sku_count - right.sku_count;
      else {
        const leftUnits = [...unitTotals.get(left.id)!.keys()].sort();
        const rightUnits = [...unitTotals.get(right.id)!.keys()].sort();
        // Group unlike units before comparing quantities; never add litres and pieces.
        comparison = leftUnits.join(":").localeCompare(rightUnits.join(":"));
        for (const unit of leftUnits) {
          if (comparison) break;
          const field = selected.field === "stock" ? "qty" : "net_movement";
          comparison = unitTotals.get(left.id)!.get(unit)![field].comparedTo(unitTotals.get(right.id)!.get(unit)![field]);
        }
      }
      return comparison * (selected.direction === "asc" ? 1 : -1) || left.id.localeCompare(right.id);
    });
    return { brands: result.slice(pagination.skip, pagination.skip + pagination.take), ...paginationMetadata(result.length, pagination) };
  }, { isolationLevel: "RepeatableRead" });
}

export function get_inventory_history(inventoryId: string, pagination: Pagination | undefined, search: string, filters: QuickFilterState | undefined, access: RecordAccess, sorting?: Sorting) {
  return getDatabase().$transaction(async (tx) => {
    const balance = await tx.inventory.findFirst({ where: { AND: [{ id: inventoryId }, record_where(access, "inventory")] }, include });
    if (!balance) return null;
    const range = filters ? resolveDateRange(filters.date) : {};
    const period: Prisma.stock_movementWhereInput = { facility_id: balance.facility_id, product_id: balance.product_id, created_at: { ...(range.from ? { gte: range.from } : {}), ...(range.toExclusive ? { lt: range.toExclusive } : {}) } };
    const where = build_filter<Prisma.stock_movementWhereInput>(filters ? { ...filters, date: { preset: "all", from: "", to: "" } } : undefined, {
      where: period, status: { in: { direction: "in" }, out: { direction: "out" } },
      additional: { transaction_type: { po_receive_in: { type: "po_receive_in" }, dispatch_out: { type: "dispatch_out" }, receive_in: { type: "receive_in" } } },
      search: { value: search, fields: [
        (value) => ({ po_receiving_item: { receiving: { receiving_no: value } } }),
        (value) => ({ dispatch_item: { dispatch: { dispatch_no: value } } }),
        (value) => ({ receiving_item: { receiving: { receiving_no: value } } }),
      ] },
    });
    const orderBy = build_sort<Prisma.stock_movementOrderByWithRelationInput>(sorting, {
      fields: { created_at: (direction) => ({ created_at: direction }), qty: (direction) => ({ qty: direction }), direction: (direction) => ({ direction }), balance_after: (direction) => ({ balance_after: { sort: direction, nulls: "last" } }) },
      default: { field: "created_at", direction: "desc" }, tieBreaker: { field: "sequence", order: { sequence: "desc" } },
    });
    const rows = await tx.stock_movement.findMany({ where, orderBy, ...(pagination ? { skip: pagination.skip, take: pagination.take } : {}), include: {
      po_receiving_item: { select: { receiving: { select: { receiving_no: true, notes: true, purchase_order: { select: { purchase_order_no: true } } } } } },
      dispatch_item: { select: { dispatch: { select: { dispatch_no: true, notes: true, request: { select: { request_no: true } } } } } },
      receiving_item: { select: { receiving: { select: { receiving_no: true, notes: true, request: { select: { request_no: true } } } } } },
    } });
    const users = await tx.user.findMany({ where: { id: { in: [...new Set(rows.map((row) => row.created_by))] } }, select: { id: true, name: true } });
    const names = new Map(users.map((user) => [user.id, user.name]));
    const movements: InventoryHistoryMovement[] = rows.map((row) => {
      const po = row.po_receiving_item?.receiving;
      const dispatch = row.dispatch_item?.dispatch;
      const receipt = row.receiving_item?.receiving;
      const permission = po ? "purchaseOrders.view" : "materialRequests.view";
      const reference = po?.purchase_order.purchase_order_no ?? dispatch?.request.request_no ?? receipt?.request.request_no;
      return { id: row.id, qty: row.qty.toString(), direction: row.direction, type: row.type,
        source_line_id: (row.po_receiving_item_id ?? row.material_request_dispatch_item_id ?? row.material_request_receiving_item_id)!,
        balance_before: row.balance_before?.toString() ?? null, balance_after: row.balance_after?.toString() ?? null,
        reference_no: po?.receiving_no ?? dispatch?.dispatch_no ?? receipt?.receiving_no ?? "Unnumbered",
        remarks: po?.notes ?? dispatch?.notes ?? receipt?.notes ?? "",
        source_href: reference && (access.superAdmin || access.grants.some((grant) => grant.permission === permission)) ? `${po ? "/purchase-orders" : "/material-requests"}?search=${encodeURIComponent(reference)}` : null,
        created_by: row.created_by, created_by_name: names.get(row.created_by) ?? null, created_at: row.created_at.toISOString() };
    });
    const flows = await tx.stock_movement.groupBy({ by: ["direction"], where: period, _sum: { qty: true } });
    const incoming = flows.find((flow) => flow.direction === "in")?._sum.qty ?? new Prisma.Decimal(0);
    const outgoing = flows.find((flow) => flow.direction === "out")?._sum.qty ?? new Prisma.Decimal(0);
    const pair = { facility_id: balance.facility_id, product_id: balance.product_id };
    const beginning = range.from
      ? (await tx.stock_movement.findFirst({ where: { ...pair, created_at: { lt: range.from } }, orderBy: [{ created_at: "desc" }, { sequence: "desc" }] }))?.balance_after ?? null
      : (await tx.stock_movement.findFirst({ where: pair, orderBy: [{ created_at: "asc" }, { sequence: "asc" }] }))?.balance_before ?? null;
    const ending = range.toExclusive && range.toExclusive <= new Date()
      ? (await tx.stock_movement.findFirst({ where: { ...pair, created_at: { lt: range.toExclusive } }, orderBy: [{ created_at: "desc" }, { sequence: "desc" }] }))?.balance_after ?? null
      : balance.qty;
    return { inventory: serialize_inventory(balance), movements, summary: { stock_in: incoming.toString(), stock_out: outgoing.toString(), net_movement: incoming.minus(outgoing).toString(), current_stock: balance.qty.toString(), beginning_balance: beginning?.toString() ?? null, ending_balance: ending?.toString() ?? null }, ...paginationMetadata(await tx.stock_movement.count({ where }), pagination ?? { page: 1, page_size: rows.length, skip: 0, take: rows.length }) };
  }, { isolationLevel: "RepeatableRead", timeout: pagination ? 10000 : 60000 });
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
  const balance = await tx.inventory.findUniqueOrThrow({
    where: { facility_id_product_id: { facility_id: facilityId, product_id: productId } },
  });
  await tx.stock_movement.create({
    data: {
      facility_id: facilityId,
      product_id: productId,
      qty,
      direction: "out",
      type: "dispatch_out",
      balance_before: balance.qty.plus(qty),
      balance_after: balance.qty,
      material_request_dispatch_item_id: dispatchItemId,
      created_by: userId,
      created_at: new Date(),
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
  const balance = await tx.inventory.upsert({
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
      balance_before: balance.qty.minus(qty),
      balance_after: balance.qty,
      ...source,
      created_by: userId,
      created_at: new Date(),
    },
  });
}
