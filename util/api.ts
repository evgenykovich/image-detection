import { AISelectorEnum } from './enums'

/**
 * Represents the structure of an API call.
 */
type APICallType = {
  /** The action to perform (e.g., 'detect', 'measure'). */
  action: string
  /** The base64-encoded image data. */
  base64Image: string
  /** A comma-separated string of items to analyze in the image. */
  items: string
  /** The AI service to use for analysis. */
  aiToUse?: string
}

/**
 * Makes a general API call to a specified route with a file and items.
 *
 * @param {string} route - The API route to call.
 * @param {File} file - The file to be sent in the request.
 * @param {string} items - The items to be sent as a question in the request.
 * @returns {Promise<Response | undefined>} The fetch response if successful, undefined if an error occurs.
 */
export const generalApiCall = async (
  route: string,
  file: File,
  items: string
): Promise<Response | undefined> => {
  try {
    return await fetch(`/api/${route}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        file,
        question: items,
      }),
    })
  } catch (error) {
    console.error('Error api call', error)
  }
}

/**
 * Handles an API call for AI-based image analysis.
 *
 * @param {Object} params - The parameters for the API call.
 * @param {string} params.action - The action to perform (e.g., 'detect', 'measure').
 * @param {string} params.base64Image - The base64-encoded image data.
 * @param {string} params.items - A comma-separated string of items to analyze in the image.
 * @param {AISelectorEnum} [params.aiToUse=AISelectorEnum.ALL_AI] - The AI service to use for analysis.
 * @returns {Promise<Response>} A promise that resolves to the fetch Response object.
 */
export const handleAPICall = async ({
  action,
  base64Image,
  items,
  aiToUse = AISelectorEnum.ALL_AI,
}: APICallType): Promise<Response> => {
  return await fetch(`/api/${action}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      image: base64Image,
      items: items.split(',').map((item: string) => item.trim()),
      aiToUse,
    }),
  })
}

/**
 * Handles API calls for all AI services except ALL_AI.
 *
 * @param {Object} params - The parameters for the API call.
 * @param {string} params.action - The action to perform (e.g., 'detect', 'measure').
 * @param {string} params.base64Image - The base64-encoded image data.
 * @param {string} params.items - A comma-separated string of items to analyze in the image.
 * @returns {Promise<Response[]>} A promise that resolves to an array of fetch Response objects, one for each AI service.
 */
export const handleAllAIAPICall = async ({
  action,
  base64Image,
  items,
}: APICallType): Promise<Response[]> => {
  const iterableValues = Object.values(AISelectorEnum).filter(
    (x) => x !== AISelectorEnum.ALL_AI
  )
  return await Promise.all(
    iterableValues.map(async (ai) => {
      return await fetch(`/api/${action}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          image: base64Image,
          items: items.split(',').map((item: string) => item.trim()),
          aiToUse: ai,
        }),
      })
    })
  )
}
