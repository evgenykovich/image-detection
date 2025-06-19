import { NextResponse } from 'next/server'
import { prisma } from '@/lib/services/prismaService'

export async function GET() {
  try {
    const namespaces = await prisma.namespace.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        createdAt: true,
        updatedAt: true,
      },
    })

    return NextResponse.json({ namespaces })
  } catch (error) {
    console.error('Error fetching namespaces:', error)
    return NextResponse.json(
      { error: 'Failed to fetch namespaces' },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    const { name } = await request.json()

    if (!name) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 })
    }

    // Try to find existing namespace first
    let namespace = await prisma.namespace.findUnique({
      where: { name },
      select: {
        id: true,
        name: true,
        createdAt: true,
        updatedAt: true,
      },
    })

    // If namespace doesn't exist, create it
    if (!namespace) {
      namespace = await prisma.namespace.create({
        data: { name },
        select: {
          id: true,
          name: true,
          createdAt: true,
          updatedAt: true,
        },
      })
    }

    return NextResponse.json({ namespace })
  } catch (error) {
    console.error('Error creating/finding namespace:', error)
    return NextResponse.json(
      { error: 'Failed to create/find namespace' },
      { status: 500 }
    )
  }
}

export async function DELETE(request: Request) {
  try {
    const { id } = await request.json()

    if (!id) {
      return NextResponse.json(
        { error: 'Namespace ID is required' },
        { status: 400 }
      )
    }

    await prisma.namespace.delete({
      where: { id },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting namespace:', error)
    return NextResponse.json(
      { error: 'Failed to delete namespace' },
      { status: 500 }
    )
  }
}
