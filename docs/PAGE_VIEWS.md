# Pages, lists, and views

A route page renders one list. The list owns the data and the screen. Table and card views only display the rows the list passes in.

## Page

`src/app/(app)/{resource}/page.tsx` imports the list and returns it. It does not fetch data, hold dialogs, or render a table.

```tsx
import CompaniesList from "@/components/companies/list";

export default function CompaniesPage() {
  return <CompaniesList />;
}
```

The `(app)` layout already wraps the page in the dashboard shell. Login, docs, and the home page are the exceptions: they are not resource lists.

## List

`src/components/{resource}/list.tsx` is a client component and the default export. It:

- Loads the page from Redux, including search, filters, sorting, and pagination.
- Renders the heading, add button, `SearchFilterBar`, and `Pagination`.
- Opens create and edit dialogs. See [dialog structure](DIALOG_STRUCTURE.md).
- Passes the current rows and callbacks into the table view and, when the screen has one, the card view.

```tsx
const [view, setView] = useState<"table" | "cards">("table");

{view === "table" ? (
  <CompaniesTableView {...actions} />
) : (
  <CompaniesCards {...actions} />
)}
```

`actions` carries the rows, `sorting`, `onSortingChange`, `loading`, `disabled`, and the row callbacks (`onEdit`, `onDelete`, and any extra actions). Changing sort or search resets the page to 1.

## Table view

```text
src/components/{resource}/table-view/
  {resource}-table-columns.tsx
  {resource}-table-view.tsx
```

The columns file exports `TableColumn<T>[]` for the shared `TableView` in `src/components/common/table-view.tsx`. The table view file renders `TableView` with those columns, the rows from the list, and row actions. It does not dispatch the list request. Pagination stays in the list.

## Card view

```text
src/components/{resource}/card-views/
  {resource}-cards.tsx
```

The card view receives the same rows and callbacks as the table view. Add one only when the list has the table/cards toggle. Product types currently render a table view only. See [card views](CARD_VIEWS.md).

## Shared UI

Search, pagination, delete confirmation, and the table shell stay in `src/components/common`. A resource folder does not copy those components.
