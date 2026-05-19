"use client";

import { Sun, Moon, RefreshCw } from "lucide-react";

interface HeaderProps {
  title: string;
  subtitle: string;
  dark: boolean;
  onToggleDark: () => void;
  onRefresh: () => void;
}

export default function Header({
  title,
  subtitle,
  dark,
  onToggleDark,
  onRefresh,
}: HeaderProps) {
  return (
    <header
      className={`flex items-center justify-between border-b px-6 py-4 transition-colors ${
        dark
          ? "border-white/10 bg-[#0f2035] text-white"
          : "border-gray-200 bg-white text-gray-900"
      }`}
    >
      <div>
        <h2 className="text-lg font-semibold leading-tight tracking-tight">
          {title}
        </h2>
        <p
          className={`mt-0.5 text-xs ${
            dark ? "text-gray-400" : "text-gray-500"
          }`}
        >
          {subtitle}
        </p>
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={onRefresh}
          aria-label="Sync data"
          className={`inline-flex h-9 w-9 items-center justify-center rounded-lg transition-colors ${
            dark
              ? "text-gray-400 hover:bg-white/10 hover:text-white"
              : "text-gray-500 hover:bg-gray-100 hover:text-gray-800"
          }`}
        >
          <RefreshCw className="h-4 w-4" />
        </button>

        <button
          onClick={onToggleDark}
          aria-label="Toggle dark mode"
          className={`inline-flex h-9 w-9 items-center justify-center rounded-lg transition-colors ${
            dark
              ? "text-gray-400 hover:bg-white/10 hover:text-white"
              : "text-gray-500 hover:bg-gray-100 hover:text-gray-800"
          }`}
        >
          {dark ? (
            <Sun className="h-4 w-4" />
          ) : (
            <Moon className="h-4 w-4" />
          )}
        </button>
      </div>
    </header>
  );
}
