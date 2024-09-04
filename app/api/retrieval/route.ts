import { NextResponse } from 'next/server'
import { qa } from '@/util/ai'

const getPdfBuffer = async (
  file: File | null,
  pdfUrl: string | null
): Promise<Buffer> => {
  if (file) {
    return Buffer.from(await file.arrayBuffer())
  }

  if (pdfUrl) {
    const response = await fetch(pdfUrl)
    if (!response.ok) {
      throw new Error('Failed to fetch PDF from URL')
    }
    return Buffer.from(await response.arrayBuffer())
  }

  throw new Error('No file or URL provided')
}

export const POST = async (request: any) => {
  const formData = await request.formData()
  const file = formData.get('file')
  const question = formData.get('question')
  const pdfUrl = formData.get('pdfUrl')

  if (!question || (!file && !pdfUrl)) {
    return new NextResponse(JSON.stringify({ error: 'Invalid request' }), {
      status: 400,
    })
  }

  let pdfBuffer: Buffer

  try {
    pdfBuffer = await getPdfBuffer(file, pdfUrl)
  } catch (error) {
    return new NextResponse(
      JSON.stringify({
        error: (error as Error).message || 'An error occurred',
      }),
      {
        status: 400,
      }
    )
  }

  const answer = await qa(question, pdfBuffer)

  return new NextResponse(JSON.stringify({ answer }), {
    status: 200,
  })
}
