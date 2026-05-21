import React, { useState } from "react";
import { Bell, Command, HelpCircle, Search } from "lucide-react";

import { Avatar } from "../ui/avatar";
import { SearchInput } from "../ui/input";
import { useAuth } from "../../auth/useAuth";

export function AppHeader() {
  const [search, setSearch] = useState("");
  const { user } = useAuth();

  return (
    <header className="sticky top-0 z-20 h-16 shrink-0 border-b border-slate-200 bg-white/95 backdrop-blur">
      <div className="flex h-full items-center gap-4 px-5 lg:px-6">
        <div className="hidden min-w-0 lg:block">
          <div className="text-sm font-semibold text-slate-900">Compliance Manager</div>
          <div className="text-xs text-slate-500">ValidateNow platform</div>
        </div>

        <div className="hidden items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs text-slate-600 xl:inline-flex">
          <Command className="h-3.5 w-3.5" />
          Global command search
        </div>

        <div className="mx-auto w-full max-w-2xl">
          <SearchInput
            placeholder="Search pages, records, or actions..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            onClear={() => setSearch("")}
            className="h-10"
          />
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            className="hidden h-9 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-600 transition-colors hover:bg-slate-50 lg:inline-flex"
          >
            <Search className="h-4 w-4" />
            Search
          </button>

          <button
            type="button"
            className="hidden h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 transition-colors hover:bg-slate-50 hover:text-slate-700 lg:inline-flex"
          >
            <HelpCircle className="h-4 w-4" />
          </button>

          <button
            type="button"
            className="relative flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 transition-colors hover:bg-slate-50 hover:text-slate-700"
          >
            <Bell className="h-4 w-4" />
            <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-blue-600 ring-2 ring-white" />
          </button>

          <button
            type="button"
            className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-2 py-1.5 transition-colors hover:bg-slate-50"
          >
            <Avatar name={user?.full_name || user?.email || "User"} size="sm" status="online" />
            <div className="hidden text-left sm:block">
              <div className="text-sm font-medium leading-tight text-slate-800">{user?.full_name || "User"}</div>
              <div className="text-xs text-slate-500">{user?.roles?.[0] || "Authenticated"}</div>
            </div>
            <svg className="hidden h-3.5 w-3.5 text-slate-400 sm:block" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        </div>
      </div>
    </header>
  );
}
