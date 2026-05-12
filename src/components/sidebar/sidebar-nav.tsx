"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
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

const navItemVariants = {
  hidden: { opacity: 0, x: -8 },
  visible: { opacity: 1, x: 0 },
};

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.03,
      delayChildren: 0.05,
    },
  },
};

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
  const [hoveredItem, setHoveredItem] = useState<string | null>(null);

  function isActive(item: NavItem) {
    if (item.exact) return pathname === item.href;
    return pathname.startsWith(item.href);
  }

  function renderNavItem(item: NavItem) {
    const active = isActive(item);
    const Icon = item.icon;
    const hovered = hoveredItem === item.href;

    return (
      <motion.div key={item.href} variants={navItemVariants}>
        <Link
          href={item.href}
          onMouseEnter={() => setHoveredItem(item.href)}
          onMouseLeave={() => setHoveredItem(null)}
          className={cn(
            "relative flex items-center gap-3 rounded-md text-body-sm transition-colors duration-200 ease-out group min-h-[44px]",
            collapsed ? "justify-center px-2" : "px-3 py-2.5",
            active
              ? "bg-surface-2 text-ink"
              : "text-ink-subtle hover:text-ink-muted hover:bg-surface-2/50"
          )}
          title={collapsed ? item.label : undefined}
        >
          {/* Active indicator pill */}
          <AnimatePresence>
            {active && (
              <motion.div
                layoutId="sidebar-active-indicator"
                className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r-full bg-primary"
                initial={{ opacity: 0, scaleY: 0 }}
                animate={{ opacity: 1, scaleY: 1 }}
                exit={{ opacity: 0, scaleY: 0 }}
                transition={{ type: "spring", stiffness: 400, damping: 30 }}
              />
            )}
          </AnimatePresence>

          {/* Hover glow (subtle) */}
          {hovered && !active && (
            <motion.div
              className="absolute inset-0 rounded-md bg-surface-2/30"
              layoutId="sidebar-hover"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
            />
          )}

          <Icon
            className={cn(
              "w-[18px] h-[18px] shrink-0 transition-colors duration-200 relative z-10",
              active ? "text-primary" : "text-ink-tertiary group-hover:text-ink-subtle"
            )}
          />
          {!collapsed && (
            <span className="flex-1 truncate relative z-10">{item.label}</span>
          )}
        </Link>
      </motion.div>
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
    <nav className="flex flex-col h-full py-3">
      {/* Logo + collapse toggle */}
      <div className={cn("mb-6", collapsed ? "px-1" : "px-2")}>
        <div className={cn("flex items-center min-h-[44px]", collapsed ? "justify-center px-1" : "justify-between px-3")}>
          <Link href="/dashboard" className="flex items-center gap-2">
            <motion.div
              className="w-7 h-7 rounded-md bg-primary flex items-center justify-center"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              transition={{ type: "spring", stiffness: 400, damping: 20 }}
            >
              <span className="text-on-primary text-caption font-semibold leading-none">S</span>
            </motion.div>
            {!collapsed && (
              <motion.span
                className="text-body-sm font-semibold text-ink tracking-tight"
                initial={{ opacity: 0, width: 0 }}
                animate={{ opacity: 1, width: "auto" }}
                exit={{ opacity: 0, width: 0 }}
              >
                Synapse
              </motion.span>
            )}
          </Link>

          {/* Collapse toggle (desktop only) */}
          {onToggleCollapse && !collapsed && (
            <motion.button
              onClick={onToggleCollapse}
              className="flex items-center justify-center w-7 h-7 rounded-md text-ink-tertiary hover:text-ink-subtle hover:bg-surface-2/50 transition-colors duration-200"
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              aria-label="Collapse sidebar"
            >
              <ChevronsLeft className="w-4 h-4" />
            </motion.button>
          )}
          {onToggleCollapse && collapsed && (
            <motion.button
              onClick={onToggleCollapse}
              className="flex items-center justify-center w-7 h-7 rounded-md text-ink-tertiary hover:text-ink-subtle hover:bg-surface-2/50 transition-colors duration-200 mt-2"
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              aria-label="Expand sidebar"
            >
              <ChevronsRight className="w-4 h-4" />
            </motion.button>
          )}
        </div>
      </div>

      {/* Main nav — staggered entrance */}
      <motion.div
        className={cn("flex-1 space-y-1", collapsed ? "px-1" : "px-2")}
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        {NAV_ITEMS_WORKSPACE.map(renderNavItem)}

        {/* Section divider */}
        <div className={cn("pt-4 pb-1.5", collapsed ? "px-1" : "px-3")}>
          {!collapsed ? (
            <span className="text-eyebrow text-ink-tertiary">Curriculum</span>
          ) : (
            <div className="w-6 h-px bg-hairline mx-auto" />
          )}
        </div>

        {NAV_ITEMS_CURRICULUM.map(renderNavItem)}
      </motion.div>

      {/* Bottom section */}
      <div className={cn("pt-2 border-t border-hairline", collapsed ? "px-1" : "px-2")}>
        {/* Keyboard shortcut hint */}
        {!collapsed && (
          <div className="px-3 py-2 mb-1">
            <div className="flex items-center gap-2 text-caption text-ink-tertiary">
              <Search className="w-3 h-3" />
              <span>Search</span>
              <kbd className="ml-auto px-1.5 py-0.5 rounded bg-surface-2 border border-hairline text-[10px] font-mono">
                ⌘K
              </kbd>
            </div>
          </div>
        )}

        {/* Settings */}
        <div className="space-y-1">
          {BOTTOM_ITEMS.map((item) => {
            const active = isActive(item);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "relative flex items-center gap-3 rounded-md text-body-sm transition-colors duration-200 ease-out group min-h-[44px]",
                  collapsed ? "justify-center px-2" : "px-3 py-2.5",
                  active
                    ? "bg-surface-2 text-ink"
                    : "text-ink-subtle hover:text-ink-muted hover:bg-surface-2/50"
                )}
                title={collapsed ? item.label : undefined}
              >
                {active && (
                  <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r-full bg-primary" />
                )}
                <Icon
                  className={cn(
                    "w-[18px] h-[18px] shrink-0 transition-colors duration-200",
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
            "mt-2 pt-2 border-t border-hairline",
            collapsed ? "flex justify-center" : ""
          )}>
            <div className={cn(
              "flex items-center gap-3 rounded-md min-h-[44px]",
              collapsed ? "justify-center px-2" : "px-3 py-2"
            )}>
              {/* Avatar */}
              <div className="w-7 h-7 rounded-full bg-surface-3 border border-hairline flex items-center justify-center shrink-0">
                <span className="text-[10px] font-medium text-ink-subtle">{initials}</span>
              </div>
              {!collapsed && (
                <div className="flex-1 min-w-0">
                  {userName && (
                    <p className="text-caption text-ink truncate">{userName}</p>
                  )}
                  {userEmail && (
                    <p className="text-[11px] text-ink-tertiary truncate">{userEmail}</p>
                  )}
                </div>
              )}
              {!collapsed && (
                <Link
                  href="/auth/signout"
                  className="flex items-center justify-center w-6 h-6 rounded text-ink-tertiary hover:text-ink-subtle hover:bg-surface-2/50 transition-colors duration-200"
                  title="Sign out"
                >
                  <LogOut className="w-3.5 h-3.5" />
                </Link>
              )}
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}
