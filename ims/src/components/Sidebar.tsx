"use client";

import {
  BarChart3,
  Warehouse,
  BookOpen,
  Wrench,
  Truck,
  Users,
  Bell,
} from "lucide-react";

interface SidebarProps {
  currentTab: string;
  onTabChange: (tab: string) => void;
  lastSync: string;
}

const sections = [
  {
    heading: "Overview",
    items: [{ key: "dashboard", label: "Dashboard", icon: BarChart3 }],
  },
  {
    heading: "Operations",
    items: [
      { key: "stock", label: "Stock / Inventory", icon: Warehouse },
      { key: "orders", label: "Order Book", icon: BookOpen },
      { key: "jobwork", label: "Job Work Tracker", icon: Wrench },
      { key: "dispatch", label: "Dispatch Log", icon: Truck },
    ],
  },
  {
    heading: "Analytics",
    items: [
      { key: "clients", label: "Client Portfolios", icon: Users },
      { key: "alerts", label: "Stock Alerts", icon: Bell },
    ],
  },
] as const;

export default function Sidebar({
  currentTab,
  onTabChange,
  lastSync,
}: SidebarProps) {
  return (
    <aside className="flex h-screen w-64 flex-col justify-between bg-[#0d1b2a] text-gray-300 select-none">
      {/* Brand */}
      <div>
        <div className="flex items-center gap-3 px-5 py-6">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#c9a84c] font-bold text-[#0d1b2a] text-sm tracking-wide">
            JR
          </div>
          <div>
            <h1 className="text-sm font-semibold tracking-wide text-white">
              Jai Roop Textiles
            </h1>
            <p className="text-[10px] uppercase tracking-widest text-[#c9a84c]">
              IMS Tracking
            </p>
          </div>
        </div>

        <div className="mx-4 mb-4 border-t border-white/10" />

        {/* Navigation sections */}
        <nav className="space-y-5 px-3">
          {sections.map((section) => (
            <div key={section.heading}>
              <p className="mb-1.5 px-2 text-[10px] font-semibold uppercase tracking-widest text-gray-500">
                {section.heading}
              </p>
              <ul className="space-y-0.5">
                {section.items.map((item) => {
                  const active = currentTab === item.key;
                  return (
                    <li key={item.key}>
                      <button
                        onClick={() => onTabChange(item.key)}
                        className={`group flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                          active
                            ? "border-l-[3px] border-[#c9a84c] bg-[#c9a84c]/10 text-[#c9a84c]"
                            : "border-l-[3px] border-transparent text-gray-400 hover:bg-white/5 hover:text-gray-200"
                        }`}
                      >
                        <item.icon
                          className={`h-4 w-4 shrink-0 ${
                            active
                              ? "text-[#c9a84c]"
                              : "text-gray-500 group-hover:text-gray-300"
                          }`}
                        />
                        {item.label}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>
      </div>

      {/* Footer */}
      <div className="border-t border-white/10 px-5 py-4">
        <p className="text-[11px] font-medium text-gray-500">
          Version{" "}
          <span className="font-semibold text-gray-400">v7.0</span>
        </p>
        <p className="mt-0.5 text-[10px] text-gray-600">
          Last sync:{" "}
          <span className="text-gray-500">{lastSync}</span>
        </p>
      </div>
    </aside>
  );
}
