import { Pinecone } from '@pinecone-database/pinecone'
import OpenAI from 'openai'
import {
  Category,
  State,
  ImageFeatures,
  SimilarCase,
  ValidationDiagnosis,
} from '@/types/validation'

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
  diagnosis: string | ValidationDiagnosis,
  keyFeatures: string[],
  confidence: number = 0.5,
  prompt?: string,
  namespace?: string
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

    // Process diagnosis
    let diagnosisValue: ValidationDiagnosis
    if (typeof diagnosis === 'string') {
      // Clean any markdown code block markers and trim whitespace
      const cleanedDiagnosis = diagnosis.replace(/```json\n|\n```/g, '').trim()
      try {
        // If it's a JSON string, parse it
        const parsedDiagnosis = JSON.parse(cleanedDiagnosis)
        if (typeof parsedDiagnosis === 'object' && parsedDiagnosis !== null) {
          diagnosisValue = {
            overall_assessment: parsedDiagnosis.overall_assessment || 'Unknown',
            confidence_level: parsedDiagnosis.confidence_level || confidence,
            key_observations: parsedDiagnosis.key_observations || [
              cleanedDiagnosis,
            ],
            matched_criteria: parsedDiagnosis.matched_criteria || [],
            failed_criteria: parsedDiagnosis.failed_criteria || [],
            detailed_explanation:
              parsedDiagnosis.detailed_explanation || cleanedDiagnosis,
          }
        } else {
          diagnosisValue = {
            overall_assessment: 'Unknown',
            confidence_level: confidence,
            key_observations: [cleanedDiagnosis],
            matched_criteria: [],
            failed_criteria: [],
            detailed_explanation: cleanedDiagnosis,
          }
        }
      } catch (e) {
        // If not valid JSON, create a simple diagnosis object
        diagnosisValue = {
          overall_assessment: 'Unknown',
          confidence_level: confidence,
          key_observations: [cleanedDiagnosis],
          matched_criteria: [],
          failed_criteria: [],
          detailed_explanation: cleanedDiagnosis,
        }
      }
    } else {
      // If diagnosis is already a ValidationDiagnosis object
      diagnosisValue = diagnosis
    }

    metadata.diagnosis = JSON.stringify(diagnosisValue)

    // Get embeddings for the feature vector
    const featureDescription = generateDescription(features)
    const embeddingResponse = await openai.embeddings.create({
      input: featureDescription,
      model: 'text-embedding-ada-002',
    })

    const vector = embeddingResponse.data[0].embedding

    // Store in Pinecone
    const namespacedIndex = getNamespacedIndex(namespace)
    await namespacedIndex.upsert([
      {
        id: `${category}-${state}-${Date.now()}`,
        values: vector,
        metadata,
      },
    ])

    // Return an array with a single SimilarCase object
    const similarCase: SimilarCase = {
      imageUrl,
      category,
      state,
      confidence,
      keyFeatures,
      diagnosis: diagnosisValue,
    }

    return [similarCase]
  } catch (error) {
    console.error('Error storing validation case:', error)
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

          // Parse diagnosis from metadata
          let diagnosisValue: ValidationDiagnosis
          try {
            const diagnosisStr = metadata.diagnosis?.toString() || ''
            const parsedDiagnosis = JSON.parse(diagnosisStr)
            diagnosisValue = {
              overall_assessment:
                parsedDiagnosis.overall_assessment || 'Unknown',
              confidence_level:
                parsedDiagnosis.confidence_level ||
                Number(metadata.confidence) ||
                match.score ||
                0,
              key_observations: parsedDiagnosis.key_observations || [],
              matched_criteria: parsedDiagnosis.matched_criteria || [],
              failed_criteria: parsedDiagnosis.failed_criteria || [],
              detailed_explanation: parsedDiagnosis.detailed_explanation || '',
            }
          } catch (e) {
            // If parsing fails, create a default diagnosis
            diagnosisValue = {
              overall_assessment: 'Unknown',
              confidence_level: Number(metadata.confidence) || match.score || 0,
              key_observations: [],
              matched_criteria: [],
              failed_criteria: [],
              detailed_explanation: metadata.diagnosis?.toString() || '',
            }
          }

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
            diagnosis: diagnosisValue,
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
