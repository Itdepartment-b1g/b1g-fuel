"use client";

import { useRecordAccess } from "@/components/providers/access-provider";
import { canPerform } from "@/lib/auth/access-scope";
import {
  useToast,
  toastErrorMessage,
} from "@/components/providers/toast-provider";
import type { TableSort } from "@/types/table-views";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle, Plus, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Pagination } from "@/components/common/pagination";
import { SearchFilterBar, useListView } from "@/components/common/filter/search-filter-bar";
import { DeleteRoleDialog } from "./dialog/delete-role-dialog";
import { useAppDispatch, useAppSelector } from "@/lib/store/hooks";
import {
  listRole,
  getRoleFilterOption,
  deleteRole,
  clearRoleMutation,
  selectRole,
} from "@/lib/store/roles-slice";
import { countActiveFilters, createQuickFilterState } from "@/utils/quick-filter";
import { ROLE_FILTER_DEFAULTS } from "@/utils/management-filters";
import { DEFAULT_PAGE_SIZE, PAGE_SIZE_OPTIONS, paginationFromApi } from "@/utils/pagination";
import type { RoleSummary } from "@/types/roles";
import { CreateRoleDialog } from "./dialog/create-role-dialog";
import { EditRoleDialog } from "./dialog/edit-role-dialog";
import { RolesTableView } from "./table-view/roles-table-view";
import { RolesCards } from "./card-views/roles-cards";

