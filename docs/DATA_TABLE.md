# Reusable data table

`src/components/common/data-table.tsx` exports the generic `DataTable<T>`. It renders only the table; the existing pagination component and parent page controls stay separate. Column and action dropdowns use the shared portal menu in `table-menu.tsx`, so scrolling containers do not clip them.

## Columns and local datasets

```tsx
import { DataTable, type DataTableColumn } from "@/components/common/data-table";

type Item = { id: string; name: string; quantity: number | null; created_at: string };
const columns: DataTableColumn<Item>[] = [
  { id: "name", header: "Item Name", value: row => row.name, sortable: true, freezable: true, width: 240 },
  { id: "quantity", header: "Quantity", value: row => row.quantity, sortable: true, width: 150 },
  { id: "created_at", header: "Date Added", value: row => new Date(row.created_at), sortable: true, width: 180 },
];

<DataTable data={allItems} columns={columns} rowKey={row => row.id} caption="Inventory items" />
```

Local mode sorts the complete supplied dataset without mutating it. The default is `created_at` descending with row ID as a tie-breaker. Strings use case-insensitive natural ordering; numbers, booleans and Date objects are supported. Null, undefined and invalid numeric/date values stay last in either direction. Use a stable unique `rowKey`, never a row index.

A column can define a custom `cell(row)` renderer independently of its sorting `value(row)`. For custom ordering, provide `compare(a, b)` returning an ascending comparison; the component reverses it for descending. Custom comparators should handle their own missing values. `sortField` maps a display column ID to a different sorting field.

Override the default with `defaultSorting={{ field: "name", direction: "asc" }}`. If that field is not a displayed column, provide `defaultSortValue={row => row.name}`. Creation timestamps are read from `created_at` automatically when no column accessor is supplied.

## API lists and pagination

```tsx
const [sorting, setSorting] = useState<TableSort | null>(null);

<DataTable
  data={pageRows}
  columns={columns}
  rowKey={row => row.id}
  caption="Inventory items"
  sortingMode="server"
  sorting={sorting}
  onSortingChange={next => { setSorting(next); setPage(1); }}
/>
```

Import `TableSort` from `@/lib/table`. In server mode the component preserves supplied row order. The parent sends the selected field/direction as `sort_by` and `sort_order`, requests a new page, and omits both when sorting is null. The server must apply sorting before its pagination; see [server sorting](SORTING.md). A custom server default must also be configured in the parent request/repository.

Users, Companies and Roles now use this pattern. Header changes reset their page to 1, Redux forwards sorting to the API, and existing cancellation/stale-response handling remains active. Their pagination UI has not changed. Fields unsupported by the backend, such as company membership counts, do not expose sorting options.

`PaginatedUsersTable` sorts its complete local dataset before `paginateItems`, then passes the page to the table in manual/server mode to avoid sorting the page again. For another locally paginated screen, follow that pattern rather than letting the table sort a sliced page.

## Header menu and frozen columns

Sortable headers expose Default, Ascending and Descending. Default restores the configured default field/direction from any header; by default it is labeled Default (Latest First). Active sorting has an arrow and accessible `aria-sort` metadata.

Freezing is separate: a column with `freezable: true` can expose its menu even when `sortable` is false. Freeze/Unfreeze follows the sort choices after a separator when both are enabled. Frozen columns move to the left in their original column order and have a pin indicator; sticky offsets use measured rendered column widths, including the optional expansion control.

Single-column freezing is the default. Set `multipleFrozenColumns` to allow several, and `initialFrozenColumns={["name"]}` for initial pins. Sorting, refreshing data and freezing do not reset one another. Remounting the table resets its internal frozen/expanded state.

## Expanded rows and row actions

Provide `expandedRow={row => <ItemDetails item={row} />}` to enable an expansion control. Expansion is associated with the stable row ID and survives sorting. `expansionMode="single"` is the default; use `"multiple"` to allow several rows. Details animate open/closed, honor reduced-motion preferences, and collapsed content is hidden from accessibility and keyboard navigation.

```tsx
actions={[
  { id: "view", label: "View Details", icon: <Eye />, onSelect: openDetails },
  { id: "edit", label: "Edit", icon: <Pencil />, hidden: row => !canEdit(row), onSelect: editItem },
  { id: "delete", label: "Delete", icon: <Trash2 />, destructive: true,
    disabled: row => (row.quantity ?? 0) > 0, description: "Delete only empty items", onSelect: confirmDelete },
]}
```

Actions can be an array or a function returning an array for each row. `hidden(row)`, `disabled` or `disabled(row)`, and a static or per-row `description` support permissions and status rules. `actionsDisabled` disables all action triggers during pending operations. Actions stay in the rightmost column and are omitted entirely when no actions are configured.

Companies and Roles preserve their existing edit/delete restrictions and confirmation dialogs. Their card views retain the existing action buttons; Users has no extra account mutation actions.

## States, accessibility and examples

`loading` shows skeleton rows when data is empty and announces loading; existing rows remain visible during refresh. Configure `skeletonRows`, `emptyTitle` and `emptyDescription` as needed. Column widths and horizontal scrolling support narrow screens, including frozen-column alignment and viewport-constrained menus.

Menus support Enter/Space, Arrow Up/Down, Home/End, Escape, Tab, outside clicks and focus restoration. They close on outside scrolling/resizing to avoid drifting from their triggers.

`src/components/common/data-table-examples.tsx` exports `DataTableExamples` with five local-fixture examples: sorting only, sorting and accordion, sorting and actions, sorting and frozen columns, and all features together. Import it into a client page for a preview; it performs no API writes.

Verification:

```text
npm test
node scripts/check-table-browser.mjs
```

The optional browser check uses an installed Chromium browser, the existing esbuild dependency, and the theme CSS from `npm run build`. Set `TABLE_BROWSER_PATH` if Edge/Chrome/Chromium is in another location. It checks keyboard menus, default reset, sticky alignment on mobile, expanded row identity, disabled actions, loading and empty states, and saves a preview under `.next/table-browser/table-desktop.png`.
