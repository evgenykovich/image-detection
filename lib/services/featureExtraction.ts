import sharp from 'sharp'
import { ImageFeatures } from '@/types/validation'
import OpenAI from 'openai'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

function generateImageDescription(features: any): string {
  const { stats, edges, sharpness, metadata } = features

  return `Image Analysis:
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
  // Extract raw image features
  const image = sharp(imageBuffer)
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

  // Generate text description
  const description = generateImageDescription({
    stats,
    edges,
    sharpness,
    metadata,
  })

  // Get embedding from text-embedding-3-small
  const embedding = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: description,
    encoding_format: 'float',
  })

  return {
    visualFeatures: embedding.data[0].embedding,
    structuralFeatures: {
      edges: edges.channels[0].mean,
      contrast: Math.max(...stats.channels.map((c) => c.stdev)),
      brightness: Math.max(...stats.channels.map((c) => c.mean)),
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
