/*
  Warnings:

  - You are about to drop the column `seatNumber` on the `bookings` table. All the data in the column will be lost.
  - Added the required column `boarding` to the `bookings` table without a default value. This is not possible if the table is not empty.
  - Added the required column `coachId` to the `bookings` table without a default value. This is not possible if the table is not empty.
  - Added the required column `destination` to the `bookings` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "bookings" DROP CONSTRAINT "bookings_trainId_fkey";

-- DropForeignKey
ALTER TABLE "bookings" DROP CONSTRAINT "bookings_userId_fkey";

-- AlterTable
ALTER TABLE "bookings" DROP COLUMN "seatNumber",
ADD COLUMN     "boarding" TEXT NOT NULL,
ADD COLUMN     "coachId" INTEGER NOT NULL,
ADD COLUMN     "destination" TEXT NOT NULL;

-- CreateTable
CREATE TABLE "halts" (
    "id" SERIAL NOT NULL,
    "trainId" INTEGER NOT NULL,
    "stationName" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "arrivalTime" TEXT,
    "departureTime" TEXT,

    CONSTRAINT "halts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "coaches" (
    "id" SERIAL NOT NULL,
    "trainId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "totalSeats" INTEGER NOT NULL,

    CONSTRAINT "coaches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reservations" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "coachId" INTEGER NOT NULL,
    "seatNumbers" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reservations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "booking_seats" (
    "id" SERIAL NOT NULL,
    "bookingId" INTEGER NOT NULL,
    "coachId" INTEGER NOT NULL,
    "seatNumber" INTEGER NOT NULL,
    "passengerName" TEXT NOT NULL,
    "passengerAge" INTEGER NOT NULL,

    CONSTRAINT "booking_seats_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "halts_trainId_order_key" ON "halts"("trainId", "order");

-- AddForeignKey
ALTER TABLE "halts" ADD CONSTRAINT "halts_trainId_fkey" FOREIGN KEY ("trainId") REFERENCES "trains"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coaches" ADD CONSTRAINT "coaches_trainId_fkey" FOREIGN KEY ("trainId") REFERENCES "trains"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_coachId_fkey" FOREIGN KEY ("coachId") REFERENCES "coaches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_trainId_fkey" FOREIGN KEY ("trainId") REFERENCES "trains"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_coachId_fkey" FOREIGN KEY ("coachId") REFERENCES "coaches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking_seats" ADD CONSTRAINT "booking_seats_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking_seats" ADD CONSTRAINT "booking_seats_coachId_fkey" FOREIGN KEY ("coachId") REFERENCES "coaches"("id") ON DELETE CASCADE ON UPDATE CASCADE;
