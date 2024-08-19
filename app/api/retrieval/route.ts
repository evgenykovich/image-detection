import fs from 'fs'
import { NextResponse } from 'next/server'
import { qa } from '@/util/ai'

export const POST = async (request: any) => {
  const body = await request.json()
  const { file, question } = body

  if (!file || !question) {
    return new NextResponse(JSON.stringify({ error: 'Invalid request' }), {
      status: 400,
    })
  }
  const pdfBuffer = fs.readFileSync(file.filepath)

  const answer = await qa(question, pdfBuffer)

  return new NextResponse(JSON.stringify({ answer }), {
    status: 200,
  })
}
