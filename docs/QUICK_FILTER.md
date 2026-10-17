# Reusable Quick Filter

`src/components/common/filter/quick-filter.tsx` renders a right-side Radix Dialog with the white/navy theme. It fills the viewport width on mobile. The Users page is the implemented example: table and card views share immediate, server-filtered results and pagination.

## Controlled state

Keep `QuickFilterState` in the parent. It contains `date`, uniquely identified column `conditions`, `status` and an `additional` key/value map. `onChange` receives the next state immediately. Done only closes the panel. Closing/reopening preserves selections because the panel has no draft copy.

```tsx
const defaults = {
  status: statusOptions[0].value,
  additional: Object.fromEntries(
    extraFilters.map(filter => [filter.key, filter.options[0].value])
  ),
};
const [filters, setFilters] = useState(() => createQuickFilterState(defaults));

<QuickFilter
  value={filters}
  onChange={setFilters}
  fields={fields}
  statusOptions={statusOptions}
  additionalFilters={extraFilters}
/>
```

Imports: component from `@/components/common/filter/quick-filter`; shared types, date preset choices and UI state helpers from `@/lib/quick-filter`. Server record matching, condition grouping and date resolution live in `@/server/lib/filter`. Fields are `{ key, label, options }`; dropdown options are `{ value, label, count? }`. Additional filters also have a unique `key`. The first status/additional option is unrestricted. Supply nonempty option lists with a distinct unrestricted first value. Labels can customize the button, panel title, section headings, All columns and Any. Optional `onOpenChange` and `maxConditions` support other screens. The date section uses `DateRangeMenu`.

## Column semantics

- All columns has field `""` and applies no restriction; it never searches every column.
- A specific field reveals its searchable values. Search matches both label and value without case sensitivity.
- Any clears the value. Selected values show a checkmark; unmatched searches show No results.
- Changing a field clears its value. A condition is active only with a specific field and a nonblank trimmed value.
- Add condition requires the last row to be active. The new row inherits its field and starts with an empty value.
- Remove is available with more than one row. Clear restores exactly one empty row with a new ID.
- Active conditions group by field regardless of position. Within a field, values use OR; field groups use AND. Incomplete rows are ignored.

For example, Sales + Support in Department, with Manila in Location, means `(Sales OR Support) AND Manila`. Duplicate active rows count individually in the badge even though duplicate matching values need only one comparison.

## Filtering helpers

Presentation does not inspect records. For a complete in-memory dataset on the server, import `filterRecords` and `matchesDate` from `@/server/lib/filter` and use:

```ts
const filtered = filterRecords(records, filters, {
  defaults,
  match: (record, field, value) =>
    String(record[field]).toLowerCase() === value.toLowerCase(),
  matchDate: (record, date) => matchesDate(record.created_at, date),
  matchStatus: (record, status) => record.status === status,
  matchAdditional: (record, key, value) => record[key] === value,
});
```

Adapt the match callbacks to the dataset's types and relationship fields. Column matching, date, status and every nondefault additional filter combine with AND. `matchesColumnConditions`, `matchesQuickFilters` and `groupActiveConditions` are exported from `@/server/lib/filter` for server data sources. Condition-edit helpers, `searchFilterOptions` and `countActiveFilters` remain in `@/lib/quick-filter` for the UI.

Apply filters before slicing pages. For a paginated backend, translate `groupActiveConditions` into queries and send the controlled filter state to the server, as Users does. Filtering only the current page gives incorrect totals and misses matching records on other pages.

## Dates and indicators

The date control is `DateRangeMenu`. Presets are All Time, This Month, Last Month, Last 3 Months, Last 6 Months, This Year, Last Year, and a custom range. Calendar boundaries use Asia/Manila (UTC+08:00). This Month and Last Month cover the full calendar month. Last 3 Months and Last 6 Months are rolling windows ending today. This Year and Last Year cover 1 January through 31 December. Custom from/to dates are inclusive calendar days. `resolveDateRange` produces `[from, toExclusive)` database bounds. Invalid calendar dates and reversed ranges are rejected.

The badge counts each active condition, one nondefault date preset, one nondefault status and each nondefault extra dropdown. A custom range counts when its preset is custom. The button highlights when the total exceeds zero; Clear appears only then and resets every configured default. Text search outside Quick Filter is separate and is not counted in its badge.

## Users integration

- Parent: `src/components/users/list.tsx`. Filter changes reset the page to 1 and dispatch a new list request. Existing requests are canceled and stale results are ignored.
- Fields: Name, Email, Company and Role. Company/role values are UUIDs; names/emails use exact, case-insensitive matching.
- Date: account creation date.
- Status: All users / Roles assigned / No roles assigned. This describes assignments, not whether an Auth account is enabled.
- Extra: All memberships / With a company / Without a company.
- `GET /api/users/filter-options` provides choices across the full database. Optional counts describe the full dataset, not the current filtered subset. Counts and choices are read in one consistent snapshot.
- `GET /api/users?filters=...` accepts JSON-encoded state; the server validates it and combines it with search before pagination/counting. The Users example allows at most 50 conditions and 12,000 JSON characters. Swagger documents the format.
- Filter choices reload after user creation or refresh. Filter state survives closing the panel and switching views; a full page reload returns to defaults.

The `list_user` handler validates quick filters inline; user operations also handle their own HTTP error responses. `list_user` in `src/server/repositories/users_repository.ts` uses the shared `build_filter` utility before pagination and counting. Dropdown choices and account-creation eligibility queries also live in `users_repository.ts`. The user service passes search and filters to the repository, which constructs the Prisma where objects. `src/lib/store/users-slice.ts` handles filter-option loading and serializes filters into GET requests. Neither component nor Redux imports backend/database code.

## Keyboard and layering

Native field/date/status selects support keyboard navigation. Value dropdowns open a nested Radix Dialog portal above the panel. Their focused search input uses combobox/listbox semantics; Arrow Up/Down move the active choice, Enter selects and Escape closes only the dropdown. Tab follows dialog focus management. Resize or scrolling the trigger's container closes the dropdown so it does not become detached. The panel traps focus, closes with Escape, and returns focus to its trigger.

Browser checks cover actual database-filtered Users results, saved selections, reset behavior, layering and mobile width.

## Shared database filter utility

Use `build_filter<Prisma.ModelWhereInput>(filters, config)` from `@/server/lib/filter` inside a repository list function. It returns a Prisma-compatible where object; use the same object for both row selection and counting before applying skip/take. It performs no database queries or HTTP validation.

The configuration accepts:

- `fields`: callbacks keyed by filter field, receiving trimmed, deduplicated values. Each callback must match any of those values using OR or in. Different field groups combine with AND.
- `search`: the search value and an array of field callbacks. Each receives a literal, case-insensitive contains predicate; the resulting field predicates combine with OR.
- `date`: a callback receiving gte/lt bounds from the shared Manila calendar range resolver.
- `status` and `additional`: maps from selected values to resource-specific predicates. Omit unrestricted choices so they add no clause.
- `where`: an optional repository predicate, such as role scope, combined with all other conditions.

Unknown or unconfigured choices are ignored; controllers remain responsible for rejecting invalid request values. An optional third argument supplies the clock for deterministic date tests. Companies and Roles use the same utility for text search, while Users also configures relationship, date and assignment filters. Dropdown loading and account-creation eligibility stay in the Users repository.
