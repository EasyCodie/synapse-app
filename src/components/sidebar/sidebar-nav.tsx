"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard,
  CalendarDays,
  BookOpen,
  Layers,
  ClipboardList,
  Library,
  Search,
  Settings,
  MessageSquare,
  GraduationCap,
  Route,
  ChevronsLeft,
  ChevronsRight,
  LogOut,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface NavItem {
  href: string;
  label: string;
  icon: React.ElementType;
  exact?: boolean;
}

const NAV_ITEMS_WORKSPACE: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { href: "/chat", label: "AI Chat", icon: MessageSquare },
  { href: "/flashcards", label: "Flashcards", icon: GraduationCap },
  { href: "/calendar", label: "Calendar & Tasks", icon: CalendarDays },
  { href: "/roadmap", label: "Roadmap", icon: Route },
];

const NAV_ITEMS_CURRICULUM: NavItem[] = [
  { href: "/subjects", label: "Subjects", icon: BookOpen },
  { href: "/core", label: "The Core", icon: Layers },
  { href: "/ia-manager", label: "IA Manager", icon: ClipboardList },
  { href: "/resources", label: "Resource Library", icon: Library },
  { href: "/search", label: "Search", icon: Search },
];

const BOTTOM_ITEMS: NavItem[] = [
  { href: "/settings", label: "Settings", icon: Settings },
];

// Hoisted static element (react-best-practices: rendering-hoist-jsx)
const collapsedSeparator = <div className="w-5 h-px bg-hairline mx-auto" />;

interface SidebarNavProps {
  userEmail?: string;
  userName?: string;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}

