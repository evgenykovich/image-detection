import { z } from 'zod'

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
  expectedState: string,
  prompt?: string
) {
  // If custom prompt is provided, use it with folder context
  if (prompt) {
    return `${prompt}

Note: This image is from a folder labeled "${expectedState}".
Please analyze the image based on the prompt above, while considering this folder context.

Respond with a detailed assessment following the exact schema provided.`
  }

  // Default folder-based prompt if no custom prompt provided
  return `Please analyze this image for ${category} validation.
This image is from a folder labeled "${expectedState}", indicating it should be in ${expectedState} state.

Key validation task:
1. Verify if the actual state matches the expected "${expectedState}" state
- Is the component actually in ${expectedState} state as the folder suggests?
- If not, what is its actual state?
- Document any discrepancy between folder classification and actual state

2. Physical State Assessment
- Document specific observations about physical condition
- Note any defects or issues
- Identify any misalignment with expected state

3. Overall Assessment
- Determine if this is valid for the ${expectedState} state folder
- If invalid, explain why it doesn't belong in this folder
- Suggest correct classification if applicable

Respond with a detailed assessment following the exact schema provided.`
}

// Type for validation results
export type ValidationResult = z.infer<typeof BaseValidationSchema>
