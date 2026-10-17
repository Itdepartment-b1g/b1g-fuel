"use client";

import { useToast, toastErrorMessage } from "@/components/providers/toast-provider";
import { useRecordAccess } from "@/components/providers/access-provider";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useAppDispatch, useAppSelector } from "@/lib/store/hooks";
import { ACCESS_SCOPE_LABELS, STAFF_ACCESS_SCOPES, type AccessScope } from "@/lib/auth/access-scope";
import { PAGE_CATALOG } from "@/lib/auth/catalog";
import { PERMISSION_CATALOG } from "@/lib/auth/permissions";
import { assignUser, getUserOption, selectUser } from "@/lib/store/users-slice";
import type { AssignableRole, UserSummary } from "@/types/users";

function staffPages(roles: AssignableRole[], roleIds: string[], actorPages: string[]) {
  const rolePages = new Set(roles.filter((role) => roleIds.includes(role.id)).flatMap((role) => role.pages));
  return PAGE_CATALOG.filter((page) => page.key !== "users" && rolePages.has(page.key) && actorPages.includes(page.key));
}

function RoleAccess({ role }: { role: AssignableRole }) {
  const pages = PAGE_CATALOG.filter((page) => role.pages.includes(page.key));
  if (!pages.length) return <p className="ml-6 text-xs text-muted-foreground">This role has no pages or permissions.</p>;
  return (
    <ul className="ml-6 mt-1 space-y-1 text-xs text-muted-foreground">
      {pages.map((page) => {
        const actions = PERMISSION_CATALOG.filter((item) => item.page_key === page.key && role.permissions.includes(item.key));
        const labels = actions.map((item) => {
          const scope = role.permission_scopes[item.key];
          return item.action === "add" || !scope ? item.label : `${item.label} (${ACCESS_SCOPE_LABELS[scope as AccessScope]})`;
        });
        return (
          <li key={page.key}>
            <span className="font-medium text-foreground">{page.label}</span>
            {labels.length ? ` · ${labels.join(", ")}` : ""}
          </li>
        );
      })}
    </ul>
  );
}

