-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "vector";

-- Create array_to_vector function
CREATE OR REPLACE FUNCTION array_to_vector(arr float[])
RETURNS vector
AS $$
BEGIN
    RETURN arr::vector;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Create cosine_similarity function
CREATE OR REPLACE FUNCTION cosine_similarity(a float[], b float[])
RETURNS float
AS $$
DECLARE
    dot_product float := 0;
    norm_a float := 0;
    norm_b float := 0;
BEGIN
    -- Calculate dot product and norms
    FOR i IN 1..array_length(a, 1) LOOP
        dot_product := dot_product + (a[i] * b[i]);
        norm_a := norm_a + (a[i] * a[i]);
        norm_b := norm_b + (b[i] * b[i]);
    END LOOP;

    -- Return cosine similarity
    RETURN dot_product / (sqrt(norm_a) * sqrt(norm_b));
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- CreateTable
CREATE TABLE "Namespace" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Namespace_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Vector" (
    "id" TEXT NOT NULL,
    "embedding" float[] NOT NULL,
    "metadata" JSONB NOT NULL,
    "namespaceId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Vector_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Namespace_name_key" ON "Namespace"("name");

-- CreateIndex
CREATE INDEX "Vector_namespaceId_idx" ON "Vector"("namespaceId");

-- AddForeignKey
ALTER TABLE "Vector" ADD CONSTRAINT "Vector_namespaceId_fkey" FOREIGN KEY ("namespaceId") REFERENCES "Namespace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
