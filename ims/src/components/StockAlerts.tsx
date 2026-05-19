"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Loader2,
  AlertTriangle,
  AlertCircle,
  Info,
  Bell,
  Package,
} from "lucide-react";

interface Alert {
  type: string;
  itemCode: string;
  itemName: string;
  balance: number;
  allocated: number;
  minLevel: number;
  message: string;
}

interface StockAlertsProps {
  refreshKey: number;
}

const ALERT_STYLES: Record<string, { bg: string; border: string; icon: typeof AlertTriangle; iconColor: string; badge: string }> = {
  critical: {
    bg: "bg-red-50 dark:bg-red-950/40",
    border: "border-red-200 dark:border-red-800",
    icon: AlertTriangle,
    iconColor: "text-red-600 dark:text-red-400",
    badge: "bg-red-100 text-red-700 dark:bg-red-900/60 dark:text-red-300",
  },
  warning: {
    bg: "bg-amber-50 dark:bg-amber-950/40",
    border: "border-amber-200 dark:border-amber-800",
    icon: AlertCircle,
    iconColor: "text-amber-600 dark:text-amber-400",
    badge: "bg-amber-100 text-amber-700 dark:bg-amber-900/60 dark:text-amber-300",
  },
  info: {
    bg: "bg-blue-50 dark:bg-blue-950/40",
    border: "border-blue-200 dark:border-blue-800",
    icon: Info,
    iconColor: "text-blue-600 dark:text-blue-400",
    badge: "bg-blue-100 text-blue-700 dark:bg-blue-900/60 dark:text-blue-300",
  },
};

export default function StockAlerts({ refreshKey }: StockAlertsProps) {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAlerts = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/alerts");
      const data = await res.json();
      setAlerts(data.alerts ?? []);
    } catch {
      setAlerts([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAlerts();
  }, [fetchAlerts, refreshKey]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Alert Count Header */}
      <div className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800">
        <div className={`flex h-11 w-11 items-center justify-center rounded-lg ${
          alerts.length > 0
            ? "bg-red-100 dark:bg-red-900/40"
            : "bg-green-100 dark:bg-green-900/40"
        }`}>
          <Bell className={`h-5 w-5 ${
            alerts.length > 0
              ? "text-red-600 dark:text-red-400"
              : "text-green-600 dark:text-green-400"
          }`} />
        </div>
        <div>
          <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Active Alerts</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{alerts.length}</p>
        </div>
        {alerts.length > 0 && (
          <div className="ml-auto flex gap-2">
            {["critical", "warning", "info"].map((type) => {
              const count = alerts.filter((a) => a.type === type).length;
              if (count === 0) return null;
              const style = ALERT_STYLES[type];
              return (
                <span key={type} className={`rounded-full px-3 py-1 text-xs font-semibold ${style.badge}`}>
                  {count} {type}
                </span>
              );
            })}
          </div>
        )}
      </div>

      {alerts.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-gray-200 py-20 text-center dark:border-gray-700">
          <Package className="mb-3 h-10 w-10 text-green-300 dark:text-green-700" />
          <p className="text-sm font-medium text-gray-500 dark:text-gray-400">All stock levels are healthy</p>
          <p className="text-xs text-gray-400 dark:text-gray-500">No alerts at this time</p>
        </div>
      ) : (
        <div className="space-y-3">
          {alerts.map((alert, idx) => {
            const style = ALERT_STYLES[alert.type] ?? ALERT_STYLES.info;
            const Icon = style.icon;

            return (
              <div
                key={`${alert.itemCode}-${idx}`}
                className={`rounded-xl border p-5 ${style.bg} ${style.border} transition hover:shadow-md`}
              >
                <div className="flex items-start gap-4">
                  <div className="mt-0.5 shrink-0">
                    <Icon className={`h-5 w-5 ${style.iconColor}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="mb-1 flex items-center gap-2">
                      <span className="font-mono text-sm font-bold text-gray-900 dark:text-white">
                        {alert.itemCode}
                      </span>
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${style.badge}`}>
                        {alert.type}
                      </span>
                    </div>
                    <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      {alert.itemName}
                    </p>
                    <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                      {alert.message}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-4 text-xs">
                      <div>
                        <span className="text-gray-500 dark:text-gray-400">Balance: </span>
                        <span className="font-semibold text-gray-800 dark:text-gray-200">
                          {alert.balance.toLocaleString("en-IN")} Mtr
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-500 dark:text-gray-400">Allocated: </span>
                        <span className="font-semibold text-gray-800 dark:text-gray-200">
                          {alert.allocated.toLocaleString("en-IN")} Mtr
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-500 dark:text-gray-400">Min Level: </span>
                        <span className="font-semibold text-gray-800 dark:text-gray-200">
                          {alert.minLevel.toLocaleString("en-IN")} Mtr
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
