const CLIP_SERVICE_URL =
  process.env.CLIP_SERVICE_URL || 'https://clip-service.fly.dev'

export async function createClipEmbedding(
  imageBuffer: Buffer
): Promise<number[]> {
  try {
    // Only run on server side
    if (typeof window !== 'undefined') {
      throw new Error(
        'CLIP embeddings can only be generated on the server side'
      )
    }

    // Create form data with the image
    const formData = new FormData()
    const blob = new Blob([imageBuffer], { type: 'image/jpeg' })
    formData.append('file', blob, 'image.jpg')

    // Call our CLIP service
    const response = await fetch(CLIP_SERVICE_URL + '/embed', {
      method: 'POST',
      body: formData as FormData,
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(
        `API request failed: ${response.statusText}. ${errorText}`
      )
    }

    const result = await response.json()
    return result.embedding
  } catch (error) {
    console.error('Error creating CLIP embedding:', error)
    throw error
  }
}
