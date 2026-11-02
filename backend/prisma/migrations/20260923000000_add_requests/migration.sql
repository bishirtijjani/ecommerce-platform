-- CreateEnum
CREATE TYPE "RequestStatus" AS ENUM ('OPEN', 'ASSIGNED', 'EXPIRED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "RequestResponseStatus" AS ENUM ('PENDING', 'ACCEPTED', 'DECLINED', 'WITHDRAWN');

-- CreateEnum
CREATE TYPE "RequestReach" AS ENUM ('NEARBY', 'ANYWHERE');

-- AlterTable
ALTER TABLE "vendors" ADD COLUMN     "serviceRadiusKm" INTEGER;

-- AlterTable
ALTER TABLE "notification_preferences" ADD COLUMN     "requestAlerts" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "requests" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "categoryId" TEXT,
    "subcategoryId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "images" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "quantity" INTEGER,
    "budgetMin" DECIMAL(15,2),
    "budgetMax" DECIMAL(15,2),
    "neededBy" TIMESTAMP(3),
    "urgency" VARCHAR(20),
    "address" TEXT NOT NULL,
    "lat" DOUBLE PRECISION NOT NULL,
    "lng" DOUBLE PRECISION NOT NULL,
    "placeId" TEXT,
    "reach" "RequestReach" NOT NULL DEFAULT 'NEARBY',
    "radiusKm" INTEGER NOT NULL DEFAULT 15,
    "status" "RequestStatus" NOT NULL DEFAULT 'OPEN',
    "assignedVendorId" TEXT,
    "assignedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "request_responses" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "message" VARCHAR(1000) NOT NULL,
    "price" DECIMAL(15,2),
    "priceNote" VARCHAR(120),
    "etaText" VARCHAR(120),
    "status" "RequestResponseStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "request_responses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "request_pings" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "notifiedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "seenAt" TIMESTAMP(3),

    CONSTRAINT "request_pings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "requests_customerId_createdAt_idx" ON "requests"("customerId", "createdAt");

-- CreateIndex
CREATE INDEX "requests_status_expiresAt_idx" ON "requests"("status", "expiresAt");

-- CreateIndex
CREATE INDEX "requests_categoryId_status_idx" ON "requests"("categoryId", "status");

-- CreateIndex
CREATE INDEX "requests_assignedVendorId_idx" ON "requests"("assignedVendorId");

-- CreateIndex
CREATE INDEX "request_responses_vendorId_createdAt_idx" ON "request_responses"("vendorId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "request_responses_requestId_vendorId_key" ON "request_responses"("requestId", "vendorId");

-- CreateIndex
CREATE INDEX "request_pings_requestId_idx" ON "request_pings"("requestId");

-- CreateIndex
CREATE INDEX "request_pings_vendorId_seenAt_idx" ON "request_pings"("vendorId", "seenAt");

-- CreateIndex
CREATE UNIQUE INDEX "request_pings_requestId_vendorId_key" ON "request_pings"("requestId", "vendorId");

-- AddForeignKey
ALTER TABLE "requests" ADD CONSTRAINT "requests_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "requests" ADD CONSTRAINT "requests_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "vendor_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "requests" ADD CONSTRAINT "requests_subcategoryId_fkey" FOREIGN KEY ("subcategoryId") REFERENCES "subcategories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "request_responses" ADD CONSTRAINT "request_responses_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "request_responses" ADD CONSTRAINT "request_responses_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "vendors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "request_pings" ADD CONSTRAINT "request_pings_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "request_pings" ADD CONSTRAINT "request_pings_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "vendors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

