import fs from 'fs'
import { NextResponse } from 'next/server'
import { qa } from '@/util/ai'

export const POST = async (request: any) => {
  const formData = await request.formData()
  const file = formData.get('file')
  const question = formData.get('question')

  if (!file || !question) {
    return new NextResponse(JSON.stringify({ error: 'Invalid request' }), {
      status: 400,
    })
  }

  const pdfBuffer = Buffer.from(await file.arrayBuffer())

  const answer = await qa(question, pdfBuffer)

  return new NextResponse(JSON.stringify({ answer }), {
    status: 200,
  })
}
