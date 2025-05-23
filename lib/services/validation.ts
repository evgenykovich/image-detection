import { ChatOpenAI } from 'langchain/chat_models/openai'
import { HumanMessage } from 'langchain/schema'
import {
  ValidationResult,
  ValidationContext,
  Category,
  State,
  SimilarCase,
} from '@/types/validation'
import { extractImageFeatures } from './featureExtraction'
import { findSimilarCases, storeValidationCase } from './vectorStorage'
import { getCategoryGuidelines, getValidationCriteria } from './guidelines'

const model = new ChatOpenAI({
  modelName: 'gpt-4o-mini',
  temperature: 0,
})

const CONFIDENCE_THRESHOLDS = {
  HIGH: 0.8, // Use for immediate decisions based on similar cases
  MEDIUM: 0.6, // Use for storing as training data
  LOW: 0.4, // Use for requiring additional validation
}

interface ValidationOptions {
  useVectorStore: boolean // Whether to use vector store for validation
  isGroundTruth?: boolean // Whether this is ground truth data for training
  storeResults?: boolean // Whether to store results in vector store
  compareWithRules?: boolean // Whether to compare with validation rules
}

export async function validateImage(
  imageBuffer: Buffer,
  category: Category,
  expectedState: State,
  options: ValidationOptions = {
    useVectorStore: true,
    isGroundTruth: false,
    storeResults: true,
    compareWithRules: true,
  }
): Promise<ValidationResult> {
  // 1. Extract image features
  const features = await extractImageFeatures(imageBuffer)

  let vectorStoreResult: ValidationResult | null = null
  let rulesResult: ValidationResult | null = null

  // 2. If using vector store, get similar cases and vector-based validation
  if (options.useVectorStore) {
    try {
      const similarCases = await findSimilarCases(features, category, 10)

      if (similarCases.length > 0) {
        // Calculate state distribution from similar cases
        const stateDistribution = similarCases.reduce((acc, curr) => {
          acc[curr.state] = (acc[curr.state] || 0) + curr.confidence
          return acc
        }, {} as Record<string, number>)

        // Normalize scores
        const total = Object.values(stateDistribution).reduce(
          (a, b) => a + b,
          0
        )
        const normalizedDistribution = Object.entries(stateDistribution).reduce(
          (acc, [state, score]) => {
            acc[state] = score / total
            return acc
          },
          {} as Record<string, number>
        )

        // Get prediction and confidence from vectorstore
        const [predictedState, confidence] = Object.entries(
          normalizedDistribution
        ).reduce((a, b) => (b[1] > a[1] ? b : a))

        vectorStoreResult = {
          isValid: predictedState === expectedState,
          confidence,
          diagnosis: `Based on ${
            similarCases.length
          } similar training examples, this image shows ${predictedState} with ${(
            confidence * 100
          ).toFixed(1)}% confidence`,
          matchedCriteria: similarCases
            .filter((c) => c.state === predictedState)
            .flatMap((c) => c.keyFeatures),
          failedCriteria: [],
          similarCases,
          explanation: `Vector store analysis: Strong match with training examples showing ${predictedState}`,
          features,
        }
      }
    } catch (error) {
      console.warn('Failed to get vector store results:', error)
    }
  }

  // 3. If comparing with rules, perform rules-based validation
  if (options.compareWithRules) {
    try {
      // Get category guidelines and criteria
      const [guidelines, criteria] = await Promise.all([
        getCategoryGuidelines(category),
        getValidationCriteria(category),
      ])

      // Build validation context
      const context: ValidationContext = {
        features,
        similarCases: vectorStoreResult?.similarCases || [],
        categoryGuidelines: guidelines,
        rules: guidelines.rules,
      }

      // Get vision model analysis
      const prompt = buildEnhancedPrompt(
        context,
        category,
        expectedState,
        criteria
      )
      const message = new HumanMessage(prompt)
      message.additional_kwargs = {
        image: imageBuffer.toString('base64'),
      }

      const response = await model.call([message])
      rulesResult = parseAnalysisResponse(response.content, context)
      rulesResult.explanation =
        'Rules-based analysis: ' + rulesResult.explanation
    } catch (error) {
      console.warn('Failed to get rules-based results:', error)
    }
  }

  // 4. Combine results or use available result
  let finalResult: ValidationResult
  if (vectorStoreResult && rulesResult) {
    // Combine both results
    const agreementBonus =
      vectorStoreResult.isValid === rulesResult.isValid ? 0.1 : -0.1
    finalResult = {
      isValid:
        vectorStoreResult.confidence > rulesResult.confidence
          ? vectorStoreResult.isValid
          : rulesResult.isValid,
      confidence: Math.min(
        1.0,
        Math.max(vectorStoreResult.confidence, rulesResult.confidence) +
          agreementBonus
      ),
      diagnosis: `Combined Analysis:\n\nVector Store: ${vectorStoreResult.diagnosis}\n\nRules Based: ${rulesResult.diagnosis}`,
      matchedCriteria: Array.from(
        new Set([
          ...vectorStoreResult.matchedCriteria,
          ...rulesResult.matchedCriteria,
        ])
      ),
      failedCriteria: Array.from(
        new Set([
          ...vectorStoreResult.failedCriteria,
          ...rulesResult.failedCriteria,
        ])
      ),
      similarCases: vectorStoreResult.similarCases,
      explanation: `${vectorStoreResult.explanation}\n\n${rulesResult.explanation}`,
      features,
    }
  } else {
    finalResult = vectorStoreResult ||
      rulesResult || {
        isValid: false,
        confidence: 0,
        diagnosis: 'No validation results available',
        matchedCriteria: [],
        failedCriteria: ['No validation performed'],
        similarCases: [],
        explanation: 'Failed to perform validation',
        features,
      }
  }

  // 5. Store result if requested and either ground truth or high confidence
  if (
    options.storeResults &&
    (options.isGroundTruth ||
      finalResult.confidence > CONFIDENCE_THRESHOLDS.MEDIUM)
  ) {
    try {
      await storeValidationCase(
        `data:image/jpeg;base64,${imageBuffer.toString('base64')}`,
        category,
        expectedState,
        features,
        finalResult.diagnosis,
        finalResult.matchedCriteria.concat(finalResult.failedCriteria),
        options.isGroundTruth ? 1.0 : finalResult.confidence
      )
    } catch (error) {
      console.warn('Failed to store validation case:', error)
    }
  }

  return finalResult
}

