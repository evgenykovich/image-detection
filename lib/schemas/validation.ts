import { z } from 'zod'
import { State } from '@/types/validation'

// Base validation criteria for all categories
export const BaseValidationSchema = z.object({
  is_valid: z
    .boolean()
    .describe('Whether the image meets all validation criteria'),
  confidence: z
    .number()
    .min(0)
    .max(1)
    .describe('Confidence level of the assessment'),
  diagnosis: z.object({
    overall_assessment: z.string().describe('Brief assessment of pass/fail'),
    confidence_level: z.number().min(0).max(1),
    key_observations: z
      .array(z.string())
      .describe('Specific observations about the image'),
    matched_criteria: z
      .array(z.string())
      .describe('Criteria that were successfully met'),
    failed_criteria: z.array(z.string()).describe('Criteria that were not met'),
    detailed_explanation: z.string().describe('Detailed analysis of findings'),
  }),
  explanation: z
    .string()
    .describe('Concise summary of why the image passed or failed validation'),
})

// Generic characteristics schema that can be used for any category
const CharacteristicsSchema = z.object({
  physical_state: z
    .object({
      matches_expected: z
        .boolean()
        .describe('Whether the physical state matches the expected state'),
      has_defects: z.boolean().describe('Whether any defects are present'),
      condition_details: z
        .array(z.string())
        .describe('Detailed observations about physical condition'),
    })
    .optional(),
  measurements: z
    .object({
      meets_requirements: z
        .boolean()
        .describe('Whether measurements meet specifications'),
      measurement_details: z
        .array(z.string())
        .describe('Specific measurement observations'),
    })
    .optional(),
})

// Function to build schema for a category
export function buildSchemaForCategory(category: string) {
  return BaseValidationSchema.extend({
    characteristics: CharacteristicsSchema,
  })
}

// Helper function to build model prompts based on category and state
export function buildPromptFromCategory(
  category: string,
  expectedState: State,
  customPrompt?: string,
  folderDescription?: string
): string {
  // Start with the folder description if available
  let contextPrompt = folderDescription
    ? `Context: ${folderDescription}\n\n`
    : ''

  // Add the custom prompt if provided
  if (customPrompt) {
    return `${contextPrompt}${customPrompt}`
  }

  // Build default prompt based on category and state
  let basePrompt = ''
  switch (category.toLowerCase()) {
    case 'corrosion':
      basePrompt = `${contextPrompt}Analyze this image for signs of corrosion. The expected state is ${expectedState}.
Focus on:
1. Surface condition and color changes
2. Presence of rust, oxidation, or discoloration
3. Material degradation or pitting
4. Surface texture abnormalities
5. Extent and severity of any corrosion
6. Impact on component functionality
7. Comparison with acceptable corrosion limits`
      break

    case 'threads':
      basePrompt = `${contextPrompt}Examine this image and determine if threads are ${expectedState}.
Focus on:
1. Thread visibility and presence
2. Thread pattern and consistency
3. Thread pitch and spacing
4. Thread damage or wear
5. Thread depth and clarity
6. Thread engagement area
7. Signs of cross-threading or stripping`
      break

    case 'connector_plates':
      basePrompt = `${contextPrompt}Analyze this connector plate image and determine if it is ${expectedState}.
Focus on:
1. Overall plate alignment and orientation
2. Any visible bends, warps, or deformations
3. Angles and straightness of edges
4. Signs of physical damage or stress
5. Proper mounting position and alignment
6. Surface condition and integrity
7. Connection point alignment`
      break

    case 'cotter_pins':
      basePrompt = `${contextPrompt}Examine this image and verify if the cotter pin is ${expectedState}.
Focus on:
1. Pin presence and visibility
2. Proper installation orientation
3. Pin spread/bend condition
4. Pin engagement through hole
5. Pin size appropriateness
6. Signs of wear or damage
7. Security of installation`
      break

    case 'spacer_plates':
      basePrompt = `${contextPrompt}Analyze this image to verify if the spacer plate is ${expectedState}.
Focus on:
1. Plate presence and position
2. Proper spacing maintained
3. Plate orientation
4. Surface condition
5. Any signs of movement
6. Proper fitment
7. Signs of wear or damage`
      break

    case 'positive_connection':
      basePrompt = `${contextPrompt}Examine this image to verify if there is a ${expectedState} positive connection.
Focus on:
1. Connection integrity
2. Component engagement
3. Proper alignment
4. Security of fasteners
5. No gaps or looseness
6. Proper seating
7. Signs of movement or separation`
      break

    case 'cable_diameter':
      basePrompt = `${contextPrompt}Analyze this image to determine if the cable diameter is ${expectedState}.
Focus on:
1. Cable diameter measurement
2. Consistent diameter along length
3. Signs of wear or reduction
4. Comparison to required specifications
5. Measurement accuracy
6. Cable roundness
7. Surface condition impact on diameter`
      break

    default:
      basePrompt = `${contextPrompt}Analyze this image and determine if the ${category} is ${expectedState}.
Focus on:
1. Overall condition
2. Presence or absence of the component
3. Any visible damage or wear
4. Proper positioning and alignment
5. Compliance with expected state
6. Component integrity
7. Functional impact`
  }

  return basePrompt
}

// Type for validation results
export type ValidationResult = z.infer<typeof BaseValidationSchema>
