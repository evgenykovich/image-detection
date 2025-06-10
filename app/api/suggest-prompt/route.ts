import { ChatOpenAI } from 'langchain/chat_models/openai'
import { HumanMessage, SystemMessage } from 'langchain/schema'
import { NextResponse } from 'next/server'
import { normalizeCategoryName, normalizeState } from '../validate-image/route'
import {
  baseValidationTemplate,
  categoryTemplates,
} from '@/lib/config/validation-templates'
import { Category } from '@/types/validation'
import { processImageBuffer } from '../validate-image/route'
export const maxDuration = 300

// Initialize the model with environment variables
const model = new ChatOpenAI({
  modelName: 'gpt-4o-mini',
  maxTokens: 1000,
})

// Helper function to validate and format image data
async function validateAndFormatImage(imageBase64: string): Promise<string> {
  // Remove data URL prefix if present
  const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, '')

  // Detect image format from the base64 header
  let format = ''
  if (base64Data.startsWith('/9j/')) {
    format = 'jpeg'
  } else if (base64Data.startsWith('iVBORw0KGgo')) {
    format = 'png'
  } else if (base64Data.startsWith('R0lGOD')) {
    format = 'gif'
  } else if (base64Data.startsWith('UklGR')) {
    format = 'webp'
  } else {
    throw new Error(
      'Unsupported image format. Please provide a PNG, JPEG, GIF, or WebP image.'
    )
  }

  // Add proper MIME type prefix
  return `data:image/${format};base64,${base64Data}`
}

function buildPromptFromTemplate(
  category: Category,
  state: string,
  description: string
): string {
  const template = categoryTemplates[category]
  if (!template) {
    throw new Error(`No template found for category: ${category}`)
  }

  // Build category-specific validation points
  const validationPoints = template.validationPoints
    .map((point) => {
      let prefix = ''
      switch (point.importance) {
        case 'critical':
          prefix = '[CRITICAL] '
          break
        case 'high':
          prefix = '[HIGH] '
          break
      }
      return `${prefix}${point.description}`
    })
    .join('\n')

  // Add measurement requirements if available
  const measurements = template.measurementRequirements
    ? '\nMeasurement Requirements:\n' +
      template.measurementRequirements
        .map(
          (req) =>
            `- ${req.type}: ${req.tolerance || 'As specified'} (${req.unit})`
        )
        .join('\n')
    : ''

  // Add industry standards if available
  const standards = template.industryStandards
    ? '\nRelevant Standards:\n' +
      template.industryStandards.map((std) => `- ${std}`).join('\n')
    : ''

  // Add safety considerations if available
  const safety = template.safetyConsiderations
    ? '\nSafety Considerations:\n' +
      template.safetyConsiderations.map((safety) => `- ${safety}`).join('\n')
    : ''

  return `${template.description} for ${state} state.

Key Validation Points:
${validationPoints}
${measurements}
${standards}
${safety}

Additional Context:
${description}`
}

async function generatePrompt(
  category: Category,
  state: string,
  description: string,
  imageBase64: string
) {
  try {
    // Validate and format the image
    const formattedImage = await validateAndFormatImage(imageBase64)

    // Create the system prompt
    const systemPrompt = new SystemMessage({
      content: baseValidationTemplate,
    })

    // Build the category-specific prompt
    const categoryPrompt = buildPromptFromTemplate(category, state, description)

    // Create the human message with image and context
    const humanMessage = new HumanMessage({
      content: [
        {
          type: 'text',
          text: `Category: ${categoryTemplates[category].name}\nState: ${state}\n\n${categoryPrompt}`,
        },
        {
          type: 'image_url',
          image_url: {
            url: formattedImage,
          },
        },
      ] as unknown as string,
    })

    // Get the response from the model
    const response = await model.call([systemPrompt, humanMessage])

    return response.content
  } catch (error) {
    console.error('Error generating prompt:', error)
    throw error
  }
}

export async function POST(req: Request) {
  try {
    const { imageBase64, folderPath, description } = await req.json()

    if (!imageBase64) {
      return NextResponse.json(
        { error: 'No image data provided' },
        { status: 400 }
      )
    }

    // Use the same image processing logic from validate-image route
    const imageBuffer = await processImageBuffer(imageBase64)

    const systemPrompt = `You are an expert at analyzing images and creating validation prompts. 
Your task is to suggest a validation prompt based on the image and context provided.

Context:
- Folder Path: ${folderPath}
${description ? `- Description: ${description}` : ''}

Guidelines for the prompt:
1. Focus on key visual characteristics that need validation
2. Include specific measurements or tolerances if visible
3. Consider safety-critical aspects
4. Make the prompt clear and unambiguous
5. Keep it concise but comprehensive

Please suggest a validation prompt that would effectively validate similar images.`

    const message = new HumanMessage(systemPrompt)
    message.additional_kwargs = {
      image: imageBuffer.toString('base64'),
    }

    const response = await model.call([message])

    return NextResponse.json({
      suggestedPrompt: response.content,
    })
  } catch (error) {
    console.error('Error suggesting prompt:', error)
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : 'Failed to suggest prompt',
      },
      { status: 500 }
    )
  }
}
