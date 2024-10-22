import { NextResponse } from 'next/server'
import { detectFacesFromImageOpenAI } from '@/util/ai'
import { blurFaceInImage } from '@/util/helpers'

export const POST = async (request: any) => {
  const body = await request.json()
  const { image } = body

  if (!image) {
    return new NextResponse(JSON.stringify({ error: 'Invalid request' }), {
      status: 400,
    })
  }

  const detectedFaces = await detectFacesFromImageOpenAI(image)

  if (!detectedFaces) {
    return new NextResponse(JSON.stringify({ error: 'No faces detected' }), {
      status: 400,
    })
  }

  return new NextResponse(JSON.stringify({ detectedFaces }), {
    status: 200,
  })
}
