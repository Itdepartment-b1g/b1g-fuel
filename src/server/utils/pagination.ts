import { DEFAULT_PAGE_SIZE, PAGE_SIZE_OPTIONS } from "@/lib/pagination";

export type Pagination = {
  page: number;
  page_size: number;
  skip: number;
  take: number;
};

export type PaginationOptions = {
  defaultPageSize?: number;
  maxPageSize?: number;
  maxPage?: number;
};

export class PaginationError extends Error {
  constructor() { super("Invalid pagination parameters."); }
}

function positiveInteger(value: unknown, fallback: number, maximum: number): number {
  if (value === undefined) return fallback;
  if (typeof value !== "string" || !/^[1-9]\d*$/.test(value)) throw new PaginationError();
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed > maximum) throw new PaginationError();
  return parsed;
}

/** Parse Express query values once in the controller; pass skip/take to the repository. */
export function parsePagination(
  query: { page?: unknown; page_size?: unknown },
  options: PaginationOptions = {},
): Pagination {
  const { defaultPageSize = DEFAULT_PAGE_SIZE, maxPageSize = 100, maxPage = 1_000_000 } = options;
  if ([defaultPageSize, maxPageSize, maxPage].some((value) => !Number.isSafeInteger(value) || value < 1) || defaultPageSize > maxPageSize || !PAGE_SIZE_OPTIONS.some((size) => size === defaultPageSize)) {
    throw new Error("Invalid pagination configuration.");
  }
  const page = positiveInteger(query.page, 1, maxPage);
  const pageSize = positiveInteger(query.page_size, defaultPageSize, maxPageSize);
  if (!PAGE_SIZE_OPTIONS.some((size) => size === pageSize)) throw new PaginationError();
  const skip = (page - 1) * pageSize;
  if (!Number.isSafeInteger(skip)) throw new PaginationError();
  return { page, page_size: pageSize, skip, take: pageSize };
}

/** Preserve resource-specific array keys while sharing the response metadata. */
export function paginationMetadata(total: number, pagination: Pagination) {
  return { total, page: pagination.page, page_size: pagination.page_size };
}
