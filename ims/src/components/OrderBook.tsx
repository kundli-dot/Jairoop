"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Search,
  Plus,
  X,
  Loader2,
  ChevronDown,
  ClipboardList,
  Eye,
  CheckCircle2,
  Circle,
  Truck,
  PackageCheck,
} from "lucide-react";

interface Order {
  orderId: string;
  date: string;
  clientName: string;
  itemCode: string;
  quantity: number;
  status: string;
  remarks: string;
}

interface OrdersResponse {
  orders: Order[];
}

interface LifecycleStep {
  step: string;
  status: "completed" | "current" | "pending";
  date?: string;
}

interface OrderBookProps {
  refreshKey: number;
  onRefresh: () => void;
}

const STATUS_OPTIONS = ["All", "Pending", "In Production", "Completed"];

const STATUS_COLORS: Record<string, string> = {
  Completed:
    "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400 ring-1 ring-green-200 dark:ring-green-800",
  "In Production":
    "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400 ring-1 ring-blue-200 dark:ring-blue-800",
  Pending:
    "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400 ring-1 ring-amber-200 dark:ring-amber-800",
};

const LIFECYCLE_STEPS = [
  "Order Placed",
  "Job Work",
  "Dispatch",
  "Completed",
] as const;

const STEP_ICONS: Record<string, React.ReactNode> = {
  "Order Placed": <ClipboardList className="w-5 h-5" />,
  "Job Work": <Circle className="w-5 h-5" />,
  Dispatch: <Truck className="w-5 h-5" />,
  Completed: <PackageCheck className="w-5 h-5" />,
};

const EMPTY_ORDER = {
  date: "",
  clientName: "",
  itemCode: "",
  quantity: "",
  status: "Pending",
  remarks: "",
};

