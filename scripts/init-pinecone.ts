import { Pinecone } from '@pinecone-database/pinecone'
import { loadTrainingData } from './load-training-data'

// We'll use process.env directly since dotenv is causing issues
const PINECONE_API_KEY = process.env.PINECONE_API_KEY
if (!PINECONE_API_KEY) {
  throw new Error('PINECONE_API_KEY environment variable is not set')
}

// Create Pinecone client with validated API key
const pinecone = new Pinecone({
  apiKey: PINECONE_API_KEY,
})

async function initPineconeIndex() {
  const indexName = process.env.PINECONE_INDEX || 'image-validation'

  try {
    // Try to get the index - if it doesn't exist, this will throw
    await pinecone.describeIndex(indexName)
    console.log(`Index ${indexName} already exists`)
  } catch (error) {
    console.log(`Creating new index: ${indexName}`)

    // Create a new index with increased dimension for visual features
    await pinecone.createIndex({
      name: indexName,
      dimension: 1536, // Matches text-embedding-3-small dimension
      metric: 'cosine',
      spec: {
        serverless: {
          cloud: 'aws',
          region: 'us-west-2',
        },
      },
    })

    console.log('Index created successfully')
  }

  // Describe the index to verify configuration
  const indexDescription = await pinecone.describeIndex(indexName)
  console.log('Index description:', indexDescription)

  // Load training data
  console.log('Loading training data...')
  await loadTrainingData()
  console.log('Training data loaded successfully')
}

initPineconeIndex().catch(console.error)
