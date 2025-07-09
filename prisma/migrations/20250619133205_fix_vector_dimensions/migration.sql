-- Drop existing vector table and recreate with correct dimensions
DROP TABLE IF EXISTS "Vector";

-- Create the vector extension if it doesn't exist
CREATE EXTENSION IF NOT EXISTS vector;

-- Create the vector table with explicit dimensions
CREATE TABLE "Vector" (
    "id" TEXT NOT NULL,
    "embedding" vector(512),
    "metadata" JSONB NOT NULL,
    "namespaceId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Vector_pkey" PRIMARY KEY ("id")
);

-- Create indexes
CREATE INDEX "Vector_namespaceId_idx" ON "Vector"("namespaceId");
CREATE INDEX "Vector_embedding_idx" ON "Vector" USING ivfflat ("embedding" vector_cosine_ops);

-- Add foreign key constraint
ALTER TABLE "Vector" ADD CONSTRAINT "Vector_namespaceId_fkey" 
    FOREIGN KEY ("namespaceId") REFERENCES "Namespace"("id") ON DELETE CASCADE ON UPDATE CASCADE; 