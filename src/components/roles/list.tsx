"use client";
import { SearchFilterBar } from "@/components/common/search-filter-bar";
import { countActiveFilters, createQuickFilterState } from "@/lib/quick-filter";
import { ROLE_FILTER_DEFAULTS } from "@/lib/management-filters";
import { useRecordAccess } from "@/components/providers/access-provider";
import { canPerform } from "@/lib/auth/access-scope";
import { useToast, toastErrorMessage } from "@/components/providers/toast-provider";
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
  listRole, getRoleFilterOption,
  deleteRole,
  clearRoleMutation,
  selectRole,
} from "@/lib/store/roles-slice";
import { DEFAULT_PAGE_SIZE, paginationFromApi } from "@/lib/pagination";
import type { RoleSummary } from "@/server/schema/roles_schema";
import { RoleDialog } from "./dialog/role-dialog";
import { RolesTableView } from "./table-view/roles-table-view";
import { RolesCards } from "./card-views/roles-cards";

export default function RolesList() {
  const dispatch = useAppDispatch();
  const access = useRecordAccess();
  const toast = useToast();
  const router = useRouter();
  const { roles, total, listStatus, listError, mutationStatus, mutationError, filterOptions, filterOptionsError } =
    useAppSelector(selectRole);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState<number>(DEFAULT_PAGE_SIZE);
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState(() => createQuickFilterState(ROLE_FILTER_DEFAULTS));
  const activeFilters = countActiveFilters(filters, ROLE_FILTER_DEFAULTS);
  const [sorting, setSorting] = useState<TableSort | null>(null);
  const [view, setView] = useState<"table" | "cards">("table");
  const [revision, setRevision] = useState(0);
  const [editor, setEditor] = useState<{ id: string | null } | null>(null);
  const [removing, setRemoving] = useState<RoleSummary | null>(null);
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
        ...(activeFilters ? { filters } : {}),
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
  }, [dispatch, page, limit, search, filters, activeFilters, revision, sorting]);
  useEffect(() => {
    if ([listError, mutationError].some((error) => error?.status === 401))
      router.replace("/login");
  }, [listError, mutationError, router]);
  useEffect(() => {
    const request = dispatch(getRoleFilterOption());
    return () => request.abort();
  }, [dispatch, revision]);
  function openRole(role?: RoleSummary) {
    dispatch(clearRoleMutation());
    setEditor({ id: role?.id ?? null });
  }
  async function removeRole() {
    if (!removing) return;
    try {
      await dispatch(deleteRole(removing.id)).unwrap();
      toast.success(`${removing.name} was deleted.`);
      setRemoving(null);
      setRevision((value) => value + 1);
    } catch (error) {
      toast.error(toastErrorMessage(error, "Could not delete the role."));
    }
  }
  if (listError?.status === 403)
    return (
      <section className="rounded-xl border p-6">
        <h1 className="text-xl font-semibold">Access restricted</h1>
        <p className="mt-2 text-muted-foreground">
          You do not have permission to view roles.
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
          canPerform(access, "roles", "add") ? <Button disabled={pending} onClick={() => openRole()}>
            <Plus className="size-4" aria-hidden="true" />
            Add role
          </Button> : null
        }
        filterBar={
          <>
            <SearchFilterBar
              search={search}
              onSearch={(value) => { setSearch(value); setPage(1); }}
              filters={filters}
              onFiltersChange={(next) => { setFilters(next); setPage(1); }}
              fields={filterOptions.fields}
              statusOptions={filterOptions.statusOptions}
              additionalFilters={filterOptions.additionalFilters}
              filterLabels={{ date: "Creation date", status: "Assignment status" }}
              maxConditions={50}
              loading={loading}
              searchLabel="Search roles by name or slug"
              placeholder="Search by name or slug"
              maxLength={100}
              quickFilterActive={activeFilters > 0}
            />
            {filterOptionsError && <div role="alert" className="flex items-center justify-between gap-2 text-xs text-destructive"><span>Filter choices could not be loaded.</span><Button variant="ghost" size="sm" onClick={() => dispatch(getRoleFilterOption())}>Retry</Button></div>}
          </>
        }
        view={view}
        onView={setView}
        loading={loading}
        error={listError?.message}
        onRefresh={() => setRevision((value) => value + 1)}
        metadata={metadata}
        onPage={setPage}
        onLimitChange={(value) => {
          setLimit(value);
          setPage(1);
        }}
      >
        {view === "table" ? (
          <RolesTableView {...actions} />
        ) : !roles.length ? (
          <ListPlaceholder
            loading={loading}
            title={
              search || activeFilters > 0 ? "No matching roles" : "No roles yet"
            }
            description={
              search || activeFilters > 0
                ? "Try another search or clear your filters."
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
            toast.success(
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
