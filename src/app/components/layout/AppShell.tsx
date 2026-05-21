import React from "react";
import type { NavPage } from "../../auth/accessPolicy";
import { AppSidebar } from "./AppSidebar";
import { AppHeader } from "./AppHeader";

interface AppShellProps {
  activePage: NavPage;
  onNavigate: (page: NavPage) => void;
  children: React.ReactNode;
}

export function AppShell({ activePage, onNavigate, children }: AppShellProps) {
  return (
    <div className="flex h-screen overflow-hidden bg-slate-100">
      <AppSidebar activePage={activePage} onNavigate={onNavigate} />
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <AppHeader />
        <main className="min-h-0 flex-1 overflow-y-auto bg-slate-50">
          <div className="min-h-full">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
