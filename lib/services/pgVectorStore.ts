import OpenAI from 'openai'
import { VectorStore } from './vectorStoreInterface'
import {
  Category,
  State,
  ImageFeatures,
  SimilarCase,
  ValidationDiagnosis,
} from '@/types/validation'
import { prisma } from './prismaService'
import { Prisma } from '@prisma/client'
import { randomUUID } from 'crypto'

// Define the expected metadata structure
interface VectorMetadata {
  category: Category
  state: State
  features: ImageFeatures
  diagnosis: ValidationDiagnosis | string
  keyFeatures: string[]
  confidence: number
  prompt?: string
  [key: string]: unknown
}

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

// Helper to generate description for embedding
function generateDescription(features: ImageFeatures): string {
  const { structuralFeatures, metadata } = features
  return `Image Analysis:
Format: ${metadata.format}, Size: ${metadata.dimensions.width}x${metadata.dimensions.height}
Edges: ${structuralFeatures.edges}
Contrast: ${structuralFeatures.contrast}
Brightness: ${structuralFeatures.brightness}
Sharpness: ${structuralFeatures.sharpness}`
}

// Helper to convert diagnosis to a Prisma JSON object
function diagnosisToJsonObject(
  diagnosis: ValidationDiagnosis
): Prisma.JsonObject {
  return {
    overall_assessment: diagnosis.overall_assessment,
    confidence_level: diagnosis.confidence_level,
    key_observations: diagnosis.key_observations,
    matched_criteria: diagnosis.matched_criteria,
    failed_criteria: diagnosis.failed_criteria,
    detailed_explanation: diagnosis.detailed_explanation,
  }
}

// Helper to convert JSON object to diagnosis
function jsonObjectToDiagnosis(obj: Prisma.JsonObject): ValidationDiagnosis {
  return {
    overall_assessment: String(obj.overall_assessment || ''),
    confidence_level: Number(obj.confidence_level || 0),
    key_observations: Array.isArray(obj.key_observations)
      ? obj.key_observations.map(String)
      : [],
    matched_criteria: Array.isArray(obj.matched_criteria)
      ? obj.matched_criteria.map(String)
      : [],
    failed_criteria: Array.isArray(obj.failed_criteria)
      ? obj.failed_criteria.map(String)
      : [],
    detailed_explanation: String(obj.detailed_explanation || ''),
  }
}

