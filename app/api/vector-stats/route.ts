import { NextResponse } from 'next/server'
import { Pinecone } from '@pinecone-database/pinecone'
import {
  isNamespaceKnownEmpty,
  getNamespaceState,
  markNamespaceAsPopulated,
} from '../vector-store-state'

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

    const pinecone = new Pinecone({
      apiKey: process.env.PINECONE_API_KEY!,
    })

    const index = pinecone.index(process.env.PINECONE_INDEX!)

    // Always query Pinecone first
    try {
      // Query for vectors
      const queryResponse = await index.namespace(namespace).query({
        vector: new Array(1536).fill(0),
        topK: 100,
        includeMetadata: true,
      })

      // If we got results, update our state
      if (queryResponse.matches.length > 0) {
        markNamespaceAsPopulated(namespace)
      }

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
          namespaceState: getNamespaceState(namespace),
          queryTimestamp: Date.now(),
        },
      })
    } catch (pineconeError) {
      console.error('Error querying Pinecone:', pineconeError)

      // Fallback to state tracking only if Pinecone query fails
      const namespaceState = getNamespaceState(namespace)
      if (isNamespaceKnownEmpty(namespace)) {
        console.log(
          'Falling back to state tracking - namespace is known to be empty:',
          namespace
        )
        return NextResponse.json({
          totalVectors: 0,
          categories: {},
          debug: {
            source: 'state_tracker_fallback',
            error:
              pineconeError instanceof Error
                ? pineconeError.message
                : 'Unknown error',
            knownEmpty: true,
            lastCleared: namespaceState?.lastCleared,
            stateAge: namespaceState
              ? Date.now() - namespaceState.lastCleared
              : null,
          },
        })
      }

      // If we don't know the state, propagate the error
      throw pineconeError
    }
  } catch (error) {
    console.error('Error fetching vector stats:', error)
    return NextResponse.json(
      { error: 'Failed to fetch vector stats' },
      { status: 500 }
    )
  }
}
