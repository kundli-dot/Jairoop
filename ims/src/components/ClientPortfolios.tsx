"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Loader2,
  Users,
  ShoppingBag,
  Truck,
  ClipboardList,
  ChevronDown,
  CheckCircle2,
  Clock,
  AlertCircle,
} from "lucide-react";

interface Order {
  orderId: string;
  itemCode: string;
  quantity: number;
  status: string;
  date: string;
  clientName: string;
}

interface ClientData {
  name: string;
  orders: Order[];
  totalOrdered: number;
  totalDispatched: number;
  completedOrders: number;
  totalOrders: number;
}

interface ClientPortfoliosProps {
  refreshKey: number;
}

const STATUS_STYLES: Record<string, { bg: string; text: string; icon: typeof CheckCircle2 }> = {
  Completed: { bg: "bg-green-100 dark:bg-green-900/40", text: "text-green-700 dark:text-green-400", icon: CheckCircle2 },
  "In Production": { bg: "bg-blue-100 dark:bg-blue-900/40", text: "text-blue-700 dark:text-blue-400", icon: Clock },
  Pending: { bg: "bg-amber-100 dark:bg-amber-900/40", text: "text-amber-700 dark:text-amber-400", icon: AlertCircle },
};

export default function ClientPortfolios({ refreshKey }: ClientPortfoliosProps) {
  const [clients, setClients] = useState<string[]>([]);
  const [selectedClient, setSelectedClient] = useState("");
  const [clientData, setClientData] = useState<ClientData | null>(null);
  const [loadingClients, setLoadingClients] = useState(true);
  const [loadingData, setLoadingData] = useState(false);

  const fetchClients = useCallback(async () => {
    setLoadingClients(true);
    try {
      const res = await fetch("/api/clients");
      const data = await res.json();
      setClients(data.clients ?? []);
    } catch {
      setClients([]);
    } finally {
      setLoadingClients(false);
    }
  }, []);

  useEffect(() => {
    fetchClients();
  }, [fetchClients, refreshKey]);

  useEffect(() => {
    if (!selectedClient) {
      setClientData(null);
      return;
    }
    const fetchClientData = async () => {
      setLoadingData(true);
      try {
        const res = await fetch(`/api/clients?client=${encodeURIComponent(selectedClient)}`);
        const data = await res.json();
        setClientData(data.clientData ?? null);
      } catch {
        setClientData(null);
      } finally {
        setLoadingData(false);
      }
    };
    fetchClientData();
  }, [selectedClient, refreshKey]);

  if (loadingClients) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Client Selector */}
      <div className="flex items-center gap-4">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-violet-100 dark:bg-violet-900/40">
          <Users className="h-5 w-5 text-violet-600 dark:text-violet-400" />
        </div>
        <div className="relative flex-1 max-w-xs">
          <select
            value={selectedClient}
            onChange={(e) => setSelectedClient(e.target.value)}
            className="w-full appearance-none rounded-lg border border-gray-200 bg-white py-2.5 pl-4 pr-10 text-sm font-medium outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100 dark:border-gray-700 dark:bg-gray-800 dark:focus:border-blue-500 dark:focus:ring-blue-900"
          >
            <option value="">Select a client…</option>
            {clients.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        </div>
      </div>

      {!selectedClient && (
        <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-gray-200 py-20 text-center dark:border-gray-700">
          <Users className="mb-3 h-10 w-10 text-gray-300 dark:text-gray-600" />
          <p className="text-sm text-gray-400 dark:text-gray-500">Select a client to view their portfolio</p>
        </div>
      )}

      {loadingData && (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
        </div>
      )}

      {clientData && !loadingData && (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-3 gap-4">
            <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-800">
              <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-900/40">
                <ShoppingBag className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Total Ordered</p>
              <p className="mt-1 text-2xl font-bold text-gray-900 dark:text-white">
                {clientData.totalOrdered.toLocaleString("en-IN")} <span className="text-sm font-normal text-gray-400">Mtr</span>
              </p>
            </div>
            <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-800">
              <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-100 dark:bg-emerald-900/40">
                <Truck className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
              </div>
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Total Dispatched</p>
              <p className="mt-1 text-2xl font-bold text-gray-900 dark:text-white">
                {clientData.totalDispatched.toLocaleString("en-IN")} <span className="text-sm font-normal text-gray-400">Mtr</span>
              </p>
            </div>
            <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-800">
              <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-violet-100 dark:bg-violet-900/40">
                <ClipboardList className="h-5 w-5 text-violet-600 dark:text-violet-400" />
              </div>
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Orders</p>
              <p className="mt-1 text-2xl font-bold text-gray-900 dark:text-white">
                {clientData.totalOrders}
                <span className="ml-2 text-sm font-normal text-gray-400">
                  ({clientData.completedOrders} completed)
                </span>
              </p>
            </div>
          </div>

          {/* Order Cards Grid */}
          <div>
            <h3 className="mb-3 text-sm font-semibold text-gray-700 dark:text-gray-300">
              Orders ({clientData.orders.length})
            </h3>
            {clientData.orders.length === 0 ? (
              <p className="text-sm text-gray-400">No orders found for this client.</p>
            ) : (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {clientData.orders.map((order) => {
                  const style = STATUS_STYLES[order.status] ?? STATUS_STYLES["Pending"];
                  const Icon = style.icon;

                  return (
                    <div
                      key={order.orderId}
                      className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm transition hover:shadow-md dark:border-gray-700 dark:bg-gray-800"
                    >
                      <div className="mb-3 flex items-center justify-between">
                        <span className="font-mono text-xs font-medium text-gray-500 dark:text-gray-400">
                          {order.orderId}
                        </span>
                        <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${style.bg} ${style.text}`}>
                          <Icon className="h-3 w-3" />
                          {order.status}
                        </span>
                      </div>
                      <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">
                        {order.itemCode}
                      </p>
                      <div className="mt-2 flex items-center justify-between">
                        <span className="text-lg font-bold text-gray-900 dark:text-white">
                          {order.quantity.toLocaleString("en-IN")} <span className="text-xs font-normal text-gray-400">Mtr</span>
                        </span>
                        <span className="text-xs text-gray-400">
                          {new Date(order.date).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
