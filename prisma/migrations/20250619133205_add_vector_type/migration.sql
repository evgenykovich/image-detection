-- Drop existing table and recreate with 512 dimensions
DROP TABLE IF EXISTS "Vector";

-- CreateTable
CREATE TABLE "Vector" (
    "id" TEXT NOT NULL,
    "embedding" vector(512),
    "metadata" JSONB NOT NULL,
    "namespaceId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Vector_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Vector_namespaceId_idx" ON "Vector"("namespaceId");

-- AddForeignKey
ALTER TABLE "Vector" ADD CONSTRAINT "Vector_namespaceId_fkey" FOREIGN KEY ("namespaceId") REFERENCES "Namespace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
