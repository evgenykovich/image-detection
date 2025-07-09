import OpenAI from 'openai'
import { GoogleGenerativeAI } from '@google/generative-ai'
import {
  ValidationResult,
  Category,
  State,
  ValidationDiagnosis,
  Characteristics,
  SimilarCase,
} from '@/types/validation'
import { extractImageFeatures } from './featureExtraction'
import { vectorStore } from './vectorStorage'
import {
  buildSchemaForCategory,
  buildPromptFromCategory,
  getCategoryValidationCriteria,
} from '../schemas/validation'
import {
  baseValidationTemplate,
  categoryTemplates,
} from '../config/validation-templates'

// Initialize models
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

const geminiModel = new GoogleGenerativeAI(
  process.env.GOOGLE_AI_API_KEY || ''
).getGenerativeModel({
  model: 'gemini-1.5-flash-latest',
})

// Define multimodal message type
interface MultiModalContent {
  type: 'text' | 'image_url'
  text?: string
  image_url?: {
    url: string
  }
}

interface ValidationOptions {
  useVectorStore: boolean
  isGroundTruth?: boolean
  measurement?: string
  prompt?: string
  description?: string
  useGemini?: boolean
  namespace?: string
}

async function getModelResponse(
  category: Category,
  expectedState: State,
  imageBuffer: Buffer,
  useGemini: boolean = false,
  options?: ValidationOptions
) {
  try {
    const schema = buildSchemaForCategory(category)

    // Get the category-specific template
    const basePrompt = buildPromptFromCategory(
      category,
      expectedState,
      options?.prompt,
      options?.description
    )

    const jsonInstructions = `${basePrompt}

CRITICAL: You MUST respond with ONLY a JSON object. DO NOT include any other text, explanations, or markdown formatting.
The JSON object MUST follow this exact format:

{
  "is_valid": boolean,        // true if validation criteria are met
  "confidence": number,       // confidence in your assessment (0-1):
                             // 0.8-1.0 = very sure about assessment (whether positive or negative)
                             // 0.4-0.7 = can see the component but some aspects unclear
                             // 0.1-0.3 = cannot properly analyze the image
  "diagnosis": {
    "overall_assessment": string,     // One sentence summary
    "confidence_level": number,       // Same as top-level confidence
    "key_observations": string[],     // List ALL visible features, even if uncertain
    "matched_criteria": string[],     // List of criteria that were met
    "failed_criteria": string[],      // List of criteria that failed or couldn't be assessed
    "detailed_explanation": string    // Explain what you see and why you can/cannot make an assessment
  },
  "explanation": string,
  "characteristics": {
    "physical_state": {
      "matches_expected": boolean,
      "has_defects": boolean,
      "condition_details": string[]
    }
  }
}`

    if (useGemini) {
      const base64Image = imageBuffer.toString('base64')
      const result = await geminiModel.generateContent([
        jsonInstructions,
        {
          inlineData: {
            data: base64Image,
            mimeType: 'image/jpeg',
          },
        },
      ])

      const response = result.response.text()
      console.log('Raw Gemini response:', response)

      try {
        const parsedResponse = JSON.parse(
          response.replace(/```json\n|\n```/g, '').trim()
        )
        return schema.parse(parsedResponse)
      } catch (error) {
        console.error('Failed to parse Gemini response:', error)
        throw new Error('Invalid JSON response from Gemini')
      }
    }

    // OpenAI path
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: jsonInstructions,
            },
            {
              type: 'image_url',
              image_url: {
                url: `data:image/jpeg;base64,${imageBuffer.toString('base64')}`,
              },
            },
          ],
        },
      ],
      temperature: 0,
    })

    console.log('Raw OpenAI response:', response.choices[0].message.content)

    try {
      let content = response.choices[0].message.content || ''

      // First try to find JSON block in code fence
      const codeFenceMatch = content.match(/```(?:json)?\n([\s\S]*?)\n```/)
      if (codeFenceMatch) {
        content = codeFenceMatch[1].trim()
      } else {
        // If no code fence, try to find JSON object directly
        const jsonMatch = content.match(/\{[\s\S]*\}/)
        if (jsonMatch) {
          content = jsonMatch[0]
        } else {
          throw new Error('No JSON found in response')
        }
      }

      // Clean up any remaining non-JSON text
      content = content.replace(/^[^{]*/, '').replace(/[^}]*$/, '')

      const parsedResponse = JSON.parse(content.trim())
      return schema.parse(parsedResponse)
    } catch (error) {
      console.error('Failed to parse OpenAI response:', error)
      throw new Error('Invalid JSON response from OpenAI')
    }
  } catch (error) {
    console.error(
      `Error in ${useGemini ? 'Gemini' : 'OpenAI'} model response:`,
      error
    )
    throw error
  }
}

