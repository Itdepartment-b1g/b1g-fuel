<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Client structure

A resource page only renders that resource's `list.tsx`. The list loads the data, opens dialogs, and passes the same rows to the table view and, when present, the card view. Read [pages and views](docs/PAGE_VIEWS.md), [card views](docs/CARD_VIEWS.md), and [dialog structure](docs/DIALOG_STRUCTURE.md).

## Server structure

Express resources go route → controller → service → repository. Operations use snake_case. Read [backend structure](docs/BACKEND_STRUCTURE.md) and [code conventions](docs/CODE_CONVENTIONS.md) before changing the server.

## Action feedback

Use `useToast` from `@/components/providers/toast-provider` for create, update, and delete results. Show a success toast after the request succeeds and an error toast when it fails. Keep forms open on failure so users can retry, and avoid duplicating success messages in page banners.
