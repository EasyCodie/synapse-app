"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
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

interface SidebarNavProps {
  userEmail?: string;
  userName?: string;
}

export function SidebarNav({ userEmail, userName }: SidebarNavProps) {
  const pathname = usePathname();

  function isActive(item: NavItem) {
    if (item.exact) return pathname === item.href;
    return pathname.startsWith(item.href);
  }

  function renderNavItem(item: NavItem) {
    const active = isActive(item);
    const Icon = item.icon;
    return (
      <Link
        key={item.href}
        href={item.href}
        className={cn(
          "relative flex items-center gap-3 px-3 py-2.5 rounded-md text-body-sm transition-all duration-200 ease-out group min-h-[44px]",
          active
            ? "bg-surface-2 text-ink"
            : "text-ink-subtle hover:text-ink-muted hover:bg-surface-2/50"
        )}
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
        <span className="flex-1 truncate">{item.label}</span>
      </Link>
    );
  }

  return (
    <nav className="flex flex-col h-full py-3">
      {/* Logo */}
      <div className="px-2 mb-6">
        <Link href="/dashboard" className="flex items-center gap-2 px-3 min-h-[44px]">
          <div className="w-7 h-7 rounded-md bg-primary flex items-center justify-center">
            <span className="text-on-primary text-caption font-semibold leading-none">S</span>
          </div>
          <span className="text-body-sm font-semibold text-ink tracking-tight">Synapse</span>
        </Link>
      </div>

      {/* Main nav */}
      <div className="flex-1 px-2 space-y-1">
        {NAV_ITEMS_WORKSPACE.map(renderNavItem)}

        {/* Section divider */}
        <div className="pt-4 pb-1.5 px-3">
          <span className="text-eyebrow text-ink-tertiary">Curriculum</span>
        </div>

        {NAV_ITEMS_CURRICULUM.map(renderNavItem)}
      </div>

      {/* Bottom nav */}
      <div className="px-2 pt-2 border-t border-hairline space-y-1">
        {BOTTOM_ITEMS.map((item) => {
          const active = isActive(item);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "relative flex items-center gap-3 px-3 py-2.5 rounded-md text-body-sm transition-all duration-200 ease-out group min-h-[44px]",
                active
                  ? "bg-surface-2 text-ink"
                  : "text-ink-subtle hover:text-ink-muted hover:bg-surface-2/50"
              )}
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
              <span className="truncate">{item.label}</span>
            </Link>
          );
        })}

        {/* User info */}
        {(userName ?? userEmail) && (
          <div className="px-3 py-2.5 mt-1">
            <p className="text-caption text-ink-subtle truncate">
              {userName ?? userEmail}
            </p>
          </div>
        )}
      </div>
    </nav>
  );
}
