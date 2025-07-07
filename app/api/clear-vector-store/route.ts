import { NextResponse } from 'next/server'
import { prisma } from '@/lib/services/prismaService'

export async function POST(request: Request) {
  try {
    const { namespace } = await request.json()

    if (!namespace) {
      return NextResponse.json(
        { error: 'Namespace is required' },
        { status: 400 }
      )
    }

    await prisma.vector.deleteMany({
      where: { namespaceId: namespace },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error clearing vector store:', error)
    return NextResponse.json(
      { error: 'Failed to clear vector store' },
      { status: 500 }
    )
  }
}
