import { Prisma } from "@/generated/prisma/client";
import type { QuickFilterState } from "@/types/quick-filter";
import { record_where, type RecordAccess } from "@/server/auth/record-access";
import { getDatabase, type DatabaseExecutor } from "@/server/lib/database";
import { build_filter } from "@/server/lib/filter";
import { paginationMetadata, type Pagination } from "@/server/lib/pagination";
import { build_sort, type Sorting } from "@/server/lib/sorting";
import type {
  CreatePurchaseOrderInput,
  ListPurchaseOrderResponse,
  PaymentMethod,
  PurchaseOrderLineInput,
  PurchaseOrderStatus,
} from "@/server/schema/purchase_order_schema";

const include = {
  company: { select: { id: true, name: true } },
  location: { select: { id: true, name: true, address: true } },
  supplier: { select: { id: true, name: true } },
  items: {
    orderBy: { id: "asc" as const },
    include: {
      unit: { select: { id: true, name: true, symbol: true, key: true } },
      product: {
        select: {
          id: true,
          variant_id: true,
          product_type_id: true,
          base_unit_id: true,
          variant: { select: { name: true, brand: { select: { name: true } } } },
          product_type: { select: { id: true, name: true, key: true } },
        },
      },
    },
  },
  events: {
    orderBy: { created_at: "asc" as const },
    include: {
      receiving: {
        select: {
          receiving_no: true,
          items: {
            orderBy: { id: "asc" as const },
            select: {
              purchase_order_item_id: true,
              qty: true,
              unit: { select: { symbol: true } },
              product: {
                select: {
                  variant: { select: { name: true, brand: { select: { name: true } } } },
                  product_type: { select: { name: true } },
                },
              },
            },
          },
        },
      },
    },
  },
} satisfies Prisma.purchase_orderInclude;

type Row = Prisma.purchase_orderGetPayload<{ include: typeof include }>;

type Header = Omit<CreatePurchaseOrderInput, "company_id" | "estimated_delivery_on" | "lines"> & {
  company_id: string;
  estimated_delivery_at: Date | null;
  payment_method: PaymentMethod | null;
  lines: PurchaseOrderLineInput[];
};

export type SaveFailure =
  | "invalid_location"
  | "many_warehouses"
  | "invalid_supplier"
  | "invalid_line"
  | "unit_conflict";

function manila_date(value: Date | null) {
  if (!value) return null;
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(value);
}

function present(record: Row, names: Map<string, string>): ListPurchaseOrderResponse {
  return {
    id: record.id,
    company_id: record.company_id,
    company: record.company,
    location_id: record.location_id,
    location: record.location,
    supplier_id: record.supplier_id,
    supplier: record.supplier,
    status: record.status,
    payment_terms: record.payment_terms,
    payment_method: record.payment_method as PaymentMethod | null,
    estimated_delivery_on: manila_date(record.estimated_delivery_at),
    notes: record.notes,
    line_count: record.items.length,
    events: record.events.map((event) => ({
      id: event.id,
      kind: event.kind,
      status: event.status,
      note: event.note,
      receiving_id: event.receiving_id,
      receiving_no: event.receiving?.receiving_no ?? null,
      created_by: event.created_by,
      created_by_name: event.created_by ? (names.get(event.created_by) ?? null) : null,
      created_at: event.created_at.toISOString(),
      lines: (event.receiving?.items ?? []).map((item) => ({
        purchase_order_item_id: item.purchase_order_item_id,
        display_name: `${item.product.variant.brand.name} ${item.product.variant.name} · ${item.product.product_type.name}`,
        qty: item.qty.toString(),
        unit: item.unit.symbol,
      })),
    })),
    items: record.items.map((item) => ({
      id: item.id,
      product_id: item.product_id,
      variant_id: item.product.variant_id,
      product_type_id: item.product.product_type_id,
      base_unit_id: item.product.base_unit_id,
      unit_id: item.unit_id,
      ordered_qty: item.ordered_qty.toString(),
      received_qty: item.received_qty.toString(),
      display_name: `${item.product.variant.brand.name} ${item.product.variant.name} · ${item.product.product_type.name}`,
      brand: { name: item.product.variant.brand.name },
      variant: { name: item.product.variant.name },
      unit: item.unit,
      product_type: item.product.product_type,
    })),
    created_by: record.created_by,
    created_by_name: record.created_by ? (names.get(record.created_by) ?? null) : null,
    created_at: record.created_at.toISOString(),
    updated_at: record.updated_at.toISOString(),
  };
}

