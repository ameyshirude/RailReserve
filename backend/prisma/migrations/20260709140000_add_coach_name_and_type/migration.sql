-- Preserve the old `name` value as the coach class, then assign each existing
-- coach a stable, human-readable identifier within its train.
ALTER TABLE "coaches" ADD COLUMN "type" TEXT;

UPDATE "coaches"
SET "type" = UPPER("name");

WITH ranked_coaches AS (
    SELECT
        "id",
        "type",
        ROW_NUMBER() OVER (
            PARTITION BY "trainId", "type"
            ORDER BY "id"
        ) AS coach_number
    FROM "coaches"
)
UPDATE "coaches" AS coach
SET "name" =
    CASE ranked."type"
        WHEN 'SL' THEN 'S'
        WHEN '3A' THEN 'B'
        WHEN '2A' THEN 'A'
        WHEN '1A' THEN 'H'
        ELSE 'C'
    END || ranked.coach_number
FROM ranked_coaches AS ranked
WHERE coach."id" = ranked."id";

ALTER TABLE "coaches" ALTER COLUMN "type" SET NOT NULL;

CREATE UNIQUE INDEX "coaches_trainId_name_key"
ON "coaches"("trainId", "name");
