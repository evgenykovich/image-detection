let Sharp: any

if (typeof window === 'undefined') {
  Sharp = require('sharp')
} else {
  Sharp = null
}

import { validateImage } from '@/lib/services/validation'
import { Category, State } from '@/types/validation'
import { NextResponse } from 'next/server'

export async function processImageBuffer(base64Image: string): Promise<Buffer> {
  try {
    // More robust base64 data extraction
    let base64Data = base64Image

    // Handle data URL format with any image type
    if (base64Image.startsWith('data:')) {
      const matches = base64Image.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/)
      if (!matches || matches.length !== 3) {
        throw new Error('Invalid data URL format')
      }
      base64Data = matches[2]
    }

    // Validate base64 string
    if (!base64Data.match(/^[A-Za-z0-9+/]+={0,2}$/)) {
      throw new Error('Invalid base64 format')
    }

    // Convert to buffer
    const buffer = Buffer.from(base64Data, 'base64')
    if (buffer.length === 0) {
      throw new Error('Empty image buffer')
    }

    // Try to determine format and process with Sharp
    if (!Sharp) {
      throw new Error('Sharp is not available on the client side')
    }

    const image = Sharp(buffer)
    const metadata = await image.metadata()

    if (!metadata.format) {
      throw new Error('Unable to determine image format')
    }

    if (!metadata.width || !metadata.height) {
      throw new Error('Invalid image dimensions')
    }

    console.log('Processing image:', {
      format: metadata.format,
      width: metadata.width,
      height: metadata.height,
      size: buffer.length,
    })

    // Convert to standard format and validate
    return await image
      .toFormat('jpeg', {
        quality: 90,
        chromaSubsampling: '4:4:4', // Better quality for technical images
      })
      .toBuffer()
  } catch (error) {
    console.error('Error processing image buffer:', error)
    const errorMessage =
      error instanceof Error ? error.message : 'unknown error'
    console.error('Full error details:', error)
    throw new Error('Failed to process image: ' + errorMessage)
  }
}

export async function POST(request: Request) {
  try {
    const {
      imageBase64,
      folderPath,
      useVectorStore = true,
      isTrainingMode = false,
      prompt,
      description,
      useGemini = false,
      namespace,
    } = await request.json()

    if (!imageBase64 || !folderPath) {
      return new Response(
        JSON.stringify({
          error: 'Missing required fields: imageBase64 or folderPath',
        }),
        { status: 400 }
      )
    }

    if (useVectorStore && !namespace) {
      return new Response(
        JSON.stringify({
          error: 'Namespace is required when using vector store',
        }),
        { status: 400 }
      )
    }

    // Log the presence of a prompt and description for debugging
    console.log('Validation request:', {
      folderPath,
      hasPrompt: !!prompt,
      hasDescription: !!description,
      promptLength: prompt?.length,
      descriptionLength: description?.length,
      useVectorStore,
      namespace,
    })

    // Process the image
    const imageBuffer = await processImageBuffer(imageBase64)

    // Get category and state from folder path
    const category = normalizeCategoryName(folderPath)
    const { state, measurement } = normalizeState(folderPath)

    // Configure validation options
    const validationOptions = {
      useVectorStore,
      isGroundTruth: isTrainingMode,
      measurement,
      prompt: prompt?.trim() || undefined,
      description: description?.trim() || undefined,
      useGemini,
      namespace,
    }

    // Validate the image
    const result = await validateImage(
      imageBuffer,
      category as Category,
      state as State,
      validationOptions
    )

    // If we have a perfect vector store match (confidence > 0.99), adjust the confidence to 100%
    if (
      useVectorStore &&
      result.similarCases &&
      result.similarCases.length > 0
    ) {
      const perfectMatch = result.similarCases.some((c) => c.confidence > 0.99)
      if (perfectMatch) {
        result.confidence = 1.0
        if (result.diagnosis && typeof result.diagnosis === 'object') {
          result.diagnosis.confidence_level = 1.0
          result.diagnosis.key_observations.push(
            'Exact match found in reference database'
          )
        }
      }
    }

    // Add mode information to response
    const response = {
      ...result,
      mode: isTrainingMode ? 'training' : 'validation',
      vectorStoreUsed: useVectorStore,
      category,
      expectedState: state,
      measurement,
      customPromptUsed: !!prompt,
      folderDescription: description,
      promptSource: 'folder',
    }

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
      },
    })
  } catch (error) {
    console.error('Error handling request:', error)
    return new Response(
      JSON.stringify({
        error: 'Invalid request format',
        details: error instanceof Error ? error.message : 'Unknown error',
      }),
      { status: 400 }
    )
  }
}

export function normalizeCategoryName(folderPath: string): string {
  const parts = folderPath.split('/')
  const categoryFolder = parts.find((p) => /^\d{2}-/.test(p)) || ''
  return categoryFolder
    .replace(/^\d{2}-/, '')
    .toLowerCase()
    .replace(/\s+/g, '_')
}

export function normalizeState(folderPath: string): {
  state: string
  measurement?: string
} {
  const parts = folderPath.split('/')
  const stateFolder =
    parts.find((p) =>
      /(Present|Missing|Visible|No |Has |Bent|Straight|\d+inch)/.test(p)
    ) || ''

  const state = stateFolder
    .replace(/^\d{2}-/, '')
    .toLowerCase()
    .trim()

  // Extract measurement if present (e.g., "38inch minimum" -> "3/8")
  let measurement: string | undefined
  const measurementMatch = state.match(/(\d+)inch/)
  if (measurementMatch) {
    const numValue = parseInt(measurementMatch[1])
    if (numValue === 38) {
      measurement = '3/8'
    } else if (numValue === 25) {
      measurement = '1/4'
    } else {
      measurement = `${numValue}/8` // Default to eighths
    }
  }

  // Map folder names to valid states
  const stateMapping: { [key: string]: string } = {
    // Corrosion states
    'no corrosion': 'clean',
    'has corrosion': 'corroded',
    clean: 'clean',
    corroded: 'corroded',

    // Thread states
    'no threads': 'missing',
    'threads visible': 'visible',
    'no threads visible': 'missing',
    'threads present': 'present',
    'threads missing': 'missing',

    // Connector Plates states
    bent: 'bent',
    straight: 'straight',
    'plate bent': 'bent',
    'plate straight': 'straight',

    // Generic states (for Cotter Pins, Spacer Plates)
    present: 'present',
    missing: 'missing',
    visible: 'visible',
    'not visible': 'missing',
    'not present': 'missing',

    // Cable Diameter states - now handled dynamically
    minimum: 'compliant',
    below: 'non_compliant',
    under: 'non_compliant',

    // Positive Connection states
    secure: 'secure',
    unsecure: 'unsecure',
    proper: 'secure',
    improper: 'unsecure',
    connected: 'secure',
    disconnected: 'unsecure',
  }

  // Check if we have a mapping for this state
  let mappedState = stateMapping[state]

  // Handle diameter measurements
  if (!mappedState && measurementMatch) {
    if (state.includes('minimum') || state.includes('above')) {
      mappedState = 'compliant'
    } else if (state.includes('below') || state.includes('under')) {
      mappedState = 'non_compliant'
    }
  }

  // If no mapping found, return the original state
  return {
    state: mappedState || state,
    measurement,
  }
}