export default function OrderBook({ refreshKey, onRefresh }: OrderBookProps) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [loading, setLoading] = useState(true);

  const [showNewModal, setShowNewModal] = useState(false);
  const [formData, setFormData] = useState(EMPTY_ORDER);
  const [submitting, setSubmitting] = useState(false);

  const [lifecycleModal, setLifecycleModal] = useState<string | null>(null);
  const [lifecycleSteps, setLifecycleSteps] = useState<LifecycleStep[]>([]);
  const [lifecycleLoading, setLifecycleLoading] = useState(false);

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (statusFilter && statusFilter !== "All")
        params.set("status", statusFilter);
      const res = await fetch(`/api/orders?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to fetch orders");
      const data: OrdersResponse = await res.json();
      setOrders(data.orders);
    } catch {
      setOrders([]);
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders, refreshKey]);

  const handleNewOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          quantity: parseInt(formData.quantity) || 0,
        }),
      });
      if (!res.ok) throw new Error("Failed to create order");
      setShowNewModal(false);
      setFormData(EMPTY_ORDER);
      onRefresh();
    } catch {
      /* keep modal open */
    } finally {
      setSubmitting(false);
    }
  };

  const handleStatusChange = async (orderId: string, newStatus: string) => {
    try {
      const res = await fetch("/api/orders", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId, status: newStatus }),
      });
      if (!res.ok) throw new Error("Failed to update status");
      onRefresh();
    } catch {
      /* silent */
    }
  };

  const openLifecycle = async (orderId: string) => {
    setLifecycleModal(orderId);
    setLifecycleLoading(true);
    try {
      const res = await fetch(`/api/orders/${orderId}/lifecycle`);
      if (!res.ok) throw new Error("Failed to fetch lifecycle");
      const data = await res.json();
      setLifecycleSteps(data.steps ?? data);
    } catch {
      const order = orders.find((o) => o.orderId === orderId);
      const currentIdx = LIFECYCLE_STEPS.indexOf(
        order?.status === "In Production"
          ? "Job Work"
          : (order?.status as (typeof LIFECYCLE_STEPS)[number]) ??
              "Order Placed",
      );
      setLifecycleSteps(
        LIFECYCLE_STEPS.map((step, i) => ({
          step,
          status:
            i < currentIdx
              ? "completed"
              : i === currentIdx
                ? "current"
                : "pending",
        })),
      );
    } finally {
      setLifecycleLoading(false);
    }
  };

  const formatDate = (d: string) => {
    try {
      return new Date(d).toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      });
    } catch {
      return d;
    }
  };

  return (
    <div className="space-y-5">
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="flex flex-1 flex-wrap gap-3 items-center w-full sm:w-auto">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search orders…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40 transition"
            />
          </div>

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
          onClick={() => setShowNewModal(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium shadow-sm transition whitespace-nowrap"
        >
          <Plus className="w-4 h-4" />
          New Order
        </button>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 dark:border-gray-800 bg-gray-50/60 dark:bg-gray-800/40">
                <th className="text-left px-4 py-3 font-semibold text-gray-500 dark:text-gray-400 whitespace-nowrap">
                  Order ID
                </th>
                <th className="text-left px-4 py-3 font-semibold text-gray-500 dark:text-gray-400 whitespace-nowrap">
                  Date
                </th>
                <th className="text-left px-4 py-3 font-semibold text-gray-500 dark:text-gray-400 whitespace-nowrap">
                  Client
                </th>
                <th className="text-left px-4 py-3 font-semibold text-gray-500 dark:text-gray-400 whitespace-nowrap">
                  Item Code
                </th>
                <th className="text-right px-4 py-3 font-semibold text-gray-500 dark:text-gray-400 whitespace-nowrap">
                  Qty
                </th>
                <th className="text-center px-4 py-3 font-semibold text-gray-500 dark:text-gray-400 whitespace-nowrap">
                  Status
                </th>
                <th className="text-center px-4 py-3 font-semibold text-gray-500 dark:text-gray-400 whitespace-nowrap">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="text-center py-16">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto text-blue-500" />
                    <p className="mt-2 text-gray-400 text-sm">
                      Loading orders…
                    </p>
                  </td>
                </tr>
              ) : orders.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-16">
                    <ClipboardList className="w-10 h-10 mx-auto text-gray-300 dark:text-gray-600" />
                    <p className="mt-2 text-gray-400 text-sm">
                      No orders found
                    </p>
                  </td>
                </tr>
              ) : (
                orders.map((order) => (
                  <tr
                    key={order.orderId}
                    className="border-b border-gray-50 dark:border-gray-800/60 hover:bg-gray-50/50 dark:hover:bg-gray-800/30 transition-colors"
                  >
                    <td className="px-4 py-3 font-mono text-xs font-semibold text-blue-600 dark:text-blue-400">
                      {order.orderId}
                    </td>
                    <td className="px-4 py-3 text-gray-500 dark:text-gray-400">
                      {formatDate(order.date)}
                    </td>
                    <td className="px-4 py-3 font-medium">
                      {order.clientName}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs">
                      {order.itemCode}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums font-semibold">
                      {order.quantity.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span
                        className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold ${STATUS_COLORS[order.status] ?? "bg-gray-100 text-gray-600"}`}
                      >
                        {order.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => openLifecycle(order.orderId)}
                          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 transition"
                          title="View Lifecycle"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          Lifecycle
                        </button>

                        {order.status !== "Completed" && (
                          <div className="relative">
                            <select
                              value={order.status}
                              onChange={(e) =>
                                handleStatusChange(
                                  order.orderId,
                                  e.target.value,
                                )
                              }
                              className="appearance-none pl-2 pr-6 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/40 cursor-pointer"
                            >
                              {STATUS_OPTIONS.filter((s) => s !== "All").map(
                                (s) => (
                                  <option key={s} value={s}>
                                    {s}
                                  </option>
                                ),
                              )}
                            </select>
                            <ChevronDown className="absolute right-1.5 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400 pointer-events-none" />
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* New Order Modal */}
      {showNewModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => setShowNewModal(false)}
          />
          <div className="relative bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 w-full max-w-lg p-6 animate-fade-in">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-bold">New Order</h3>
              <button
                onClick={() => setShowNewModal(false)}
                className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleNewOrder} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">
                    Date
                  </label>
                  <input
                    required
                    type="date"
                    value={formData.date}
                    onChange={(e) =>
                      setFormData({ ...formData, date: e.target.value })
                    }
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">
                    Client Name
                  </label>
                  <input
                    required
                    value={formData.clientName}
                    onChange={(e) =>
                      setFormData({ ...formData, clientName: e.target.value })
                    }
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                    placeholder="Rajesh Fabrics"
                  />
                </div>
              </div>

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
                    placeholder="3MM-SATIN"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">
                    Quantity
                  </label>
                  <input
                    required
                    type="number"
                    value={formData.quantity}
                    onChange={(e) =>
                      setFormData({ ...formData, quantity: e.target.value })
                    }
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                    placeholder="200"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">
                    Status
                  </label>
                  <div className="relative">
                    <select
                      value={formData.status}
                      onChange={(e) =>
                        setFormData({ ...formData, status: e.target.value })
                      }
                      className="appearance-none w-full px-3 pr-8 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40 cursor-pointer"
                    >
                      <option value="Pending">Pending</option>
                      <option value="In Production">In Production</option>
                      <option value="Completed">Completed</option>
                    </select>
                    <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">
                    Remarks
                  </label>
                  <input
                    value={formData.remarks}
                    onChange={(e) =>
                      setFormData({ ...formData, remarks: e.target.value })
                    }
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                    placeholder="Optional"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowNewModal(false)}
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
                  {submitting ? "Creating…" : "Create Order"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Lifecycle Modal */}
      {lifecycleModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => setLifecycleModal(null)}
          />
          <div className="relative bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 w-full max-w-md p-6 animate-fade-in">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-lg font-bold">Order Lifecycle</h3>
                <p className="text-xs text-gray-400 font-mono mt-0.5">
                  {lifecycleModal}
                </p>
              </div>
              <button
                onClick={() => setLifecycleModal(null)}
                className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {lifecycleLoading ? (
              <div className="flex flex-col items-center py-10">
                <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
                <p className="mt-2 text-gray-400 text-sm">
                  Loading lifecycle…
                </p>
              </div>
            ) : (
              <div className="relative pl-4">
                {lifecycleSteps.map((step, idx) => {
                  const isLast = idx === lifecycleSteps.length - 1;
                  const isCompleted = step.status === "completed";
                  const isCurrent = step.status === "current";

                  return (
                    <div key={step.step} className="flex gap-4 pb-8 last:pb-0">
                      {/* Vertical line + dot */}
                      <div className="relative flex flex-col items-center">
                        <div
                          className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${
                            isCompleted
                              ? "bg-green-100 text-green-600 dark:bg-green-900/40 dark:text-green-400"
                              : isCurrent
                                ? "bg-blue-100 text-blue-600 dark:bg-blue-900/40 dark:text-blue-400 ring-2 ring-blue-400/50"
                                : "bg-gray-100 text-gray-400 dark:bg-gray-800 dark:text-gray-500"
                          }`}
                        >
                          {isCompleted ? (
                            <CheckCircle2 className="w-5 h-5" />
                          ) : (
                            STEP_ICONS[step.step] ?? (
                              <Circle className="w-5 h-5" />
                            )
                          )}
                        </div>
                        {!isLast && (
                          <div
                            className={`w-0.5 flex-1 mt-1 ${
                              isCompleted
                                ? "bg-green-300 dark:bg-green-700"
                                : "bg-gray-200 dark:bg-gray-700"
                            }`}
                          />
                        )}
                      </div>

                      {/* Content */}
                      <div className="pt-1.5 min-w-0">
                        <p
                          className={`text-sm font-semibold ${
                            isCompleted
                              ? "text-green-700 dark:text-green-400"
                              : isCurrent
                                ? "text-blue-700 dark:text-blue-400"
                                : "text-gray-400 dark:text-gray-500"
                          }`}
                        >
                          {step.step}
                        </p>
                        {step.date && (
                          <p className="text-xs text-gray-400 mt-0.5">
                            {formatDate(step.date)}
                          </p>
                        )}
                        <p className="text-xs text-gray-400 mt-0.5 capitalize">
                          {step.status === "current"
                            ? "In progress"
                            : step.status}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