export function AssignUserDialog({
  user,
  onClose,
  onSaved,
}: {
  user: UserSummary;
  onClose: () => void;
  onSaved: (user: UserSummary) => void;
}) {
  const access = useRecordAccess();
  const supervisor = Boolean(access && !access.superAdmin);
  const dispatch = useAppDispatch();
  const toast = useToast();
  const router = useRouter();
  const { options, optionsStatus, optionsError } = useAppSelector(selectUser);
  const initialCompany = user.companies[0];
  const [companyId, setCompanyId] = useState(initialCompany?.id ?? "");
  const [roleIds, setRoleIds] = useState<string[]>(initialCompany?.roles.map((role) => role.id) ?? []);
  const [pageKeys, setPageKeys] = useState<string[]>(initialCompany?.page_grant_mode === "assigned_pages" ? initialCompany.pages.filter((key) => key !== "users") : []);
  const [permissionKeys, setPermissionKeys] = useState<string[]>(initialCompany?.permissions ?? []);
  const [permissionScopes, setPermissionScopes] = useState<Record<string, AccessScope>>((initialCompany?.permission_scopes ?? {}) as Record<string, AccessScope>);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pages = staffPages(options.roles, roleIds, access?.pages ?? []);
  const prefilled = useRef(initialCompany?.page_grant_mode === "assigned_pages");
  useEffect(() => {
    const request = dispatch(getUserOption());
    return () => request.abort();
  }, [dispatch]);
  useEffect(() => {
    if (optionsError?.status === 401) router.replace("/login");
  }, [optionsError, router]);
  useEffect(() => {
    if (!supervisor || optionsStatus !== "succeeded" || !options.companies.length) return;
    if (options.companies.some((company) => company.id === companyId)) return;
    const next = options.companies[0].id;
    const membership = user.companies.find((company) => company.id === next);
    setCompanyId(next);
    setRoleIds(membership?.roles.map((role) => role.id) ?? []);
    setPageKeys(membership?.page_grant_mode === "assigned_pages" ? membership.pages.filter((key) => key !== "users") : staffPages(options.roles, membership?.roles.map((role) => role.id) ?? [], access?.pages ?? []).map((page) => page.key));
  }, [supervisor, optionsStatus, options.companies, options.roles, companyId, user.companies, access?.pages]);
  useEffect(() => {
    if (!supervisor || optionsStatus !== "succeeded" || prefilled.current) return;
    if (!options.companies.some((company) => company.id === companyId)) return;
    const membership = user.companies.find((company) => company.id === companyId);
    if (membership?.page_grant_mode === "assigned_pages") {
      prefilled.current = true;
      return;
    }
    setPageKeys(staffPages(options.roles, roleIds, access?.pages ?? []).map((page) => page.key));
    prefilled.current = true;
  }, [supervisor, optionsStatus, options.companies, options.roles, roleIds, companyId, user.companies, access?.pages]);
  const companyRoles = options.roles;
  async function save() {
    if (pending) return;
    if (!companyId || !roleIds.length) {
      setError("Select a company and at least one role.");
      return;
    }
    setPending(true);
    setError(null);
    try {
      onSaved(await dispatch(assignUser({
        id: user.id,
        company_id: companyId,
        role_ids: roleIds,
        ...(supervisor ? {
          page_keys: pageKeys,
          permissions: permissionKeys,
          permission_scopes: Object.fromEntries(permissionKeys.filter((key) => !key.endsWith(".add")).map((key) => [key, permissionScopes[key] === "own" ? "own" : "company"])),
        } : {}),
      })).unwrap());
    } catch (failure) {
      toast.error(toastErrorMessage(failure, "Could not assign the company and roles."));
      setError(toastErrorMessage(failure, "Could not assign the company and roles."));
      if (failure && typeof failure === "object" && "status" in failure && failure.status === 401) router.replace("/login");
    } finally {
      setPending(false);
    }
  }
  return (
    <Dialog open onOpenChange={(open) => { if (!open && !pending) onClose(); }}>
      <DialogContent className="max-h-[90svh] w-[calc(100%_-_2rem)] max-w-xl overflow-y-auto" onEscapeKeyDown={(event) => { if (pending) event.preventDefault(); }} onPointerDownOutside={(event) => { if (pending) event.preventDefault(); }}>
        <DialogHeader>
          <DialogTitle>{supervisor ? "Assign staff access" : "Assign company and roles"}</DialogTitle>
          <DialogDescription>
            {supervisor
              ? `Choose ${user.name}'s role, then the dashboards they can open. View, add, edit, and delete stay on that role.`
              : `Choose ${user.name}'s company, then choose roles. Page access comes from those roles.`}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4" aria-busy={pending}>
          <label className="block space-y-2 text-sm font-medium">
            Company <span className="text-destructive">*</span>
            <select
              aria-label="Assignment company"
              value={companyId}
              disabled={pending || optionsStatus !== "succeeded" || (supervisor && options.companies.length <= 1)}
              onChange={(event) => {
                const next = event.target.value;
                const membership = user.companies.find((company) => company.id === next);
                setCompanyId(next);
                setRoleIds(membership?.roles.map((role) => role.id) ?? []);
                const nextRoles = membership?.roles.map((role) => role.id) ?? [];
                setPageKeys(membership?.page_grant_mode === "assigned_pages" ? membership.pages.filter((key) => key !== "users") : staffPages(options.roles, nextRoles, access?.pages ?? []).map((page) => page.key));
              }}
              className="h-10 w-full rounded-md border bg-white px-3 text-sm disabled:opacity-50"
            >
              <option value="">Select a company</option>
              {options.companies.map((company) => <option key={company.id} value={company.id}>{company.name}</option>)}
            </select>
          </label>
          {optionsStatus === "loading" && <p role="status" className="text-xs text-muted-foreground">Loading companies and roles…</p>}
          {optionsError && (
            <div>
              <p role="alert" className="text-xs text-destructive">Companies and roles could not be loaded.</p>
              <Button type="button" size="sm" variant="outline" className="mt-2" onClick={() => dispatch(getUserOption())}>Retry</Button>
            </div>
          )}
          {companyId && (
            <fieldset>
              <legend className="mb-2 text-sm font-medium">Roles <span className="text-destructive">*</span></legend>
              {companyRoles.length ? (
                <div className="max-h-64 space-y-3 overflow-y-auto rounded-md border bg-white p-3">
                  {companyRoles.map((role) => (
                    <div key={role.id}>
                      <label className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={roleIds.includes(role.id)}
                          disabled={pending}
                          onChange={(event) => {
                            const next = event.target.checked ? [...roleIds, role.id] : roleIds.filter((id) => id !== role.id);
                            setRoleIds(next);
                            if (supervisor) {
                              const allowed = new Set<string>(staffPages(options.roles, next, access?.pages ?? []).map((page) => page.key));
                              setPageKeys((current) => current.filter((key) => allowed.has(key)));
                            }
                          }}
                          className="size-4 accent-primary"
                        />
                        {role.name}
                      </label>
                      {roleIds.includes(role.id) && <RoleAccess role={role} />}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">{supervisor ? "Create staff with a role name before assigning an existing company role." : "Create a role before assigning this user."}</p>
              )}
            </fieldset>
          )}
          {supervisor && roleIds.length > 0 && (
            <fieldset className="space-y-3">
              <legend className="mb-2 text-sm font-medium">Pages and permissions</legend>
              <p className="text-xs text-muted-foreground">Select a page, then choose what this role can do on that page.</p>
              {pages.length ? pages.map((page) => {
                const choices = PERMISSION_CATALOG.filter((item) => item.page_key === page.key);
                const selected = pageKeys.includes(page.key);
                return (
                  <div key={page.key} className="rounded-lg border">
                    <label className="flex cursor-pointer items-center gap-3 p-3 text-sm font-medium">
                      <input
                        type="checkbox"
                        checked={selected}
                        disabled={pending}
                        onChange={(event) => {
                          setPageKeys((current) => event.target.checked ? [...current, page.key] : current.filter((key) => key !== page.key));
                          if (!event.target.checked) setPermissionKeys((current) => current.filter((key) => !choices.some((choice) => choice.key === key)));
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
                                  checked={permissionKeys.includes(choice.key)}
                                  disabled={pending}
                                  onChange={(event) => setPermissionKeys((current) => event.target.checked ? [...current, choice.key] : current.filter((key) => key !== choice.key))}
                                  className="size-4 accent-primary"
                                />
                                {choice.label}
                              </label>
                              {choice.action !== "add" && permissionKeys.includes(choice.key) && (
                                <select
                                  aria-label={`${page.label} ${choice.label} access scope`}
                                  value={permissionScopes[choice.key] === "own" ? "own" : "company"}
                                  disabled={pending}
                                  onChange={(event) => setPermissionScopes((current) => ({ ...current, [choice.key]: event.target.value as AccessScope }))}
                                  className="h-9 w-full rounded-md border bg-white px-2 text-xs"
                                >
                                  {STAFF_ACCESS_SCOPES.map((value) => <option key={value} value={value}>{ACCESS_SCOPE_LABELS[value]}</option>)}
                                </select>
                              )}
                              {choice.action === "add" && permissionKeys.includes(choice.key) && <p className="text-xs text-muted-foreground">Creator is set to the signed-in user.</p>}
                            </div>
                          ))}
                          <div className="space-y-2">
                            <label className="flex items-center gap-2 text-sm">
                              <input
                                type="checkbox"
                                checked={choices.length > 0 && choices.every((choice) => permissionKeys.includes(choice.key))}
                                disabled={pending}
                                onChange={(event) => {
                                  const keys = choices.map((choice) => choice.key);
                                  setPermissionKeys((current) => event.target.checked ? [...new Set([...current, ...keys])] : current.filter((key) => !keys.includes(key)));
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
          )}
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
          <div className="flex justify-end gap-3 border-t pt-4">
            <Button type="button" variant="outline" onClick={onClose} disabled={pending}>Cancel</Button>
            <Button type="button" onClick={() => { void save(); }} disabled={pending || !companyId || !roleIds.length}>
              {pending && <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />}
              {pending ? "Saving…" : "Save assignment"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
