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
  accent: {
    text: string;
    hoverText: string;
    bg: string;
    hoverBg: string;
    border: string;
    hoverBorder: string;
    indicator: string;
  };
  exact?: boolean;
}

const NAV_ITEMS_WORKSPACE: NavItem[] = [
  {
    href: "/dashboard",
    label: "Dashboard",
    icon: LayoutDashboard,
    accent: {
      text: "text-[#f6c453]",
      hoverText: "group-hover:text-[#f6c453]",
      bg: "bg-[#f6c453]/10",
      hoverBg: "hover:bg-[#f6c453]/10",
      border: "border-[#f6c453]/25",
      hoverBorder: "hover:border-[#f6c453]/25",
      indicator: "bg-[#f6c453]",
    },
    exact: true,
  },
  {
    href: "/chat",
    label: "AI Chat",
    icon: MessageSquare,
    accent: {
      text: "text-[#a78bfa]",
      hoverText: "group-hover:text-[#a78bfa]",
      bg: "bg-[#a78bfa]/10",
      hoverBg: "hover:bg-[#a78bfa]/10",
      border: "border-[#a78bfa]/25",
      hoverBorder: "hover:border-[#a78bfa]/25",
      indicator: "bg-[#a78bfa]",
    },
  },
  {
    href: "/flashcards",
    label: "Flashcards",
    icon: GraduationCap,
    accent: {
      text: "text-[#34d399]",
      hoverText: "group-hover:text-[#34d399]",
      bg: "bg-[#34d399]/10",
      hoverBg: "hover:bg-[#34d399]/10",
      border: "border-[#34d399]/25",
      hoverBorder: "hover:border-[#34d399]/25",
      indicator: "bg-[#34d399]",
    },
  },
  {
    href: "/calendar",
    label: "Calendar & Tasks",
    icon: CalendarDays,
    accent: {
      text: "text-[#38bdf8]",
      hoverText: "group-hover:text-[#38bdf8]",
      bg: "bg-[#38bdf8]/10",
      hoverBg: "hover:bg-[#38bdf8]/10",
      border: "border-[#38bdf8]/25",
      hoverBorder: "hover:border-[#38bdf8]/25",
      indicator: "bg-[#38bdf8]",
    },
  },
  {
    href: "/roadmap",
    label: "Roadmap",
    icon: Route,
    accent: {
      text: "text-[#fb923c]",
      hoverText: "group-hover:text-[#fb923c]",
      bg: "bg-[#fb923c]/10",
      hoverBg: "hover:bg-[#fb923c]/10",
      border: "border-[#fb923c]/25",
      hoverBorder: "hover:border-[#fb923c]/25",
      indicator: "bg-[#fb923c]",
    },
  },
];

