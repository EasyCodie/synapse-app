"use client";

import { useState, useSyncExternalStore } from "react";
import { motion } from "framer-motion";
import { SidebarNav } from "@/components/sidebar/sidebar-nav";
import { MobileSidebarToggle } from "@/components/sidebar/mobile-sidebar-toggle";

interface WorkspaceShellProps {
  children: React.ReactNode;
  userEmail?: string;
  userName?: string;
}

const SIDEBAR_COLLAPSED_KEY = "synapse-sidebar-collapsed";

function getStoredCollapsed() {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === "true";
}

function subscribe(callback: () => void) {
  window.addEventListener("storage", callback);
  return () => window.removeEventListener("storage", callback);
}

export function WorkspaceShell({ children, userEmail, userName }: WorkspaceShellProps) {
  const storedCollapsed = useSyncExternalStore(subscribe, getStoredCollapsed, () => false);
  const [collapsed, setCollapsed] = useState(storedCollapsed);

  function handleToggleCollapse() {
    setCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(next));
      return next;
    });
  }

  return (
    <div className="flex h-screen overflow-hidden bg-canvas">
      {/* Sidebar — desktop */}
      <motion.aside
        className="hidden shrink-0 flex-col overflow-hidden border-r border-hairline bg-sidebar md:flex"
        animate={{ width: collapsed ? 52 : 204 }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
      >
        <SidebarNav
          userEmail={userEmail}
          userName={userName}
          collapsed={collapsed}
          onToggleCollapse={handleToggleCollapse}
        />
      </motion.aside>

      {/* Mobile sidebar toggle */}
      <MobileSidebarToggle
        userEmail={userEmail}
        userName={userName}
      />

      {/* Main content */}
      <main className="relative flex-1 overflow-y-auto bg-canvas">
        <div className="max-w-[1280px] mx-auto px-4 md:px-5 lg:px-6 pt-5 pb-8">
          {children}
        </div>
      </main>
    </div>
  );
}
