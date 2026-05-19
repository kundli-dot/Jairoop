import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const items = await prisma.inventoryItem.findMany();
    const orders = await prisma.order.findMany({
      where: { status: { in: ["In Production", "Pending"] } },
    });

    const allocatedMap: Record<string, number> = {};
    orders.forEach(o => {
      allocatedMap[o.itemCode] = (allocatedMap[o.itemCode] || 0) + o.quantity;
    });

    type Alert = {
      type: string;
      itemCode: string;
      itemName: string;
      balance: number;
      allocated: number;
      minLevel: number;
      message: string;
    };

    const alerts: Alert[] = [];
    items.forEach(item => {
      const allocated = allocatedMap[item.itemCode] || 0;
      if (item.closingBalance <= item.minStockLevel) {
        alerts.push({
          type: "critical",
          itemCode: item.itemCode,
          itemName: item.itemName,
          balance: item.closingBalance,
          allocated,
          minLevel: item.minStockLevel,
          message: "Stock at critical level — immediate reorder required!",
        });
      } else if (item.closingBalance > 0 && allocated / item.closingBalance > 0.8) {
        alerts.push({
          type: "warning",
          itemCode: item.itemCode,
          itemName: item.itemName,
          balance: item.closingBalance,
          allocated,
          minLevel: item.minStockLevel,
          message: "Over 80% of stock allocated to active orders",
        });
      } else if (item.closingBalance <= item.minStockLevel * 1.5) {
        alerts.push({
          type: "info",
          itemCode: item.itemCode,
          itemName: item.itemName,
          balance: item.closingBalance,
          allocated,
          minLevel: item.minStockLevel,
          message: "Stock approaching reorder level — consider restocking",
        });
      }
    });

    alerts.sort((a, b) => {
      const priority: Record<string, number> = { critical: 0, warning: 1, info: 2 };
      return (priority[a.type] ?? 3) - (priority[b.type] ?? 3);
    });

    return NextResponse.json({ alerts });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
