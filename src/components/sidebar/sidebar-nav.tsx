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
  ChevronRight,
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

const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { href: "/chat", label: "AI Chat", icon: MessageSquare },
  { href: "/flashcards", label: "Flashcards", icon: GraduationCap },
  { href: "/calendar", label: "Calendar & Tasks", icon: CalendarDays },
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

  return (
    <nav className="flex flex-col h-full py-3">
      {/* Logo */}
      <div className="px-4 mb-6">
        <Link href="/dashboard" className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-sm bg-primary flex items-center justify-center">
            <span className="text-on-primary text-caption font-semibold leading-none">S</span>
          </div>
          <span className="text-body-sm font-semibold text-ink tracking-tight">Synapse</span>
        </Link>
      </div>

      {/* Main nav */}
      <div className="flex-1 px-2 space-y-0.5">
        {NAV_ITEMS.map((item) => {
          const active = isActive(item);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-2.5 px-3 py-2 rounded-md text-body-sm transition-colors group",
                active
                  ? "bg-surface-2 text-ink"
                  : "text-ink-subtle hover:text-ink hover:bg-surface-2"
              )}
            >
              <Icon
                className={cn(
                  "w-4 h-4 shrink-0 transition-colors",
                  active ? "text-primary" : "text-ink-tertiary group-hover:text-ink-subtle"
                )}
              />
              <span className="flex-1 truncate">{item.label}</span>
              {active && (
                <ChevronRight className="w-3 h-3 text-ink-tertiary shrink-0" />
              )}
            </Link>
          );
        })}
      </div>

      {/* Bottom nav */}
      <div className="px-2 pt-2 border-t border-hairline space-y-0.5">
        {BOTTOM_ITEMS.map((item) => {
          const active = isActive(item);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-2.5 px-3 py-2 rounded-md text-body-sm transition-colors group",
                active
                  ? "bg-surface-2 text-ink"
                  : "text-ink-subtle hover:text-ink hover:bg-surface-2"
              )}
            >
              <Icon className="w-4 h-4 shrink-0 text-ink-tertiary group-hover:text-ink-subtle" />
              <span className="truncate">{item.label}</span>
            </Link>
          );
        })}

        {/* User info */}
        {(userName ?? userEmail) && (
          <div className="px-3 py-2 mt-1">
            <p className="text-caption text-ink-subtle truncate">
              {userName ?? userEmail}
            </p>
          </div>
        )}
      </div>
    </nav>
  );
}
