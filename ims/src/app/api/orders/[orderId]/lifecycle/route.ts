import { prisma } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ orderId: string }> }
) {
  try {
    const { orderId } = await params;
    const order = await prisma.order.findUnique({
      where: { orderId },
      include: { item: true },
    });
    if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });

    const jobWorks = await prisma.jobWork.findMany({ where: { orderId } });
    const dispatches = await prisma.dispatch.findMany({ where: { orderId } });

    return NextResponse.json({ order, jobWorks, dispatches });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
