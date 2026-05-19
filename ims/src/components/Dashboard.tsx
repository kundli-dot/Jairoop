"use client";

import { useEffect, useState, useCallback } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
} from "recharts";

interface TopItem {
  code: string;
  name: string;
  balance: number;
}

interface CategoryBreakdown {
  [category: string]: { count: number; totalStock: number };
}

interface MonthlyDispatch {
  [month: string]: number;
}

interface KPIs {
  reorderCount: number;
  reorderItems: string[];
  activeOrderCount: number;
  pendingOrderCount: number;
  completedOrderCount: number;
  totalOrderCount: number;
  fulfilmentRate: number;
  jwLiveCount: number;
  totalDispatched: number;
  avgWastagePct: number;
  totalItems: number;
  categoryBreakdown: CategoryBreakdown;
  topItems: TopItem[];
  monthlyDispatch: MonthlyDispatch;
}

interface DashboardResponse {
  kpis: KPIs;
}

const COLORS = {
  gold: "#c9a84c",
  blue: "#2563eb",
  green: "#059669",
  red: "#dc2626",
  amber: "#d97706",
  purple: "#7c3aed",
} as const;

const PIE_COLORS = [COLORS.green, COLORS.blue, COLORS.amber];

function KpiCard({
  title,
  value,
  subtitle,
  accent,
}: {
  title: string;
  value: string;
  subtitle?: string;
  accent: string;
}) {
  return (
    <div className="relative overflow-hidden rounded-xl border border-gray-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md dark:border-gray-700 dark:bg-gray-900">
      <div
        className="absolute left-0 top-0 h-full w-1"
        style={{ backgroundColor: accent }}
      />
      <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
        {title}
      </p>
      <p className="text-3xl font-bold text-gray-900 dark:text-white">
        {value}
      </p>
      {subtitle && (
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          {subtitle}
        </p>
      )}
    </div>
  );
}

function ChartCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-900">
      <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-gray-600 dark:text-gray-300">
        {title}
      </h3>
      <div className="h-64">{children}</div>
    </div>
  );
}

export default function Dashboard({ refreshKey }: { refreshKey: number }) {
  const [data, setData] = useState<KPIs | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/dashboard");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json: DashboardResponse = await res.json();
      setData(json.kpis);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load dashboard");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [refreshKey, fetchData]);

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-gray-300 border-t-[#c9a84c]" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex h-96 flex-col items-center justify-center gap-3 text-gray-500 dark:text-gray-400">
        <p className="text-lg font-medium">Unable to load dashboard</p>
        <p className="text-sm">{error}</p>
        <button
          onClick={fetchData}
          className="mt-2 rounded-lg bg-[#c9a84c] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#b8943f]"
        >
          Retry
        </button>
      </div>
    );
  }

  const categoryData = Object.entries(data.categoryBreakdown).map(
    ([name, { totalStock }]) => ({ name, stock: totalStock }),
  );

  const orderStatusData = [
    { name: "Completed", value: data.completedOrderCount },
    { name: "In Production", value: data.activeOrderCount },
    { name: "Pending", value: data.pendingOrderCount },
  ];

  const topItemsData = data.topItems.slice(0, 5).map((item) => ({
    name: item.code,
    balance: item.balance,
  }));

  const dispatchData = Object.entries(data.monthlyDispatch)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, volume]) => ({
      month: month.slice(5),
      volume,
    }));

  return (
    <div className="space-y-6">
      {/* Reorder Alert Banner */}
      {data.reorderCount > 0 && (
        <div className="rounded-xl bg-gradient-to-r from-red-600 to-red-500 px-5 py-4 text-white shadow-lg shadow-red-500/20">
          <div className="flex items-center gap-3">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/20 text-sm font-bold">
              {data.reorderCount}
            </span>
            <div>
              <p className="font-semibold">
                {data.reorderCount} item{data.reorderCount > 1 ? "s" : ""} below
                reorder level
              </p>
              <p className="mt-0.5 text-sm text-red-100">
                {data.reorderItems.join(" · ")}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid auto-rows-fr grid-cols-[repeat(auto-fit,minmax(160px,1fr))] gap-4">
        <KpiCard
          title="Critical Reorders"
          value={String(data.reorderCount)}
          accent={COLORS.red}
        />
        <KpiCard
          title="Active Production"
          value={String(data.activeOrderCount)}
          subtitle={`${data.pendingOrderCount} pending`}
          accent={COLORS.blue}
        />
        <KpiCard
          title="Live Job Batches"
          value={String(data.jwLiveCount)}
          accent={COLORS.amber}
        />
        <KpiCard
          title="Total Dispatched"
          value={`${data.totalDispatched.toLocaleString()} Mtr`}
          accent={COLORS.green}
        />
        <KpiCard
          title="Fulfilment Rate"
          value={`${data.fulfilmentRate}%`}
          accent={COLORS.gold}
        />
        <KpiCard
          title="Avg Wastage"
          value={`${data.avgWastagePct}%`}
          accent={COLORS.blue}
        />
      </div>

      {/* Charts */}
      <div className="grid gap-5 md:grid-cols-2">
        {/* Stock by Category */}
        <ChartCard title="Stock by Category">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={categoryData} barSize={32}>
              <XAxis
                dataKey="name"
                tick={{ fontSize: 12 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 12 }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                contentStyle={{
                  borderRadius: "8px",
                  border: "none",
                  boxShadow: "0 4px 12px rgba(0,0,0,.1)",
                }}
              />
              <Bar dataKey="stock" fill={COLORS.blue} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Order Status Split */}
        <ChartCard title="Order Status Split">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={orderStatusData}
                cx="50%"
                cy="50%"
                innerRadius={55}
                outerRadius={90}
                paddingAngle={4}
                dataKey="value"
                nameKey="name"
                label={({ name, percent }) =>
                  `${name} ${((percent ?? 0) * 100).toFixed(0)}%`
                }
              >
                {orderStatusData.map((_, idx) => (
                  <Cell key={idx} fill={PIE_COLORS[idx % PIE_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  borderRadius: "8px",
                  border: "none",
                  boxShadow: "0 4px 12px rgba(0,0,0,.1)",
                }}
              />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Top 5 Items by Closing Balance */}
        <ChartCard title="Top 5 Items by Closing Balance">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={topItemsData} layout="vertical" barSize={20}>
              <XAxis
                type="number"
                tick={{ fontSize: 12 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                type="category"
                dataKey="name"
                tick={{ fontSize: 11 }}
                width={90}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                contentStyle={{
                  borderRadius: "8px",
                  border: "none",
                  boxShadow: "0 4px 12px rgba(0,0,0,.1)",
                }}
              />
              <Bar
                dataKey="balance"
                fill={COLORS.purple}
                radius={[0, 4, 4, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Monthly Dispatch Volume */}
        <ChartCard title="Monthly Dispatch Volume">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={dispatchData}>
              <defs>
                <linearGradient id="dispatchGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={COLORS.green} stopOpacity={0.3} />
                  <stop
                    offset="100%"
                    stopColor={COLORS.green}
                    stopOpacity={0.02}
                  />
                </linearGradient>
              </defs>
              <XAxis
                dataKey="month"
                tick={{ fontSize: 12 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 12 }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                contentStyle={{
                  borderRadius: "8px",
                  border: "none",
                  boxShadow: "0 4px 12px rgba(0,0,0,.1)",
                }}
              />
              <Area
                type="monotone"
                dataKey="volume"
                stroke={COLORS.green}
                strokeWidth={2}
                fill="url(#dispatchGrad)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>
    </div>
  );
}
