import { prisma } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  try {
    const client = req.nextUrl.searchParams.get("client") || "";

    const clients = await prisma.order.findMany({
      select: { clientName: true },
      distinct: ["clientName"],
      orderBy: { clientName: "asc" },
    });

    if (client) {
      const orders = await prisma.order.findMany({
        where: { clientName: client },
        include: { item: true },
        orderBy: { date: "desc" },
      });
      const dispatches = await prisma.dispatch.findMany({
        where: { clientName: client },
      });
      const totalOrdered = orders.reduce((s, o) => s + o.quantity, 0);
      const totalDispatched = dispatches.reduce((s, d) => s + d.dispatchedQty, 0);
      const completedOrders = orders.filter(o => o.status === "Completed").length;

      return NextResponse.json({
        clients: clients.map(c => c.clientName),
        clientData: {
          name: client,
          orders,
          dispatches,
          totalOrdered,
          totalDispatched,
          completedOrders,
          totalOrders: orders.length,
        },
      });
    }

    return NextResponse.json({ clients: clients.map(c => c.clientName) });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
