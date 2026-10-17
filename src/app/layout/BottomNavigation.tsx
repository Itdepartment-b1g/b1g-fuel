"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { useRecordAccess } from "@/components/providers/access-provider";
import { APP_PATHS } from "@/lib/auth/dashboard";
import { listBottomNavigationMenu } from "./bottomNavigationMenu";
import type { SideBarAccess } from "./sideBarMenuItems";

export default function BottomNavigation({
  pages,
  permissions,
  role,
}: SideBarAccess = {}) {
  const pathname = usePathname();
  const access = useRecordAccess();
  const items = listBottomNavigationMenu(access?.pages ?? pages ?? [], {
    pages: access?.pages ?? pages,
    permissions: access
      ? access.grants.map((grant) => grant.permission)
      : permissions,
    role: role ?? (access?.superAdmin ? "super_admin" : undefined),
  });
  const isActive = (href: string) =>
    pathname === href ||
    (href !== APP_PATHS.home && pathname.startsWith(`${href}/`));

  if (!items.length) return null;

  return (
    <nav
      aria-label="Bottom navigation"
      className="shrink-0 border-t bg-card pb-[env(safe-area-inset-bottom)] lg:hidden"
    >
      <ul className="flex">
        {items.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.href);
          return (
            <li key={`${item.label}:${item.href}`} className="min-w-0 flex-1">
              <Link
                href={item.href}
                title={item.label}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex min-h-14 flex-col items-center justify-center gap-1 px-1 py-2 text-muted-foreground",
                  active && "bg-accent font-medium text-primary",
                )}
              >
                <Icon className="size-5 shrink-0" aria-hidden="true" />
                <span className="line-clamp-2 max-w-full text-center text-[10px] leading-tight">
                  {item.label}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