const NAV_ITEMS_CURRICULUM: NavItem[] = [
  {
    href: "/subjects",
    label: "Subjects",
    icon: BookOpen,
    accent: {
      text: "text-[#60a5fa]",
      hoverText: "group-hover:text-[#60a5fa]",
      bg: "bg-[#60a5fa]/10",
      hoverBg: "hover:bg-[#60a5fa]/10",
      border: "border-[#60a5fa]/25",
      hoverBorder: "hover:border-[#60a5fa]/25",
      indicator: "bg-[#60a5fa]",
    },
  },
  {
    href: "/core",
    label: "The Core",
    icon: Layers,
    accent: {
      text: "text-[#c084fc]",
      hoverText: "group-hover:text-[#c084fc]",
      bg: "bg-[#c084fc]/10",
      hoverBg: "hover:bg-[#c084fc]/10",
      border: "border-[#c084fc]/25",
      hoverBorder: "hover:border-[#c084fc]/25",
      indicator: "bg-[#c084fc]",
    },
  },
  {
    href: "/ia-manager",
    label: "IA Manager",
    icon: ClipboardList,
    accent: {
      text: "text-[#fb7185]",
      hoverText: "group-hover:text-[#fb7185]",
      bg: "bg-[#fb7185]/10",
      hoverBg: "hover:bg-[#fb7185]/10",
      border: "border-[#fb7185]/25",
      hoverBorder: "hover:border-[#fb7185]/25",
      indicator: "bg-[#fb7185]",
    },
  },
  {
    href: "/resources",
    label: "Resource Library",
    icon: Library,
    accent: {
      text: "text-[#2dd4bf]",
      hoverText: "group-hover:text-[#2dd4bf]",
      bg: "bg-[#2dd4bf]/10",
      hoverBg: "hover:bg-[#2dd4bf]/10",
      border: "border-[#2dd4bf]/25",
      hoverBorder: "hover:border-[#2dd4bf]/25",
      indicator: "bg-[#2dd4bf]",
    },
  },
  {
    href: "/search",
    label: "Search",
    icon: Search,
    accent: {
      text: "text-[#818cf8]",
      hoverText: "group-hover:text-[#818cf8]",
      bg: "bg-[#818cf8]/10",
      hoverBg: "hover:bg-[#818cf8]/10",
      border: "border-[#818cf8]/25",
      hoverBorder: "hover:border-[#818cf8]/25",
      indicator: "bg-[#818cf8]",
    },
  },
];

const BOTTOM_ITEMS: NavItem[] = [
  {
    href: "/settings",
    label: "Settings",
    icon: Settings,
    accent: {
      text: "text-[#94a3b8]",
      hoverText: "group-hover:text-[#94a3b8]",
      bg: "bg-[#94a3b8]/10",
      hoverBg: "hover:bg-[#94a3b8]/10",
      border: "border-[#94a3b8]/25",
      hoverBorder: "hover:border-[#94a3b8]/25",
      indicator: "bg-[#94a3b8]",
    },
  },
];

const iconHover = {
  rest: { y: 0, rotate: 0, scale: 1 },
  hover: { y: -1, rotate: -3, scale: 1.08 },
};

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
      <motion.div
        key={item.href}
        initial="rest"
        whileHover="hover"
        whileTap={{ scale: 0.98 }}
      >
        <Link
          href={item.href}
          className={cn(
            "relative flex items-center gap-2.5 rounded-md border text-cell transition-colors duration-150 group",
            collapsed ? "justify-center px-2 min-h-[30px]" : "px-2.5 py-1.5 min-h-[30px]",
            active
              ? cn(item.accent.bg, item.accent.border, "text-ink")
              : cn("border-transparent text-ink-tertiary hover:text-ink-subtle", item.accent.hoverBg, item.accent.hoverBorder)
          )}
          title={collapsed ? item.label : undefined}
        >
          {/* Active indicator */}
          <AnimatePresence>
            {active && (
              <motion.div
                layoutId="sidebar-active-indicator"
                className={cn(
                  "absolute left-0 top-1/2 -translate-y-1/2 w-[2px] h-3.5 rounded-r-full",
                  item.accent.indicator
                )}
                initial={{ opacity: 0, scaleY: 0 }}
                animate={{ opacity: 1, scaleY: 1 }}
                exit={{ opacity: 0, scaleY: 0 }}
                transition={{ type: "spring", stiffness: 400, damping: 30 }}
              />
            )}
          </AnimatePresence>

          <motion.span
            variants={iconHover}
            transition={{ type: "spring", stiffness: 420, damping: 24 }}
            className="flex h-4 w-4 shrink-0 items-center justify-center"
          >
            <Icon
              className={cn(
                "w-4 h-4 shrink-0 transition-colors duration-150",
                active ? item.accent.text : cn("text-ink-tertiary", item.accent.hoverText)
              )}
            />
          </motion.span>
          {!collapsed && (
            <span className="flex-1 truncate">{item.label}</span>
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
          {BOTTOM_ITEMS.map(renderNavItem)}
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
