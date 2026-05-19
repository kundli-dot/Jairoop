"use client";

import { useState, useEffect, useCallback } from "react";
import Sidebar from "@/components/Sidebar";
import Header from "@/components/Header";
import Dashboard from "@/components/Dashboard";
import Inventory from "@/components/Inventory";
import OrderBook from "@/components/OrderBook";
import JobWorkTracker from "@/components/JobWorkTracker";
import DispatchLog from "@/components/DispatchLog";
import ClientPortfolios from "@/components/ClientPortfolios";
import StockAlerts from "@/components/StockAlerts";
import Loader from "@/components/Loader";

export type TabId = "dashboard" | "inventory" | "orderbook" | "jobwork" | "dispatch" | "clients" | "alerts";

const TAB_TITLES: Record<TabId, [string, string]> = {
  dashboard: ["Dashboard Overview", "Live KPIs & Analytics"],
  inventory: ["Stock / Inventory", "Manage fabric stock levels"],
  orderbook: ["Order Book", "Track & manage all orders"],
  jobwork: ["Job Work Tracker", "Monitor production & workers"],
  dispatch: ["Dispatch Log", "Track shipments & challans"],
  clients: ["Client Portfolios", "Client-wise order history"],
  alerts: ["Stock Alerts", "Reorder & allocation warnings"],
};

export default function Home() {
  const [currentTab, setCurrentTab] = useState<TabId>("dashboard");
  const [dark, setDark] = useState(false);
  const [loading, setLoading] = useState(true);
  const [lastSync, setLastSync] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    const timer = setTimeout(() => setLoading(false), 1400);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (dark) document.documentElement.classList.add("dark");
    else document.documentElement.classList.remove("dark");
  }, [dark]);

  const triggerRefresh = useCallback(() => {
    setRefreshKey(k => k + 1);
    setLastSync(new Date().toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }));
  }, []);

  useEffect(() => {
    triggerRefresh();
  }, [triggerRefresh]);

  if (loading) return <Loader />;

  return (
    <div className={`flex h-screen overflow-hidden bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100 transition-colors`}>
      <Sidebar currentTab={currentTab} onTabChange={(tab) => setCurrentTab(tab as TabId)} lastSync={lastSync} />
      <main className="flex-1 flex flex-col overflow-hidden">
        <Header
          title={TAB_TITLES[currentTab][0]}
          subtitle={TAB_TITLES[currentTab][1]}
          dark={dark}
          onToggleDark={() => setDark(!dark)}
          onRefresh={triggerRefresh}
        />
        <div className="flex-1 overflow-y-auto p-6 animate-fade-in" key={currentTab}>
          {currentTab === "dashboard" && <Dashboard refreshKey={refreshKey} />}
          {currentTab === "inventory" && <Inventory refreshKey={refreshKey} onRefresh={triggerRefresh} />}
          {currentTab === "orderbook" && <OrderBook refreshKey={refreshKey} onRefresh={triggerRefresh} />}
          {currentTab === "jobwork" && <JobWorkTracker refreshKey={refreshKey} onRefresh={triggerRefresh} />}
          {currentTab === "dispatch" && <DispatchLog refreshKey={refreshKey} onRefresh={triggerRefresh} />}
          {currentTab === "clients" && <ClientPortfolios refreshKey={refreshKey} />}
          {currentTab === "alerts" && <StockAlerts refreshKey={refreshKey} />}
        </div>
      </main>
    </div>
  );
}
