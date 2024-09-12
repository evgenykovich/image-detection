/**
 * Utility functions for handling base64 images, URL validation, and PDF retrieval.
 * @module helpers
 */

/**
 * Removes the base64 prefix from an image string if present.
 * @param {string} imageBase64 - The base64 encoded image string.
 * @returns {string} The base64 string without the prefix.
 */
export const base64Helper = (imageBase64: string) => {
  const prefix = 'data:image/jpeg;base64,'
  return imageBase64.startsWith(prefix)
    ? imageBase64.substring(prefix.length)
    : imageBase64
}

/**
 * Validates a URL string.
 * @param {string} url - The URL to validate.
 * @returns {boolean} True if the URL is valid, false otherwise.
 */
export const validateUrl = (url: string) => {
  const urlRegex =
    /^(https?:\/\/)?(www\.)?[-a-zA-Z0-9@:%._\+~#=]{2,256}\.[a-z]{2,6}\b([-a-zA-Z0-9@:%_\+.~#?&//=]*)$/
  return urlRegex.test(url)
}

/**
 * Retrieves a PDF buffer from either a File object or a URL.
 * @param {File | null} file - The File object containing the PDF.
 * @param {string | null} pdfUrl - The URL of the PDF.
 * @returns {Promise<Buffer>} A promise that resolves to the PDF buffer.
 * @throws {Error} If neither file nor URL is provided, or if fetching from URL fails.
 */
export const getPdfBuffer = async (
  file: File | null,
  pdfUrl: string | null
): Promise<Buffer> => {
  if (!file && !pdfUrl) {
    throw new Error('Either a file or a URL must be provided')
  }

  if (file) {
    return Buffer.from(await file.arrayBuffer())
  }

  if (pdfUrl) {
    const response = await fetch(pdfUrl)
    if (!response.ok) {
      throw new Error(`Failed to fetch PDF from URL: ${response.statusText}`)
    }
    return Buffer.from(await response.arrayBuffer())
  }

  // This line should never be reached due to the initial check,
  // but it's included to satisfy TypeScript's control flow analysis
  throw new Error('Unexpected error occurred')
}
