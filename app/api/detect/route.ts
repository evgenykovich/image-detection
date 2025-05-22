import { NextResponse } from 'next/server'
import {
  geminiDetectImage,
  detect,
  claudeDetectImage,
  awsRekognitionDetectImage,
} from '@/util/ai'
import { AIAction, AISelectorEnum } from '@/util/enums'
import { base64Helper } from '@/util/helpers'

export const POST = async (request: any) => {
  try {
    const body = await request.json()
    const { image, items, aiToUse } = body

    if (!image || !items) {
      return new NextResponse(JSON.stringify({ error: 'Invalid request' }), {
        status: 400,
      })
    }

    // Ensure we have clean base64 data
    const cleanBase64 = base64Helper(image)

    const detectFunctions = {
      [AISelectorEnum.OPEN_AI]: detect,
      [AISelectorEnum.GEMINI]: (image: string, items: string[]) =>
        geminiDetectImage(image, AIAction.DETECT, items),
      [AISelectorEnum.CLAUDE]: (image: string, items: string[]) =>
        claudeDetectImage(image, AIAction.DETECT, items),
      [AISelectorEnum.AWS_REKOGNITION]: awsRekognitionDetectImage,
    }

    const detectFunction =
      detectFunctions[aiToUse as keyof typeof detectFunctions]

    if (!detectFunction) {
      return new NextResponse(
        JSON.stringify({ error: 'Invalid AI selection' }),
        {
          status: 400,
        }
      )
    }

    const detectedItems = await detectFunction(cleanBase64, items)

    return new NextResponse(JSON.stringify({ detectedItems }), {
      status: 200,
    })
  } catch (error) {
    console.error('Error in detect API:', error)
    return new NextResponse(
      JSON.stringify({ error: 'Error processing image' }),
      { status: 500 }
    )
  }
}
