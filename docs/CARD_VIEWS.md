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
const [view, setView] = useState<"table" | "cards">("table");

{view === "table" ? <CompaniesTableView {...actions} /> : <CompaniesCards {...actions} />}
```

## What a card contains

- One `<article>` per record, keyed by `record.id`.
- A resource icon, the record name, and the short facts a person needs without opening the table.
- The same row actions as the table: Edit, Delete, Assign, or the extra brand actions. Call `canPerform` before enabling an action, or reuse the action component exported by the table view (`CompanyActions`, `RoleActions`).
- `disabled` from the list while a save or delete is in progress.

An expanded section, such as company members, role details, or brand variants, uses local state for the open card id. Render that detail only while it is open. Do not start a second copy of the list request.

## What stays out of the card view

- Do not dispatch `list*` from the card view. The list already loaded the page.
- Do not render `Pagination`, `SearchFilterBar`, or the page heading here.
- Do not open create or edit dialogs here. Call `onEdit`, `onDelete`, or the other callback and let the list open the dialog.
