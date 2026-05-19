-- CreateTable
CREATE TABLE "inventory_items" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "itemCode" TEXT NOT NULL,
    "itemName" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'General',
    "weightPerMtr" REAL NOT NULL DEFAULT 0,
    "openingStock" REAL NOT NULL DEFAULT 0,
    "totalIn" REAL NOT NULL DEFAULT 0,
    "totalOut" REAL NOT NULL DEFAULT 0,
    "closingBalance" REAL NOT NULL DEFAULT 0,
    "minStockLevel" REAL NOT NULL DEFAULT 50,
    "unit" TEXT NOT NULL DEFAULT 'Mtr',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "orders" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "orderId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "clientName" TEXT NOT NULL,
    "itemCode" TEXT NOT NULL,
    "quantity" REAL NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'Pending',
    "remarks" TEXT NOT NULL DEFAULT '',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "orders_itemCode_fkey" FOREIGN KEY ("itemCode") REFERENCES "inventory_items" ("itemCode") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "job_works" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "jobId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "workerName" TEXT NOT NULL,
    "itemCode" TEXT NOT NULL,
    "sentQty" REAL NOT NULL DEFAULT 0,
    "receivedQty" REAL NOT NULL DEFAULT 0,
    "wastageMtr" REAL NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'Out',
    "totalPayment" REAL NOT NULL DEFAULT 0,
    "ratePerMtr" REAL NOT NULL DEFAULT 0.25,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "job_works_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders" ("orderId") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "job_works_itemCode_fkey" FOREIGN KEY ("itemCode") REFERENCES "inventory_items" ("itemCode") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "dispatches" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "dispatchId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "clientName" TEXT NOT NULL,
    "itemCode" TEXT NOT NULL,
    "dispatchedQty" REAL NOT NULL,
    "dispatchDate" TEXT NOT NULL,
    "challanNo" TEXT NOT NULL DEFAULT '',
    "vehicleNo" TEXT NOT NULL DEFAULT '',
    "transportName" TEXT NOT NULL DEFAULT '',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "dispatches_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders" ("orderId") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "dispatches_itemCode_fkey" FOREIGN KEY ("itemCode") REFERENCES "inventory_items" ("itemCode") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "activity_logs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "action" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "details" TEXT NOT NULL DEFAULT '',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE UNIQUE INDEX "inventory_items_itemCode_key" ON "inventory_items"("itemCode");

-- CreateIndex
CREATE UNIQUE INDEX "orders_orderId_key" ON "orders"("orderId");

-- CreateIndex
CREATE UNIQUE INDEX "job_works_jobId_key" ON "job_works"("jobId");

-- CreateIndex
CREATE UNIQUE INDEX "dispatches_dispatchId_key" ON "dispatches"("dispatchId");
