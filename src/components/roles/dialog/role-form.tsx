"use client";
import { useToast, toastErrorMessage } from "@/components/providers/toast-provider";
import { useRef, useState, type FormEvent } from "react";
import { LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAppDispatch, useAppSelector } from "@/lib/store/hooks";
import { createRole, updateRole, selectRole } from "@/lib/store/roles-slice";
import type { RoleSummary, RoleScope } from "@/server/schema/roles_schema";

export function RoleForm({
  role,
  onSaved,
  onCancel,
}: {
  role?: RoleSummary;
  onSaved: (role: RoleSummary) => void;
  onCancel: () => void;
}) {
  const dispatch = useAppDispatch();
  const toast = useToast();
  const {
    options,
    optionsStatus,
    optionsError,
    mutationStatus,
    mutationError,
  } = useAppSelector(selectRole);
  const pending = mutationStatus === "loading";
  const readOnly = Boolean(role?.is_system || role?.slug === "super_admin");
  const busy = useRef(false);
  const [scope, setScope] = useState<RoleScope>(role?.scope ?? "company");
  const [isDefault, setIsDefault] = useState(role?.is_default_role ?? false);
  const [pages, setPages] = useState(role?.pages ?? []);
  const [permissions, setPermissions] = useState(role?.permissions ?? []);
  const [error, setError] = useState<string | null>(null);
  const sameKeys = (left: string[], right: string[]) =>
    left.length === right.length && left.every((key) => right.includes(key));
  async function saveRole(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy.current || readOnly) return;
    const form = new FormData(event.currentTarget);
    const name = String(form.get("name") ?? "").trim();
    if (!name) {
      setError("Enter a role name.");
      return;
    }
    busy.current = true;
    setError(null);
    try {
      const response = role
        ? await dispatch(
            updateRole({
              id: role.id,
              name,
              is_default_role: isDefault,
              ...(!sameKeys(pages, role.pages) ? { pages } : {}),
              ...(!sameKeys(permissions, role.permissions)
                ? { permissions }
                : {}),
            }),
          ).unwrap()
        : await dispatch(
            createRole({
              name,
              ...(String(form.get("slug") ?? "").trim()
                ? { slug: String(form.get("slug")).trim() }
                : {}),
              scope,
              is_default_role: isDefault,
              pages,
              permissions,
            }),
          ).unwrap();
      onSaved(response.role);
    } catch (error) {
      toast.error(toastErrorMessage(error, role ? "Could not update the role." : "Could not create the role."));
    } finally {
      busy.current = false;
    }
  }
  function toggleKey(current: string[], key: string, selected: boolean) {
    return selected
      ? [...current, key]
      : current.filter((value) => value !== key);
  }
  return (
    <form onSubmit={saveRole} className="space-y-5" aria-busy={pending}>
      {readOnly && (
        <p
          role="alert"
          className="rounded-md bg-amber-50 p-3 text-sm text-amber-900"
        >
          This role is managed by the application and cannot be edited.
        </p>
      )}
      <fieldset disabled={pending || readOnly} className="space-y-5">
        <label className="block space-y-2 text-sm font-medium">
          Role name <span className="text-destructive">*</span>
          <Input
            name="name"
            defaultValue={role?.name}
            maxLength={100}
            required
            placeholder="Branch Manager"
          />
        </label>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block space-y-2 text-sm font-medium">
            Slug
            <Input
              name="slug"
              defaultValue={role?.slug}
              placeholder="branch_manager"
              maxLength={100}
              disabled={Boolean(role)}
            />
            <span className="block text-xs font-normal text-muted-foreground">
              {role
                ? "The slug stays fixed after creation."
                : "Optional. Generated from the name if left blank."}
            </span>
          </label>
          <label className="block space-y-2 text-sm font-medium">
            Scope
            <select
              aria-label="Role scope"
              className="h-10 w-full rounded-md border bg-white px-3 text-sm"
              value={scope}
              disabled={Boolean(role)}
              onChange={(event) => {
                const next = event.target.value as RoleScope;
                setScope(next);
                if (next === "global") setIsDefault(false);
              }}
            >
              <option value="company">Company</option>
              <option value="global">Global</option>
            </select>
            <span className="block text-xs font-normal text-muted-foreground">
              {role
                ? "Scope stays fixed after creation."
                : "Company roles belong to company memberships."}
            </span>
          </label>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={isDefault}
            onChange={(event) => setIsDefault(event.target.checked)}
            disabled={scope !== "company"}
            className="size-4 accent-primary"
          />
          Default company role
        </label>
        <p className="-mt-3 text-xs text-muted-foreground">
          Only one company role can be the default. Clear the current default
          before choosing another.
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          {(["pages", "permissions"] as const).map((kind) => {
            const selected = kind === "pages" ? pages : permissions;
            const setSelected = kind === "pages" ? setPages : setPermissions;
            const choices = options[kind];
            return (
              <fieldset key={kind} className="rounded-lg border p-3">
                <legend className="px-1 text-sm font-medium">
                  {kind === "pages" ? "Pages" : "Permissions"}
                </legend>
                {optionsStatus === "loading" ? (
                  <p className="text-xs text-muted-foreground">
                    Loading choices…
                  </p>
                ) : choices.length ? (
                  <div className="max-h-48 space-y-3 overflow-y-auto">
                    {choices.map((choice) => (
                      <label
                        key={choice.key}
                        className="flex items-start gap-2 text-sm"
                      >
                        <input
                          type="checkbox"
                          checked={selected.includes(choice.key)}
                          onChange={(event) =>
                            setSelected((current) =>
                              toggleKey(
                                current,
                                choice.key,
                                event.target.checked,
                              ),
                            )
                          }
                          className="mt-0.5 size-4 accent-primary"
                        />
                        <span>{choice.label}</span>
                      </label>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    No choices available.
                  </p>
                )}
              </fieldset>
            );
          })}
        </div>
        <p className="text-xs leading-relaxed text-muted-foreground">
          These selections define the role’s access settings. Administrative
          pages currently require a global super-admin role.
        </p>
        {optionsError && (
          <p role="alert" className="text-xs text-destructive">
            Access choices could not be loaded. Existing selections will be
            preserved.
          </p>
        )}
      </fieldset>
      {(error || mutationError) && (
        <p role="alert" className="text-sm text-destructive">
          {error ?? mutationError?.message}
        </p>
      )}
      <div className="flex justify-end gap-3 border-t pt-4">
        <Button
          variant="outline"
          type="button"
          onClick={onCancel}
          disabled={pending}
        >
          Cancel
        </Button>
        <Button type="submit" disabled={pending || readOnly}>
          {pending && (
            <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
          )}
          {pending ? "Saving…" : role ? "Save changes" : "Create role"}
        </Button>
      </div>
    </form>
  );
}
