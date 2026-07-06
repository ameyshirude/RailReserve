-- CreateEnum
CREATE TYPE "BookingStatus" AS ENUM ('CONFIRMED', 'CANCELLED');

-- AlterTable
ALTER TABLE "bookings" ADD COLUMN     "cancelledSeats" TEXT,
ADD COLUMN     "status" "BookingStatus" NOT NULL DEFAULT 'CONFIRMED';
