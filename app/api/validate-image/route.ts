import { NextResponse } from 'next/server'
import { OpenAI as langChainOpenAI } from 'langchain/llms/openai'

interface ValidationConfig {
  category: string
  expectedState: string
  prompt: string
}

const getValidationConfig = (folderPath: string): ValidationConfig => {
  const parts = folderPath.split('/')
  const categoryFolder = parts.find((p) => /^\d{2}-/.test(p)) || ''
  const stateFolder =
    parts.find((p) =>
      /(Present|Missing|Visible|No |Has |Bent|Straight|38inch)/.test(p)
    ) || ''

  const category = categoryFolder.replace(/^\d{2}-/, '')
  const expectedState = stateFolder.replace(/^\d{2}-/, '')

  let prompt = ''
  switch (category.toLowerCase()) {
    case 'corrosion':
      prompt = `Analyze this image and determine if there is any visible corrosion. Focus on signs of rust, deterioration, or surface degradation. The image should show ${expectedState.toLowerCase()}.`
      break
    case 'threads':
      prompt = `Examine this image and determine if there are visible threads on the component. The threads should be ${expectedState.toLowerCase()}.`
      break
    case 'connector plates':
      prompt = `Analyze this image and determine if the connector plate is ${expectedState.toLowerCase()}. Look for any bending, straightness, or deformation.`
      break
    case 'cotter pins':
      prompt = `Examine this image and determine if the cotter pins are ${expectedState.toLowerCase()}. Look for the presence or absence of cotter pins in the assembly.`
      break
    case 'spacer plates':
      prompt = `Analyze this image and determine if the spacer plates are ${expectedState.toLowerCase()}. Check for proper placement and presence of spacer plates.`
      break
    case 'postitive connection':
      prompt = `Examine this image and verify if the bolts are ${expectedState.toLowerCase()}. Check for proper bolt installation and presence.`
      break
    case 'cable diameter':
      prompt = `Measure and verify if the cable diameter meets the minimum 38-inch requirement. Look for any signs that indicate the cable diameter is insufficient.`
      break
    default:
      prompt = `Analyze this image and determine if it shows ${expectedState.toLowerCase()} for ${category.toLowerCase()}.`
  }

  return {
    category,
    expectedState,
    prompt,
  }
}

const convertToJpeg = (base64Data: string): string => {
  // Extract the actual base64 data, removing the data URL prefix if present
  const base64Content = base64Data.includes('base64,')
    ? base64Data.split('base64,')[1]
    : base64Data

  // Return as JPEG data URL
  return `data:image/jpeg;base64,${base64Content}`
}

export async function POST(request: Request) {
  try {
    const { imageBase64, folderPath } = await request.json()

    if (!imageBase64 || !folderPath) {
      return NextResponse.json(
        { error: 'Image and folder path are required' },
        { status: 400 }
      )
    }

    // Convert the image to JPEG format
    const jpegImage = convertToJpeg(imageBase64)

    const model = new langChainOpenAI({
      temperature: 0,
      modelName: 'gpt-4o-mini',
      openAIApiKey: process.env.OPENAI_API_KEY,
    })

    const config = getValidationConfig(folderPath)

    const response = await model.call([
      {
        type: 'text',
        text: config.prompt,
      },
      {
        type: 'image_url',
        image_url: {
          url: jpegImage,
        },
      },
    ] as any)

    return NextResponse.json({
      result: response,
      category: config.category,
      expectedState: config.expectedState,
    })
  } catch (error) {
    console.error('Error validating image:', error)
    return NextResponse.json(
      { error: 'Failed to validate image' },
      { status: 500 }
    )
  }
}
