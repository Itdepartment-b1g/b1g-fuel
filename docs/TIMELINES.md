# Shared timelines

Use `Timeline` from `@/components/common/timeline/timeline` for inline history and `TimelineDialog` from `@/components/common/timeline/timeline-dialog` for a standalone history dialog.

The resource owns fetching, cancellation, authorization redirects, event ordering, and domain calculations. Pass entries in display order; the shared UI preserves that order and formats timestamps using the Manila date helper. Give every entry a stable ID.

```tsx
<TimelineDialog
  title="Material request timeline"
  description={request.request_no ?? "Draft"}
  entries={request.events.map((event) => ({
    id: event.id,
    title: event.kind,
    occurredAt: event.created_at,
    actorName: event.created_by_name,
    note: event.note,
  }))}
  loading={loading}
  error={error?.message}
  onRetry={reload}
  onClose={onClose}
/>
```

Entries also accept `icon`, `tone` (`info`, `warning`, `success`, `danger`, or `neutral`), and `content` for resource-specific detail sections. Reuse the shared TableView for item tables. The dialog's optional children appear before the timeline for a resource legend or display controls.

The dialog provides a title, description, event count, loading, error/retry, empty history, and Done button. It uses the existing accessible Dialog. Loading and errors hide previous event content. Timeline history is read-only; approve, reject, and other forms stay in their feature dialogs.

Purchase orders use the common dialog while retaining their receiving calculations and table/card controls. Material requests have a **Timeline** row action that opens `dialog/timeline-material-request-dialog.tsx`, loads the selected request, and uses the common dialog. Their preview and expanded table rows use the inline component. All MR views share event labels, icons, and colors through `timeline-entries.tsx`. No API or database changes are needed.

The MR timeline follows the purchase-order layout: event legend, table/card display controls, request details at creation, status details on later events, and a paginated materials section under every event. Tables reuse the shared TableView. Approved quantities and the assigned warehouse appear at the approval step. Material quantities and editable request details come from the current saved record; the dialog explains this because earlier draft versions are not stored.
