import { prisma } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";
import { generateId } from "@/lib/utils";

export async function GET(req: NextRequest) {
  try {
    const search = req.nextUrl.searchParams.get("search") || "";
    const status = req.nextUrl.searchParams.get("status") || "";

    const where: Record<string, unknown> = {};
    if (search) {
      where.OR = [
        { orderId: { contains: search } },
        { clientName: { contains: search } },
        { itemCode: { contains: search } },
      ];
    }
    if (status) where.status = status;

    const orders = await prisma.order.findMany({
      where,
      include: { item: true },
      orderBy: { date: "desc" },
    });

    return NextResponse.json({ orders });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const data = await req.json();
    const orderId = generateId("ORD");
    const order = await prisma.order.create({
      data: {
        orderId,
        date: data.date,
        clientName: data.clientName,
        itemCode: data.itemCode,
        quantity: parseFloat(data.quantity),
        status: data.status || "Pending",
        remarks: data.remarks || "",
      },
    });
    await prisma.activityLog.create({
      data: { action: "CREATE", entity: "Order", entityId: orderId, details: `New order for ${data.clientName}: ${data.itemCode} x ${data.quantity}` },
    });
    return NextResponse.json({ success: true, order });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const data = await req.json();
    const { orderId, ...update } = data;
    const order = await prisma.order.update({
      where: { orderId },
      data: update,
    });
    await prisma.activityLog.create({
      data: { action: "UPDATE", entity: "Order", entityId: orderId, details: `Order updated: status=${order.status}` },
    });
    return NextResponse.json({ success: true, order });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
