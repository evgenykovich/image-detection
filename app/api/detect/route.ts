import { NextResponse } from 'next/server'
import { geminiDetectImage, detect } from '@/util/ai'
import { AISelectorEnum } from '@/util/enums'

export const POST = async (request: any) => {
  const body = await request.json()
  const { image, items, aiToUse } = body
  console.log('aiToUse', aiToUse)

  if (!image || !items) {
    return new NextResponse(JSON.stringify({ error: 'Invalid request' }), {
      status: 400,
    })
  }
  let analysisResult = null
  let detectedItems = null
  switch (aiToUse) {
    case AISelectorEnum.OPEN_AI:
      analysisResult = await detect(image, items)
      detectedItems = analysisResult?.message.content
      break
    case AISelectorEnum.GEMINI:
      analysisResult = await geminiDetectImage(image, items)
      detectedItems = analysisResult
      break
    default:
      break
  }

  // const analysisResult = await detect(image, items)

  return new NextResponse(JSON.stringify({ detectedItems }), {
    status: 200,
  })
}
