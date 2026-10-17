import {
  listSidebarMenu,
  type SideBarAccess,
  type SideBarMenuItem,
} from "./sideBarMenuItems";

export const BOTTOM_NAVIGATION_LIMIT = 5;

export type BottomNavigationItem = Pick<
  SideBarMenuItem,
  "label" | "href" | "icon"
>;

export function listBottomNavigationItems(
  items: SideBarMenuItem[],
): BottomNavigationItem[] {
  return items
    .filter((item) => !item.children?.length)
    .slice(0, BOTTOM_NAVIGATION_LIMIT)
    .map(({ label, href, icon }) => ({ label, href, icon }));
}

export function listBottomNavigationMenu(
  pages: string[],
  access?: SideBarAccess,
): BottomNavigationItem[] {
  return listBottomNavigationItems(listSidebarMenu(pages, access));
}
