import { Languages } from './enums'

let Sharp: any

if (typeof window === 'undefined') {
  Sharp = require('sharp')
} else {
  Sharp = null
}

export const base64Helper = (imageBase64: string) => {
  // Handle both data URL format and raw base64
  const dataUrlRegex = /^data:image\/([a-zA-Z]+);base64,/
  const match = imageBase64.match(dataUrlRegex)

  if (match) {
    // If it's a data URL, extract just the base64 data
    return imageBase64.substring(imageBase64.indexOf(',') + 1)
  }

  // If it's already raw base64, return as is
  return imageBase64
}

export const addImagePrefix = (base64Data: string, mimeType = 'image/jpeg') => {
  return `data:${mimeType};base64,${base64Data}`
}

export const validateUrl = (url: string) => {
  const urlRegex =
    /^(https?:\/\/)?(www\.)?[-a-zA-Z0-9@:%._\+~#=]{2,256}\.[a-z]{2,6}\b([-a-zA-Z0-9@:%_\+.~#?&//=]*)$/
  return urlRegex.test(url)
}

/**
 * Finds the translation of a term using the provided glossary.
 * @param {Object} glossary - The glossary containing translations.
 * @param {string | number} outputLang - The target language for translation.
 * @param {string} term - The term to be translated.
 * @returns {string} The translated text.
 */
export const findTranslation = (
  glossary: any,
  outputLang: string | number,
  term: string
): string => {
  const terms = Object.keys(glossary)
  let text = term

  terms.forEach((term) => {
    const regex = new RegExp(`\\b${term}\\b`, 'gi')
    const translation = glossary[term][outputLang] || term
    text = text.replace(regex, translation)
  })

  return text
}

/**
 * Maps a column key to a language code.
 * @param {string} columnKey - The key of the column to map.
 * @returns {string} The corresponding language code.
 */
export const mapColumnToLang = (columnKey: string): string => {
  const columnMapping: { [key: string]: string } = {
    Column7: 'zh_TW',
    Column9: 'zh_CN',
    Column11: 'pt_BR',
    Column13: 'en_US',
    Column15: 'de',
    Column17: 'es',
    Column19: 'fr',
    Column21: 'it',
    Column23: 'ja',
    Column25: 'ko',
    Column29: 'da',
    Column31: 'sv',
    Column33: 'no',
    Column35: 'nl_NL',
    Column37: 'es_MX',
  }
  return columnMapping[columnKey] || columnKey
}

export const mapLanguageToString = (columnKey: string): string => {
  const reverseMapping = Object.entries(Languages).find(
    ([_, value]) => value === columnKey
  )
  return reverseMapping ? reverseMapping[0] : columnKey
}

export const blurFaceInImage = async (imageBase64: string, faces: any[]) => {
  if (!Sharp) {
    throw new Error('Sharp is not available on the client side')
  }

  const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, '')
  const buffer = Buffer.from(base64Data, 'base64')
  let image = Sharp(buffer)

  try {
    const { width, height } = await image.metadata()

    if (!width || !height) {
      throw new Error('Unable to get image dimensions')
    }

    const compositeOperations = await Promise.all(
      faces.map(async (face) => {
        const {
          left,
          top,
          width: faceWidth,
          height: faceHeight,
        } = face.boundingBox

        const safeLeft = Math.max(0, Math.min(width - 1, Math.round(left)))
        const safeTop = Math.max(0, Math.min(height - 1, Math.round(top)))
        const safeWidth = Math.min(width - safeLeft, Math.round(faceWidth))
        const safeHeight = Math.min(height - safeTop, Math.round(faceHeight))

        if (safeWidth <= 0 || safeHeight <= 0) {
          console.warn('Skipping face due to invalid dimensions', {
            left,
            top,
            width: faceWidth,
            height: faceHeight,
          })
          return null
        }

        const blurredFace = await Sharp(buffer)
          .extract({
            left: safeLeft,
            top: safeTop,
            width: safeWidth,
            height: safeHeight,
          })
          .blur(30)
          .toBuffer()

        return {
          input: blurredFace,
          left: safeLeft,
          top: safeTop,
        }
      })
    )

    const validOperations = compositeOperations.filter((op) => op !== null)

    if (validOperations.length > 0) {
      image = image.composite(validOperations)
    } else {
      console.warn('No valid faces to blur')
    }

    const outputBuffer = await image.toBuffer()

    return `data:image/jpeg;base64,${outputBuffer.toString('base64')}`
  } catch (error) {
    console.error('Error during face blurring:', error)
    throw error
  }
}