export default function RolesList() {
  const dispatch = useAppDispatch();
  const access = useRecordAccess();
  const toast = useToast();
  const router = useRouter();
  const {
    roles,
    total,
    listStatus,
    listError,
    mutationStatus,
    mutationError,
    filterOptions,
    filterOptionsError,
  } = useAppSelector(selectRole);
  const [filters, setFilters] = useState(() =>
    createQuickFilterState(ROLE_FILTER_DEFAULTS),
  );
  const activeFilters = countActiveFilters(filters, ROLE_FILTER_DEFAULTS);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(DEFAULT_PAGE_SIZE);
  const [search, setSearch] = useState("");
  const [sorting, setSorting] = useState<TableSort | null>(null);
  const [view, setView] = useListView();
  const [revision, setRevision] = useState(0);
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [removing, setRemoving] = useState<RoleSummary | null>(null);
  const loading = listStatus === "loading" || listStatus === "idle";
  const pending = mutationStatus === "loading";
  const pagination = paginationFromApi({ page, page_size: pageSize, total });
  useEffect(() => {
    let current = true;
    const request = dispatch(
      listRole({
        page,
        page_size: pageSize,
        search,
        ...(sorting
          ? { sort_by: sorting.field, sort_order: sorting.direction }
          : {}),
        ...(activeFilters ? { filters } : {}),
      }),
    );
    request.then((action) => {
      if (current && listRole.fulfilled.match(action)) {
        const validPage = paginationFromApi(action.payload).page;
        if (validPage !== page) setPage(validPage);
      }
    });
    return () => {
      current = false;
      request.abort();
    };
  }, [
    dispatch,
    page,
    pageSize,
    search,
    revision,
    filters,
    activeFilters,
    sorting,
  ]);
  useEffect(() => {
    const request = dispatch(getRoleFilterOption());
    return () => request.abort();
  }, [dispatch, revision]);
  useEffect(() => {
    if ([listError, mutationError].some((error) => error?.status === 401))
      router.replace("/login");
  }, [listError, mutationError, router]);
  function openRole(role?: RoleSummary) {
    dispatch(clearRoleMutation());
    if (role) setEditingId(role.id);
    else setCreating(true);
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
      <section className="w-full space-y-6">
        <header className="flex flex-col gap-4 lg:flex-row lg:flex-wrap lg:items-center lg:justify-between">
          <div>
            <p className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Organization
            </p>
            <h1 className="text-3xl font-bold tracking-tight text-primary">
              Roles
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Define role access, pages, permissions and company defaults.
            </p>
          </div>
          {canPerform(access, "roles", "add") && (
            <Button className="w-full lg:w-auto" disabled={pending} onClick={() => openRole()}>
              <Plus className="size-4" aria-hidden="true" />
              Add role
            </Button>
          )}
        </header>
        <SearchFilterBar
            search={search}
            onSearch={(value) => {
              setSearch(value);
              setPage(1);
            }}
            filters={filters}
            onFiltersChange={(next) => {
              setFilters(next);
              setPage(1);
            }}
            fields={filterOptions.fields}
            statusOptions={filterOptions.statusOptions}
            additionalFilters={filterOptions.additionalFilters}
            filterLabels={{ date: "Creation date", status: "Role status" }}
            maxConditions={50}
            loading={loading}
            searchLabel="Search users by name or email"
            placeholder="Search by name or email"
            maxLength={254}
            quickFilterActive={activeFilters > 0}
            view={view}
            onViewChange={setView}
            viewLabel="Role display"
          />
        <div className="overflow-hidden rounded-[6px] border bg-white shadow-sm">
          {listError && (
            <div
              role="alert"
              className="flex flex-wrap items-center justify-between gap-3 border-b bg-red-50 px-6 py-4 text-sm text-destructive"
            >
              <span>{listError.message}</span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setRevision((value) => value + 1)}
              >
                Try again
              </Button>
            </div>
          )}
          {filterOptionsError && (
            <div
              role="alert"
              className="flex items-center justify-between gap-2 px-6 py-2 text-xs text-destructive"
            >
              <span>Filter choices could not be loaded.</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => dispatch(getRoleFilterOption())}
              >
                Retry
              </Button>
            </div>
          )}
          <div
            aria-busy={loading}
            className={loading && roles.length ? "opacity-60" : ""}
          >
            {view === "table" ? (
              <RolesTableView {...actions} />
            ) : !roles.length && loading ? (
              <div
                role="status"
                className="flex items-center justify-center gap-2 py-20 text-sm text-muted-foreground"
              >
                <LoaderCircle
                  className="size-5 animate-spin"
                  aria-hidden="true"
                />
                Loading roles…
              </div>
            ) : !roles.length && !listError ? (
              <div className="px-6 py-16 text-center">
                <Shield
                  className="mx-auto mb-4 size-10 text-primary/40"
                  aria-hidden="true"
                />
                <h3 className="font-semibold">
                  {search || activeFilters
                    ? "No matching roles"
                    : "No roles yet"}
                </h3>
                <p className="mt-2 text-sm text-muted-foreground">
                  {search || activeFilters
                    ? "Try another search or clear your filters."
                    : "Add a role to define access for your team."}
                </p>
              </div>
            ) : roles.length ? (
              <RolesCards {...actions} />
            ) : null}
          </div>
        </div>
        <Pagination
          metadata={pagination}
          disabled={loading}
          onPrev={() => setPage(pagination.page - 1)}
          onNext={() => setPage(pagination.page + 1)}
          onPage={setPage}
          onLimitChange={(size) => {
            setPageSize(size);
            setPage(1);
          }}
          limitOptions={PAGE_SIZE_OPTIONS}
        />
      </section>
      {creating && (
        <CreateRoleDialog
          onClose={() => setCreating(false)}
          onSaved={(role) => {
            toast.success(`${role.name} was created successfully.`);
            setPage(1);
            setCreating(false);
            setRevision((value) => value + 1);
          }}
        />
      )}
      {editingId && (
        <EditRoleDialog
          roleId={editingId}
          onClose={() => setEditingId(null)}
          onSaved={(role) => {
            toast.success(`${role.name} was updated successfully.`);
            setEditingId(null);
            setRevision((value) => value + 1);
          }}
        />
      )}
      {removing && (
        <DeleteRoleDialog
          role={removing}
          pending={pending}
          error={mutationError?.message}
          onClose={() => setRemoving(null)}
          onConfirm={() => { void removeRole(); }}
        />
      )}
    </>
  );
}
