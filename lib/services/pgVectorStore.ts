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
import { createClipEmbedding } from '@/util/clip'

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
  const { structuralFeatures, metadata, semanticFeatures } = features
  return `Image Analysis:
Semantic Content: ${semanticFeatures || 'No semantic content detected'}
Format: ${metadata.format}, Size: ${metadata.dimensions.width}x${
    metadata.dimensions.height
  }
Edges: ${structuralFeatures.edges}
Contrast: ${structuralFeatures.contrast}
Brightness: ${structuralFeatures.brightness}
Sharpness: ${structuralFeatures.sharpness}`
}

// Type assertion function to convert any object to JsonObject
function asJsonObject(obj: any): Prisma.JsonObject {
  return obj as Prisma.JsonObject
}

// Helper to convert diagnosis to a Prisma JSON object
function diagnosisToJsonObject(
  diagnosis: ValidationDiagnosis
): Prisma.JsonObject {
  const obj = {
    overall_assessment: diagnosis.overall_assessment,
    confidence_level: diagnosis.confidence_level,
    key_observations: diagnosis.key_observations,
    matched_criteria: diagnosis.matched_criteria,
    failed_criteria: diagnosis.failed_criteria,
    detailed_explanation: diagnosis.detailed_explanation,
  }
  return asJsonObject(obj)
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

// Helper to get CLIP embeddings for an image
async function getClipEmbeddings(imageUrl: string): Promise<number[]> {
  try {
    // If it's a data URL, convert it to a buffer
    let imageBuffer: Buffer
    if (imageUrl.startsWith('data:')) {
      const base64Data = imageUrl.split(',')[1]
      imageBuffer = Buffer.from(base64Data, 'base64')
    } else {
      // Fetch the image if it's a regular URL
      const response = await fetch(imageUrl)
      imageBuffer = Buffer.from(await response.arrayBuffer())
    }

    // Get CLIP embeddings
    return await createClipEmbedding(imageBuffer)
  } catch (error) {
    console.error('Failed to get CLIP embeddings:', error)
    throw error
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

    // Get embeddings using CLIP
    const vector = await getClipEmbeddings(imageUrl)

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
    return this.findSimilarCases(imageUrl, features, category, 5, namespace)
  }

  async findSimilar(
    namespace: string,
    embedding: number[],
    category?: Category,
    limit: number = 5
  ): Promise<
    Array<{ id: string; metadata: VectorMetadata; similarity: number }>
  > {
    try {
      // Get similar vectors using cosine similarity
      const results = await prisma.$queryRaw<
        Array<{ id: string; metadata: VectorMetadata; similarity: number }>
      >`
        SELECT id, metadata, 1 - (embedding <=> ${embedding}::vector) as similarity
        FROM "Vector"
        WHERE "namespaceId" = ${namespace}
        ${
          category
            ? Prisma.sql`AND metadata->>'category' = ${category}`
            : Prisma.empty
        }
        AND 1 - (embedding <=> ${embedding}::vector) > 0.85
        ORDER BY similarity DESC
        LIMIT ${limit}
      `

      return results
    } catch (error) {
      console.error('Failed to find similar vectors:', error)
      throw error
    }
  }

  async findSimilarCases(
    imageUrl: string,
    features: ImageFeatures,
    category: Category,
    limit: number = 5,
    namespace: string = '_default_'
  ): Promise<SimilarCase[]> {
    console.log('Finding similar cases:', {
      category,
      namespace,
      limit,
      hasVisualFeatures: !!features?.visualFeatures,
    })

    try {
      // Get embeddings using CLIP
      const queryVector = await getClipEmbeddings(imageUrl)

      // Find similar vectors
      const results = await this.findSimilar(
        namespace,
        queryVector,
        category,
        limit
      )

      // Convert to SimilarCase format
      return results.map((result) => ({
        imageUrl: '', // We don't store the actual images
        category: result.metadata.category,
        state: result.metadata.state,
        confidence: result.similarity, // Use similarity as confidence
        similarity: result.similarity,
        keyFeatures: result.metadata.keyFeatures || [],
        diagnosis:
          typeof result.metadata.diagnosis === 'string'
            ? undefined
            : (result.metadata.diagnosis as ValidationDiagnosis),
        metadata: {
          prompt: result.metadata.prompt,
        },
      }))
    } catch (error) {
      console.error('Failed to get similar cases:', error)
      throw error
    }
  }

  async clearNamespace(namespace: string): Promise<void> {
    await prisma.namespace.delete({
      where: { id: namespace },
    })
  }

  async getStats(namespace: string): Promise<{
    totalVectors: number
    categories: { [key: string]: number }
  }> {
    const vectors = await prisma.$queryRaw`
      SELECT v.metadata->>'category' as category, COUNT(*) as count
      FROM "Vector" v
      JOIN "Namespace" n ON v."namespaceId" = n.id
      WHERE n.id = ${namespace}
      GROUP BY v.metadata->>'category'
    `

    const categories = (
      vectors as Array<{ category: string; count: number }>
    ).reduce(
      (acc, { category, count }) => ({
        ...acc,
        [category]: Number(count),
      }),
      {} as { [key: string]: number }
    )

    return {
      totalVectors: Object.values(categories).reduce(
        (sum, count) => sum + count,
        0
      ),
      categories,
    }
  }

  async deleteVector(namespace: string, vectorId: string): Promise<void> {
    await prisma.$executeRaw`
      DELETE FROM "Vector" v
      USING "Namespace" n
      WHERE v.id = ${vectorId}
        AND v."namespaceId" = n.id
        AND n.id = ${namespace}
    `
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
      embedding,
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
