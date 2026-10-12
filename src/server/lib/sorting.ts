export type SortDirection = "asc" | "desc";
export type Sorting = { field: string; direction: SortDirection };

export class SortingError extends Error {
  constructor() {
    super("Invalid sorting parameters.");
  }
}

/** Validate API sorting against the resource's allowed fields; omitted parameters preserve its default order. */
export function parse_sort(
  query: { sort_by?: unknown; sort_order?: unknown },
  fields: readonly string[],
): Sorting | undefined {
  if (query.sort_by === undefined && query.sort_order === undefined) return undefined;
  const field = query.sort_by === undefined ? "created_at" : query.sort_by;
  const direction = query.sort_order === undefined ? (field === "created_at" ? "desc" : "asc") : query.sort_order;
  if (typeof field !== "string" || !fields.includes(field) ||
      (direction !== "asc" && direction !== "desc")) throw new SortingError();
  return { field, direction };
}

/** Build typed Prisma ordering before pagination, appending a unique key for stable ordering of equal values. */
export function build_sort<Order>(
  sorting: Sorting | undefined,
  config: {
    fields: Record<string, (direction: SortDirection) => Order>;
    default: Sorting;
    tieBreaker: { field: string; order: Order };
  },
): Order[] {
  const selected = sorting ?? config.default;
  if (!Object.hasOwn(config.fields, selected.field) ||
      (selected.direction !== "asc" && selected.direction !== "desc")) throw new SortingError();
  const order = config.fields[selected.field](selected.direction);
  return selected.field === config.tieBreaker.field ? [order] : [order, config.tieBreaker.order];
}
