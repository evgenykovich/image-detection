import { vectorStore } from '@/lib/services/vectorStorage'
import { processTrainingData } from './load-training-data'

async function initVectorStore() {
  try {
    // Clear any existing data in the training namespace
    await vectorStore.clearNamespace('training')
    console.log('Cleared existing training data')

    // Load training data
    console.log('Loading training data...')
    await processTrainingData()
    console.log('Training data loaded successfully')
  } catch (error) {
    console.error('Error initializing vector store:', error)
    throw error
  }
}

initVectorStore().catch(console.error)
