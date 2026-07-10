ALTER TABLE "bookings" ADD COLUMN "pnr" TEXT;

UPDATE "bookings"
SET "pnr" = 'RR' || LPAD("id"::text, 10, '0')
WHERE "pnr" IS NULL;

ALTER TABLE "bookings" ALTER COLUMN "pnr" SET NOT NULL;

CREATE UNIQUE INDEX "bookings_pnr_key" ON "bookings"("pnr");
