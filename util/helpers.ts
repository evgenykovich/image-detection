import { Languages } from './enums'

let Sharp: any

if (typeof window === 'undefined') {
  Sharp = require('sharp')
} else {
  Sharp = null
}

export const base64Helper = (imageBase64: string) => {
  const prefix = 'data:image/jpeg;base64,'
  return imageBase64.startsWith(prefix)
    ? imageBase64.substring(prefix.length)
    : imageBase64
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

export const blurFaceInImage = async (imagePath: string, faces: any) => {
  if (!Sharp) {
    throw new Error('Sharp is not available on the client side')
  }
  let image = Sharp(imagePath)

  for (const face of faces) {
    const { left, top, width, height } = face.boundingBox
    image = image.blur(30).extract({
      left: Math.round(left),
      top: Math.round(top),
      width: Math.round(width),
      height: Math.round(height),
    })
  }
  return image.toBuffer()
}
