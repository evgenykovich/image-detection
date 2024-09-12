import { NextResponse } from 'next/server'
import {
  geminiDetectImage,
  detect,
  claudeDetectImage,
  awsRekognitionDetectImage,
} from '@/util/ai'
import { AIAction, AISelectorEnum } from '@/util/enums'

/**
 * Handles POST requests for detecting items in an image using various AI services.
 *
 * @param {Request} request - The incoming HTTP request object.
 * @returns {Promise<NextResponse>} A promise that resolves to a NextResponse object.
 */
export const POST = async (request: Request) => {
  const body = await request.json()
  const { image, items, aiToUse } = body

  if (!image || !items) {
    return new NextResponse(JSON.stringify({ error: 'Invalid request' }), {
      status: 400,
    })
  }

  /**
   * Object mapping AI services to their respective detection functions.
   */
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
    return new NextResponse(JSON.stringify({ error: 'Invalid AI selection' }), {
      status: 400,
    })
  }

  const detectedItems = await detectFunction(image, items)

  return new NextResponse(JSON.stringify({ detectedItems }), {
    status: 200,
  })
}
