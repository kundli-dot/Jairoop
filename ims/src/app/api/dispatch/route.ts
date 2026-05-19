import { prisma } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";
import { generateId } from "@/lib/utils";

export async function GET(req: NextRequest) {
  try {
    const search = req.nextUrl.searchParams.get("search") || "";

    const where: Record<string, unknown> = {};
    if (search) {
      where.OR = [
        { dispatchId: { contains: search } },
        { orderId: { contains: search } },
        { clientName: { contains: search } },
        { challanNo: { contains: search } },
      ];
    }

    const dispatches = await prisma.dispatch.findMany({
      where,
      include: { order: true, item: true },
      orderBy: { dispatchDate: "desc" },
    });

    return NextResponse.json({ dispatches });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const data = await req.json();
    const dispatchId = generateId("DISP");

    const dispatch = await prisma.dispatch.create({
      data: {
        dispatchId,
        orderId: data.orderId,
        clientName: data.clientName,
        itemCode: data.itemCode,
        dispatchedQty: parseFloat(data.dispatchedQty),
        dispatchDate: data.dispatchDate,
        challanNo: data.challanNo || "",
        vehicleNo: data.vehicleNo || "",
        transportName: data.transportName || "",
      },
    });

    if (data.markCompleted) {
      await prisma.order.update({
        where: { orderId: data.orderId },
        data: { status: "Completed" },
      });
    }

    const item = await prisma.inventoryItem.findUnique({ where: { itemCode: data.itemCode } });
    if (item) {
      await prisma.inventoryItem.update({
        where: { itemCode: data.itemCode },
        data: {
          totalOut: item.totalOut + parseFloat(data.dispatchedQty),
          closingBalance: item.closingBalance - parseFloat(data.dispatchedQty),
        },
      });
    }

    await prisma.activityLog.create({
      data: { action: "CREATE", entity: "Dispatch", entityId: dispatchId, details: `Dispatched ${data.dispatchedQty} Mtr of ${data.itemCode} to ${data.clientName}` },
    });

    return NextResponse.json({ success: true, dispatch });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
