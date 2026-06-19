-- AlterTable
ALTER TABLE "disciplinas" ADD COLUMN     "blocosSemanais" INTEGER;

-- Backfill existing records using the required rule.
UPDATE "disciplinas"
SET "blocosSemanais" = GREATEST(1, CEIL("cargaHoraria"::numeric / 20))
WHERE "blocosSemanais" IS NULL;

-- Make the column required after backfill.
ALTER TABLE "disciplinas"
ALTER COLUMN "blocosSemanais" SET NOT NULL;
