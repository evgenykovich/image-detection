import {
  Category,
  State,
  ImageFeatures,
  SimilarCase,
  ValidationDiagnosis,
} from '@/types/validation'

export interface VectorStore {
  storeValidationCase(
    imageUrl: string,
    category: Category,
    state: State,
    features: ImageFeatures,
    diagnosis: string | ValidationDiagnosis,
    keyFeatures: string[],
    confidence?: number,
    prompt?: string,
    namespace?: string
  ): Promise<SimilarCase[]>

  findSimilarCases(
    features: ImageFeatures,
    category: Category,
    limit?: number,
    namespace?: string
  ): Promise<SimilarCase[]>

  clearNamespace(namespace: string): Promise<void>

  getStats(namespace: string): Promise<{
    totalVectors: number
    categories: { [key: string]: number }
  }>

  addVector(
    namespace: string,
    embedding: number[],
    metadata: Record<string, any>
  ): Promise<void>

  findSimilar(
    namespace: string,
    embedding: number[],
    limit?: number
  ): Promise<Array<{ id: string; metadata: any; similarity: number }>>

  deleteVector(namespace: string, vectorId: string): Promise<void>
}