async function present_all(records: Row[], client: DatabaseExecutor) {
  const ids = [
    ...new Set(
      records.flatMap((record) => [
        ...(record.created_by ? [record.created_by] : []),
        ...record.events.flatMap((event) => (event.created_by ? [event.created_by] : [])),
      ]),
    ),
  ];
  const creators = ids.length
    ? await client.user.findMany({
        where: { id: { in: ids } },
        select: { id: true, name: true },
      })
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
    estimated_delivery_at: (direction: Prisma.SortOrder) => ({
      estimated_delivery_at: direction,
    }),
  },
  default: { field: "created_at" as const, direction: "desc" as const },
  tieBreaker: { field: "id" as const, order: { id: "asc" as const } },
};

function usable(companyId: string | null, expected: string) {
  return companyId === null || companyId === expected;
}

async function resolve_lines(
  tx: DatabaseExecutor,
  companyId: string,
  lines: PurchaseOrderLineInput[],
  actor: string,
) {
  const items = [];
  for (const line of lines) {
    const [variant, productType, unit] = await Promise.all([
      tx.variant.findUnique({
        where: { id: line.variant_id },
        select: { id: true, company_id: true },
      }),
      tx.product_type.findUnique({
        where: { id: line.product_type_id },
        select: { id: true, company_id: true },
      }),
      tx.measurement_unit.findUnique({
        where: { id: line.base_unit_id },
        select: { id: true, measurement: { select: { company_id: true } } },
      }),
    ]);
    if (
      !variant ||
      !usable(variant.company_id, companyId) ||
      !productType ||
      !usable(productType.company_id, companyId) ||
      !unit ||
      !usable(unit.measurement.company_id, companyId)
    )
      return "invalid_line" as const;
    const existing = await tx.product.findFirst({
      where: {
        company_id: companyId,
        variant_id: line.variant_id,
        product_type_id: line.product_type_id,
      },
      select: { id: true, base_unit_id: true },
    });
    if (existing && existing.base_unit_id !== line.base_unit_id)
      return "unit_conflict" as const;
    const product =
      existing ??
      (await tx.product.create({
        data: {
          company_id: companyId,
          variant_id: line.variant_id,
          product_type_id: line.product_type_id,
          base_unit_id: line.base_unit_id,
          note: "",
          created_by: actor,
        },
        select: { id: true },
      }));
    items.push({
      product_id: product.id,
      unit_id: line.base_unit_id,
      ordered_qty: line.ordered_qty,
    });
  }
  return items;
}

async function company_warehouse(tx: DatabaseExecutor, companyId: string) {
  const warehouses = await tx.location.findMany({
    where: { company_id: companyId, type: "warehouse", is_active: true },
    select: { id: true },
    orderBy: [{ created_at: "asc" }, { id: "asc" }],
    take: 2,
  });
  if (!warehouses.length) return "invalid_location" as const;
  if (warehouses.length > 1) return "many_warehouses" as const;
  return warehouses[0].id;
}

async function validate_header(tx: DatabaseExecutor, input: Header) {
  const supplier = await tx.supplier.findFirst({
    where: {
      id: input.supplier_id,
      OR: [{ company_id: null }, { company_id: input.company_id }],
    },
    select: { id: true },
  });
  if (!supplier) return "invalid_supplier" as const;
  return company_warehouse(tx, input.company_id);
}

export async function list_purchase_orders(
  pagination: Pagination,
  search: string,
  sorting: Sorting | undefined,
  access: RecordAccess,
  filters?: QuickFilterState,
) {
  const where = build_filter<Prisma.purchase_orderWhereInput>(filters, {
    where: record_where(access, "purchaseOrders"),
    fields: {
      company: (values) => ({ company_id: { in: values } }),
      supplier: (values) => ({ supplier_id: { in: values } }),
      location: (values) => ({ location_id: { in: values } }),
    },
    date: (range) => ({ created_at: range }),
    status: {
      draft: { status: "draft" },
      awaiting_receipt: { status: "awaiting_receipt" },
      partially_received: { status: "partially_received" },
      received: { status: "received" },
      closed: { status: "closed" },
    },
    search: {
      value: search,
      fields: [
        (filter) => ({ notes: filter }),
        (filter) => ({ payment_terms: filter }),
        (filter) => ({ supplier: { name: filter } }),
        (filter) => ({ location: { name: filter } }),
        (filter) => ({ company: { name: filter } }),
      ],
    },
  });
  const orderBy = build_sort<Prisma.purchase_orderOrderByWithRelationInput>(
    sorting,
    sortConfig,
  );
  return getDatabase().$transaction(
    async (tx) => {
      const rows = await tx.purchase_order.findMany({
        where,
        include,
        orderBy,
        skip: pagination.skip,
        take: pagination.take,
      });
      return {
        purchase_orders: await present_all(rows, tx),
        ...paginationMetadata(await tx.purchase_order.count({ where }), pagination),
      };
    },
    { isolationLevel: "RepeatableRead" },
  );
}

