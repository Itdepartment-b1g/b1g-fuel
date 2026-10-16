import { Prisma } from "@/generated/prisma/client";
import type { QuickFilterState } from "@/types/quick-filter";
import { record_where, type RecordAccess } from "@/server/auth/record-access";
import { getDatabase, type DatabaseExecutor } from "@/server/lib/database";
import { build_filter } from "@/server/lib/filter";
import { paginationMetadata, type Pagination } from "@/server/lib/pagination";
import { build_sort, type Sorting } from "@/server/lib/sorting";
import { receiving_number } from "@/server/utils/receiving-number";
import { RECEIVABLE_STATUSES, type CreateReceivingInput, type ListReceivingResponse } from "@/server/schema/receiving_schema";

const productSelect = {
  id: true,
  variant: { select: { name: true, brand: { select: { name: true } } } },
  product_type: { select: { name: true } },
} satisfies Prisma.productSelect;

const include = {
  company: { select: { id: true, name: true } },
  location: { select: { id: true, name: true, address: true } },
  purchase_order: {
    select: {
      id: true,
      status: true,
      supplier: { select: { id: true, name: true } },
    },
  },
  items: {
    orderBy: { id: "asc" as const },
    include: {
      unit: { select: { id: true, name: true, symbol: true, key: true } },
      product: { select: productSelect },
      purchase_order_item: { select: { ordered_qty: true, received_qty: true } },
    },
  },
} satisfies Prisma.receivingInclude;

type Row = Prisma.receivingGetPayload<{ include: typeof include }>;

const RECEIVABLE: Prisma.Enumpurchase_order_statusFilter["in"] = [...RECEIVABLE_STATUSES];

function order_scope(access: RecordAccess, action: "add" | "edit") {
  return record_where(access, "receiving", action) as Prisma.purchase_orderWhereInput;
}

function display_name(product: {
  variant: { name: string; brand: { name: string } };
  product_type: { name: string };
}) {
  return `${product.variant.brand.name} ${product.variant.name} · ${product.product_type.name}`;
}

function present(record: Row, names: Map<string, string>): ListReceivingResponse {
  return {
    id: record.id,
    company_id: record.company_id,
    company: record.company,
    purchase_order_id: record.purchase_order_id,
    purchase_order_status: record.purchase_order.status,
    supplier: record.purchase_order.supplier,
    location_id: record.location_id,
    location: record.location,
    status: record.status,
    receiving_no: record.receiving_no,
    notes: record.notes,
    line_count: record.items.length,
    items: record.items.map((item) => ({
      id: item.id,
      purchase_order_item_id: item.purchase_order_item_id,
      product_id: item.product_id,
      display_name: display_name(item.product),
      unit: item.unit,
      ordered_qty: item.purchase_order_item.ordered_qty.toString(),
      received_qty: item.purchase_order_item.received_qty.toString(),
      outstanding_qty: item.purchase_order_item.ordered_qty
        .minus(item.purchase_order_item.received_qty)
        .toString(),
      qty: item.qty.toString(),
      content_per_unit: item.content_per_unit.toString(),
      base_qty: item.base_qty.toString(),
    })),
    created_by: record.created_by,
    created_by_name: record.created_by ? (names.get(record.created_by) ?? null) : null,
    posted_by: record.posted_by,
    posted_by_name: record.posted_by ? (names.get(record.posted_by) ?? null) : null,
    posted_at: record.posted_at?.toISOString() ?? null,
    created_at: record.created_at.toISOString(),
    updated_at: record.updated_at.toISOString(),
  };
}

async function present_all(records: Row[], client: DatabaseExecutor) {
  const ids = [
    ...new Set(
      records.flatMap((record) => [
        ...(record.created_by ? [record.created_by] : []),
        ...(record.posted_by ? [record.posted_by] : []),
      ]),
    ),
  ];
  const creators = ids.length
    ? await client.user.findMany({ where: { id: { in: ids } }, select: { id: true, name: true } })
    : [];
  const names = new Map(creators.map((creator) => [creator.id, creator.name]));
  return records.map((record) => present(record, names));
}

const sortConfig = {
  fields: {
    id: (direction: Prisma.SortOrder) => ({ id: direction }),
    created_at: (direction: Prisma.SortOrder) => ({ created_at: direction }),
    updated_at: (direction: Prisma.SortOrder) => ({ updated_at: direction }),
    status: (direction: Prisma.SortOrder) => ({ status: direction }),
    posted_at: (direction: Prisma.SortOrder) => ({ posted_at: direction }),
    receiving_no: (direction: Prisma.SortOrder) => ({ receiving_no: direction }),
  },
  default: { field: "created_at" as const, direction: "desc" as const },
  tieBreaker: { field: "id" as const, order: { id: "asc" as const } },
};