export async function validateImage(
  imageBuffer: Buffer,
  category: Category,
  expectedState: State,
  options: ValidationOptions = {
    useVectorStore: true,
    isGroundTruth: false,
    useGemini: false,
  }
): Promise<ValidationResult> {
  try {
    console.log('Using Gemini:', options.useGemini)
    console.log('Custom prompt:', options.prompt)
    console.log('Using namespace:', options.namespace)

    // Only extract features if using vector store
    let features = null
    if (options.useVectorStore) {
      features = await extractImageFeatures(imageBuffer)
    }

    // Get model response
    const modelResponse = await getModelResponse(
      category,
      expectedState,
      imageBuffer,
      options.useGemini,
      options
    )

    // Find similar cases if vector store is enabled
    let similarCases: SimilarCase[] = []
    let adjustedConfidence = modelResponse.confidence
    if (options.useVectorStore && features) {
      // Convert buffer to data URL for CLIP processing
      const imageUrl = `data:image/jpeg;base64,${imageBuffer.toString(
        'base64'
      )}`
      similarCases = await vectorStore.findSimilarCases(
        imageUrl,
        features,
        category,
        5,
        options.namespace || '_default_'
      )

      // Adjust validation based on vector store matches
      if (similarCases.length > 0) {
        // Get the highest similarity match
        const bestMatch = similarCases[0]
        console.log('Best vector match:', {
          similarity: bestMatch.similarity,
          originalConfidence: bestMatch.confidence,
          category: bestMatch.category,
          state: bestMatch.state,
          keyFeatures: bestMatch.keyFeatures,
        })

        // If we have a very close match (similarity > 0.9)
        if (bestMatch.similarity > 0.9) {
          // When using vector store matches, our confidence should be based on the similarity score
          adjustedConfidence = bestMatch.similarity
          console.log('Using similarity as confidence:', adjustedConfidence)

          // For very high confidence matches, use the reference image's validation state
          if (bestMatch.similarity > 0.9) {
            // Get validation criteria for the current category
            const validationCriteria = getCategoryValidationCriteria(category)

            // Create a completely new diagnosis object for high confidence matches
            const validationDiagnosis = {
              overall_assessment: `The image is valid, matching a verified reference image with ${Math.round(
                bestMatch.similarity * 100
              )}% confidence.`,
              confidence_level: adjustedConfidence,
              key_observations: [
                `Image matches a verified reference image with ${Math.round(
                  bestMatch.similarity * 100
                )}% similarity`,
                'All validation criteria met based on reference match',
                ...(bestMatch.keyFeatures || []),
              ],
              matched_criteria: validationCriteria,
              failed_criteria: [],
              detailed_explanation: `The image shows a valid configuration, verified through high-similarity matching with a reference image from ${
                bestMatch.metadata?.prompt || 'the reference set'
              }. All standard validation criteria are met based on this match.`,
            }

            // Update all properties of the model response
            modelResponse.is_valid = true
            modelResponse.confidence = adjustedConfidence
            modelResponse.diagnosis = validationDiagnosis
            modelResponse.explanation = `This image closely matches a verified reference image (${Math.round(
              bestMatch.similarity * 100
            )}% similarity) from ${
              bestMatch.metadata?.prompt || 'the reference set'
            }, indicating it meets all validation criteria.`
            modelResponse.characteristics = {
              physical_state: {
                matches_expected: true,
                has_defects: false,
                condition_details: [
                  `Matches verified reference image with ${Math.round(
                    bestMatch.similarity * 100
                  )}% similarity`,
                  `Reference image from: ${
                    bestMatch.metadata?.prompt || 'reference set'
                  }`,
                  `All validation criteria met based on reference match`,
                ],
              },
            }

            console.log(
              'High similarity match found, using reference validation:',
              modelResponse
            )
          }
        }
      }

      // Store validation case if it's ground truth
      if (options.isGroundTruth && features) {
        const imageUrl = `data:image/jpeg;base64,${imageBuffer.toString(
          'base64'
        )}`
        await vectorStore.storeValidationCase(
          imageUrl,
          category,
          expectedState,
          features,
          modelResponse.diagnosis,
          modelResponse.diagnosis.key_observations,
          modelResponse.confidence,
          options.prompt,
          options.namespace || '_default_'
        )
        console.log('Stored ground truth case in vector store')
      }
    }

    // Update the response with adjusted confidence
    modelResponse.confidence = adjustedConfidence
    modelResponse.diagnosis.confidence_level = adjustedConfidence

    // Log final response before returning
    const finalResponse = {
      is_valid: modelResponse.is_valid,
      confidence: adjustedConfidence,
      diagnosis: {
        ...modelResponse.diagnosis,
        confidence_level: adjustedConfidence,
      },
      matched_criteria: modelResponse.diagnosis.matched_criteria,
      failed_criteria: modelResponse.diagnosis.failed_criteria,
      similarCases,
      explanation: modelResponse.explanation,
      features: features || null,
      modelUsed: options.useGemini ? 'Gemini' : 'OpenAI',
      characteristics: {
        physical_state: modelResponse.characteristics?.physical_state || {
          matches_expected: false,
          has_defects: false,
          condition_details: [],
        },
      },
    }

    console.log('Final validation response:', {
      is_valid: finalResponse.is_valid,
      confidence: finalResponse.confidence,
      diagnosis: {
        overall_assessment: finalResponse.diagnosis.overall_assessment,
        confidence_level: finalResponse.diagnosis.confidence_level,
        matched_criteria: finalResponse.matched_criteria,
        failed_criteria: finalResponse.failed_criteria,
      },
      similarCases: finalResponse.similarCases.map((c) => ({
        similarity: c.similarity,
        confidence: c.confidence,
        category: c.category,
        state: c.state,
      })),
    })

    return finalResponse
  } catch (error) {
    console.error('Validation error:', error)
    throw error
  }
}