export class PgVectorStore implements VectorStore {
  async storeValidationCase(
    imageUrl: string,
    category: Category,
    state: State,
    features: ImageFeatures,
    diagnosis: string | ValidationDiagnosis,
    keyFeatures: string[],
    confidence: number = 0.5,
    prompt?: string,
    namespace: string = '_default_'
  ): Promise<SimilarCase[]> {
    console.log('PgVectorStore.storeValidationCase called:', {
      category,
      state,
      namespace,
      hasFeatures: !!features,
      confidence,
    })

    // Get embeddings for the image features
    const response = await openai.embeddings.create({
      model: 'text-embedding-ada-002',
      input: generateDescription(features),
      encoding_format: 'float',
    })
    const vector = response.data[0].embedding

    // Prepare metadata
    const metadata: VectorMetadata = {
      category,
      state,
      features,
      diagnosis,
      keyFeatures,
      confidence,
      prompt,
    }

    // Store vector
    try {
      console.log('Storing vector with namespace:', namespace)
      // First ensure namespace exists
      const namespaceRecord = await prisma.namespace.upsert({
        where: { id: namespace },
        update: {},
        create: {
          id: namespace,
          name: namespace,
          updatedAt: new Date(),
        },
      })

      // Then create vector with confirmed namespace
      const vectorData = {
        id: randomUUID(),
        embedding: vector,
        metadata: metadata as unknown as Prisma.JsonValue,
        namespaceId: namespaceRecord.id,
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      await prisma.$executeRaw`
        INSERT INTO "Vector" (id, embedding, metadata, "namespaceId", "createdAt", "updatedAt")
        VALUES (
          ${vectorData.id},
          ${vector}::vector,
          ${vectorData.metadata}::jsonb,
          ${vectorData.namespaceId},
          ${vectorData.createdAt},
          ${vectorData.updatedAt}
        )
      `
      console.log('Successfully stored vector')
    } catch (error) {
      console.error('Failed to store vector:', error)
      throw error
    }

    // Return similar cases
    return this.findSimilarCases(features, category, 5, namespace)
  }

  async findSimilarCases(
    features: ImageFeatures,
    category: Category,
    limit: number = 5,
    namespace: string = '_default_'
  ): Promise<SimilarCase[]> {
    console.log('Finding similar cases:', { category, namespace, limit })

    // Get embeddings for query
    const response = await openai.embeddings.create({
      model: 'text-embedding-ada-002',
      input: generateDescription(features),
      encoding_format: 'float',
    })
    const queryVector = response.data[0].embedding
    console.log('Generated query vector with length:', queryVector.length)

    // Query similar vectors using cosine similarity in PostgreSQL
    console.log('Querying PostgreSQL for similar vectors')
    const vectors = await prisma.$queryRaw`
      WITH similarity_matches AS (
        SELECT 
          v.id,
          v.metadata,
          v."namespaceId",
          v."createdAt",
          v."updatedAt",
          1 - (array_to_vector(${queryVector}::float[]) <=> v.embedding) as similarity
        FROM "Vector" v
        JOIN "Namespace" n ON v."namespaceId" = n.id
        WHERE n.id = ${namespace}
          AND v.metadata->>'category' = ${category}
        ORDER BY array_to_vector(${queryVector}::float[]) <=> v.embedding
        LIMIT ${limit * 2}
      )
      SELECT * FROM similarity_matches
      WHERE similarity > 0.7  -- Only return reasonably similar matches
      ORDER BY similarity DESC
    `

    console.log('Found vectors:', {
      count: (vectors as any[]).length,
      similarities: (vectors as any[]).map((v) => v.similarity),
    })

    // Map results to SimilarCase type
    return (
      vectors as Array<{ metadata: Prisma.JsonValue; similarity: number }>
    ).map((v) => {
      const metadata = v.metadata as unknown as VectorMetadata
      // Convert string diagnosis to ValidationDiagnosis
      const diagnosis: ValidationDiagnosis =
        typeof metadata.diagnosis === 'string'
          ? {
              overall_assessment: metadata.diagnosis,
              confidence_level: metadata.confidence,
              key_observations: [],
              matched_criteria: [],
              failed_criteria: [],
              detailed_explanation: metadata.diagnosis,
            }
          : metadata.diagnosis
      return {
        imageUrl: '', // Required by SimilarCase type but not stored in vector store
        category: metadata.category,
        state: metadata.state,
        features: metadata.features,
        diagnosis,
        keyFeatures: metadata.keyFeatures,
        confidence: metadata.confidence,
        similarity: v.similarity,
      }
    })
  }

  async clearNamespace(namespace: string): Promise<void> {
    await prisma.vector.deleteMany({
      where: {
        namespaceId: namespace,
      },
    })
  }

  async getStats(namespace: string): Promise<{
    totalVectors: number
    categories: { [key: string]: number }
  }> {
    const vectors = await prisma.vector.findMany({
      where: {
        namespaceId: namespace,
      },
      select: {
        metadata: true,
      },
    })

    // Process vectors to get category counts
    const categories: { [key: string]: number } = {}
    vectors.forEach((vector) => {
      const metadata = vector.metadata as Prisma.JsonObject
      const category = String(metadata.category || '')
      categories[category] = (categories[category] || 0) + 1
    })

    return {
      totalVectors: vectors.length,
      categories,
    }
  }

  async deleteVector(namespace: string, vectorId: string): Promise<void> {
    const namespaceRecord = await prisma.namespace.findUnique({
      where: { id: namespace },
    })

    if (!namespaceRecord) {
      throw new Error('Namespace not found')
    }

    await prisma.vector.delete({
      where: {
        id: vectorId,
        namespaceId: namespaceRecord.id,
      },
    })
  }

  async addVector(
    namespace: string,
    embedding: number[],
    metadata: Record<string, any>
  ): Promise<void> {
    // First ensure namespace exists
    const namespaceRecord = await prisma.namespace.upsert({
      where: { id: namespace },
      update: {},
      create: {
        id: namespace,
        name: namespace,
        updatedAt: new Date(),
      },
    })

    // Then create vector with confirmed namespace
    const vectorData = {
      id: randomUUID(),
      embedding: embedding,
      metadata: metadata as unknown as Prisma.JsonValue,
      namespaceId: namespaceRecord.id,
      createdAt: new Date(),
      updatedAt: new Date(),
    }

    await prisma.$executeRaw`
      INSERT INTO "Vector" (id, embedding, metadata, "namespaceId", "createdAt", "updatedAt")
      VALUES (
        ${vectorData.id},
        ${embedding}::vector,
        ${vectorData.metadata}::jsonb,
        ${vectorData.namespaceId},
        ${vectorData.createdAt},
        ${vectorData.updatedAt}
      )
    `
  }

  async findSimilar(
    namespace: string,
    embedding: number[],
    limit: number = 5
  ): Promise<Array<{ id: string; metadata: any; similarity: number }>> {
    // Query similar vectors using cosine similarity in PostgreSQL
    const vectors = await prisma.$queryRaw`
      WITH similarity_matches AS (
        SELECT 
          v.id,
          v.metadata,
          1 - (array_to_vector(${embedding}::float[]) <=> v.embedding) as similarity
        FROM "Vector" v
        JOIN "Namespace" n ON v."namespaceId" = n.id
        WHERE n.id = ${namespace}
        ORDER BY array_to_vector(${embedding}::float[]) <=> v.embedding
        LIMIT ${limit}
      )
      SELECT * FROM similarity_matches
      WHERE similarity > 0.7  -- Only return reasonably similar matches
      ORDER BY similarity DESC
    `

    return (
      vectors as Array<{
        id: string
        metadata: Prisma.JsonValue
        similarity: number
      }>
    ).map((v) => ({
      id: v.id,
      metadata: v.metadata,
      similarity: v.similarity,
    }))
  }
}

// Helper function to calculate cosine similarity
function cosineSimilarity(a: number[], b: number[]): number {
  let dotProduct = 0
  let normA = 0
  let normB = 0

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i]
    normA += a[i] * a[i]
    normB += b[i] * b[i]
  }

  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB))
}
