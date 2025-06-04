import { ChatOpenAI } from 'langchain/chat_models/openai'
import { HumanMessage } from 'langchain/schema'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { ValidationResult, Category, State } from '@/types/validation'
import { extractImageFeatures } from './featureExtraction'
import { findSimilarCases, storeValidationCase } from './vectorStorage'
import {
  buildSchemaForCategory,
  buildPromptFromCategory,
} from '../schemas/validation'

// Initialize models
const openaiModel = new ChatOpenAI({
  modelName: 'gpt-4o-mini',
  temperature: 0,
})

const geminiModel = new GoogleGenerativeAI(
  process.env.GOOGLE_AI_API_KEY || ''
).getGenerativeModel({
  model: 'gemini-1.5-flash-latest',
})

interface ValidationOptions {
  useVectorStore: boolean
  isGroundTruth?: boolean
  measurement?: string
  prompt?: string
  useGemini?: boolean
  namespace?: string
}

async function getModelResponse(
  category: string,
  expectedState: State,
  imageBuffer: Buffer,
  useGemini: boolean = false,
  options?: ValidationOptions
) {
  try {
    // Get the validation schema for this category
    const schema = buildSchemaForCategory(category)

    // Build the prompt using the category, state, and any custom prompt
    const basePrompt = buildPromptFromCategory(
      category,
      expectedState,
      options?.prompt
    )

    const jsonInstructions = `
You are a computer vision expert analyzing images. Your task is to provide a detailed analysis in JSON format.

Your response must be a valid JSON object with this exact structure:
{
  "is_valid": boolean,
  "confidence": number (between 0 and 1),
  "diagnosis": {
    "overall_assessment": string,
    "confidence_level": number (between 0 and 1),
    "key_observations": string[],
    "matched_criteria": string[],
    "failed_criteria": string[],
    "detailed_explanation": string
  },
  "explanation": string,
  "characteristics": {
    "physical_state": {
      "matches_expected": boolean,
      "has_defects": boolean,
      "condition_details": string[]
    },
    "measurements": {
      "meets_requirements": boolean,
      "measurement_details": string[]
    }
  }
}

IMPORTANT:
1. Respond ONLY with the JSON object
2. Do not include any other text or markdown
3. Ensure all fields are present and properly typed
4. Base your analysis purely on what you see in the image

Here is your task:
${basePrompt}`

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
        // Parse and validate response against schema
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
    const message = new HumanMessage(jsonInstructions)
    message.additional_kwargs = {
      image: imageBuffer.toString('base64'),
    }

    const response = await openaiModel.call([message])
    console.log('Raw OpenAI response:', response.content)

    try {
      let content = response.content
      // If the response starts with "I apologize" or similar, try to find JSON in the response
      if (
        content.toLowerCase().includes('i apologize') ||
        content.toLowerCase().includes("i'm sorry")
      ) {
        const jsonMatch = content.match(/\{[\s\S]*\}/)
        if (jsonMatch) {
          content = jsonMatch[0]
        }
      }

      const parsedResponse = JSON.parse(
        content.replace(/```json\n|\n```/g, '').trim()
      )
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
  category: string,
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
    const features = await extractImageFeatures(imageBuffer)

    if (options.isGroundTruth) {
      const groundTruthResult: ValidationResult = {
        isValid: true,
        confidence: 1.0,
        diagnosis: {
          overall_assessment: 'Valid',
          confidence_level: 1.0,
          key_observations: [
            `Ground truth ${expectedState} ${category} example`,
          ],
          matched_criteria: [`Meets ${expectedState} criteria for ${category}`],
          failed_criteria: [],
          detailed_explanation: `This is a reference image provided by the client showing a valid ${expectedState} ${category}.`,
        },
        matchedCriteria: [`Reference image for ${expectedState} ${category}`],
        failedCriteria: [],
        similarCases: [],
        explanation: `Ground truth example of ${expectedState} ${category}`,
        features,
        modelUsed: options.useGemini ? 'Gemini' : 'OpenAI',
        characteristics: {
          physical_state: {
            matches_expected: true,
            has_defects: false,
            condition_details: [`Valid ${expectedState} state`],
          },
        },
      }

      try {
        await storeValidationCase(
          `data:image/jpeg;base64,${imageBuffer.toString('base64')}`,
          category,
          expectedState,
          features,
          groundTruthResult.diagnosis.detailed_explanation,
          groundTruthResult.matchedCriteria,
          1.0,
          options.prompt,
          options.namespace
        )
      } catch (error) {
        console.warn('Failed to store ground truth case:', error)
      }

      return groundTruthResult
    }

    // Get model response using schema-based validation
    const modelResponse = await getModelResponse(
      category,
      expectedState,
      imageBuffer,
      options.useGemini,
      options
    )

    // Build the validation result
    const result: ValidationResult = {
      isValid: options?.prompt
        ? modelResponse.is_valid // For custom prompts, use the direct response
        : modelResponse.characteristics?.physical_state?.matches_expected ===
          false
        ? modelResponse.is_valid // For straight validation, true means it's straight
        : !modelResponse.is_valid, // Invert the validation for bent validation
      confidence: modelResponse.confidence,
      diagnosis: {
        ...modelResponse.diagnosis,
        overall_assessment: options?.prompt
          ? modelResponse.is_valid
            ? 'Valid'
            : 'Invalid'
          : modelResponse.characteristics?.physical_state?.matches_expected ===
            false
          ? 'Valid' // If it's straight when we expect bent, it's valid for straight check
          : 'Invalid', // If it's bent when we expect straight, it's invalid for straight check
        key_observations: [
          ...modelResponse.diagnosis.key_observations,
          modelResponse.characteristics?.physical_state?.condition_details ||
            [],
        ].flat(),
      },
      matchedCriteria: modelResponse.diagnosis.matched_criteria,
      failedCriteria: modelResponse.diagnosis.failed_criteria,
      similarCases: [],
      explanation:
        modelResponse.characteristics?.physical_state?.condition_details?.[0] ||
        (modelResponse.is_valid
          ? 'Connector plate is straight'
          : 'Connector plate is bent'),
      features,
      modelUsed: options.useGemini ? 'Gemini' : 'OpenAI',
      characteristics: modelResponse.characteristics,
    }

    // If vector store is enabled, find and use similar cases
    if (options.useVectorStore) {
      console.log('Vector store enabled, searching for similar cases...')
      try {
        const similarCases = await findSimilarCases(
          features,
          category,
          5, // Default limit
          options.namespace
        )
        console.log('Found similar cases:', {
          count: similarCases.length,
          cases: similarCases.map((c) => ({
            category: c.category,
            state: c.state,
            confidence: c.confidence,
          })),
        })

        result.similarCases = similarCases

        // Adjust confidence based on similar cases if we have high confidence matches
        const highConfidenceCases = similarCases.filter(
          (c) => c.confidence > 0.8
        )

        if (highConfidenceCases.length > 0) {
          console.log('Found high confidence matches:', {
            count: highConfidenceCases.length,
            confidences: highConfidenceCases.map((c) => c.confidence),
          })

          const totalWeight = highConfidenceCases.reduce(
            (sum, c) => sum + c.confidence,
            0
          )
          const weightedConfidence =
            highConfidenceCases.reduce(
              (sum, c) => sum + c.confidence * c.confidence,
              0
            ) / totalWeight

          result.confidence = (result.confidence + weightedConfidence) / 2

          // Add reference match information to observations
          const mostSimilar = highConfidenceCases[0]
          result.diagnosis.key_observations.push(
            `Matches reference image with ${(
              mostSimilar.confidence * 100
            ).toFixed(1)}% confidence`
          )
        } else {
          console.log('No high confidence matches found')
        }
      } catch (error) {
        console.warn('Failed to find or process similar cases:', error)
      }
    } else {
      console.log('Vector store disabled, skipping similar case search')
    }

    return result
  } catch (error) {
    console.error('Validation error:', error)
    return {
      isValid: false,
      confidence: 0,
      diagnosis: {
        overall_assessment: 'Invalid',
        confidence_level: 0,
        key_observations: [],
        matched_criteria: [],
        failed_criteria: ['Validation error occurred'],
        detailed_explanation:
          error instanceof Error ? error.message : 'Unknown error',
      },
      matchedCriteria: [],
      failedCriteria: ['Validation error occurred'],
      similarCases: [],
      explanation: 'Validation failed',
      features: await extractImageFeatures(imageBuffer),
      modelUsed: options.useGemini ? 'Gemini' : 'OpenAI',
      characteristics: {
        physical_state: {
          matches_expected: false,
          has_defects: true,
          condition_details: ['Validation error occurred'],
        },
      },
    }
  }
}
