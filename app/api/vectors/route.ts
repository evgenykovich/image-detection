import { NextResponse } from 'next/server'
import { prisma } from '@/lib/services/prismaService'
import { PgVectorStore } from '@/lib/services/pgVectorStore'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const namespace = searchParams.get('namespace')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '10')
    const offset = (page - 1) * limit

    if (!namespace) {
      return NextResponse.json(
        { error: 'Namespace parameter is required' },
        { status: 400 }
      )
    }

    // Get vectors with pagination
    const vectors = await prisma.vector.findMany({
      where: { namespaceId: namespace },
      select: {
        id: true,
        metadata: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { createdAt: 'desc' },
      skip: offset,
      take: limit,
    })

    // Get total count for pagination
    const totalVectors = await prisma.vector.count({
      where: { namespaceId: namespace },
    })

    return NextResponse.json({
      vectors,
      totalPages: Math.ceil(totalVectors / limit),
      currentPage: page,
      totalVectors,
    })
  } catch (error) {
    console.error('Error getting vectors:', error)
    return NextResponse.json(
      { error: 'Failed to get vectors' },
      { status: 500 }
    )
  }
}

export async function DELETE(request: Request) {
  try {
    const { namespace, vectorId } = await request.json()

    if (!namespace || !vectorId) {
      return NextResponse.json(
        { error: 'Namespace and vectorId are required' },
        { status: 400 }
      )
    }

    const vectorStore = new PgVectorStore()
    await vectorStore.deleteVector(namespace, vectorId)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting vector:', error)
    return NextResponse.json(
      { error: 'Failed to delete vector' },
      { status: 500 }
    )
  }
}