export async function list_by_id_purchase_order(id: string, access: RecordAccess) {
  const client = getDatabase();
  const record = await client.purchase_order.findFirst({
    where: { AND: [{ id }, record_where(access, "purchaseOrders")] },
    include,
  });
  return record ? (await present_all([record], client))[0] : null;
}

export function get_purchase_order_filter_data(access: RecordAccess) {
  return getDatabase().purchase_order.findMany({
    where: record_where(access, "purchaseOrders"),
    select: {
      status: true,
      company: { select: { id: true, name: true } },
      supplier: { select: { id: true, name: true } },
      location: { select: { id: true, name: true } },
    },
    orderBy: [{ created_at: "desc" }, { id: "asc" }],
  });
}

async function write_order(
  tx: DatabaseExecutor,
  input: Header,
  actor: string,
  id?: string,
) {
  const location_id = await validate_header(tx, input);
  if (
    location_id === "invalid_location" ||
    location_id === "many_warehouses" ||
    location_id === "invalid_supplier"
  )
    return location_id;
  const items = await resolve_lines(tx, input.company_id, input.lines, actor);
  if (!Array.isArray(items)) return items;
  const data = {
    company_id: input.company_id,
    location_id,
    supplier_id: input.supplier_id,
    payment_terms: input.payment_terms ?? "",
    payment_method: input.payment_method,
    estimated_delivery_at: input.estimated_delivery_at,
    notes: input.notes ?? "",
    items: {
      create: items.map((item) => ({
        product_id: item.product_id,
        unit_id: item.unit_id,
        ordered_qty: item.ordered_qty,
      })),
    },
  };
  const record = id
    ? await tx.purchase_order.update({
        where: { id },
        data: {
          ...data,
          items: { deleteMany: {}, create: data.items.create },
        },
        include,
      })
    : await tx.purchase_order.create({
        data: {
          ...data,
          created_by: actor,
          events: {
            create: { kind: "created", status: "draft", created_by: actor },
          },
        },
        include,
      });
  return (await present_all([record], tx))[0];
}

export function create_purchase_order(input: Header, actor: string) {
  return getDatabase().$transaction((tx) => write_order(tx, input, actor));
}

export function update_purchase_order(
  input: Header & { id: string },
  access: RecordAccess,
) {
  return getDatabase().$transaction(async (tx) => {
    const current = await tx.purchase_order.findFirst({
      where: {
        AND: [{ id: input.id }, record_where(access, "purchaseOrders", "edit")],
      },
      select: { id: true, status: true, company_id: true },
    });
    if (!current) return "not_found" as const;
    if (current.status !== "draft") return "not_draft" as const;
    return write_order(
      tx,
      { ...input, company_id: current.company_id },
      access.userId,
      current.id,
    );
  });
}

export function confirm_purchase_order(id: string, access: RecordAccess) {
  return getDatabase().$transaction(async (tx) => {
    const current = await tx.purchase_order.findFirst({
      where: {
        AND: [{ id }, record_where(access, "purchaseOrders", "edit")],
      },
      select: {
        id: true,
        status: true,
        payment_terms: true,
        _count: { select: { items: true } },
      },
    });
    if (!current) return "not_found" as const;
    if (current.status !== "draft") return "not_draft" as const;
    if (!current.payment_terms.trim()) return "terms" as const;
    if (!current._count.items) return "lines" as const;
    const record = await tx.purchase_order.update({
      where: { id },
      data: {
        status: "awaiting_receipt",
        events: {
          create: {
            kind: "confirmed",
            status: "awaiting_receipt",
            created_by: access.userId,
          },
        },
      },
      include,
    });
    return (await present_all([record], tx))[0];
  });
}

export function close_purchase_order(id: string, access: RecordAccess) {
  return getDatabase().$transaction(async (tx) => {
    const current = await tx.purchase_order.findFirst({
      where: {
        AND: [{ id }, record_where(access, "purchaseOrders", "edit")],
      },
      select: { id: true, status: true },
    });
    if (!current) return "not_found" as const;
    if (current.status !== "awaiting_receipt" && current.status !== "partially_received")
      return "not_open" as const;
    const record = await tx.purchase_order.update({
      where: { id },
      data: {
        status: "closed",
        events: {
          create: { kind: "closed", status: "closed", created_by: access.userId },
        },
      },
      include,
    });
    return (await present_all([record], tx))[0];
  });
}

export function delete_purchase_order(id: string, access: RecordAccess) {
  return getDatabase().$transaction(async (tx) => {
    const current = await tx.purchase_order.findFirst({
      where: {
        AND: [{ id }, record_where(access, "purchaseOrders", "delete")],
      },
      select: { id: true, status: true },
    });
    if (!current) return "not_found" as const;
    if (current.status !== "draft") return "not_draft" as const;
    await tx.purchase_order.delete({ where: { id } });
    return "deleted" as const;
  });
}

export type { PurchaseOrderStatus };
