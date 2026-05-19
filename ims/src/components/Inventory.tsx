"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Search,
  Filter,
  Plus,
  Package,
  X,
  Loader2,
  ChevronDown,
} from "lucide-react";

interface InventoryItem {
  itemCode: string;
  itemName: string;
  category: string;
  weightPerMtr: number;
  openingStock: number;
  totalIn: number;
  totalOut: number;
  closingBalance: number;
  minStockLevel: number;
  allocated: number;
  reorderStatus: "REORDER" | "LOW" | "NORMAL";
}

interface InventoryResponse {
  items: InventoryItem[];
  categories: string[];
}

interface InventoryProps {
  refreshKey: number;
  onRefresh: () => void;
}

const STATUS_OPTIONS = ["All", "REORDER", "LOW", "NORMAL"] as const;

const STATUS_COLORS: Record<string, string> = {
  REORDER:
    "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400 ring-1 ring-red-200 dark:ring-red-800",
  LOW: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400 ring-1 ring-amber-200 dark:ring-amber-800",
  NORMAL:
    "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400 ring-1 ring-green-200 dark:ring-green-800",
};

const EMPTY_FORM = {
  itemCode: "",
  itemName: "",
  category: "",
  weightPerMtr: "",
  openingStock: "",
  minStockLevel: "",
};

