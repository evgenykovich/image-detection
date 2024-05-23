import { NextResponse } from 'next/server'
import { detect } from '@/util/ai'

export const POST = async (request: any) => {
  const body = await request.json()
  const { image, items } = body

  if (!image || !items) {
    return new NextResponse(JSON.stringify({ error: 'Invalid request' }), {
      status: 400,
    })
  }

  const analysisResult = await detect(image, items)

  const detectedItems = analysisResult.message.content

  return new NextResponse(JSON.stringify({ detectedItems }), {
    status: 200,
  })
}
