import type { ComponentType } from "react";
import { Building2, ClipboardList, Folder, LayoutDashboard, PackageCheck, Ruler, ShieldCheck, Shapes, Tag, Truck, UsersRound } from "lucide-react";
import { PAGE_CATALOG, PAGE_GROUPS, PAGE_KEYS, type PageKey } from "@/lib/auth/catalog";

type MenuIcon = ComponentType<{ className?: string }>;

export type SideBarMenuChild = {
  label: string;
  href: string;
  icon: MenuIcon;
};

export type SideBarMenuItem = SideBarMenuChild & {
  icon: MenuIcon;
  showChevron?: boolean;
  children?: SideBarMenuChild[];
};

export type SideBarAccess = {
  pages?: string[];
  permissions?: string[];
  role?: string | null;
};

const icons_by_page: Record<PageKey, MenuIcon> = {
  [PAGE_KEYS.home]: LayoutDashboard,
  [PAGE_KEYS.hubs]: Building2,
  [PAGE_KEYS.users]: UsersRound,
  [PAGE_KEYS.roles]: ShieldCheck,
  [PAGE_KEYS.companies]: Building2,
  [PAGE_KEYS.measurements]: Ruler,
  [PAGE_KEYS.brandsAndVariants]: Tag,
  [PAGE_KEYS.suppliers]: Truck,
  [PAGE_KEYS.productTypes]: Shapes,
  [PAGE_KEYS.purchaseOrders]: ClipboardList,
  [PAGE_KEYS.receiving]: PackageCheck,
  [PAGE_KEYS.materialRequests]: ClipboardList,
  [PAGE_KEYS.materialRequestReceiving]: PackageCheck,
};

export function listSidebarMenu(pages: string[], access?: SideBarAccess): SideBarMenuItem[] {
  const superAdmin = access?.role === "super_admin";
  const allowedPages = new Set(access?.pages ?? pages);
  const allowedPermissions = new Set(access?.permissions ?? []);
  const groupDefinitions = new Map(PAGE_GROUPS.map((group) => [group.key, group]));
  const groups = new Map<string, SideBarMenuItem>();
  const items: SideBarMenuItem[] = [];

  for (const page of PAGE_CATALOG) {
    if (page.navigation === false) continue;
    if (!superAdmin && !allowedPages.has(page.key)) continue;
    if (!superAdmin && page.view_permission && !allowedPermissions.has(page.view_permission)) continue;
    const groupDefinition = page.group ? groupDefinitions.get(page.group) : undefined;
    if (groupDefinition) {
      let group = groups.get(groupDefinition.key);
      if (!group) {
        group = { label: groupDefinition.label, href: page.href, icon: Folder, showChevron: true, children: [] };
        groups.set(groupDefinition.key, group);
        items.push(group);
      }
      group.children!.push({ label: page.label, href: page.href, icon: icons_by_page[page.key] });
    } else {
      items.push({ label: page.label, href: page.href, icon: icons_by_page[page.key], showChevron: false });
    }
  }

  // No fallback link: the sidebar intentionally stays empty until pages are registered.
  return items;
}

export function formatRoleLabel(role: string | null | undefined) {
  return role ? role.replaceAll("_", " ").toUpperCase() : "USER";
}

export const sideBarMenuItems: SideBarMenuItem[] = listSidebarMenu([]);
