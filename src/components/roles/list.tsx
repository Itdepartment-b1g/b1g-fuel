"use client";
import type { TableSort } from "@/lib/table";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  ManagementList,
  ListPlaceholder,
} from "@/components/common/management-list";
import { DeleteDialog } from "@/components/common/delete-dialog";
import { useAppDispatch, useAppSelector } from "@/lib/store/hooks";
import {
  listRole,
  deleteRole,
  clearRoleMutation,
  selectRole,
} from "@/lib/store/roles-slice";
import { DEFAULT_PAGE_SIZE, paginationFromApi } from "@/lib/pagination";
import type { RoleSummary, RoleScope } from "@/server/schema/roles_schema";
import { RoleDialog } from "./dialog";
import { RolesTable, RolesCards } from "./table";

export default function RolesList() {
  const dispatch = useAppDispatch();
  const router = useRouter();
  const { roles, total, listStatus, listError, mutationStatus, mutationError } =
    useAppSelector(selectRole);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState<number>(DEFAULT_PAGE_SIZE);
  const [search, setSearch] = useState("");
  const [draft, setDraft] = useState("");
  const [scope, setScope] = useState<"all" | RoleScope>("all");
  const [sorting, setSorting] = useState<TableSort | null>(null);
  const [view, setView] = useState<"table" | "cards">("table");
  const [revision, setRevision] = useState(0);
  const [editor, setEditor] = useState<{ id: string | null } | null>(null);
  const [removing, setRemoving] = useState<RoleSummary | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const loading = listStatus === "loading" || listStatus === "idle";
  const pending = mutationStatus === "loading";
  const metadata = paginationFromApi({ page, page_size: limit, total });
  useEffect(() => {
    let current = true;
    const request = dispatch(
      listRole({
        page,
        page_size: limit,
        search,
        ...(sorting
          ? { sort_by: sorting.field, sort_order: sorting.direction }
          : {}),
        ...(scope === "all" ? {} : { scope }),
      }),
    );
    request.then((action) => {
      if (current && listRole.fulfilled.match(action)) {
        const valid = paginationFromApi(action.payload).page;
        if (valid !== page) setPage(valid);
      }
    });
    return () => {
      current = false;
      request.abort();
    };
  }, [dispatch, page, limit, search, scope, revision, sorting]);
  useEffect(() => {
    if ([listError, mutationError].some((error) => error?.status === 401))
      router.replace("/login");
  }, [listError, mutationError, router]);
  function openRole(role?: RoleSummary) {
    dispatch(clearRoleMutation());
    setEditor({ id: role?.id ?? null });
  }
  async function removeRole() {
    if (!removing) return;
    try {
      await dispatch(deleteRole(removing.id)).unwrap();
      setSuccess(`${removing.name} was deleted.`);
      setRemoving(null);
      setRevision((value) => value + 1);
    } catch {
      /* Redux keeps the error in the confirmation dialog. */
    }
  }
  if (listError?.status === 403)
    return (
      <section className="rounded-xl border p-6">
        <h1 className="text-xl font-semibold">Access restricted</h1>
        <p className="mt-2 text-muted-foreground">
          Role management is available to super-admins.
        </p>
      </section>
    );
  const actions = {
    roles,
    sorting,
    loading,
    onSortingChange: (next: TableSort | null) => {
      setSorting(next);
      setPage(1);
    },
    disabled: pending || loading,
    onEdit: openRole,
    onDelete: (role: RoleSummary) => {
      dispatch(clearRoleMutation());
      setRemoving(role);
    },
  };
  return (
    <>
      <ManagementList
        title="Roles"
        description="Define role access, pages, permissions and company defaults."
        total={total}
        action={
          <Button disabled={pending} onClick={() => openRole()}>
            <Plus className="size-4" aria-hidden="true" />
            Add role
          </Button>
        }
        searchDraft={draft}
        onSearchDraft={setDraft}
        searchMaxLength={100}
        onSearch={() => {
          setSearch(draft.trim());
          setPage(1);
        }}
        searchActive={Boolean(search)}
        onClearSearch={() => {
          setDraft("");
          setSearch("");
          setPage(1);
        }}
        toolbar={
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            Scope
            <select
              aria-label="Filter role scope"
              value={scope}
              onChange={(event) => {
                setScope(event.target.value as "all" | RoleScope);
                setPage(1);
              }}
              className="h-10 rounded-md border bg-white px-3 text-sm text-foreground"
            >
              <option value="all">All scopes</option>
              <option value="company">Company</option>
              <option value="global">Global</option>
            </select>
          </label>
        }
        view={view}
        onView={setView}
        loading={loading}
        error={listError?.message}
        onRefresh={() => setRevision((value) => value + 1)}
        success={success}
        onDismissSuccess={() => setSuccess(null)}
        metadata={metadata}
        onPage={setPage}
        onLimitChange={(value) => {
          setLimit(value);
          setPage(1);
        }}
      >
        {view === "table" ? (
          <RolesTable {...actions} />
        ) : !roles.length ? (
          <ListPlaceholder
            loading={loading}
            title={
              search || scope !== "all" ? "No matching roles" : "No roles yet"
            }
            description={
              search || scope !== "all"
                ? "Try another search or scope."
                : "Add a role to define access for your team."
            }
          />
        ) : (
          <RolesCards {...actions} />
        )}
      </ManagementList>
      {editor && (
        <RoleDialog
          roleId={editor.id}
          onClose={() => setEditor(null)}
          onSaved={(role) => {
            setSuccess(
              `${role.name} was ${editor.id ? "updated" : "created"} successfully.`,
            );
            if (!editor.id) setPage(1);
            setEditor(null);
            setRevision((value) => value + 1);
          }}
        />
      )}
      <DeleteDialog
        open={Boolean(removing)}
        onOpenChange={(open) => {
          if (!open) setRemoving(null);
        }}
        title="Delete role?"
        description={`Delete ${removing?.name ?? "this role"}? Its page and permission mappings will also be removed. This cannot be undone.`}
        onConfirm={() => {
          void removeRole();
        }}
        pending={pending}
        error={mutationError?.message}
      />
    </>
  );
}
