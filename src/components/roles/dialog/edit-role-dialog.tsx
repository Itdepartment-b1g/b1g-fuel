"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Loading } from "@/components/common/loading";
import { useToast, toastErrorMessage } from "@/components/providers/toast-provider";
import { useAppDispatch, useAppSelector } from "@/lib/store/hooks";
import { editRole, getRoleOption, selectRole, updateRole } from "@/lib/store/roles-slice";
import type { RoleSummary } from "@/types/roles";
import { ACCESS_SCOPES, ACCESS_SCOPE_LABELS, type AccessScope } from "@/lib/auth/access-scope";

export function EditRoleDialog({
  roleId,
  onClose,
  onSaved,
}: {
  roleId: string;
  onClose: () => void;
  onSaved: (role: RoleSummary) => void;
}) {
  const dispatch = useAppDispatch();
  const router = useRouter();
  const { selectedRole, detailStatus, detailError, mutationStatus, mutationError, optionsError } = useAppSelector(selectRole);
  const pending = mutationStatus === "loading";
  const role = selectedRole?.id === roleId ? selectedRole : null;
  const ready = detailStatus === "succeeded" && role;

  useEffect(() => {
    const options = dispatch(getRoleOption());
    const detail = dispatch(editRole(roleId));
    return () => {
      options.abort();
      detail.abort();
    };
  }, [dispatch, roleId]);

  useEffect(() => {
    if ([detailError, mutationError, optionsError].some((error) => error?.status === 401)) router.replace("/login");
  }, [detailError, mutationError, optionsError, router]);

  return (
    <Dialog open onOpenChange={(open) => { if (!open && !pending) onClose(); }}>
      <DialogContent
        className={`max-h-[90svh] w-[calc(100%_-_2rem)] max-w-2xl overflow-y-auto ${pending ? "[&>button]:hidden" : ""}`}
        onEscapeKeyDown={(event) => { if (pending) event.preventDefault(); }}
        onPointerDownOutside={(event) => { if (pending) event.preventDefault(); }}
      >
        <DialogHeader>
          <DialogTitle>Edit role</DialogTitle>
          <DialogDescription>Update the role name, default setting, pages and permissions.</DialogDescription>
        </DialogHeader>
        {ready && role ? (
          <EditRoleFields role={role} onCancel={onClose} onSaved={onSaved} />
        ) : detailError ? (
          <div>
            <p role="alert" className="text-sm text-destructive">{detailError.message}</p>
            <Button variant="outline" className="mt-3" onClick={() => dispatch(editRole(roleId))}>Try again</Button>
          </div>
        ) : (
          <Loading />
        )}
        {optionsError && (
          <Button type="button" variant="ghost" size="sm" onClick={() => dispatch(getRoleOption())}>
            Retry loading access choices
          </Button>
        )}
      </DialogContent>
    </Dialog>
  );
}

