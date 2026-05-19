import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const [items, orders, jobWorks, dispatches] = await Promise.all([
      prisma.inventoryItem.findMany(),
      prisma.order.findMany(),
      prisma.jobWork.findMany(),
      prisma.dispatch.findMany(),
    ]);

    const reorderItems = items.filter(i => i.closingBalance <= i.minStockLevel);
    const activeOrders = orders.filter(o => o.status === "In Production");
    const pendingOrders = orders.filter(o => o.status === "Pending");
    const completedOrders = orders.filter(o => o.status === "Completed");
    const jwOut = jobWorks.filter(j => j.status === "Out");

    const totalDispatched = dispatches.reduce((sum, d) => sum + d.dispatchedQty, 0);

    let totalSent = 0, totalWastage = 0;
    jobWorks.forEach(j => {
      totalSent += j.sentQty;
      totalWastage += j.wastageMtr;
    });
    const avgWastagePct = totalSent > 0 ? +(totalWastage / totalSent * 100).toFixed(2) : 0;

    const categoryMap: Record<string, { count: number; totalStock: number }> = {};
    items.forEach(item => {
      if (!categoryMap[item.category]) categoryMap[item.category] = { count: 0, totalStock: 0 };
      categoryMap[item.category].count++;
      categoryMap[item.category].totalStock += item.closingBalance;
    });

    const topItems = items
      .filter(i => i.closingBalance > 0)
      .sort((a, b) => b.closingBalance - a.closingBalance)
      .slice(0, 5)
      .map(i => ({ code: i.itemCode, name: i.itemName, balance: i.closingBalance }));

    const monthlyDispatch: Record<string, number> = {};
    dispatches.forEach(d => {
      if (d.dispatchDate) {
        const month = d.dispatchDate.substring(0, 7);
        monthlyDispatch[month] = (monthlyDispatch[month] || 0) + d.dispatchedQty;
      }
    });

    const totalOrderValue = orders.reduce((sum, o) => sum + o.quantity, 0);
    const fulfilmentRate = orders.length > 0 ? +((completedOrders.length / orders.length) * 100).toFixed(1) : 0;

    const allocatedMap: Record<string, number> = {};
    orders.filter(o => o.status === "In Production" || o.status === "Pending")
      .forEach(o => {
        allocatedMap[o.itemCode] = (allocatedMap[o.itemCode] || 0) + o.quantity;
      });

    return NextResponse.json({
      kpis: {
        reorderCount: reorderItems.length,
        reorderItems: reorderItems.map(i => i.itemCode),
        activeOrderCount: activeOrders.length,
        pendingOrderCount: pendingOrders.length,
        completedOrderCount: completedOrders.length,
        totalOrderCount: orders.length,
        fulfilmentRate,
        jwLiveCount: jwOut.length,
        totalDispatched,
        avgWastagePct,
        totalItems: items.length,
        totalOrderValue,
        categoryBreakdown: categoryMap,
        topItems,
        monthlyDispatch,
      },
    });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
