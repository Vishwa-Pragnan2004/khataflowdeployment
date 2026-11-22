-- AlterTable
ALTER TABLE "Customer" ADD COLUMN "address" TEXT;
ALTER TABLE "Customer" ADD COLUMN "email" TEXT;

-- AlterTable
ALTER TABLE "Payment" ADD COLUMN "reference" TEXT;

-- CreateTable
CREATE TABLE "BillItem" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "billId" INTEGER NOT NULL,
    "description" TEXT NOT NULL,
    "qty" INTEGER NOT NULL,
    "unitPrice" INTEGER NOT NULL,
    "amount" INTEGER NOT NULL,
    CONSTRAINT "BillItem_billId_fkey" FOREIGN KEY ("billId") REFERENCES "Bill" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ActivityLog" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "billId" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "detail" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ActivityLog_billId_fkey" FOREIGN KEY ("billId") REFERENCES "Bill" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Bill" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "billNumber" TEXT NOT NULL,
    "customerId" INTEGER NOT NULL,
    "itemsNote" TEXT,
    "totalAmount" INTEGER NOT NULL,
    "billDate" DATETIME NOT NULL,
    "dueDate" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT NOT NULL DEFAULT 'SENT',
    "termsDays" INTEGER NOT NULL DEFAULT 15,
    "subtotal" INTEGER NOT NULL DEFAULT 0,
    "discount" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,
    "sentAt" DATETIME,
    "shareToken" TEXT,
    "promisedDate" DATETIME,
    CONSTRAINT "Bill_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Bill" ("billDate", "billNumber", "createdAt", "customerId", "dueDate", "id", "itemsNote", "totalAmount") SELECT "billDate", "billNumber", "createdAt", "customerId", "dueDate", "id", "itemsNote", "totalAmount" FROM "Bill";
DROP TABLE "Bill";
ALTER TABLE "new_Bill" RENAME TO "Bill";
CREATE UNIQUE INDEX "Bill_billNumber_key" ON "Bill"("billNumber");
CREATE UNIQUE INDEX "Bill_shareToken_key" ON "Bill"("shareToken");
CREATE TABLE "new_ReminderLog" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "billId" INTEGER NOT NULL,
    "tone" TEXT NOT NULL,
    "channel" TEXT NOT NULL DEFAULT 'WHATSAPP',
    "message" TEXT NOT NULL,
    "sentAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ReminderLog_billId_fkey" FOREIGN KEY ("billId") REFERENCES "Bill" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_ReminderLog" ("billId", "id", "message", "sentAt", "tone") SELECT "billId", "id", "message", "sentAt", "tone" FROM "ReminderLog";
DROP TABLE "ReminderLog";
ALTER TABLE "new_ReminderLog" RENAME TO "ReminderLog";
CREATE TABLE "new_Shop" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "ownerName" TEXT NOT NULL,
    "upiId" TEXT NOT NULL,
    "phone" TEXT NOT NULL DEFAULT '',
    "email" TEXT NOT NULL DEFAULT '',
    "address" TEXT NOT NULL DEFAULT '',
    "gstin" TEXT,
    "paymentTerms" INTEGER NOT NULL DEFAULT 15
);
INSERT INTO "new_Shop" ("id", "name", "ownerName", "upiId") SELECT "id", "name", "ownerName", "upiId" FROM "Shop";
DROP TABLE "Shop";
ALTER TABLE "new_Shop" RENAME TO "Shop";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
