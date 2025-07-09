import { NextResponse } from 'next/server'
import { prisma } from '@/lib/services/prismaService'
import { Prisma } from '@prisma/client'

interface VectorData {
  id: string
  metadata: Prisma.JsonValue
  createdAt: Date
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const namespace = searchParams.get('namespace')

    if (!namespace) {
      return NextResponse.json(
        { error: 'Namespace parameter is required' },
        { status: 400 }
      )
    }

    // Get vector count for the namespace
    const vectorCount = await prisma.vector.count({
      where: { namespaceId: namespace },
    })

    // Get the namespace details
    const namespaceDetails = await prisma.namespace.findUnique({
      where: { id: namespace },
      select: {
        name: true,
        createdAt: true,
        updatedAt: true,
      },
    })

    // Get all unique categories
    const allVectors = await prisma.vector.findMany({
      where: { namespaceId: namespace },
      select: {
        metadata: true,
      },
    })
    const allCategories = Array.from(
      new Set(allVectors.map((v) => (v.metadata as any).category))
    ).filter(Boolean)

    // Get sample metadata with increased limit
    const sampleVectors = await prisma.vector.findMany({
      where: { namespaceId: namespace },
      select: {
        id: true,
        metadata: true,
        createdAt: true,
      },
      take: 20,
      orderBy: {
        createdAt: 'desc',
      },
    })

    return NextResponse.json({
      namespace: namespaceDetails?.name || namespace,
      totalVectors: vectorCount,
      categories: allCategories,
      lastUpdated: namespaceDetails?.updatedAt || null,
      created: namespaceDetails?.createdAt || null,
      sampleMetadata: sampleVectors.map((v: VectorData) => ({
        id: v.id,
        createdAt: v.createdAt,
        ...(v.metadata as object),
      })),
    })
  } catch (error) {
    console.error('Error getting vector store stats:', error)
    return NextResponse.json(
      { error: 'Failed to get vector store stats' },
      { status: 500 }
    )
  }
}
