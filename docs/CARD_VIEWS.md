# Card views

A card view is the grid shown when the list toggle is on Cards. It displays the same page of records as the table view. It does not load, search, filter, sort, or paginate those records.

## File

```text
src/components/{resource}/card-views/{resource}-cards.tsx
```

| Resource | Component |
| --- | --- |
| Companies | `CompaniesCards` |
| Suppliers | `SuppliersCards` |
| Measurements | `MeasurementsCards` |
| Brands | `BrandsCards` |
| Roles | `RolesCards` |
| Users | `UsersCards` |
| Receiving | `ReceivingCards` |
| Purchase orders | `PurchaseOrderCards` |

Product types have a table view only. Add a card file when the list grows a table/cards toggle.

## What the list passes in

The list owns the rows. The card view receives that array plus the same action callbacks the table view uses. Reuse the table view's action prop type when one exists, such as `CompanyActionProps` or `BrandActionProps`.

```tsx
export function CompaniesCards({
  companies,
  onEdit,
  onDelete,
  disabled,
}: CompanyActionProps & { companies: CompanySummary[] }) {
  return (
    <div className="grid gap-4 p-4 sm:grid-cols-2 sm:p-6 xl:grid-cols-3">
      {companies.map((company) => (
        <article key={company.id} className="rounded-xl border p-5">
          {/* name, summary, actions */}
        </article>
      ))}
    </div>
  );
}
```

The list switches views. Empty and loading states for the whole page stay in the list, next to the table branch.

```tsx
const [view, setView] = useListView();

{view === "table" ? <CompaniesTableView {...actions} /> : <CompaniesCards {...actions} />}
```

`useListView` from `SearchFilterBar` defaults to cards on mobile and table on desktop.

## What a card contains

- One `<article>` per record, keyed by `record.id`.
- A resource icon, the record name, and the short facts a person needs without opening the table.
- The same row actions as the table, inside `CardActionsMenu`: a vertical three-dot button in the card header. View, Edit, Delete, Assign, and the extra purchase-order actions open from that menu. Call `canPerform` before enabling an action.
- `disabled` from the list while a save or delete is in progress.
- A View button that opens `dialog/view-{resource}-dialog.tsx`. That dialog shows the same detail the table expands in a row: members, units, variants, role access, or purchase-order lines. The card does not expand that detail in place.

The view dialog keeps its own open record in the card view. Do not start a second copy of the list request.

## What stays out of the card view

- Do not dispatch `list*` from the card view. The list already loaded the page.
- Do not render `Pagination`, `SearchFilterBar`, or the page heading here.
- Do not open create or edit dialogs here. Call `onEdit`, `onDelete`, or the other callback and let the list open the dialog. The View dialog is the exception: the card opens it.
