# Dialog structure

Feature screens keep create and edit in separate dialog files. The form lives in the same file as the dialog. Do not add a shared `*-form.tsx`, and do not put create and edit behind one dialog that switches on a nullable id.

## Where files go

```text
src/components/{resource}/
  list.tsx
  dialog/
    create-{resource}-dialog.tsx
    edit-{resource}-dialog.tsx
  table-view/
  card-views/
```

File and component names:

| File | Export |
| --- | --- |
| `create-company-dialog.tsx` | `CreateCompanyDialog` |
| `edit-company-dialog.tsx` | `EditCompanyDialog` |

A screen that is not create or edit gets its own file. Purchase orders use `create-purchase-order-dialog.tsx`, `edit-purchase-order-dialog.tsx`, `receive-purchase-order-dialog.tsx`, and `timeline-purchase-order-dialog.tsx`. Users use `create-user-dialog.tsx` and `assign-user-dialog.tsx`.

## Inside one dialog file

The file exports the dialog. A fields function in that same file renders the form. Create fields only create. Edit fields only update.

```tsx
export function CreateCompanyDialog({ onClose, onSaved }: { onClose: () => void; onSaved: (company: CompanySummary) => void }) {
  // Load choices when create needs them. Redirect to /login on 401.
  // Block dismiss while mutationStatus === "loading".
  return (
    <Dialog open onOpenChange={(open) => { if (!open && !pending) onClose(); }}>
      <DialogContent>{/* title, then fields, error, or Loading */}</DialogContent>
    </Dialog>
  );
}

function CreateCompanyFields({ onSaved, onCancel }: { onSaved: (company: CompanySummary) => void; onCancel: () => void }) {
  // Local field state, validation, and the create dispatch live here.
}
```

Edit dialogs take a required id (`companyId`, `supplierId`, `purchaseOrderId`). They load the record, show `Loading` until it matches that id, and offer Try again when the load fails.

Keep the form open when save fails so the user can retry. Show one success toast, either in the dialog or in the list `onSaved` handler.

## How the list opens them

The list keeps two pieces of state. It does not store `{ id: string | null }`.

```tsx
const [creating, setCreating] = useState(false);
const [editingId, setEditingId] = useState<string | null>(null);

function openCompany(company?: CompanySummary) {
  dispatch(clearCompanyMutation());
  if (company) setEditingId(company.id);
  else setCreating(true);
}

{creating && (
  <CreateCompanyDialog
    onClose={() => setCreating(false)}
    onSaved={() => { setPage(1); setCreating(false); setRevision((value) => value + 1); }}
  />
)}
{editingId && (
  <EditCompanyDialog
    companyId={editingId}
    onClose={() => setEditingId(null)}
    onSaved={() => { setEditingId(null); setRevision((value) => value + 1); }}
  />
)}
```

Reset to page 1 after create. Leave the current page after edit.

## What to leave alone

- Do not merge purchase-order create, edit, receive, and timeline into one dialog.
- The purchase-order list imports `create-purchase-order-dialog.tsx`, `edit-purchase-order-dialog.tsx`, `receive-purchase-order-dialog.tsx`, and `timeline-purchase-order-dialog.tsx`. Ignore older dialog files in that folder that the list does not import.
- Delete confirmation stays in `src/components/common/delete-dialog.tsx`.