export default function Inventory({ refreshKey, onRefresh }: InventoryProps) {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);

  const fetchInventory = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (categoryFilter) params.set("category", categoryFilter);
      if (statusFilter && statusFilter !== "All")
        params.set("status", statusFilter);
      const res = await fetch(`/api/inventory?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to fetch inventory");
      const data: InventoryResponse = await res.json();
      setItems(data.items);
      setCategories(data.categories);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [search, categoryFilter, statusFilter]);

  useEffect(() => {
    fetchInventory();
  }, [fetchInventory, refreshKey]);

  const maxBalance = Math.max(...items.map((i) => i.closingBalance), 1);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await fetch("/api/inventory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          weightPerMtr: parseFloat(formData.weightPerMtr) || 0,
          openingStock: parseInt(formData.openingStock) || 0,
          minStockLevel: parseInt(formData.minStockLevel) || 0,
        }),
      });
      if (!res.ok) throw new Error("Failed to add item");
      setShowModal(false);
      setFormData(EMPTY_FORM);
      onRefresh();
    } catch {
      /* keep modal open on error */
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="flex flex-1 flex-wrap gap-3 items-center w-full sm:w-auto">
          {/* Search */}
          <div className="relative flex-1 min-w-[220px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search items…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40 transition"
            />
          </div>

          {/* Category filter */}
          <div className="relative">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="appearance-none pl-10 pr-8 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40 transition cursor-pointer"
            >
              <option value="">All Categories</option>
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
          </div>

          {/* Status filter */}
          <div className="relative">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="appearance-none pl-4 pr-8 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40 transition cursor-pointer"
            >
              {STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>
                  {s === "All" ? "All Status" : s}
                </option>
              ))}
            </select>
            <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
          </div>
        </div>

        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium shadow-sm transition whitespace-nowrap"
        >
          <Plus className="w-4 h-4" />
          Add New Item
        </button>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 dark:border-gray-800 bg-gray-50/60 dark:bg-gray-800/40">
                <th className="text-left px-4 py-3 font-semibold text-gray-500 dark:text-gray-400 whitespace-nowrap">
                  Item Code
                </th>
                <th className="text-left px-4 py-3 font-semibold text-gray-500 dark:text-gray-400 whitespace-nowrap">
                  Description
                </th>
                <th className="text-left px-4 py-3 font-semibold text-gray-500 dark:text-gray-400 whitespace-nowrap">
                  Category
                </th>
                <th className="text-right px-4 py-3 font-semibold text-gray-500 dark:text-gray-400 whitespace-nowrap">
                  Wt/Mtr
                </th>
                <th className="text-right px-4 py-3 font-semibold text-gray-500 dark:text-gray-400 whitespace-nowrap">
                  Opening
                </th>
                <th className="text-right px-4 py-3 font-semibold text-gray-500 dark:text-gray-400 whitespace-nowrap">
                  Total In
                </th>
                <th className="text-right px-4 py-3 font-semibold text-gray-500 dark:text-gray-400 whitespace-nowrap">
                  Total Out
                </th>
                <th className="text-right px-4 py-3 font-semibold text-gray-500 dark:text-gray-400 whitespace-nowrap">
                  Allocated
                </th>
                <th className="text-left px-4 py-3 font-semibold text-gray-500 dark:text-gray-400 whitespace-nowrap min-w-[180px]">
                  Closing Balance
                </th>
                <th className="text-center px-4 py-3 font-semibold text-gray-500 dark:text-gray-400 whitespace-nowrap">
                  Status
                </th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={10} className="text-center py-16">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto text-blue-500" />
                    <p className="mt-2 text-gray-400 text-sm">
                      Loading inventory…
                    </p>
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={10} className="text-center py-16">
                    <Package className="w-10 h-10 mx-auto text-gray-300 dark:text-gray-600" />
                    <p className="mt-2 text-gray-400 text-sm">
                      No items found
                    </p>
                  </td>
                </tr>
              ) : (
                items.map((item) => {
                  const pct = (item.closingBalance / maxBalance) * 100;
                  const barColor =
                    item.reorderStatus === "REORDER"
                      ? "bg-red-500"
                      : item.reorderStatus === "LOW"
                        ? "bg-amber-500"
                        : "bg-green-500";

                  return (
                    <tr
                      key={item.itemCode}
                      className="border-b border-gray-50 dark:border-gray-800/60 hover:bg-gray-50/50 dark:hover:bg-gray-800/30 transition-colors"
                    >
                      <td className="px-4 py-3 font-mono text-xs font-semibold text-blue-600 dark:text-blue-400">
                        {item.itemCode}
                      </td>
                      <td className="px-4 py-3 font-medium">
                        {item.itemName}
                      </td>
                      <td className="px-4 py-3 text-gray-500 dark:text-gray-400">
                        {item.category}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {item.weightPerMtr.toFixed(2)}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {item.openingStock.toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-green-600 dark:text-green-400">
                        +{item.totalIn.toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-red-500 dark:text-red-400">
                        -{item.totalOut.toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-amber-600 dark:text-amber-400">
                        {item.allocated.toLocaleString()}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className="tabular-nums font-semibold min-w-[48px] text-right">
                            {item.closingBalance.toLocaleString()}
                          </span>
                          <div className="flex-1 h-2 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden">
                            <div
                              className={`h-full rounded-full ${barColor} transition-all duration-500`}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span
                          className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold ${STATUS_COLORS[item.reorderStatus]}`}
                        >
                          {item.reorderStatus}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Item Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => setShowModal(false)}
          />
          <div className="relative bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 w-full max-w-lg p-6 animate-fade-in">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-bold">Add New Item</h3>
              <button
                onClick={() => setShowModal(false)}
                className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">
                    Item Code
                  </label>
                  <input
                    required
                    value={formData.itemCode}
                    onChange={(e) =>
                      setFormData({ ...formData, itemCode: e.target.value })
                    }
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                    placeholder="e.g. 3MM-SATIN"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">
                    Item Name
                  </label>
                  <input
                    required
                    value={formData.itemName}
                    onChange={(e) =>
                      setFormData({ ...formData, itemName: e.target.value })
                    }
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                    placeholder="e.g. 3 MM Satin"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">
                    Category
                  </label>
                  <input
                    required
                    value={formData.category}
                    onChange={(e) =>
                      setFormData({ ...formData, category: e.target.value })
                    }
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                    placeholder="e.g. Satin"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">
                    Weight / Mtr (kg)
                  </label>
                  <input
                    required
                    type="number"
                    step="0.01"
                    value={formData.weightPerMtr}
                    onChange={(e) =>
                      setFormData({ ...formData, weightPerMtr: e.target.value })
                    }
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                    placeholder="0.12"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">
                    Opening Stock
                  </label>
                  <input
                    required
                    type="number"
                    value={formData.openingStock}
                    onChange={(e) =>
                      setFormData({ ...formData, openingStock: e.target.value })
                    }
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                    placeholder="500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">
                    Min Stock Level
                  </label>
                  <input
                    required
                    type="number"
                    value={formData.minStockLevel}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        minStockLevel: e.target.value,
                      })
                    }
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                    placeholder="200"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-800 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex items-center gap-2 px-5 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-sm font-medium transition"
                >
                  {submitting && (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  )}
                  {submitting ? "Adding…" : "Add Item"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
