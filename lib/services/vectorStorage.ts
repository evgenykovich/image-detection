import { Pinecone } from '@pinecone-database/pinecone'
import OpenAI from 'openai'
import { Category, State, ImageFeatures, SimilarCase } from '@/types/validation'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

const pinecone = new Pinecone({
  apiKey: process.env.PINECONE_API_KEY!,
})

// Initialize index
const index = pinecone.index('image-validation')

// Helper to get namespaced index
function getNamespacedIndex(namespace?: string) {
  if (!namespace) {
    console.warn('No namespace provided, using default namespace')
    return index.namespace('_default_')
  }
  console.log('Using namespace:', namespace)
  return index.namespace(namespace)
}

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

export async function storeValidationCase(
  imageUrl: string,
  category: Category,
  state: State,
  features: ImageFeatures,
  diagnosis: string,
  keyFeatures: string[],
  confidence: number = 0.5, // Default confidence if not provided
  prompt?: string, // Add prompt parameter
  namespace?: string // Default to root namespace if not provided
) {
  try {
    console.log('Storing validation case:', {
      category,
      state,
      confidence,
      namespace,
      features: {
        dimensions: features.metadata.dimensions,
        format: features.metadata.format,
      },
    })

    // Create minimal metadata as a Record<string, string | number>
    const metadata: Record<string, string | number> = {
      category,
      state,
      edges: features.structuralFeatures.edges,
      contrast: features.structuralFeatures.contrast,
      brightness: features.structuralFeatures.brightness,
      sharpness: features.structuralFeatures.sharpness,
      width: features.metadata.dimensions.width,
      height: features.metadata.dimensions.height,
      format: features.metadata.format,
      confidence,
      keyFeatures: JSON.stringify(
        keyFeatures.slice(0, 5).map((f) => f.substring(0, 100))
      ),
    }

    // Add prompt if provided (truncate if too long)
    if (prompt) {
      const truncatedPrompt =
        prompt.length > 500 ? prompt.substring(0, 500) + '...' : prompt
      metadata.prompt = truncatedPrompt
    }

    // Add diagnosis if it's not too long
    let diagnosisValue = diagnosis
    if (typeof diagnosis === 'string') {
      // Clean any markdown code block markers and trim whitespace
      diagnosisValue = diagnosis.replace(/```json\n|\n```/g, '').trim()
      try {
        // If it's a JSON string, parse it and stringify it cleanly
        const parsedDiagnosis = JSON.parse(diagnosisValue)
        diagnosisValue = JSON.stringify(parsedDiagnosis)
      } catch (e) {
        // If not valid JSON, use as is after cleaning markdown
        console.warn('Diagnosis is not valid JSON, using cleaned string')
      }
    } else {
      // If diagnosis is already an object, stringify it cleanly
      diagnosisValue = JSON.stringify(diagnosis)
    }

    // Truncate if too long
    diagnosisValue =
      diagnosisValue.length > 500
        ? diagnosisValue.substring(0, 500) + '...'
        : diagnosisValue
    const tempMetadata = { ...metadata, diagnosis: diagnosisValue }
    const metadataSize = new TextEncoder().encode(
      JSON.stringify(tempMetadata)
    ).length

    if (metadataSize <= 40000) {
      metadata.diagnosis = diagnosisValue
    } else {
      console.warn(
        `Metadata size (${metadataSize} bytes) exceeds limit, storing without diagnosis`
      )
    }

    // Get embeddings for the feature vector
    const response = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: generateDescription(features),
      encoding_format: 'float',
    })

    const vector = response.data[0].embedding

    // Get the namespaced index
    const namespaceIndex = getNamespacedIndex(namespace)

    // Store in Pinecone with confidence in the ID for better tracking
    const id = `${category}-${state}-${confidence.toFixed(2)}-${Date.now()}`
    console.log('Upserting to Pinecone:', {
      id,
      metadata: { ...metadata, diagnosis: undefined },
      namespace: namespace || '_default_',
    })

    // Upsert using namespaced index - don't pass namespace parameter since we're using namespaced index
    await namespaceIndex.upsert([
      {
        id,
        values: vector,
        metadata,
      },
    ])

    console.log('Successfully stored validation case:', id)
  } catch (error) {
    console.error('Failed to store validation case:', {
      error,
      category,
      state,
      stack: error instanceof Error ? error.stack : undefined,
    })
    // Re-throw the error to be handled by the caller
    throw error
  }
}

export async function findSimilarCases(
  features: ImageFeatures,
  category: Category,
  limit: number = 5,
  namespace?: string
): Promise<SimilarCase[]> {
  try {
    console.log('Finding similar cases:', {
      category,
      namespace,
      features: {
        dimensions: features.metadata.dimensions,
        format: features.metadata.format,
      },
    })

    // Get embeddings for the query
    const response = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: generateDescription(features),
      encoding_format: 'float',
    })

    const queryVector = response.data[0].embedding

    // Get the namespaced index
    const namespaceIndex = getNamespacedIndex(namespace)

    // Query using namespaced index - without category filter to get more results
    const queryResponse = await namespaceIndex.query({
      vector: queryVector,
      topK: limit * 2, // Request more results since we'll filter later
      includeMetadata: true,
    })

    console.log('Query response:', {
      totalMatches: queryResponse.matches.length,
      namespace: namespace || '_default_',
      matches: queryResponse.matches.map((m) => ({
        id: m.id,
        score: m.score,
        metadata: m.metadata,
      })),
    })

    // Map results to SimilarCase type and filter by category if needed
    return (
      queryResponse.matches
        .filter((match) => match.metadata)
        .map((match) => {
          const metadata = match.metadata as Record<string, string | number>
          return {
            imageUrl: '',
            category: metadata.category as Category,
            state: metadata.state as State,
            features: {
              structuralFeatures: {
                edges: Number(metadata.edges),
                contrast: Number(metadata.contrast),
                brightness: Number(metadata.brightness),
                sharpness: Number(metadata.sharpness),
              },
              metadata: {
                dimensions: {
                  width: Number(metadata.width),
                  height: Number(metadata.height),
                },
                format: String(metadata.format),
                size: 0,
              },
              visualFeatures: [],
            },
            diagnosis: metadata.diagnosis?.toString() || '',
            confidence: Number(metadata.confidence) || match.score || 0,
            keyFeatures: JSON.parse(metadata.keyFeatures as string),
          }
        })
        // Sort by confidence/score, highest first
        .sort((a, b) => b.confidence - a.confidence)
        // Take the top N results
        .slice(0, limit)
    )
  } catch (error) {
    console.warn('Failed to find similar cases:', error)
    return []
  }
}