export function EditRoleFields({
  role,
  onSaved,
  onCancel,
}: {
  role: RoleSummary;
  onSaved: (role: RoleSummary) => void;
  onCancel: () => void;
}) {
  const dispatch = useAppDispatch();
  const toast = useToast();
  const { options, optionsStatus, optionsError, mutationStatus, mutationError } = useAppSelector(selectRole);
  const pending = mutationStatus === "loading";
  const readOnly = Boolean(role.is_system || role.slug === "super_admin");
  const busy = useRef(false);
  const [pages, setPages] = useState(role.pages);
  const [permissions, setPermissions] = useState(role.permissions);
  const [permissionScopes, setPermissionScopes] = useState<Record<string, AccessScope>>(role.permission_scopes ?? {});
  const [error, setError] = useState<string | null>(null);
  const sameKeys = (left: string[], right: string[]) => left.length === right.length && left.every((key) => right.includes(key));

  function toggleKey(current: string[], key: string, selected: boolean) {
    return selected ? [...current, key] : current.filter((value) => value !== key);
  }

  async function saveRole(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy.current || readOnly) return;
    const name = String(new FormData(event.currentTarget).get("name") ?? "").trim();
    if (!name) {
      setError("Enter a role name.");
      return;
    }
    busy.current = true;
    setError(null);
    const selectedScopes = Object.fromEntries(
      permissions.filter((key) => !key.endsWith(".add")).map((key) => [key, permissionScopes[key] ?? "company"]),
    );
    try {
      const response = await dispatch(updateRole({
        id: role.id,
        name,
        permission_scopes: selectedScopes,
        ...(!sameKeys(pages, role.pages) ? { pages } : {}),
        ...(!sameKeys(permissions, role.permissions) ? { permissions } : {}),
      })).unwrap();
      onSaved(response.role);
    } catch (failure) {
      toast.error(toastErrorMessage(failure, "Could not update the role."));
    } finally {
      busy.current = false;
    }
  }

  return (
    <form onSubmit={saveRole} className="space-y-5" aria-busy={pending}>
      {readOnly && (
        <p role="alert" className="rounded-md bg-amber-50 p-3 text-sm text-amber-900">
          This role is managed by the application and cannot be edited.
        </p>
      )}
      <fieldset disabled={pending || readOnly} className="space-y-5">
        <label className="block space-y-2 text-sm font-medium">
          Role name <span className="text-destructive">*</span>
          <Input name="name" defaultValue={role.name} maxLength={100} required placeholder="Branch Manager" />
        </label>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block space-y-2 text-sm font-medium">
            Slug
            <Input name="slug" defaultValue={role.slug} placeholder="branch_manager" maxLength={100} disabled />
            <span className="block text-xs font-normal text-muted-foreground">The slug stays fixed after creation.</span>
          </label>
          <label className="block space-y-2 text-sm font-medium">
            Scope
            <select aria-label="Role scope" className="h-10 w-full rounded-md border bg-white px-3 text-sm" value={role.scope} disabled>
              <option value="company">Company</option>
              <option value="global">Global</option>
            </select>
            <span className="block text-xs font-normal text-muted-foreground">Scope stays fixed after creation.</span>
          </label>
        </div>
        <fieldset className="space-y-3">
          <legend className="mb-2 text-sm font-medium">Pages and permissions</legend>
          <p className="text-xs text-muted-foreground">Select a page, then choose what this role can do on that page.</p>
          {optionsStatus === "loading" ? (
            <p role="status" className="text-sm text-muted-foreground">Loading pages?</p>
          ) : options.pages.length ? options.pages.filter((page, index, list) => list.findIndex((item) => item.key === page.key) === index).map((page) => {
            const selected = pages.includes(page.key);
            const choices = options.permissions.filter((permission) => permission.page_key === page.key);
            return (
              <div key={page.key} className="rounded-lg border">
                <label className="flex cursor-pointer items-center gap-3 p-3 text-sm font-medium">
                  <input
                    type="checkbox"
                    checked={selected}
                    onChange={(event) => {
                      setPages((current) => toggleKey(current, page.key, event.target.checked));
                      if (!event.target.checked) {
                        setPermissions((current) => current.filter((key) => !choices.some((choice) => choice.key === key)));
                      }
                    }}
                    className="size-4 accent-primary"
                  />
                  {page.label}
                </label>
                {selected && (
                  <details open className="border-t px-3 py-2">
                    <summary className="cursor-pointer text-sm text-muted-foreground">Permissions for {page.label}</summary>
                    <div className="grid grid-cols-2 gap-3 py-3 sm:grid-cols-5">
                      {choices.map((choice) => (
                        <div key={choice.key} className="space-y-2">
                          <label className="flex items-center gap-2 text-sm">
                            <input
                              type="checkbox"
                              checked={permissions.includes(choice.key)}
                              onChange={(event) => setPermissions((current) => toggleKey(current, choice.key, event.target.checked))}
                              className="size-4 accent-primary"
                            />
                            {choice.label}
                          </label>
                          {choice.action !== "add" && permissions.includes(choice.key) && (
                            <select
                              aria-label={`${page.label} ${choice.label} access scope`}
                              value={permissionScopes[choice.key] ?? "company"}
                              onChange={(event) => setPermissionScopes((current) => ({ ...current, [choice.key]: event.target.value as AccessScope }))}
                              className="h-9 w-full rounded-md border bg-white px-2 text-xs"
                            >
                              {ACCESS_SCOPES.map((value) => <option key={value} value={value}>{ACCESS_SCOPE_LABELS[value]}</option>)}
                            </select>
                          )}
                          {choice.action === "add" && permissions.includes(choice.key) && <p className="text-xs text-muted-foreground">Creator is set to the signed-in user.</p>}
                        </div>
                      ))}
                      <div className="space-y-2">
                        <label className="flex items-center gap-2 text-sm">
                          <input
                            type="checkbox"
                            checked={choices.length > 0 && choices.every((choice) => permissions.includes(choice.key))}
                            onChange={(event) => {
                              const keys = choices.map((choice) => choice.key);
                              setPermissions((current) => event.target.checked ? [...new Set([...current, ...keys])] : current.filter((key) => !keys.includes(key)));
                            }}
                            className="size-4 accent-primary"
                          />
                          All
                        </label>
                      </div>
                    </div>
                  </details>
                )}
              </div>
            );
          }) : <p className="text-sm text-muted-foreground">No pages available.</p>}
        </fieldset>
        <p className="text-xs leading-relaxed text-muted-foreground">
          These selections define the role’s access settings. Administrative pages currently require a global super-admin role.
        </p>
        {optionsError && (
          <p role="alert" className="text-xs text-destructive">Access choices could not be loaded. Existing selections will be preserved.</p>
        )}
      </fieldset>
      {(error || mutationError) && <p role="alert" className="text-sm text-destructive">{error ?? mutationError?.message}</p>}
      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end [&>*]:w-full sm:[&>*]:w-auto border-t pt-4">
        <Button variant="outline" type="button" onClick={onCancel} disabled={pending}>Cancel</Button>
        <Button type="submit" disabled={pending || readOnly}>
          {pending && <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />}
          {pending ? "Saving…" : "Save changes"}
        </Button>
      </div>
    </form>
  );
}
