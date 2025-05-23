import { validateImage } from '@/lib/services/validation'
import { validateCategory, getExpectedStates } from '@/lib/services/guidelines'
import { Category, State } from '@/types/validation'
import sharp from 'sharp'

function normalizeCategoryName(folderPath: string): string {
  const parts = folderPath.split('/')
  const categoryFolder = parts.find((p) => /^\d{2}-/.test(p)) || ''
  return categoryFolder
    .replace(/^\d{2}-/, '')
    .toLowerCase()
    .replace(/\s+/g, '_')
}

function normalizeState(folderPath: string): string {
  const parts = folderPath.split('/')
  const stateFolder =
    parts.find((p) =>
      /(Present|Missing|Visible|No |Has |Bent|Straight|38inch)/.test(p)
    ) || ''

  const state = stateFolder
    .replace(/^\d{2}-/, '')
    .toLowerCase()
    .trim()

  // Map folder names to valid states
  const stateMapping: { [key: string]: string } = {
    'no corrosion': 'clean',
    'has corrosion': 'corroded',
    'no threads': 'missing',
    'threads visible': 'visible',
    'no threads visible': 'missing',
    'threads present': 'present',
    bent: 'bent',
    straight: 'straight',
    present: 'present',
    missing: 'missing',
    visible: 'visible',
    '38inch': 'compliant',
    '38inch minimum': 'compliant',
  }

  // Check if we have a mapping for this state
  const mappedState = stateMapping[state]
  if (mappedState) {
    return mappedState
  }

  // If no mapping found, return the original state
  return state
}

async function processImageBuffer(base64Image: string): Promise<Buffer> {
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
    const image = sharp(buffer)
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

export async function POST(req: Request) {
  try {
    const {
      imageBase64,
      folderPath,
      useVectorStore = true,
      isTrainingMode = false, // Whether this is for training/seeding
      validateWithRules = true, // Whether to use validation rules
    } = await req.json()

    if (!imageBase64 || !folderPath) {
      return new Response(
        JSON.stringify({
          error: 'Missing required fields: imageBase64 or folderPath',
        }),
        { status: 400 }
      )
    }

    const category = normalizeCategoryName(folderPath)
    const expectedState = normalizeState(folderPath)

    const isValidCategory = await validateCategory(category)
    if (!isValidCategory) {
      return new Response(
        JSON.stringify({
          error: `Invalid category: ${category}. Please check available categories in the configuration.`,
        }),
        { status: 400 }
      )
    }

    const validStates = await getExpectedStates(category as Category)
    if (!validStates.includes(expectedState)) {
      return new Response(
        JSON.stringify({
          error: `Invalid state '${expectedState}' for category '${category}'. Valid states are: ${validStates.join(
            ', '
          )}`,
        }),
        { status: 400 }
      )
    }

    try {
      // Process and validate the image buffer
      const imageBuffer = await processImageBuffer(imageBase64)

      // Configure validation options based on mode
      const validationOptions = {
        useVectorStore,
        isGroundTruth: isTrainingMode, // Ground truth if in training mode
        storeResults: isTrainingMode || useVectorStore, // Store if training or vector store enabled
        compareWithRules: validateWithRules,
      }

      // Proceed with validation
      const result = await validateImage(
        imageBuffer,
        category as Category,
        expectedState as State,
        validationOptions
      )

      // Add mode information to response
      const response = {
        ...result,
        mode: isTrainingMode ? 'training' : 'validation',
        vectorStoreUsed: useVectorStore,
        rulesUsed: validateWithRules,
      }

      return new Response(JSON.stringify(response), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
        },
      })
    } catch (error) {
      console.error('Error processing image:', error)
      return new Response(
        JSON.stringify({
          error:
            error instanceof Error
              ? error.message
              : 'Invalid image format or corrupted image data',
        }),
        { status: 400 }
      )
    }
  } catch (error) {
    console.error('Error in validate-image route:', error)
    return new Response(
      JSON.stringify({
        error: 'Internal server error',
      }),
      { status: 500 }
    )
  }
}
