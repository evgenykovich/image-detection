import { NextResponse } from 'next/server'
import { test } from '@/util/ai'

export const POST = async (request: any) => {
  const body = await request.json()
  const { image, items } = body

  if (!image || !items) {
    return new NextResponse(JSON.stringify({ error: 'Invalid request' }), {
      status: 400,
    })
  }

  // const analysisResult = await analyze(image, items)
  const analysisResult = await test(image, items)

  console.log('analysisResult', analysisResult)

  // if (!analysisResult) {
  //   return new NextResponse(JSON.stringify({ error: 'Analysis failed' }), {
  //     status: 500,
  //   })
  // }

  // const detectedItems = analysisResult.objectsOnImage
  //   .split(',')
  //   .map((item: string) => item.trim())
  // const missingItems = items.filter(
  //   (item: any) => !detectedItems.includes(item)
  // )

  const detectedItems = analysisResult.message.content

  return new NextResponse(JSON.stringify({ detectedItems }), {
    status: 200,
  })
}

export const config = {
  api: {
    bodyParser: true,
  },
}
