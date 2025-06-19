import { readdir, readFile } from 'fs/promises'
import { join, basename } from 'path'

let Sharp: any

if (typeof window === 'undefined') {
  Sharp = require('sharp')
} else {
  Sharp = null
}

import { extractImageFeatures } from '@/lib/services/featureExtraction'
import { vectorStore } from '@/lib/services/vectorStorage'
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
  Connector: 'connector_plates',
  'Cotter Pin': 'cotter_pins',
  Spacer: 'spacer_plates',
  Connection: 'positive_connection',
  Cable: 'cable_diameter',
}

async function processGroundTruthImage(
  imagePath: string,
  category: Category,
  state: State,
  namespace: string
) {
  try {
    const imageBuffer = await readFile(imagePath)
    const features = await extractImageFeatures(imageBuffer)

    // Store as ground truth example with high confidence
    await vectorStore.storeValidationCase(
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
      1.0, // Maximum confidence for ground truth
      undefined,
      namespace
    )

    console.log(
      `✓ Processed ground truth: ${basename(
        imagePath
      )} as ${state} ${category} in namespace ${namespace}`
    )
  } catch (error) {
    console.error(`✗ Error processing ${imagePath}:`, error)
  }
}

// Main function to process all training data
export async function processTrainingData(namespace: string = '_default_') {
  try {
    // Clear existing training data for this namespace
    await vectorStore.clearNamespace(namespace)
    console.log(`Cleared existing data in namespace: ${namespace}`)

    // Read all category folders
    const categoryFolders = await readdir(TRAINING_DATA_PATH)

    for (const categoryFolder of categoryFolders) {
      const category = CATEGORY_MAPPING[categoryFolder]
      if (!category) {
        console.warn(`⚠ Skipping unknown category folder: ${categoryFolder}`)
        continue
      }

      const categoryPath = join(TRAINING_DATA_PATH, categoryFolder)
      const stateFolders = await readdir(categoryPath)

      for (const stateFolder of stateFolders) {
        const state = STATE_MAPPING[stateFolder]
        if (!state) {
          console.warn(
            `⚠ Skipping unknown state folder: ${stateFolder} in category ${categoryFolder}`
          )
          continue
        }

        const statePath = join(categoryPath, stateFolder)
        const imageFiles = await readdir(statePath)

        for (const imageFile of imageFiles) {
          if (imageFile.match(/\.(jpg|jpeg|png)$/i)) {
            await processGroundTruthImage(
              join(statePath, imageFile),
              category,
              state,
              namespace
            )
          }
        }
      }
    }

    console.log(
      `✓ Training data processing complete for namespace: ${namespace}`
    )
  } catch (error) {
    console.error('✗ Error processing training data:', error)
    throw error
  }
}

// Run the processing
processTrainingData().catch(console.error)
