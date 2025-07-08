import { ImageFeatures } from '@/types/validation'
import { createClipEmbedding } from '@/util/clip'

let Sharp: any

if (typeof window === 'undefined') {
  Sharp = require('sharp')
} else {
  Sharp = null
}

async function getSemanticContent(imageBuffer: Buffer): Promise<string> {
  try {
    // Ensure image is in JPEG format
    const image = Sharp(imageBuffer)
    const jpegBuffer = await image.jpeg().toBuffer()

    // Get semantic description using CLIP
    const clipEmbedding = await createClipEmbedding(jpegBuffer)

    // For now, we'll store the raw vector as a string
    // Later we can add more structured metadata if needed
    return JSON.stringify(clipEmbedding)
  } catch (error) {
    console.error('Error in getSemanticContent:', error)
    return '' // Return empty string on error to allow fallback to visual features
  }
}

function generateImageDescription(features: any): string {
  const { stats, edges, sharpness, metadata, semanticContent } = features

  return `Image Analysis:
- Vector Embedding: ${semanticContent}
- Format: ${metadata.format}, Size: ${metadata.width}x${metadata.height}
- Color Statistics:
  * Red Channel: mean=${stats.channels[0].mean.toFixed(
    2
  )}, std=${stats.channels[0].stdev.toFixed(2)}
  * Green Channel: mean=${stats.channels[1].mean.toFixed(
    2
  )}, std=${stats.channels[1].stdev.toFixed(2)}
  * Blue Channel: mean=${stats.channels[2].mean.toFixed(
    2
  )}, std=${stats.channels[2].stdev.toFixed(2)}
- Edge Detection: ${edges.channels[0].mean.toFixed(2)}
- Sharpness Level: ${Math.abs(sharpness.channels[0].mean).toFixed(2)}
- Overall Contrast: ${Math.max(
    ...stats.channels.map((c: any) => c.stdev)
  ).toFixed(2)}
- Overall Brightness: ${Math.max(
    ...stats.channels.map((c: any) => c.mean)
  ).toFixed(2)}`
}

export async function extractImageFeatures(
  imageBuffer: Buffer
): Promise<ImageFeatures> {
  if (!Sharp) {
    throw new Error('Sharp is not available on the client side')
  }

  const image = Sharp(imageBuffer)
  const metadata = await image.metadata()
  const stats = await image.stats()

  const edges = await image
    .greyscale()
    .convolve({
      width: 3,
      height: 3,
      kernel: [-1, 0, 1, -2, 0, 2, -1, 0, 1],
    })
    .stats()

  const sharpness = await image
    .greyscale()
    .convolve({
      width: 3,
      height: 3,
      kernel: [0, 1, 0, 1, -4, 1, 0, 1, 0],
    })
    .stats()

  // Get semantic content using CLIP embeddings
  const semanticContent = await getSemanticContent(imageBuffer)

  const description = generateImageDescription({
    stats,
    edges,
    sharpness,
    metadata,
    semanticContent,
  })

  // Use CLIP embeddings directly
  const clipEmbedding = await createClipEmbedding(imageBuffer)

  return {
    visualFeatures: clipEmbedding,
    semanticFeatures: semanticContent,
    structuralFeatures: {
      edges: edges.channels[0].mean,
      contrast: Math.max(
        ...stats.channels.map((c: { stdev: number }) => c.stdev)
      ),
      brightness: Math.max(
        ...stats.channels.map((c: { mean: number }) => c.mean)
      ),
      sharpness: Math.abs(sharpness.channels[0].mean),
    },
    metadata: {
      dimensions: {
        width: metadata.width || 0,
        height: metadata.height || 0,
      },
      format: metadata.format || 'unknown',
      size: metadata.size || 0,
    },
  }
}
