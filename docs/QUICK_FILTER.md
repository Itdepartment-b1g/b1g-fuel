# Reusable Quick Filter

`src/components/common/quick-filter.tsx` renders a right-side Radix Dialog with the white/navy theme. It fills the viewport width on mobile. The Users page is the implemented example: table and card views share immediate, server-filtered results and pagination.

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

Imports: component from `@/components/common/quick-filter`; types/defaults/helpers from `@/lib/quick-filter`. Fields are `{ key, label, options }`; dropdown options are `{ value, label, count? }`. Additional filters also have a unique `key`. The first status/additional option is unrestricted. Supply nonempty option lists with a distinct unrestricted first value. Labels can customize the button, panel title, section headings, All columns and Any. Optional `datePresets`, `onOpenChange` and `maxConditions` support other screens.

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

Presentation does not inspect records. For a complete in-memory dataset, use `filterRecords(records, filters, config)` with:

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

Adapt the match callbacks to the dataset's types and relationship fields. Column matching, date, status and every nondefault additional filter combine with AND. `matchesColumnConditions`, `matchesQuickFilters`, `groupActiveConditions`, condition-edit helpers, `searchFilterOptions` and `countActiveFilters` are also exported for custom data sources or servers.

Apply filters before slicing pages. For a paginated backend, translate `groupActiveConditions` into queries and send the controlled filter state to the server, as Users does. Filtering only the current page gives incorrect totals and misses matching records on other pages.

## Dates and indicators

The built-in presets are All dates, Today, Last 7 days, Last 30 days and Custom range. Calendar boundaries use Asia/Manila (UTC+08:00) by default. Today includes the full current calendar day; multi-day presets include today. Custom from/to dates are inclusive and can be open-ended. A custom range with both dates empty permits all dates until a boundary is entered. `resolveDateRange` produces `[from, toExclusive)` database bounds; `matchesDate` supports an injected clock and UTC offset for testing or other projects. Invalid calendar dates and reversed ranges are rejected.

The badge counts each active condition, one nondefault date preset, one nondefault status and each nondefault extra dropdown. Custom range counts as selected even before boundaries are entered. The button highlights when the total exceeds zero; Clear appears only then and resets every configured default. Text search outside Quick Filter is separate and is not counted in its badge.

## Users integration

- Parent: `src/components/users/list.tsx`. Filter changes reset the page to 1 and dispatch a new list request. Existing requests are canceled and stale results are ignored.
- Fields: Name, Email, Company and Role. Company/role values are UUIDs; names/emails use exact, case-insensitive matching.
- Date: account creation date.
- Status: All users / Roles assigned / No roles assigned. This describes assignments, not whether an Auth account is enabled.
- Extra: All memberships / With a company / Without a company.
- `GET /api/users/filter-options` provides choices across the full database. Optional counts describe the full dataset, not the current filtered subset. Counts and choices are read in one consistent snapshot.
- `GET /api/users?filters=...` accepts JSON-encoded state; the server validates it and combines it with search before pagination/counting. The Users example allows at most 50 conditions and 12,000 JSON characters. Swagger documents the format.
- Filter choices reload after user creation or refresh. Filter state survives closing the panel and switching views; a full page reload returns to defaults.

`validateUserFilter` lives directly in `src/server/controllers/users_controller.ts`. `buildUserFilter` in `src/server/utils/user_filter.ts` translates validated filters into a Prisma query without database calls. The user service applies that query through the repository. `src/lib/store/users-slice.ts` handles filter-option loading and serializes filters into GET requests. Neither component nor Redux imports backend/database code.

## Keyboard and layering

Native field/date/status selects support keyboard navigation. Value dropdowns open a nested Radix Dialog portal above the panel. Their focused search input uses combobox/listbox semantics; Arrow Up/Down move the active choice, Enter selects and Escape closes only the dropdown. Tab follows dialog focus management. Resize or scrolling the trigger's container closes the dropdown so it does not become detached. The panel traps focus, closes with Escape, and returns focus to its trigger.

Logic tests cover grouping, incomplete rows, IDs, option search, indicator counts, AND composition, date boundaries and server validation. Browser checks cover actual database-filtered Users results, saved selections, reset behavior, layering and mobile width.
