import { NextResponse } from 'next/server'
import { geminiDetectImage, measurments } from '@/util/ai'
import { AIAction, AISelectorEnum } from '@/util/enums'

export const POST = async (request: any) => {
  const body = await request.json()
  const { image, items, aiToUse } = body

  if (!image || !items) {
    return new NextResponse(JSON.stringify({ error: 'Invalid request' }), {
      status: 400,
    })
  }
  let analysisResult = null
  let detectedItems = null
  switch (aiToUse) {
    case AISelectorEnum.OPEN_AI:
      analysisResult = await measurments(image, items)
      detectedItems = analysisResult?.message.content
      break
    case AISelectorEnum.GEMINI:
      analysisResult = await geminiDetectImage(
        image,
        AIAction.MEASURMENTS,
        items
      )
      detectedItems = analysisResult
      break
    default:
      break
  }

  return new NextResponse(JSON.stringify({ detectedItems }), {
    status: 200,
  })
}
