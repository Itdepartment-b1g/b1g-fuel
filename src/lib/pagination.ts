export const PAGE_SIZE_OPTIONS = [10, 20, 50, 100] as const;
export const DEFAULT_PAGE_SIZE = PAGE_SIZE_OPTIONS[0];
// Generic component defaults. API-backed screens can pass PAGE_SIZE_OPTIONS instead.
export const DEFAULT_LIMIT_OPTIONS = [5, 10, 20, 50] as const;

export type PaginationMetadata = {
  page: number;
  limit: number;
  total: number;
  total_pages: number;
  has_next_page: boolean;
  has_prev_page: boolean;
};
export type PaginatedItems<T> = { items: T[] } & PaginationMetadata;

export function validateLimit(limit: number): void {
  if (!Number.isSafeInteger(limit) || limit <= 0) throw new RangeError("Pagination limit must be a positive integer.");
}

export function createPaginationMetadata(total: number, requestedPage = 1, limit: number = DEFAULT_PAGE_SIZE): PaginationMetadata {
  validateLimit(limit);
  if (!Number.isSafeInteger(total) || total < 0) throw new RangeError("Pagination total must be a nonnegative integer.");
  const totalPages = Math.ceil(total / limit);
  const requested = Number.isNaN(requestedPage) ? 1 : Math.trunc(requestedPage);
  const page = totalPages === 0 ? 1 : Math.min(Math.max(requested, 1), totalPages);
  return { page, limit, total, total_pages: totalPages, has_next_page: page < totalPages, has_prev_page: totalPages > 0 && page > 1 };
}

/** Filter and sort the complete dataset before calling this helper. Does not mutate input. */
export function paginateItems<T>(items: readonly T[], requestedPage = 1, limit: number = DEFAULT_PAGE_SIZE): PaginatedItems<T> {
  const metadata = createPaginationMetadata(items.length, requestedPage, limit);
  const start = (metadata.page - 1) * limit;
  return { items: items.slice(start, start + limit), ...metadata };
}

export type PageNumber = number | "ellipsis";
export function pageNavigation(target: number, metadata: PaginationMetadata, canJump: boolean, disabled = false): "page" | "prev" | "next" | null {
  if (disabled || !Number.isSafeInteger(target) || target === metadata.page || target < 1 || target > metadata.total_pages) return null;
  if (canJump) return "page";
  if (target === metadata.page - 1 && metadata.has_prev_page) return "prev";
  if (target === metadata.page + 1 && metadata.has_next_page) return "next";
  return null;
}
export function mobilePageNumbers(page: number, totalPages: number): PageNumber[] {
  if (totalPages <= 0) return [1];
  const current = Math.min(Math.max(Math.trunc(page), 1), totalPages);
  if (totalPages <= 5) return Array.from({ length: totalPages }, (_, index) => index + 1);
  if (current <= 3) return [1, 2, 3, "ellipsis", totalPages];
  if (current >= totalPages - 2) return [1, "ellipsis", totalPages - 2, totalPages - 1, totalPages];
  return [1, "ellipsis", current - 1, current, current + 1, "ellipsis", totalPages];
}

/** Existing API responses use page_size. Adapt their totals without paginating their rows again. */
export function paginationFromApi(data: { page: number; page_size: number; total: number }): PaginationMetadata {
  return createPaginationMetadata(data.total, data.page, data.page_size);
}
