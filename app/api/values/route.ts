import { NextResponse } from 'next/server'
import { getValueFromFieldsInImage } from '@/util/ai'

export const POST = async (request: any) => {
  const body = await request.json()
  const { image, fields } = body

  if (!image || !fields) {
    return new NextResponse(JSON.stringify({ error: 'Invalid request' }), {
      status: 400,
    })
  }

  const response = await getValueFromFieldsInImage(image, fields)

  return new NextResponse(JSON.stringify({ response }), {
    status: 200,
  })
}
