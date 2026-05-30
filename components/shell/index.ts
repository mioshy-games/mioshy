/**
 * Public API for the AppShell.
 *
 * Import surface:
 *
 *   import {
 *     AppShell,
 *     buildNavItems,
 *     NAV_HREF,
 *     type NavItem,
 *     type CoupleCardData,
 *     type ExpertMiniData,
 *     type ShellChrome,
 *   } from "@/components/shell";
 *
 * Everything else (SideNav, MobileTabs, CoupleCard, ExpertMini, NavRow)
 * is an internal implementation detail and shouldn't be reached for
 * directly outside this folder.
 */

export { AppShell } from "./AppShell";
export {
  buildNavItems,
  isNavActive,
  NAV_HREF,
  MOBILE_PRIMARY_KEYS,
  MOBILE_OVERFLOW_KEYS,
} from "./NavConfig";
export type {
  NavItem,
  NavKey,
  NavGroup,
  CoupleCardData,
  ExpertMiniData,
  ShellChrome,
} from "./types";
