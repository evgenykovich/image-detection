import { NextResponse } from 'next/server'
import { claudeDetectImage, geminiDetectImage, measurments } from '@/util/ai'
import { AIAction, AISelectorEnum } from '@/util/enums'

/**
 * Handles POST requests for measuring items in an image using various AI services.
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

  let detectedItems = null

  /**
   * Object mapping AI services to their respective measurement functions.
   * @type {Object.<string, function(string, string[]): Promise<string>>}
   */
  const measurementFunctions = {
    [AISelectorEnum.OPEN_AI]: async (image: string, items: string[]) => {
      const result = await measurments(image, items)
      return result?.message.content
    },
    [AISelectorEnum.GEMINI]: (image: string, items: string[]) =>
      geminiDetectImage(image, AIAction.MEASURMENTS, items),
    [AISelectorEnum.CLAUDE]: (image: string, items: string[]) =>
      claudeDetectImage(image, AIAction.MEASURMENTS, items),
  }

  const measurementFunction =
    measurementFunctions[aiToUse as keyof typeof measurementFunctions]

  if (!measurementFunction) {
    return new NextResponse(JSON.stringify({ error: 'Invalid AI selection' }), {
      status: 400,
    })
  }

  detectedItems = await measurementFunction(image, items)

  return new NextResponse(JSON.stringify({ detectedItems }), {
    status: 200,
  })
}
