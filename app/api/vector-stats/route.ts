import { NextResponse } from 'next/server'
import { Pinecone } from '@pinecone-database/pinecone'
import { isNamespaceKnownEmpty, getNamespaceState } from '../vector-store-state'

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

    // Check if we know the namespace is empty
    const namespaceState = getNamespaceState(namespace)
    if (isNamespaceKnownEmpty(namespace)) {
      console.log('Namespace is known to be empty:', namespace)
      return NextResponse.json({
        totalVectors: 0,
        categories: {},
        debug: {
          source: 'state_tracker',
          knownEmpty: true,
          lastCleared: namespaceState?.lastCleared,
          stateAge: namespaceState
            ? Date.now() - namespaceState.lastCleared
            : null,
        },
      })
    }

    const pinecone = new Pinecone({
      apiKey: process.env.PINECONE_API_KEY!,
    })

    const index = pinecone.index(process.env.PINECONE_INDEX!)

    // Query for vectors
    const queryResponse = await index.namespace(namespace).query({
      vector: new Array(1536).fill(0),
      topK: 100,
      includeMetadata: true,
    })

    // Process results
    const categories: { [key: string]: number } = {}
    const vectorIds = []
    for (const match of queryResponse.matches) {
      const category = match.metadata?.category as string
      if (category) {
        categories[category] = (categories[category] || 0) + 1
      }
      vectorIds.push(match.id)
    }

    return NextResponse.json({
      totalVectors: queryResponse.matches.length,
      categories,
      debug: {
        source: 'pinecone_query',
        vectorIds,
        namespaceState,
        queryTimestamp: Date.now(),
      },
    })
  } catch (error) {
    console.error('Error fetching vector stats:', error)
    return NextResponse.json(
      { error: 'Failed to fetch vector stats' },
      { status: 500 }
    )
  }
}
