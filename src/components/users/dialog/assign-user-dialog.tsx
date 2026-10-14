"use client";

import { useToast, toastErrorMessage } from "@/components/providers/toast-provider";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useAppDispatch, useAppSelector } from "@/lib/store/hooks";
import { ACCESS_SCOPE_LABELS, type AccessScope } from "@/lib/auth/access-scope";
import { PAGE_CATALOG } from "@/lib/auth/catalog";
import { PERMISSION_CATALOG } from "@/lib/auth/permissions";
import { assignUser, getUserOption, selectUser } from "@/lib/store/users-slice";
import type { AssignableRole, UserSummary } from "@/types/users";

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
  const dispatch = useAppDispatch();
  const toast = useToast();
  const router = useRouter();
  const { options, optionsStatus, optionsError } = useAppSelector(selectUser);
  const [companyId, setCompanyId] = useState(user.companies[0]?.id ?? "");
  const [roleIds, setRoleIds] = useState<string[]>(user.companies[0]?.roles.map((role) => role.id) ?? []);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    const request = dispatch(getUserOption());
    return () => request.abort();
  }, [dispatch]);
  useEffect(() => {
    if (optionsError?.status === 401) router.replace("/login");
  }, [optionsError, router]);
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
      onSaved(await dispatch(assignUser({ id: user.id, company_id: companyId, role_ids: roleIds })).unwrap());
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
          <DialogTitle>Assign company and roles</DialogTitle>
          <DialogDescription>Choose {user.name}&apos;s company, then choose roles. Page access comes from those roles.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4" aria-busy={pending}>
          <label className="block space-y-2 text-sm font-medium">
            Company <span className="text-destructive">*</span>
            <select
              aria-label="Assignment company"
              value={companyId}
              disabled={pending || optionsStatus !== "succeeded"}
              onChange={(event) => {
                const next = event.target.value;
                const membership = user.companies.find((company) => company.id === next);
                setCompanyId(next);
                setRoleIds(membership?.roles.map((role) => role.id) ?? []);
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
                          onChange={(event) => setRoleIds((current) => event.target.checked ? [...current, role.id] : current.filter((id) => id !== role.id))}
                          className="size-4 accent-primary"
                        />
                        {role.name}
                      </label>
                      {roleIds.includes(role.id) && <RoleAccess role={role} />}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">Create a role before assigning this user.</p>
              )}
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