export function SidebarNav({
  userEmail,
  userName,
  collapsed = false,
  onToggleCollapse,
}: SidebarNavProps) {
  const pathname = usePathname();

  function isActive(item: NavItem) {
    if (item.exact) return pathname === item.href;
    return pathname.startsWith(item.href);
  }

  function renderNavItem(item: NavItem) {
    const active = isActive(item);
    const Icon = item.icon;

    return (
      <div key={item.href}>
        <Link
          href={item.href}
          className={cn(
            "relative flex items-center gap-2.5 rounded-md text-cell transition-colors duration-150 group",
            collapsed ? "justify-center px-2 min-h-[30px]" : "px-2.5 py-1.5 min-h-[30px]",
            active
              ? "bg-surface-2/40 text-ink"
              : "text-ink-tertiary hover:text-ink-subtle hover:bg-surface-2/30"
          )}
          title={collapsed ? item.label : undefined}
        >
          {/* Active indicator */}
          <AnimatePresence>
            {active && (
              <motion.div
                layoutId="sidebar-active-indicator"
                className="absolute left-0 top-1/2 -translate-y-1/2 w-[2px] h-3.5 rounded-r-full bg-primary"
                initial={{ opacity: 0, scaleY: 0 }}
                animate={{ opacity: 1, scaleY: 1 }}
                exit={{ opacity: 0, scaleY: 0 }}
                transition={{ type: "spring", stiffness: 400, damping: 30 }}
              />
            )}
          </AnimatePresence>

          <Icon
            className={cn(
              "w-4 h-4 shrink-0 transition-colors duration-150",
              active ? "text-primary" : "text-ink-tertiary group-hover:text-ink-subtle"
            )}
          />
          {!collapsed && (
            <span className="flex-1 truncate">{item.label}</span>
          )}
        </Link>
      </div>
    );
  }

  // User initials for avatar
  const initials = userName
    ? userName
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : userEmail?.[0]?.toUpperCase() ?? "U";

  return (
    <nav className="flex flex-col h-full py-2">
      {/* Logo + collapse toggle */}
      <div className={cn("mb-3", collapsed ? "px-1" : "px-2")}>
        <div className={cn("flex items-center min-h-[30px]", collapsed ? "justify-center px-1" : "justify-between px-2.5")}>
          <Link href="/dashboard" className="flex items-center gap-2">
            <div className="w-5 h-5 rounded-[4px] bg-primary flex items-center justify-center overflow-hidden shrink-0">
              <Image
                src="/brand/synapse-logo.png"
                width={14}
                height={14}
                alt=""
                aria-hidden="true"
                className="h-3.5 w-3.5 object-contain"
              />
            </div>
            {!collapsed && (
              <span className="text-[13px] font-medium text-ink tracking-tight">
                Synapse
              </span>
            )}
          </Link>

          {/* Collapse toggle (desktop only) */}
          {onToggleCollapse && !collapsed && (
            <button
              onClick={onToggleCollapse}
              className="flex items-center justify-center w-6 h-6 rounded-md text-ink-tertiary hover:text-ink-subtle hover:bg-surface-2/30 transition-colors duration-150"
              aria-label="Collapse sidebar"
            >
              <ChevronsLeft className="w-3.5 h-3.5" />
            </button>
          )}
          {onToggleCollapse && collapsed && (
            <button
              onClick={onToggleCollapse}
              className="flex items-center justify-center w-6 h-6 rounded-md text-ink-tertiary hover:text-ink-subtle hover:bg-surface-2/30 transition-colors duration-150 mt-1"
              aria-label="Expand sidebar"
            >
              <ChevronsRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Main nav */}
      <div className={cn("flex-1 space-y-0.5", collapsed ? "px-1" : "px-2")}>
        {NAV_ITEMS_WORKSPACE.map(renderNavItem)}

        {/* Section divider */}
        <div className={cn("pt-3 pb-1", collapsed ? "px-1" : "px-2.5")}>
          {!collapsed ? (
            <span className="text-section-label text-ink-tertiary">Curriculum</span>
          ) : (
            collapsedSeparator
          )}
        </div>

        {NAV_ITEMS_CURRICULUM.map(renderNavItem)}
      </div>

      {/* Bottom section */}
      <div className={cn("pt-2 border-t border-hairline", collapsed ? "px-1" : "px-2")}>
        {/* Keyboard shortcut hint */}
        {!collapsed && (
          <div className="px-2.5 py-1.5 mb-0.5">
            <div className="flex items-center gap-2 text-[11px] text-ink-tertiary">
              <Search className="w-3 h-3" />
              <span>Search</span>
              <kbd className="ml-auto px-1 py-0.5 rounded-xs bg-surface-2 border border-hairline text-[10px] font-mono">
                ⌘K
              </kbd>
            </div>
          </div>
        )}

        {/* Settings */}
        <div className="space-y-0.5">
          {BOTTOM_ITEMS.map((item) => {
            const active = isActive(item);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "relative flex items-center gap-2.5 rounded-md text-cell transition-colors duration-150 group",
                  collapsed ? "justify-center px-2 min-h-[30px]" : "px-2.5 py-1.5 min-h-[30px]",
                  active
                    ? "bg-surface-2/40 text-ink"
                    : "text-ink-tertiary hover:text-ink-subtle hover:bg-surface-2/30"
                )}
                title={collapsed ? item.label : undefined}
              >
                {active && (
                  <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[2px] h-3.5 rounded-r-full bg-primary" />
                )}
                <Icon
                  className={cn(
                    "w-4 h-4 shrink-0 transition-colors duration-150",
                    active ? "text-primary" : "text-ink-tertiary group-hover:text-ink-subtle"
                  )}
                />
                {!collapsed && <span className="truncate">{item.label}</span>}
              </Link>
            );
          })}
        </div>

        {/* User profile section */}
        {(userName ?? userEmail) && (
          <div className={cn(
            "mt-1.5 pt-1.5 border-t border-hairline",
            collapsed ? "flex justify-center" : ""
          )}>
            <div className={cn(
              "flex items-center gap-2.5 rounded-md min-h-[30px]",
              collapsed ? "justify-center px-2" : "px-2.5 py-1"
            )}>
              {/* Avatar */}
              <div className="w-5 h-5 rounded-full bg-surface-3 border border-hairline flex items-center justify-center shrink-0">
                <span className="text-[9px] font-medium text-ink-subtle">{initials}</span>
              </div>
              {!collapsed && (
                <div className="flex-1 min-w-0">
                  {userName && (
                    <p className="text-[11px] text-ink truncate">{userName}</p>
                  )}
                  {userEmail && (
                    <p className="text-[10px] text-ink-tertiary truncate">{userEmail}</p>
                  )}
                </div>
              )}
              {!collapsed && (
                <Link
                  href="/auth/signout"
                  className="flex items-center justify-center w-5 h-5 rounded text-ink-tertiary hover:text-ink-subtle hover:bg-surface-2/30 transition-colors duration-150"
                  title="Sign out"
                >
                  <LogOut className="w-3 h-3" />
                </Link>
              )}
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}
