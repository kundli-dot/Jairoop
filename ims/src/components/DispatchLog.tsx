"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Search,
  Plus,
  X,
  Loader2,
  Printer,
  Truck,
  Package,
  FileText,
} from "lucide-react";

interface Dispatch {
  dispatchId: string;
  orderId: string;
  clientName: string;
  itemCode: string;
  dispatchedQty: number;
  dispatchDate: string;
  challanNo: string;
  vehicleNo: string;
  transportName: string;
}

interface DispatchLogProps {
  refreshKey: number;
  onRefresh: () => void;
}

export default function DispatchLog({ refreshKey, onRefresh }: DispatchLogProps) {
  const [dispatches, setDispatches] = useState<Dispatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [form, setForm] = useState({
    orderId: "",
    clientName: "",
    itemCode: "",
    dispatchedQty: "",
    dispatchDate: new Date().toISOString().split("T")[0],
    challanNo: "",
    vehicleNo: "",
    transportName: "",
    markCompleted: false,
  });

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("search", search);
      const res = await fetch(`/api/dispatch?${params}`);
      const data = await res.json();
      setDispatches(data.dispatches ?? []);
    } catch {
      setDispatches([]);
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    fetchData();
  }, [fetchData, refreshKey]);

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      await fetch("/api/dispatch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      setShowModal(false);
      setForm({
        orderId: "",
        clientName: "",
        itemCode: "",
        dispatchedQty: "",
        dispatchDate: new Date().toISOString().split("T")[0],
        challanNo: "",
        vehicleNo: "",
        transportName: "",
        markCompleted: false,
      });
      onRefresh();
    } catch {
      /* handled silently */
    } finally {
      setSubmitting(false);
    }
  };

  const handlePrintChallan = (d: Dispatch) => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;
    printWindow.document.write(`
      <html>
      <head><title>Challan - ${d.challanNo || d.dispatchId}</title>
      <style>
        body { font-family: 'Inter', Arial, sans-serif; padding: 40px; color: #1a1a1a; }
        h1 { font-size: 22px; margin-bottom: 4px; }
        .sub { color: #666; font-size: 13px; margin-bottom: 24px; }
        table { width: 100%; border-collapse: collapse; margin-top: 16px; }
        th, td { border: 1px solid #ddd; padding: 10px 14px; text-align: left; font-size: 14px; }
        th { background: #f5f5f5; font-weight: 600; }
        .footer { margin-top: 40px; font-size: 12px; color: #999; }
      </style></head>
      <body>
        <h1>Delivery Challan</h1>
        <p class="sub">Jai Roop Textiles — IMS</p>
        <table>
          <tr><th>Dispatch ID</th><td>${d.dispatchId}</td></tr>
          <tr><th>Order ID</th><td>${d.orderId}</td></tr>
          <tr><th>Client</th><td>${d.clientName}</td></tr>
          <tr><th>Item Code</th><td>${d.itemCode}</td></tr>
          <tr><th>Quantity (Mtr)</th><td>${d.dispatchedQty.toLocaleString("en-IN")}</td></tr>
          <tr><th>Dispatch Date</th><td>${new Date(d.dispatchDate).toLocaleDateString("en-IN")}</td></tr>
          <tr><th>Challan No</th><td>${d.challanNo || "—"}</td></tr>
          <tr><th>Vehicle No</th><td>${d.vehicleNo || "—"}</td></tr>
          <tr><th>Transport</th><td>${d.transportName || "—"}</td></tr>
        </table>
        <p class="footer">Printed on ${new Date().toLocaleString("en-IN")}</p>
        <script>window.print();</script>
      </body></html>
    `);
    printWindow.document.close();
  };

  const totalVolume = dispatches.reduce((sum, d) => sum + d.dispatchedQty, 0);

  return (
    <div className="space-y-5">
      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search dispatches, orders, clients…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border border-gray-200 bg-white py-2 pl-10 pr-4 text-sm outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100 dark:border-gray-700 dark:bg-gray-800 dark:focus:border-blue-500 dark:focus:ring-blue-900"
          />
        </div>

        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-blue-700"
        >
          <Plus className="h-4 w-4" />
          Log Dispatch
        </button>
      </div>

      {/* Summary Bar */}
      <div className="grid grid-cols-2 gap-4">
        <div className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-900/40">
            <Package className="h-5 w-5 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Total Volume Dispatched</p>
            <p className="text-xl font-bold text-gray-900 dark:text-white">{totalVolume.toLocaleString("en-IN")} Mtr</p>
          </div>
        </div>
        <div className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-100 dark:bg-emerald-900/40">
            <FileText className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div>
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Dispatch Records</p>
            <p className="text-xl font-bold text-gray-900 dark:text-white">{dispatches.length}</p>
          </div>
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:border-gray-700 dark:bg-gray-800/80 dark:text-gray-400">
                <th className="px-4 py-3">Dispatch ID</th>
                <th className="px-4 py-3">Order ID</th>
                <th className="px-4 py-3">Client</th>
                <th className="px-4 py-3">Item Code</th>
                <th className="px-4 py-3 text-right">Qty (Mtr)</th>
                <th className="px-4 py-3">Dispatch Date</th>
                <th className="px-4 py-3">Challan No</th>
                <th className="px-4 py-3">Vehicle No</th>
                <th className="px-4 py-3 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {dispatches.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-12 text-center text-gray-400">
                    No dispatch records found.
                  </td>
                </tr>
              ) : (
                dispatches.map((d) => (
                  <tr key={d.dispatchId} className="transition hover:bg-gray-50 dark:hover:bg-gray-700/40">
                    <td className="whitespace-nowrap px-4 py-3 font-mono text-xs font-medium text-gray-800 dark:text-gray-200">
                      {d.dispatchId}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-gray-600 dark:text-gray-400">
                      {d.orderId}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 font-medium text-gray-800 dark:text-gray-200">
                      {d.clientName}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-gray-600 dark:text-gray-300">
                      {d.itemCode}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums font-medium text-gray-700 dark:text-gray-300">
                      {d.dispatchedQty.toLocaleString("en-IN")}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-gray-600 dark:text-gray-300">
                      {new Date(d.dispatchDate).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-gray-600 dark:text-gray-300">
                      {d.challanNo || "—"}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-gray-600 dark:text-gray-300">
                      {d.vehicleNo || "—"}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-center">
                      <button
                        onClick={() => handlePrintChallan(d)}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 transition hover:bg-gray-50 hover:text-gray-900 dark:border-gray-600 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-gray-200"
                      >
                        <Printer className="h-3.5 w-3.5" />
                        Print Challan
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl dark:bg-gray-800">
            <div className="mb-5 flex items-center justify-between">
              <h3 className="flex items-center gap-2 text-lg font-semibold text-gray-900 dark:text-white">
                <Truck className="h-5 w-5 text-blue-500" />
                Log Dispatch
              </h3>
              <button onClick={() => setShowModal(false)} className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-700">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-4">
              {[
                { label: "Order ID", key: "orderId", type: "text", placeholder: "ORD-..." },
                { label: "Client Name", key: "clientName", type: "text", placeholder: "Client name" },
                { label: "Item Code", key: "itemCode", type: "text", placeholder: "3MM-SATIN" },
                { label: "Dispatched Qty (Mtr)", key: "dispatchedQty", type: "number", placeholder: "0" },
                { label: "Dispatch Date", key: "dispatchDate", type: "date" },
                { label: "Challan No", key: "challanNo", type: "text", placeholder: "CH-001" },
                { label: "Vehicle No", key: "vehicleNo", type: "text", placeholder: "MH-04-XX-1234" },
                { label: "Transport Name", key: "transportName", type: "text", placeholder: "Transport Co." },
              ].map(({ label, key, type, placeholder }) => (
                <div key={key}>
                  <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">{label}</label>
                  <input
                    type={type}
                    value={form[key as keyof typeof form] as string}
                    onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                    placeholder={placeholder}
                    className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100 dark:border-gray-600 dark:bg-gray-700 dark:focus:border-blue-500 dark:focus:ring-blue-900"
                  />
                </div>
              ))}

              <div className="col-span-2 flex items-center gap-2">
                <input
                  type="checkbox"
                  id="markCompleted"
                  checked={form.markCompleted}
                  onChange={(e) => setForm({ ...form, markCompleted: e.target.checked })}
                  className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <label htmlFor="markCompleted" className="text-sm text-gray-600 dark:text-gray-400">
                  Mark order as completed
                </label>
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => setShowModal(false)}
                className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 transition hover:bg-gray-50 dark:border-gray-600 dark:text-gray-400 dark:hover:bg-gray-700"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={submitting}
                className="flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-blue-700 disabled:opacity-50"
              >
                {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                Log Dispatch
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