export function receipt_status(lines: { ordered_qty: Prisma.Decimal; received_qty: Prisma.Decimal }[]) {
  return lines.every((line) => line.received_qty.greaterThanOrEqualTo(line.ordered_qty))
    ? ("received" as const)
    : ("partially_received" as const);
}

async function order_for_receipt(tx: DatabaseExecutor, id: string, access: RecordAccess, action: "add" | "edit") {
  return tx.purchase_order.findFirst({
    where: {
      AND: [{ id }, order_scope(access, action), { status: { in: RECEIVABLE } }],
    },
    include: { items: true },
  });
}

function line_rows(
  orderItems: { id: string; product_id: string; unit_id: string; ordered_qty: Prisma.Decimal; received_qty: Prisma.Decimal }[],
  lines: CreateReceivingInput["lines"],
) {
  const seen = new Set<string>();
  const rows = [];
  for (const line of lines) {
    if (seen.has(line.purchase_order_item_id)) return "duplicate_line" as const;
    seen.add(line.purchase_order_item_id);
    const item = orderItems.find((row) => row.id === line.purchase_order_item_id);
    if (!item) return "invalid_line" as const;
    const qty = new Prisma.Decimal(line.qty);
    const outstanding = item.ordered_qty.minus(item.received_qty);
    if (qty.greaterThan(outstanding)) return "over_receipt" as const;
    rows.push({
      purchase_order_item_id: item.id,
      product_id: item.product_id,
      unit_id: item.unit_id,
      qty,
      content_per_unit: new Prisma.Decimal(1),
      base_qty: qty,
    });
  }
  return rows;
}

export async function list_receivings(
  pagination: Pagination,
  search: string,
  sorting: Sorting | undefined,
  access: RecordAccess,
  filters?: QuickFilterState,
) {
  const where = build_filter<Prisma.receivingWhereInput>(filters, {
    where: record_where(access, "receiving"),
    fields: {
      company: (values) => ({ company_id: { in: values } }),
      supplier: (values) => ({ purchase_order: { supplier_id: { in: values } } }),
      location: (values) => ({ location_id: { in: values } }),
    },
    date: (range) => ({ created_at: range }),
    status: { draft: { status: "draft" }, posted: { status: "posted" } },
    search: {
      value: search,
      fields: [
        (filter) => ({ notes: filter }),
        (filter) => ({ purchase_order: { supplier: { name: filter } } }),
        (filter) => ({ location: { name: filter } }),
        (filter) => ({ company: { name: filter } }),
        (filter) => ({ receiving_no: filter }),
      ],
    },
  });
  const orderBy = build_sort<Prisma.receivingOrderByWithRelationInput>(sorting, sortConfig);
  return getDatabase().$transaction(async (tx) => {
    const rows = await tx.receiving.findMany({
      where,
      include,
      orderBy,
      skip: pagination.skip,
      take: pagination.take,
    });
    return {
      receivings: await present_all(rows, tx),
      ...paginationMetadata(await tx.receiving.count({ where }), pagination),
    };
  });
}

export async function list_by_id_receiving(id: string, access: RecordAccess) {
  const client = getDatabase();
  const record = await client.receiving.findFirst({
    where: { AND: [{ id }, record_where(access, "receiving")] },
    include,
  });
  return record ? (await present_all([record], client))[0] : null;
}

export function get_receiving_filter_data(access: RecordAccess) {
  return getDatabase().receiving.findMany({
    where: record_where(access, "receiving"),
    select: {
      status: true,
      company: { select: { id: true, name: true } },
      location: { select: { id: true, name: true } },
      purchase_order: { select: { supplier: { select: { id: true, name: true } } } },
    },
  });
}

export async function list_receivable_orders(access: RecordAccess) {
  const rows = await getDatabase().purchase_order.findMany({
    where: {
      AND: [order_scope(access, "add"), { status: { in: RECEIVABLE } }],
    },
    orderBy: [{ created_at: "desc" }, { id: "asc" }],
    include: {
      supplier: { select: { id: true, name: true } },
      location: { select: { id: true, name: true, address: true } },
      items: {
        orderBy: { id: "asc" },
        include: {
          unit: { select: { id: true, name: true, symbol: true, key: true } },
          product: { select: productSelect },
        },
      },
    },
  });
  return rows
    .map((order) => ({
      id: order.id,
      status: order.status as "awaiting_receipt" | "partially_received",
      supplier: order.supplier,
      location: order.location,
      items: order.items.flatMap((item) => {
        const outstanding = item.ordered_qty.minus(item.received_qty);
        if (outstanding.lessThanOrEqualTo(0)) return [];
        return [{
          id: item.id,
          product_id: item.product_id,
          display_name: display_name(item.product),
          unit: item.unit,
          ordered_qty: item.ordered_qty.toString(),
          received_qty: item.received_qty.toString(),
          outstanding_qty: outstanding.toString(),
        }];
      }),
    }))
    .filter((order) => order.items.length);
}

