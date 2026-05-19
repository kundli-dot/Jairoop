import { prisma } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  try {
    const search = req.nextUrl.searchParams.get("search") || "";
    const category = req.nextUrl.searchParams.get("category") || "";
    const status = req.nextUrl.searchParams.get("status") || "";

    const where: Record<string, unknown> = {};
    if (search) {
      where.OR = [
        { itemCode: { contains: search } },
        { itemName: { contains: search } },
      ];
    }
    if (category) where.category = category;

    let items = await prisma.inventoryItem.findMany({
      where,
      orderBy: { itemCode: "asc" },
    });

    if (status === "REORDER") {
      items = items.filter(i => i.closingBalance <= i.minStockLevel);
    } else if (status === "LOW") {
      items = items.filter(i => i.closingBalance > i.minStockLevel && i.closingBalance <= i.minStockLevel * 1.5);
    } else if (status === "NORMAL") {
      items = items.filter(i => i.closingBalance > i.minStockLevel * 1.5);
    }

    const orders = await prisma.order.findMany({
      where: { status: { in: ["In Production", "Pending"] } },
    });
    const allocatedMap: Record<string, number> = {};
    orders.forEach(o => {
      allocatedMap[o.itemCode] = (allocatedMap[o.itemCode] || 0) + o.quantity;
    });

    const enriched = items.map(item => ({
      ...item,
      allocated: allocatedMap[item.itemCode] || 0,
      reorderStatus: item.closingBalance <= item.minStockLevel ? "REORDER" :
        item.closingBalance <= item.minStockLevel * 1.5 ? "LOW" : "NORMAL",
    }));

    const categories = await prisma.inventoryItem.findMany({
      select: { category: true },
      distinct: ["category"],
    });

    return NextResponse.json({
      items: enriched,
      categories: categories.map(c => c.category),
    });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const data = await req.json();
    const item = await prisma.inventoryItem.create({ data });
    await prisma.activityLog.create({
      data: { action: "CREATE", entity: "InventoryItem", entityId: item.itemCode, details: `Created item: ${item.itemName}` },
    });
    return NextResponse.json(item, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const data = await req.json();
    const { itemCode, ...update } = data;
    const item = await prisma.inventoryItem.update({
      where: { itemCode },
      data: update,
    });
    await prisma.activityLog.create({
      data: { action: "UPDATE", entity: "InventoryItem", entityId: itemCode, details: `Updated item: ${item.itemName}` },
    });
    return NextResponse.json(item);
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
