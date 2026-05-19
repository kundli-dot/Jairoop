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
        { jobId: { contains: search } },
        { workerName: { contains: search } },
        { orderId: { contains: search } },
        { itemCode: { contains: search } },
      ];
    }
    if (status) where.status = status;

    const jobWorks = await prisma.jobWork.findMany({
      where,
      include: { order: true, item: true },
      orderBy: { date: "desc" },
    });

    const workers = await prisma.jobWork.findMany({
      select: { workerName: true },
      distinct: ["workerName"],
    });

    return NextResponse.json({
      jobWorks,
      workers: workers.map(w => w.workerName),
    });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const data = await req.json();
    const jobId = generateId("JOB");
    const sentQty = parseFloat(data.sentQty) || 0;
    const receivedQty = parseFloat(data.receivedQty) || 0;
    const wastageMtr = parseFloat(data.wastageMtr) || 0;
    const ratePerMtr = parseFloat(data.ratePerMtr) || 0.25;
    const totalPayment = parseFloat(data.totalPayment) || receivedQty * ratePerMtr;

    const jobWork = await prisma.jobWork.create({
      data: {
        jobId,
        date: data.date,
        orderId: data.orderId,
        workerName: data.workerName,
        itemCode: data.itemCode,
        sentQty,
        receivedQty,
        wastageMtr,
        status: data.status || "Out",
        totalPayment,
        ratePerMtr,
      },
    });
    await prisma.activityLog.create({
      data: { action: "CREATE", entity: "JobWork", entityId: jobId, details: `Job work for ${data.workerName}: ${data.itemCode}` },
    });
    return NextResponse.json({ success: true, jobWork });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const data = await req.json();
    const { jobId, ...update } = data;
    if (update.sentQty) update.sentQty = parseFloat(update.sentQty);
    if (update.receivedQty) update.receivedQty = parseFloat(update.receivedQty);
    if (update.wastageMtr) update.wastageMtr = parseFloat(update.wastageMtr);
    if (update.totalPayment) update.totalPayment = parseFloat(update.totalPayment);

    const jobWork = await prisma.jobWork.update({
      where: { jobId },
      data: update,
    });
    await prisma.activityLog.create({
      data: { action: "UPDATE", entity: "JobWork", entityId: jobId, details: `Job work updated: status=${jobWork.status}` },
    });
    return NextResponse.json({ success: true, jobWork });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
