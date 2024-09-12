import { NextResponse } from 'next/server'
import { getValueFromFieldsInImage } from '@/util/ai'

/**
 * Handles POST requests for extracting values from specified fields in an image.
 *
 * @param {Request} request - The incoming HTTP request object.
 * @returns {Promise<NextResponse>} A promise that resolves to a NextResponse object.
 */
export const POST = async (request: Request) => {
  const body = await request.json()
  const { image, fields } = body

  if (!image || !fields) {
    return new NextResponse(JSON.stringify({ error: 'Invalid request' }), {
      status: 400,
    })
  }

  /**
   * Extracts values from specified fields in the image.
   * @type {string} response - The extracted values or analysis result.
   */
  const response = await getValueFromFieldsInImage(image, fields)

  return new NextResponse(JSON.stringify({ response }), {
    status: 200,
  })
}
