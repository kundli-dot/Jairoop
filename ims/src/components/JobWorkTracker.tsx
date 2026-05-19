"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Search,
  Plus,
  X,
  Loader2,
  Info,
  Wrench,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";

interface JobWork {
  jobId: string;
  date: string;
  orderId: string;
  workerName: string;
  itemCode: string;
  sentQty: number;
  receivedQty: number;
  wastageMtr: number;
  status: string;
  totalPayment: number;
  ratePerMtr: number;
}

interface JobWorkTrackerProps {
  refreshKey: number;
  onRefresh: () => void;
}

const STATUSES = ["All", "Out", "Completed"] as const;

export default function JobWorkTracker({ refreshKey, onRefresh }: JobWorkTrackerProps) {
  const [jobWorks, setJobWorks] = useState<JobWork[]>([]);
  const [workers, setWorkers] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("All");
  const [showModal, setShowModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [form, setForm] = useState({
    date: new Date().toISOString().split("T")[0],
    orderId: "",
    workerName: "",
    itemCode: "",
    sentQty: "",
    receivedQty: "",
    wastageMtr: "",
    ratePerMtr: "0.25",
    status: "Out",
  });

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("search", search);
      if (statusFilter !== "All") params.set("status", statusFilter);
      const res = await fetch(`/api/jobwork?${params}`);
      const data = await res.json();
      setJobWorks(data.jobWorks ?? []);
      setWorkers(data.workers ?? []);
    } catch {
      setJobWorks([]);
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter]);

  useEffect(() => {
    fetchData();
  }, [fetchData, refreshKey]);

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      await fetch("/api/jobwork", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      setShowModal(false);
      setForm({
        date: new Date().toISOString().split("T")[0],
        orderId: "",
        workerName: "",
        itemCode: "",
        sentQty: "",
        receivedQty: "",
        wastageMtr: "",
        ratePerMtr: "0.25",
        status: "Out",
      });
      onRefresh();
    } catch {
      /* handled silently */
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Info Banner */}
      <div className="flex items-center gap-3 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800 dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-300">
        <Info className="h-4 w-4 shrink-0" />
        <span>
          <strong>Active Rules:</strong> Payment @ ₹0.25/Mtr | Wastage above 4.0% flagged critical
        </span>
      </div>

      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search jobs, workers, orders…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border border-gray-200 bg-white py-2 pl-10 pr-4 text-sm outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100 dark:border-gray-700 dark:bg-gray-800 dark:focus:border-blue-500 dark:focus:ring-blue-900"
          />
        </div>

        <div className="flex gap-1 rounded-lg border border-gray-200 bg-white p-0.5 dark:border-gray-700 dark:bg-gray-800">
          {STATUSES.map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition ${
                statusFilter === s
                  ? "bg-blue-600 text-white shadow-sm"
                  : "text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700"
              }`}
            >
              {s}
            </button>
          ))}
        </div>

        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-blue-700"
        >
          <Plus className="h-4 w-4" />
          Add Job Work
        </button>
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
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Job ID</th>
                <th className="px-4 py-3">Order ID</th>
                <th className="px-4 py-3">Worker</th>
                <th className="px-4 py-3">Item Code</th>
                <th className="px-4 py-3 text-right">Sent Mtr</th>
                <th className="px-4 py-3 text-right">Received</th>
                <th className="px-4 py-3 text-right">Balance</th>
                <th className="px-4 py-3 text-right">Wastage Mtr</th>
                <th className="px-4 py-3 text-right">Wastage %</th>
                <th className="px-4 py-3 text-right">Payment (₹)</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {jobWorks.length === 0 ? (
                <tr>
                  <td colSpan={12} className="px-4 py-12 text-center text-gray-400">
                    No job work records found.
                  </td>
                </tr>
              ) : (
                jobWorks.map((jw) => {
                  const balance = jw.sentQty - jw.receivedQty;
                  const wastagePercent = jw.sentQty > 0 ? (jw.wastageMtr / jw.sentQty) * 100 : 0;
                  const isWastageCritical = wastagePercent > 4;

                  return (
                    <tr key={jw.jobId} className="transition hover:bg-gray-50 dark:hover:bg-gray-700/40">
                      <td className="whitespace-nowrap px-4 py-3 text-gray-600 dark:text-gray-300">
                        {new Date(jw.date).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 font-mono text-xs font-medium text-gray-800 dark:text-gray-200">
                        {jw.jobId}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-gray-600 dark:text-gray-400">
                        {jw.orderId}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 font-medium text-gray-800 dark:text-gray-200">
                        {jw.workerName}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-gray-600 dark:text-gray-300">
                        {jw.itemCode}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums text-gray-700 dark:text-gray-300">
                        {jw.sentQty.toLocaleString("en-IN")}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums text-gray-700 dark:text-gray-300">
                        {jw.receivedQty.toLocaleString("en-IN")}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-right">
                        {balance === 0 ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-semibold text-green-700 dark:bg-green-900/40 dark:text-green-400">
                            <CheckCircle2 className="h-3 w-3" />
                            Done
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-700 dark:bg-amber-900/40 dark:text-amber-400">
                            {balance.toLocaleString("en-IN")}
                          </span>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums text-gray-700 dark:text-gray-300">
                        {jw.wastageMtr}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-right">
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                            isWastageCritical
                              ? "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400"
                              : "text-gray-600 dark:text-gray-400"
                          }`}
                        >
                          {isWastageCritical && <AlertTriangle className="h-3 w-3" />}
                          {wastagePercent.toFixed(1)}%
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums font-medium text-gray-700 dark:text-gray-300">
                        ₹{jw.totalPayment.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3">
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${
                            jw.status === "Completed"
                              ? "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400"
                              : "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400"
                          }`}
                        >
                          {jw.status === "Completed" ? (
                            <CheckCircle2 className="h-3 w-3" />
                          ) : (
                            <Wrench className="h-3 w-3" />
                          )}
                          {jw.status}
                        </span>
                      </td>
                    </tr>
                  );
                })
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
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Add Job Work</h3>
              <button onClick={() => setShowModal(false)} className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-700">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-4">
              {[
                { label: "Date", key: "date", type: "date" },
                { label: "Order ID", key: "orderId", type: "text", placeholder: "ORD-..." },
                { label: "Worker Name", key: "workerName", type: "text", placeholder: "Worker name" },
                { label: "Item Code", key: "itemCode", type: "text", placeholder: "3MM-SATIN" },
                { label: "Sent Qty (Mtr)", key: "sentQty", type: "number", placeholder: "0" },
                { label: "Received Qty (Mtr)", key: "receivedQty", type: "number", placeholder: "0" },
                { label: "Wastage (Mtr)", key: "wastageMtr", type: "number", placeholder: "0" },
                { label: "Rate per Mtr (₹)", key: "ratePerMtr", type: "number", placeholder: "0.25" },
              ].map(({ label, key, type, placeholder }) => (
                <div key={key}>
                  <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">{label}</label>
                  <input
                    type={type}
                    value={form[key as keyof typeof form]}
                    onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                    placeholder={placeholder}
                    className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100 dark:border-gray-600 dark:bg-gray-700 dark:focus:border-blue-500 dark:focus:ring-blue-900"
                  />
                </div>
              ))}

              <div className="col-span-2">
                <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">Status</label>
                <select
                  value={form.status}
                  onChange={(e) => setForm({ ...form, status: e.target.value })}
                  className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100 dark:border-gray-600 dark:bg-gray-700 dark:focus:border-blue-500 dark:focus:ring-blue-900"
                >
                  <option value="Out">Out</option>
                  <option value="Completed">Completed</option>
                </select>
              </div>

              {workers.length > 0 && (
                <div className="col-span-2">
                  <p className="mb-1 text-xs text-gray-400">Known workers: {workers.join(", ")}</p>
                </div>
              )}
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
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
