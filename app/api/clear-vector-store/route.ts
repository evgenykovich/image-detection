import { NextResponse } from 'next/server'
import { Pinecone } from '@pinecone-database/pinecone'
import { markNamespaceAsCleared } from '../vector-store-state'

export async function POST(request: Request) {
  try {
    if (!process.env.PINECONE_INDEX) {
      throw new Error('PINECONE_INDEX environment variable is not set')
    }

    const { namespace } = await request.json()
    if (!namespace) {
      return NextResponse.json(
        { error: 'Namespace parameter is required' },
        { status: 400 }
      )
    }

    console.log('Clearing vector store for namespace:', namespace)

    const pinecone = new Pinecone({
      apiKey: process.env.PINECONE_API_KEY!,
    })

    const index = pinecone.index(process.env.PINECONE_INDEX)

    // First, find all vectors in the namespace
    const queryResponse = await index.namespace(namespace).query({
      vector: new Array(1536).fill(0),
      topK: 100,
      includeMetadata: true,
    })

    if (queryResponse.matches.length === 0) {
      console.log('No vectors found to delete')
      markNamespaceAsCleared(namespace)
      return NextResponse.json({
        success: true,
        debug: {
          vectorsFound: 0,
          deleted: [],
          verified: true,
        },
      })
    }

    console.log(`Found ${queryResponse.matches.length} vectors to delete`)
    const vectorIds = queryResponse.matches.map((match) => match.id)

    // Delete each vector individually
    const deletedIds = []
    for (const id of vectorIds) {
      try {
        console.log('Deleting vector:', id)
        await index.deleteOne(id)
        deletedIds.push(id)
      } catch (error) {
        console.error(`Failed to delete vector ${id}:`, error)
      }
    }

    // Use deleteAll as final cleanup
    await index.namespace(namespace).deleteAll()

    // Mark the namespace as cleared in our state
    markNamespaceAsCleared(namespace)

    return NextResponse.json({
      success: true,
      debug: {
        vectorsFound: queryResponse.matches.length,
        deleted: deletedIds,
        verified: true,
      },
    })
  } catch (error) {
    console.error('Error clearing vector store:', error)
    return NextResponse.json(
      { error: 'Failed to clear vector store' },
      { status: 500 }
    )
  }
}