async function write_receipt(
  tx: DatabaseExecutor,
  input: CreateReceivingInput,
  access: RecordAccess,
  id?: string,
) {
  const order = await order_for_receipt(tx, input.purchase_order_id, access, id ? "edit" : "add");
  if (!order) return "not_receivable" as const;
  const draft = await tx.receiving.findFirst({
    where: { purchase_order_id: order.id, status: "draft", ...(id ? { id: { not: id } } : {}) },
    select: { id: true },
  });
  if (draft) return "draft_exists" as const;
  const items = line_rows(order.items, input.lines);
  if (typeof items === "string") return items;
  const data = {
    company_id: order.company_id,
    purchase_order_id: order.id,
    location_id: order.location_id,
    notes: input.notes ?? "",
    items: { create: items },
  };
  return id
    ? tx.receiving.update({
        where: { id },
        data: { ...data, items: { deleteMany: {}, create: items } },
        include,
      })
    : tx.receiving.create({ data: { ...data, created_by: access.userId }, include });
}

export function create_receiving(input: CreateReceivingInput, access: RecordAccess) {
  return getDatabase().$transaction(async (tx) => {
    const record = await write_receipt(tx, input, access);
    if (typeof record === "string") return record;
    return (await present_all([record], tx))[0];
  });
}

export function update_receiving(input: CreateReceivingInput & { id: string }, access: RecordAccess) {
  return getDatabase().$transaction(async (tx) => {
    const current = await tx.receiving.findFirst({
      where: { AND: [{ id: input.id }, record_where(access, "receiving", "edit")] },
      select: { id: true, status: true, purchase_order_id: true },
    });
    if (!current) return "not_found" as const;
    if (current.status !== "draft") return "not_draft" as const;
    const record = await write_receipt(
      tx,
      { ...input, purchase_order_id: current.purchase_order_id },
      access,
      current.id,
    );
    if (typeof record === "string") return record;
    return (await present_all([record], tx))[0];
  });
}

export function post_receiving(id: string, access: RecordAccess) {
  return getDatabase().$transaction(async (tx) => {
    const current = await tx.receiving.findFirst({
      where: { AND: [{ id }, record_where(access, "receiving", "edit")] },
      include: { items: true, company: { select: { name: true } } },
    });
    if (!current) return "not_found" as const;
    if (current.status !== "draft") return "not_draft" as const;
    const order = await order_for_receipt(tx, current.purchase_order_id, access, "edit");
    if (!order) return "not_receivable" as const;
    for (const line of current.items) {
      const item = order.items.find((row) => row.id === line.purchase_order_item_id);
      if (!item) return "invalid_line" as const;
      const outstanding = item.ordered_qty.minus(item.received_qty);
      if (line.qty.greaterThan(outstanding)) return "over_receipt" as const;
      item.received_qty = item.received_qty.plus(line.qty);
      await tx.purchase_order_item.update({
        where: { id: item.id },
        data: { received_qty: item.received_qty },
      });
    }
    const status = receipt_status(order.items);
    const posted_at = new Date();
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${current.company_id})::bigint)`;
    const latest = await tx.receiving.aggregate({
      where: { company_id: current.company_id, receipt_seq: { not: null } },
      _max: { receipt_seq: true },
    });
    const receipt_seq = (latest._max.receipt_seq ?? 0) + 1;
    const number = receiving_number(current.company.name, posted_at, receipt_seq);
    await tx.purchase_order.update({
      where: { id: order.id },
      data: {
        status,
        events: {
          create: {
            kind: "receipt_posted",
            status,
            receiving_id: current.id,
            created_by: access.userId,
          },
        },
      },
    });
    const record = await tx.receiving.update({
      where: { id: current.id },
      data: { status: "posted", posted_by: access.userId, posted_at, receipt_seq, receiving_no: number },
      include,
    });
    return (await present_all([record], tx))[0];
  });
}

export function delete_receiving(id: string, access: RecordAccess) {
  return getDatabase().$transaction(async (tx) => {
    const current = await tx.receiving.findFirst({
      where: { AND: [{ id }, record_where(access, "receiving", "delete")] },
      select: { id: true, status: true },
    });
    if (!current) return "not_found" as const;
    if (current.status !== "draft") return "not_draft" as const;
    await tx.receiving.delete({ where: { id } });
    return "deleted" as const;
  });
}
