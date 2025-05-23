import { Pinecone } from '@pinecone-database/pinecone'
import { readdir, readFile } from 'fs/promises'
import { join, basename } from 'path'
import sharp from 'sharp'
import { extractImageFeatures } from '@/lib/services/featureExtraction'
import { storeValidationCase } from '@/lib/services/vectorStorage'
import { Category, State } from '@/types/validation'

const TRAINING_DATA_PATH = join(process.cwd(), 'training-data')

// Map folder names to states
const STATE_MAPPING: Record<string, State> = {
  'No Corrosion': 'clean',
  'Has Corrosion': 'corroded',
  'No Threads': 'missing',
  'Threads Visible': 'visible',
  'Threads Present': 'present',
  Bent: 'bent',
  Straight: 'straight',
  Present: 'present',
  Missing: 'missing',
  Visible: 'visible',
  '38inch': 'compliant',
}

// Map folder names to categories
const CATEGORY_MAPPING: Record<string, Category> = {
  Corrosion: 'corrosion',
  Threads: 'threads',
  Connector: 'connector',
  'Cotter Pin': 'cotter_pin',
  Spacer: 'spacer',
  Connection: 'connection',
  Cable: 'cable',
}

async function processGroundTruthImage(
  imagePath: string,
  category: Category,
  state: State
) {
  try {
    const imageBuffer = await readFile(imagePath)
    const features = await extractImageFeatures(imageBuffer)

    // Store as ground truth example with high confidence
    await storeValidationCase(
      `file://${imagePath}`,
      category,
      state,
      features,
      `Ground truth example for ${state} ${category}`,
      [
        `Ground truth: ${state}`,
        `Category: ${category}`,
        'Source: Expert validated',
      ],
      1.0 // Maximum confidence for ground truth
    )

    console.log(
      `✓ Processed ground truth: ${basename(imagePath)} as ${state} ${category}`
    )
  } catch (error) {
    console.error(`✗ Error processing ${imagePath}:`, error)
  }
}

export async function loadTrainingData() {
  console.log('\n🔍 Loading ground truth examples from training data...\n')

  try {
    // Process each category folder
    const categoryFolders = await readdir(TRAINING_DATA_PATH)
    let totalProcessed = 0
    let totalErrors = 0

    for (const categoryFolder of categoryFolders) {
      const categoryPath = join(TRAINING_DATA_PATH, categoryFolder)
      const categoryMatch = categoryFolder.match(/^\d{2}-(.+)$/)
      if (!categoryMatch) continue

      const categoryName = categoryMatch[1]
      const category = CATEGORY_MAPPING[categoryName]
      if (!category) {
        console.warn(`⚠️  Unknown category: ${categoryName}`)
        continue
      }

      console.log(`\n📁 Processing category: ${categoryName}`)

      // Process each state folder within the category
      const stateFolders = await readdir(categoryPath)
      for (const stateFolder of stateFolders) {
        const statePath = join(categoryPath, stateFolder)
        const stateMatch = stateFolder.match(/^\d{2}-(.+)$/)
        if (!stateMatch) continue

        const stateName = stateMatch[1]
        const state = STATE_MAPPING[stateName]
        if (!state) {
          console.warn(`⚠️  Unknown state: ${stateName}`)
          continue
        }

        console.log(`  📂 Processing state: ${stateName}`)

        // Process each image in the state folder
        const images = await readdir(statePath)
        let folderProcessed = 0

        for (const image of images) {
          if (!/\.(jpg|jpeg|png)$/i.test(image)) continue
          try {
            await processGroundTruthImage(
              join(statePath, image),
              category,
              state
            )
            folderProcessed++
            totalProcessed++
          } catch (error) {
            totalErrors++
          }
        }

        console.log(`     ↳ Processed ${folderProcessed} images`)
      }
    }

    console.log('\n✅ Ground truth loading complete!')
    console.log(`   Processed: ${totalProcessed} images`)
    if (totalErrors > 0) {
      console.log(`   Errors: ${totalErrors} images`)
    }
  } catch (error) {
    console.error('\n❌ Error loading ground truth data:', error)
    throw error
  }
}

// Only run directly if this is the main module
if (require.main === module) {
  loadTrainingData().catch(console.error)
}
