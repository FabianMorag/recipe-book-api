-- AlterTable
ALTER TABLE "recipes" ADD COLUMN     "image_url" TEXT,
ADD COLUMN     "servings" INTEGER,
ADD COLUMN     "tags" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
