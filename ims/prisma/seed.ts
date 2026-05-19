import { PrismaClient } from "../src/generated/prisma/client.js";

const prisma = new PrismaClient();

async function main() {
  await prisma.dispatch.deleteMany();
  await prisma.jobWork.deleteMany();
  await prisma.order.deleteMany();
  await prisma.inventoryItem.deleteMany();
  await prisma.activityLog.deleteMany();

  const items = [
    { itemCode: "3MM-SATIN", itemName: "3 MM Satin", category: "Satin", weightPerMtr: 0.12, openingStock: 500, totalIn: 1200, totalOut: 800, closingBalance: 900, minStockLevel: 200 },
    { itemCode: "5MM-SATIN", itemName: "5 MM Satin", category: "Satin", weightPerMtr: 0.18, openingStock: 350, totalIn: 900, totalOut: 700, closingBalance: 550, minStockLevel: 150 },
    { itemCode: "10MM-SATIN", itemName: "10 MM Satin", category: "Satin", weightPerMtr: 0.25, openingStock: 200, totalIn: 600, totalOut: 500, closingBalance: 300, minStockLevel: 100 },
    { itemCode: "12MM-GRO", itemName: "12 MM Grossgrain", category: "Grossgrain", weightPerMtr: 0.30, openingStock: 180, totalIn: 400, totalOut: 350, closingBalance: 230, minStockLevel: 100 },
    { itemCode: "16MM-GRO", itemName: "16 MM Grossgrain", category: "Grossgrain", weightPerMtr: 0.35, openingStock: 150, totalIn: 300, totalOut: 280, closingBalance: 170, minStockLevel: 80 },
    { itemCode: "25MM-GRO", itemName: "25 MM Grossgrain", category: "Grossgrain", weightPerMtr: 0.42, openingStock: 120, totalIn: 250, totalOut: 200, closingBalance: 170, minStockLevel: 50 },
    { itemCode: "VELVET-20", itemName: "20 MM Velvet Ribbon", category: "Velvet", weightPerMtr: 0.55, openingStock: 80, totalIn: 200, totalOut: 220, closingBalance: 60, minStockLevel: 100 },
    { itemCode: "VELVET-38", itemName: "38 MM Velvet Ribbon", category: "Velvet", weightPerMtr: 0.72, openingStock: 100, totalIn: 150, totalOut: 120, closingBalance: 130, minStockLevel: 60 },
    { itemCode: "ORG-10", itemName: "10 MM Organza", category: "Organza", weightPerMtr: 0.08, openingStock: 600, totalIn: 800, totalOut: 650, closingBalance: 750, minStockLevel: 300 },
    { itemCode: "ORG-25", itemName: "25 MM Organza", category: "Organza", weightPerMtr: 0.15, openingStock: 400, totalIn: 500, totalOut: 450, closingBalance: 450, minStockLevel: 200 },
    { itemCode: "POLY-6", itemName: "6 MM Polyester", category: "Polyester", weightPerMtr: 0.06, openingStock: 1000, totalIn: 2000, totalOut: 1800, closingBalance: 1200, minStockLevel: 400 },
    { itemCode: "POLY-12", itemName: "12 MM Polyester", category: "Polyester", weightPerMtr: 0.10, openingStock: 800, totalIn: 1500, totalOut: 1300, closingBalance: 1000, minStockLevel: 300 },
    { itemCode: "COTTON-15", itemName: "15 MM Cotton Tape", category: "Cotton", weightPerMtr: 0.20, openingStock: 250, totalIn: 400, totalOut: 380, closingBalance: 270, minStockLevel: 100 },
    { itemCode: "COTTON-25", itemName: "25 MM Cotton Tape", category: "Cotton", weightPerMtr: 0.32, openingStock: 200, totalIn: 350, totalOut: 330, closingBalance: 220, minStockLevel: 80 },
    { itemCode: "LACE-20", itemName: "20 MM Lace Trim", category: "Lace", weightPerMtr: 0.14, openingStock: 90, totalIn: 160, totalOut: 180, closingBalance: 70, minStockLevel: 100 },
    { itemCode: "LACE-40", itemName: "40 MM Lace Trim", category: "Lace", weightPerMtr: 0.28, openingStock: 60, totalIn: 100, totalOut: 90, closingBalance: 70, minStockLevel: 50 },
    { itemCode: "ELASTIC-6", itemName: "6 MM Elastic Band", category: "Elastic", weightPerMtr: 0.04, openingStock: 2000, totalIn: 3000, totalOut: 2500, closingBalance: 2500, minStockLevel: 800 },
    { itemCode: "ELASTIC-12", itemName: "12 MM Elastic Band", category: "Elastic", weightPerMtr: 0.07, openingStock: 1500, totalIn: 2200, totalOut: 1800, closingBalance: 1900, minStockLevel: 600 },
    { itemCode: "ZIP-NYLON", itemName: "Nylon Zipper (per mtr)", category: "Zipper", weightPerMtr: 0.05, openingStock: 500, totalIn: 800, totalOut: 700, closingBalance: 600, minStockLevel: 200 },
    { itemCode: "BIAS-12", itemName: "12 MM Bias Tape", category: "Bias Tape", weightPerMtr: 0.09, openingStock: 300, totalIn: 450, totalOut: 500, closingBalance: 250, minStockLevel: 150 },
  ];

  for (const item of items) {
    await prisma.inventoryItem.create({ data: item });
  }

  const clients = [
    "Rajesh Fabrics", "Meera Textiles", "Gupta Garments", "Singh Brothers",
    "Patel Silks", "Kumar Exports", "Sharma Traders", "Agarwal Fashion",
    "Jain Impex", "Verma & Sons"
  ];
  const workers = [
    "Ramesh Kumar", "Suresh Yadav", "Ajay Singh", "Vijay Sharma",
    "Mohan Lal", "Ravi Verma", "Deepak Joshi"
  ];

  const orderData = [
    { orderId: "ORD-20260101-001", date: "2026-01-05", clientName: clients[0], itemCode: "3MM-SATIN", quantity: 200, status: "Completed", remarks: "Urgent order" },
    { orderId: "ORD-20260115-002", date: "2026-01-15", clientName: clients[1], itemCode: "5MM-SATIN", quantity: 150, status: "Completed", remarks: "" },
    { orderId: "ORD-20260201-003", date: "2026-02-01", clientName: clients[2], itemCode: "12MM-GRO", quantity: 100, status: "Completed", remarks: "Repeat order" },
    { orderId: "ORD-20260210-004", date: "2026-02-10", clientName: clients[3], itemCode: "VELVET-20", quantity: 80, status: "Completed", remarks: "" },
    { orderId: "ORD-20260220-005", date: "2026-02-20", clientName: clients[0], itemCode: "ORG-10", quantity: 300, status: "Completed", remarks: "Premium quality" },
    { orderId: "ORD-20260301-006", date: "2026-03-01", clientName: clients[4], itemCode: "POLY-6", quantity: 500, status: "Completed", remarks: "" },
    { orderId: "ORD-20260310-007", date: "2026-03-10", clientName: clients[5], itemCode: "COTTON-15", quantity: 180, status: "Completed", remarks: "" },
    { orderId: "ORD-20260315-008", date: "2026-03-15", clientName: clients[1], itemCode: "ELASTIC-6", quantity: 600, status: "In Production", remarks: "Bulk order" },
    { orderId: "ORD-20260320-009", date: "2026-03-20", clientName: clients[6], itemCode: "LACE-20", quantity: 120, status: "In Production", remarks: "" },
    { orderId: "ORD-20260401-010", date: "2026-04-01", clientName: clients[7], itemCode: "3MM-SATIN", quantity: 250, status: "In Production", remarks: "Custom color" },
    { orderId: "ORD-20260405-011", date: "2026-04-05", clientName: clients[2], itemCode: "VELVET-38", quantity: 90, status: "In Production", remarks: "" },
    { orderId: "ORD-20260410-012", date: "2026-04-10", clientName: clients[8], itemCode: "ZIP-NYLON", quantity: 200, status: "Pending", remarks: "" },
    { orderId: "ORD-20260415-013", date: "2026-04-15", clientName: clients[3], itemCode: "BIAS-12", quantity: 150, status: "Pending", remarks: "" },
    { orderId: "ORD-20260420-014", date: "2026-04-20", clientName: clients[9], itemCode: "ORG-25", quantity: 200, status: "Pending", remarks: "Wedding season" },
    { orderId: "ORD-20260501-015", date: "2026-05-01", clientName: clients[0], itemCode: "16MM-GRO", quantity: 100, status: "Pending", remarks: "" },
    { orderId: "ORD-20260505-016", date: "2026-05-05", clientName: clients[4], itemCode: "POLY-12", quantity: 350, status: "Pending", remarks: "New client request" },
    { orderId: "ORD-20260510-017", date: "2026-05-10", clientName: clients[5], itemCode: "10MM-SATIN", quantity: 180, status: "Pending", remarks: "" },
    { orderId: "ORD-20260515-018", date: "2026-05-15", clientName: clients[1], itemCode: "COTTON-25", quantity: 120, status: "Pending", remarks: "" },
  ];

  for (const order of orderData) {
    await prisma.order.create({ data: order });
  }

  const jobWorkData = [
    { jobId: "JOB-20260108-001", date: "2026-01-08", orderId: "ORD-20260101-001", workerName: workers[0], itemCode: "3MM-SATIN", sentQty: 210, receivedQty: 200, wastageMtr: 6.5, status: "Completed", totalPayment: 50, ratePerMtr: 0.25 },
    { jobId: "JOB-20260118-002", date: "2026-01-18", orderId: "ORD-20260115-002", workerName: workers[1], itemCode: "5MM-SATIN", sentQty: 160, receivedQty: 150, wastageMtr: 5.2, status: "Completed", totalPayment: 37.5, ratePerMtr: 0.25 },
    { jobId: "JOB-20260204-003", date: "2026-02-04", orderId: "ORD-20260201-003", workerName: workers[2], itemCode: "12MM-GRO", sentQty: 108, receivedQty: 100, wastageMtr: 4.8, status: "Completed", totalPayment: 25, ratePerMtr: 0.25 },
    { jobId: "JOB-20260213-004", date: "2026-02-13", orderId: "ORD-20260210-004", workerName: workers[3], itemCode: "VELVET-20", sentQty: 85, receivedQty: 80, wastageMtr: 3.0, status: "Completed", totalPayment: 20, ratePerMtr: 0.25 },
    { jobId: "JOB-20260223-005", date: "2026-02-23", orderId: "ORD-20260220-005", workerName: workers[0], itemCode: "ORG-10", sentQty: 315, receivedQty: 300, wastageMtr: 9.5, status: "Completed", totalPayment: 75, ratePerMtr: 0.25 },
    { jobId: "JOB-20260304-006", date: "2026-03-04", orderId: "ORD-20260301-006", workerName: workers[4], itemCode: "POLY-6", sentQty: 520, receivedQty: 500, wastageMtr: 12.0, status: "Completed", totalPayment: 125, ratePerMtr: 0.25 },
    { jobId: "JOB-20260313-007", date: "2026-03-13", orderId: "ORD-20260310-007", workerName: workers[5], itemCode: "COTTON-15", sentQty: 190, receivedQty: 180, wastageMtr: 6.0, status: "Completed", totalPayment: 45, ratePerMtr: 0.25 },
    { jobId: "JOB-20260318-008", date: "2026-03-18", orderId: "ORD-20260315-008", workerName: workers[1], itemCode: "ELASTIC-6", sentQty: 620, receivedQty: 350, wastageMtr: 8.0, status: "Out", totalPayment: 87.5, ratePerMtr: 0.25 },
    { jobId: "JOB-20260323-009", date: "2026-03-23", orderId: "ORD-20260320-009", workerName: workers[6], itemCode: "LACE-20", sentQty: 130, receivedQty: 60, wastageMtr: 2.5, status: "Out", totalPayment: 15, ratePerMtr: 0.25 },
    { jobId: "JOB-20260404-010", date: "2026-04-04", orderId: "ORD-20260401-010", workerName: workers[2], itemCode: "3MM-SATIN", sentQty: 260, receivedQty: 100, wastageMtr: 4.0, status: "Out", totalPayment: 25, ratePerMtr: 0.25 },
    { jobId: "JOB-20260408-011", date: "2026-04-08", orderId: "ORD-20260405-011", workerName: workers[3], itemCode: "VELVET-38", sentQty: 95, receivedQty: 0, wastageMtr: 0, status: "Out", totalPayment: 0, ratePerMtr: 0.25 },
  ];

  for (const job of jobWorkData) {
    await prisma.jobWork.create({ data: job });
  }

  const dispatchData = [
    { dispatchId: "DISP-20260112-001", orderId: "ORD-20260101-001", clientName: clients[0], itemCode: "3MM-SATIN", dispatchedQty: 200, dispatchDate: "2026-01-12", challanNo: "CH-2026-001", vehicleNo: "UP-32-AB-1234", transportName: "FastCargo" },
    { dispatchId: "DISP-20260125-002", orderId: "ORD-20260115-002", clientName: clients[1], itemCode: "5MM-SATIN", dispatchedQty: 150, dispatchDate: "2026-01-25", challanNo: "CH-2026-002", vehicleNo: "DL-01-CD-5678", transportName: "QuickTrans" },
    { dispatchId: "DISP-20260210-003", orderId: "ORD-20260201-003", clientName: clients[2], itemCode: "12MM-GRO", dispatchedQty: 100, dispatchDate: "2026-02-10", challanNo: "CH-2026-003", vehicleNo: "HR-06-EF-9012", transportName: "FastCargo" },
    { dispatchId: "DISP-20260218-004", orderId: "ORD-20260210-004", clientName: clients[3], itemCode: "VELVET-20", dispatchedQty: 80, dispatchDate: "2026-02-18", challanNo: "CH-2026-004", vehicleNo: "UP-32-GH-3456", transportName: "SafeDeliver" },
    { dispatchId: "DISP-20260228-005", orderId: "ORD-20260220-005", clientName: clients[0], itemCode: "ORG-10", dispatchedQty: 300, dispatchDate: "2026-02-28", challanNo: "CH-2026-005", vehicleNo: "DL-01-IJ-7890", transportName: "QuickTrans" },
    { dispatchId: "DISP-20260312-006", orderId: "ORD-20260301-006", clientName: clients[4], itemCode: "POLY-6", dispatchedQty: 500, dispatchDate: "2026-03-12", challanNo: "CH-2026-006", vehicleNo: "HR-06-KL-2345", transportName: "FastCargo" },
    { dispatchId: "DISP-20260320-007", orderId: "ORD-20260310-007", clientName: clients[5], itemCode: "COTTON-15", dispatchedQty: 180, dispatchDate: "2026-03-20", challanNo: "CH-2026-007", vehicleNo: "UP-32-MN-6789", transportName: "SafeDeliver" },
  ];

  for (const dispatch of dispatchData) {
    await prisma.dispatch.create({ data: dispatch });
  }

  console.log("Seed data created successfully!");
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
