import OpenAI from 'openai'
import {
  Category,
  State,
  ImageFeatures,
  SimilarCase,
  ValidationDiagnosis,
} from '@/types/validation'
import { VectorStore } from './vectorStoreInterface'
import { PgVectorStore } from './pgVectorStore'

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

// Factory function to get the appropriate vector store
export function getVectorStore(): VectorStore {
  // Always return PostgreSQL implementation now that we've migrated
  return new PgVectorStore()
}

// Export the vector store instance
export const vectorStore = getVectorStore()

// Re-export the helper function for use in other modules
export { generateDescription }
