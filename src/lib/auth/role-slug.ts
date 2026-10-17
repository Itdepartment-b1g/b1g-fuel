const SLUG_PATTERN = /^[a-z][a-z0-9]*(?:[_-][a-z0-9]+)*$/;

/** Turn a role name into a slug. "Warehouse Staff" becomes warehouse_staff. */
export function staff_role_slug(name: string) {
  const slug = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .replace(/_+/g, "_");
  const normalized = /^[a-z]/.test(slug) ? slug : slug ? `role_${slug}` : "";
  if (!normalized || normalized.length > 100 || !SLUG_PATTERN.test(normalized)) return null;
  return normalized;
}

/** Globally unique slug choices for one company. The plain slug is first; later choices add part of the company id. */
export function staff_role_slug_candidates(name: string, companyId: string) {
  const base = staff_role_slug(name);
  if (!base) return null;
  const compact = companyId.replace(/-/g, "").toLowerCase();
  const withSuffix = (length: number) => {
    const suffix = compact.slice(0, length);
    const stem = base.slice(0, 100 - suffix.length - 1).replace(/_+$/g, "");
    return `${stem}_${suffix}`;
  };
  return [...new Set([base, withSuffix(8), withSuffix(12), withSuffix(32)])];
}
