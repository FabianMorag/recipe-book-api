-- CreateEnum
CREATE TYPE "RecipeStatus" AS ENUM ('DRAFT', 'PRIVATE', 'PUBLIC');

-- Add nullable status first so existing rows can be backfilled safely.
ALTER TABLE "recipes" ADD COLUMN "status" "RecipeStatus";

-- Preserve previous visibility semantics: public rows stay public, non-public
-- rows become private. New recipes default to draft at the Prisma/database layer.
UPDATE "recipes"
SET "status" = CASE
    WHEN "is_public" = true THEN 'PUBLIC'::"RecipeStatus"
    ELSE 'PRIVATE'::"RecipeStatus"
END;

-- Enforce the new lifecycle column and remove the old boolean.
ALTER TABLE "recipes" ALTER COLUMN "status" SET DEFAULT 'DRAFT';
ALTER TABLE "recipes" ALTER COLUMN "status" SET NOT NULL;
ALTER TABLE "recipes" DROP COLUMN "is_public";

-- CreateIndex
CREATE INDEX "recipes_status_idx" ON "recipes"("status");

-- CreateIndex
CREATE INDEX "recipes_author_id_status_idx" ON "recipes"("author_id", "status");
