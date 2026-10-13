"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useAppDispatch, useAppSelector } from "@/lib/store/hooks";
import { editRole, getRoleOption, selectRole } from "@/lib/store/roles-slice";
import type { RoleSummary } from "@/server/schema/roles_schema";
import { RoleForm } from "./role-form";
import { Loading } from "@/components/common/loading";

export function RoleDialog({
  roleId,
  onClose,
  onSaved,
}: {
  roleId: string | null;
  onClose: () => void;
  onSaved: (role: RoleSummary) => void;
}) {
  const dispatch = useAppDispatch();
  const router = useRouter();
  const {
    selectedRole,
    detailStatus,
    detailError,
    mutationStatus,
    mutationError,
    optionsError,
  } = useAppSelector(selectRole);
  const pending = mutationStatus === "loading";
  useEffect(() => {
    const options = dispatch(getRoleOption());
    const detail = roleId ? dispatch(editRole(roleId)) : null;
    return () => {
      options.abort();
      detail?.abort();
    };
  }, [dispatch, roleId]);
  useEffect(() => {
    if (
      [detailError, mutationError, optionsError].some(
        (error) => error?.status === 401,
      )
    )
      router.replace("/login");
  }, [detailError, mutationError, optionsError, router]);
  const ready =
    !roleId || (detailStatus === "succeeded" && selectedRole?.id === roleId);
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !pending) onClose();
      }}
    >
      <DialogContent
        className={`max-h-[90svh] w-[calc(100%_-_2rem)] max-w-2xl overflow-y-auto ${pending ? "[&>button]:hidden" : ""}`}
        onEscapeKeyDown={(event) => {
          if (pending) event.preventDefault();
        }}
        onPointerDownOutside={(event) => {
          if (pending) event.preventDefault();
        }}
      >
        <DialogHeader>
          <DialogTitle>{roleId ? "Edit role" : "Create a role"}</DialogTitle>
          <DialogDescription>
            {roleId
              ? "Update the role name, default setting, pages and permissions."
              : "Define a role for your organization. Pages and permissions are optional."}
          </DialogDescription>
        </DialogHeader>
        {ready ? (
          <RoleForm
            key={roleId ?? "create"}
            role={roleId ? selectedRole! : undefined}
            onCancel={onClose}
            onSaved={onSaved}
          />
        ) : detailError ? (
          <div>
            <p role="alert" className="text-sm text-destructive">
              {detailError.message}
            </p>
            <Button
              variant="outline"
              className="mt-3"
              onClick={() => dispatch(editRole(roleId!))}
            >
              Try again
            </Button>
          </div>
        ) : (
          <Loading />
        )}
        {optionsError && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => dispatch(getRoleOption())}
          >
            Retry loading access choices
          </Button>
        )}
      </DialogContent>
    </Dialog>
  );
}
