"use client";

import { useState } from "react";
import { Menu, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { SidebarNav } from "./sidebar-nav";

interface MobileSidebarToggleProps {
  userEmail?: string;
  userName?: string;
}

export function MobileSidebarToggle({ userEmail, userName }: MobileSidebarToggleProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* Mobile top bar */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-40 h-14 bg-[#070707] border-b border-hairline flex items-center px-4">
        <button
          onClick={() => setOpen(true)}
          className="flex items-center justify-center min-w-[44px] min-h-[44px] rounded-md text-ink-subtle hover:text-ink hover:bg-surface-2 transition-colors duration-200"
          aria-label="Open navigation"
        >
          <Menu className="w-5 h-5" />
        </button>
        <span className="ml-2 text-body-sm font-semibold text-ink">Synapse</span>
      </div>

      {/* Mobile sidebar overlay — always rendered for CSS transition */}
      <div
        className={cn(
          "md:hidden fixed inset-0 z-50 bg-black/60 backdrop-blur-[2px] transition-opacity duration-300",
          open ? "opacity-100" : "opacity-0 pointer-events-none"
        )}
        onClick={() => setOpen(false)}
      />
      <aside
        className={cn(
          "md:hidden fixed left-0 top-0 bottom-0 z-50 w-64 bg-[#070707] border-r border-hairline flex flex-col transition-transform duration-300 ease-out",
          open ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex items-center justify-between px-4 h-14 border-b border-hairline">
          <span className="text-body-sm font-semibold text-ink">Synapse</span>
          <button
            onClick={() => setOpen(false)}
            className="flex items-center justify-center min-w-[44px] min-h-[44px] rounded-md text-ink-subtle hover:text-ink hover:bg-surface-2 transition-colors duration-200"
            aria-label="Close navigation"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto" onClick={() => setOpen(false)}>
          <SidebarNav userEmail={userEmail} userName={userName} />
        </div>
      </aside>

      {/* Spacer for mobile top bar */}
      <div className="md:hidden h-14 shrink-0" />
    </>
  );
}