function buildEnhancedPrompt(
  context: ValidationContext,
  category: Category,
  expectedState: State,
  criteria: any
): string {
  const { similarCases, categoryGuidelines } = context

  // Build context from similar cases if available
  const similarCasesContext =
    similarCases.length > 0
      ? `Similar training examples:\n${similarCases
          .map(
            (case_) =>
              `- ${case_.state} example (${(case_.confidence * 100).toFixed(
                1
              )}% match):
Key features: ${case_.keyFeatures.join(', ')}`
          )
          .join('\n')}`
      : 'No similar training examples available.'

  // Build visual criteria context
  const visualCriteriaContext = criteria.visual.features
    .map(
      (feature: any) =>
        `${feature.name}: ${feature.description}
Threshold: ${feature.threshold} ± ${feature.tolerance}
Failure mode: ${feature.failureMode}`
    )
    .join('\n')

  // Build measurement criteria context
  const measurementContext = criteria.measurements
    .map(
      (measurement: any) =>
        `${measurement.name} (${measurement.unit}):
Threshold: ${measurement.threshold} ± ${measurement.tolerance}
Critical points: ${measurement.criticalPoints.join(', ')}`
    )
    .join('\n')

  // Build contextual requirements
  const contextualRequirements = `
Required elements: ${criteria.contextual.requiredElements.join(', ')}
Forbidden elements: ${criteria.contextual.forbiddenElements.join(', ')}
Key relationships:
${criteria.contextual.relationships
  .map(
    (rel: any) =>
      `- ${rel.description}: ${rel.elements.join(' + ')} (${rel.condition})`
  )
  .join('\n')}`

  return `You are an expert inspector for ${category} validation, with access to training examples and detailed criteria.

Training Examples Analysis:
${similarCasesContext}

Visual Criteria:
${visualCriteriaContext}

Measurement Requirements:
${measurementContext}

Contextual Requirements:${contextualRequirements}

Category guidelines:
Good examples: ${categoryGuidelines.goodExamples.join(', ')}
Bad examples: ${categoryGuidelines.badExamples.join(', ')}
Critical points: ${categoryGuidelines.criticalPoints.join(', ')}

Analyze this image and determine if it shows ${expectedState} for ${category}.
Focus on:
1. Comparison with training examples
2. Meeting visual criteria thresholds
3. Satisfying measurement requirements
4. Fulfilling contextual requirements
5. Compliance with category guidelines

Provide a detailed analysis with:
1. Overall assessment (valid/invalid)
2. Confidence level (0-1)
3. Key observations
4. Matched criteria
5. Failed criteria
6. Detailed explanation

Format your response as JSON with these fields.`
}

function parseAnalysisResponse(
  analysis: string,
  context: ValidationContext
): ValidationResult {
  try {
    const parsed = JSON.parse(analysis)
    return {
      isValid: parsed.overall_assessment?.toLowerCase() === 'valid',
      confidence: parsed.confidence_level || 0.5,
      diagnosis: parsed.detailed_explanation || analysis,
      matchedCriteria: parsed.matched_criteria || [],
      failedCriteria: parsed.failed_criteria || [],
      similarCases: context.similarCases,
      explanation: parsed.detailed_explanation || analysis,
      features: context.features,
    }
  } catch (error) {
    // Fallback parsing for non-JSON responses
    return {
      isValid: analysis.toLowerCase().includes('valid'),
      confidence: 0.5,
      diagnosis: analysis,
      matchedCriteria: [],
      failedCriteria: [],
      similarCases: context.similarCases,
      explanation: analysis,
      features: context.features,
    }
  }
}
