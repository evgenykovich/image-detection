import { NextResponse } from 'next/server'
import { qa } from '@/util/ai'
import { getPdfBuffer } from '@/util/helpers'

/**
 * Handles POST requests for retrieving answers from a PDF document.
 *
 * @param {Request} request - The incoming HTTP request object.
 * @returns {Promise<NextResponse>} A promise that resolves to a NextResponse object.
 */
export const POST = async (request: Request) => {
  const formData = await request.formData()
  const file = formData.get('file') as File | null
  const question = formData.get('question') as string
  const pdfUrl = formData.get('pdfUrl') as string | null

  if (!question || (!file && !pdfUrl)) {
    return new NextResponse(JSON.stringify({ error: 'Invalid request' }), {
      status: 400,
    })
  }

  let pdfBuffer: Buffer

  try {
    /**
     * Retrieves the PDF buffer from either the uploaded file or the provided URL.
     */
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

  /**
   * Processes the question and PDF buffer to generate an answer.
   */
  const answer = await qa(question, pdfBuffer)

  return new NextResponse(JSON.stringify({ answer }), {
    status: 200,
  })
}
