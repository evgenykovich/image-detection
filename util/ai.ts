import { OpenAI } from 'openai'
import { z } from 'zod'
import Sharp from 'sharp'
import AWS from 'aws-sdk'
import * as xlsx from 'xlsx'
import { promises as fs } from 'fs'
import { OpenAI as langChainOpenAI } from 'langchain/llms/openai'
import { LLMChain } from 'langchain/chains'
import { PromptTemplate } from 'langchain/prompts'
import { GoogleGenerativeAI } from '@google/generative-ai'
import Anthropic from '@anthropic-ai/sdk'
import { AIAction, mimeType } from './enums'
import {
  base64Helper,
  blurFaceInImage,
  findTranslation,
  mapColumnToLang,
  addImagePrefix,
} from './helpers'
import { ValidationResponse } from '@/types/validation'

AWS.config.update({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION,
})

interface GlossaryEntryItem {
  [key: string]: {
    [lang: string]: string
  }
}

interface ValidationConfig {
  category: string
  expectedState: string
  prompt: string
}

const getValidationConfig = (folderPath: string): ValidationConfig => {
  const parts = folderPath.split('/')
  const categoryFolder = parts.find((p) => /^\d{2}-/.test(p)) || ''
  const stateFolder =
    parts.find((p) =>
      /(Present|Missing|Visible|No |Has |Bent|Straight|38inch)/.test(p)
    ) || ''

  const category = categoryFolder.replace(/^\d{2}-/, '')
  const expectedState = stateFolder.replace(/^\d{2}-/, '')
  debugger
  console.log(category, expectedState)
  let prompt = ''
  switch (category.toLowerCase()) {
    case 'corrosion':
      prompt = `Analyze this image for signs of corrosion. This image comes from a reference set of "${expectedState.toLowerCase()}" examples.

Key points to check:
- Look for rust, discoloration, pitting, or surface degradation
- Check edges and joints for signs of deterioration
- Note any flaking paint or surface irregularities

Your response should clearly indicate:
1. Whether you found corrosion or not
2. Your confidence in the assessment
3. Specific evidence supporting your conclusion
4. How this matches or differs from what we expect in a "${expectedState.toLowerCase()}" example

Remember: This image is from our "${expectedState.toLowerCase()}" reference set, so finding corrosion in a "no corrosion" set or no corrosion in a "corrosion" set would indicate a potential misclassification.`
      break
    case 'threads':
      prompt = `Analyze this image for thread features. This image comes from a reference set of "${expectedState.toLowerCase()}" examples.

Key points to check:
- Look for visible thread patterns
- Check thread consistency and condition
- Note any damage or wear to threads

Your response should clearly indicate:
1. Whether threads are visible and in what condition
2. Your confidence in the assessment
3. Specific evidence supporting your conclusion
4. How this matches or differs from what we expect in a "${expectedState.toLowerCase()}" example

Remember: This image is from our "${expectedState.toLowerCase()}" reference set, so finding threads when they shouldn't be visible or not finding them when they should be would indicate a potential misclassification.`
      break
    case 'connector_plates':
      prompt = `Analyze this image for connector plate alignment. This image comes from a reference set of "${expectedState.toLowerCase()}" examples.

Key points to check:
- Look for actual physical deformation, not perspective illusions
- Check for true bending vs. apparent bending due to camera angle
- Verify if gaps or misalignments are real structural issues or viewing angle effects
- Consider lighting effects that might create false impressions of bending

Specific Analysis Steps:
1. Look for multiple visual cues that confirm actual bending:
   - Consistent deformation across different viewing angles (if visible)
   - Physical gaps that can't be explained by perspective
   - Clear structural misalignment beyond camera angle effects
2. Rule out false positives:
   - Perspective distortion from camera angle
   - Shadow effects creating illusion of gaps
   - Lighting creating appearance of warping

Your response should clearly indicate:
1. Whether the plate shows true physical bending (not perspective effects)
2. Your confidence in the assessment
3. Specific evidence supporting your conclusion, distinguishing between actual deformation and visual effects
4. How this matches or differs from what we expect in a "${expectedState.toLowerCase()}" example

Remember: This image is from our "${expectedState.toLowerCase()}" reference set. Be careful to distinguish between actual bending and perspective/lighting effects before suggesting a misclassification.`
      break
    case 'cotter_pin':
      prompt = `Analyze this image for cotter pin presence and installation. This image comes from a reference set of "${expectedState.toLowerCase()}" examples.

Key points to check:
- Look for the presence/absence of cotter pins
- Check pin installation and end bending
- Note any missing or loose pins

Your response should clearly indicate:
1. Whether cotter pins are present and properly installed
2. Your confidence in the assessment
3. Specific evidence supporting your conclusion
4. How this matches or differs from what we expect in a "${expectedState.toLowerCase()}" example

Remember: This image is from our "${expectedState.toLowerCase()}" reference set, so finding pins when they should be missing or not finding them when they should be present would indicate a potential misclassification.`
      break
    case 'cable':
      prompt = `Analyze this image for cable diameter compliance. This image comes from a reference set of "${expectedState.toLowerCase()}" examples.

Key points to check:
- Assess cable diameter relative to requirements
- Check for consistent diameter throughout
- Note any wear or damage

Your response should clearly indicate:
1. Whether the cable meets minimum diameter requirements
2. Your confidence in the assessment
3. Specific evidence supporting your conclusion
4. How this matches or differs from what we expect in a "${expectedState.toLowerCase()}" example

Remember: This image is from our "${expectedState.toLowerCase()}" reference set, so finding compliant cables in a "non-compliant" set or undersized cables in a "compliant" set would indicate a potential misclassification.`
      break
    case 'connection':
      prompt = `Analyze this image for connection security. This image comes from a reference set of "${expectedState.toLowerCase()}" examples.

Key points to check:
- Assess connection tightness and security
- Check component alignment
- Note any loose or improper connections

Your response should clearly indicate:
1. Whether the connection is secure and proper
2. Your confidence in the assessment
3. Specific evidence supporting your conclusion
4. How this matches or differs from what we expect in a "${expectedState.toLowerCase()}" example

Remember: This image is from our "${expectedState.toLowerCase()}" reference set, so finding secure connections in an "unsecure" set or loose connections in a "secure" set would indicate a potential misclassification.`
      break
    default:
      prompt = `Analyze this image and determine if it shows ${expectedState.toLowerCase()} for ${category.toLowerCase()}.`
  }

  return {
    category,
    expectedState,
    prompt,
  }
}

export const detectFacesFromImageOpenAI = async (imageBase64: string) => {
  const rekognition = new AWS.Rekognition()

  const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, '')
  const imageBuffer = Buffer.from(base64Data, 'base64')

  const params = {
    Image: {
      Bytes: imageBuffer,
    },
    Attributes: ['ALL'],
  }

  try {
    const response = await rekognition.detectFaces(params).promise()

    if (response.FaceDetails && response.FaceDetails.length > 0) {
      const image = Sharp(imageBuffer)
      const metadata = await image.metadata()

      if (!metadata.width || !metadata.height) {
        throw new Error('Unable to get image dimensions')
      }

      const faces = response.FaceDetails.map((face) => {
        if (face.BoundingBox) {
          const { Width, Height, Left, Top } = face.BoundingBox
          return {
            boundingBox: {
              left: Math.max(
                0,
                Math.round((Left || 0) * (metadata.width || 0))
              ),
              top: Math.max(0, Math.round((Top || 0) * (metadata.height || 0))),
              width: Math.min(
                metadata.width || 0,
                Math.round((Width || 0) * (metadata.width || 0))
              ),
              height: Math.min(
                metadata.height || 0,
                Math.round((Height || 0) * (metadata.height || 0))
              ),
            },
          }
        }
        return null
      }).filter((face) => face !== null)

      const blurredImageBase64 = await blurFaceInImage(imageBase64, faces)
      return blurredImageBase64
    }

    return imageBase64
  } catch (error) {
    console.error('Error detecting faces:', error)
    throw error
  }
}

export const qa = async (question: string, pdfFile: File) => {
  try {
    const formData = new FormData()
    formData.append('pdf', pdfFile)
    formData.append('question', question)

    const response = await fetch('/api/pdf', {
      method: 'POST',
      body: formData,
    })

    if (!response.ok) {
      throw new Error('Failed to process PDF')
    }

    const data = await response.json()
    return data.answer
  } catch (error) {
    console.error('Error in PDF QA:', error)
    throw error
  }
}

const FieldValueSchema = z.object({
  field: z.string(),
  value: z.string(),
})

const FieldValuesArraySchema = z.array(FieldValueSchema)

export const getValueFromFieldsInImage = async (
  imageBase64: string,
  fields: string[]
) => {
  const model = new langChainOpenAI({
    modelName: 'gpt-4o',
    temperature: 0,
  })

  const prompt = `Please analyze this image and extract the value of the following fields: ${fields.join(
    ', '
  )}. Return the results as a JSON array of objects, where each object has a 'field' and a 'value' property.`

  const response = await model.call([
    {
      type: 'text',
      text: prompt,
    },
    {
      type: 'image_url',
      image_url: {
        url: imageBase64,
      },
    },
  ] as any)

  try {
    const cleanedResponse = response.replace(/```json\n|\n```/g, '').trim()
    const validatedResponse = FieldValuesArraySchema.parse(
      JSON.parse(cleanedResponse)
    )
    return validatedResponse
  } catch (error) {
    console.error('Error parsing or validating response:', error)
    throw new Error('Failed to process the AI response')
  }
}

export const validateImageByFolder = async (
  imageBase64: string,
  path: string,
  useVectorStore: boolean = true,
  isTrainingMode: boolean = false
): Promise<ValidationResponse> => {
  console.log('Validating image with vector store:', useVectorStore)
  console.log('Training mode:', isTrainingMode)

  try {
    const response = await fetch('/api/validate-image', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        imageBase64,
        folderPath: path,
        useVectorStore,
        isTrainingMode,
      }),
    })

    if (!response.ok) {
      throw new Error('Failed to validate image')
    }

    const data = await response.json()
    return data
  } catch (error) {
    console.error('Error validating image:', error)
    throw error
  }
}

export const detect = async (imageBase64: string, items: string[]) => {
  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  })

  const prompt = `Please analyze this image and detect if the following items are in the image: ${items.join(
    ', '
  )}`

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: prompt,
            },
            {
              type: 'image_url',
              image_url: {
                url: addImagePrefix(imageBase64),
              },
            },
          ],
        },
      ],
      max_tokens: 300,
    })

    return response.choices[0].message.content
  } catch (error) {
    console.error('Error in OpenAI detect:', error)
    throw error
  }
}

export const geminiDetectImage = async (
  imageBase64: string,
  action = AIAction.DETECT,
  items: string[]
) => {
  const genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY as string)
  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash-latest' })

    let prompt = ''
    switch (action) {
      case AIAction.DETECT:
        prompt = `Please analyze this image and detect if the following items are in the image: ${items.join(
          ','
        )}`
        break
      case AIAction.MEASURMENTS:
        prompt = `Please analyze this image and provide the rough measurements of either the items specified: ${items.join(
          ','
        )} and or the things you see in the image using rough estimates based on the items that might be in the image.`
        break
      default:
        break
    }

    const image = {
      inlineData: {
        data: imageBase64.split(',')[1],
        mimeType: mimeType.JPEG,
      },
    }

    const result = await model.generateContent([prompt, image])
    return result.response.text()
  } catch (error) {
    console.error('Error initializing Gemini', error)
  }
}

export const claudeDetectImage = async (
  imageBase64: string,
  action = AIAction.DETECT,
  items: string[]
) => {
  const anthropic = new Anthropic({
    apiKey: process.env.CLAUDE_API_KEY as string,
  })
  try {
    let prompt = ''
    switch (action) {
      case AIAction.DETECT:
        prompt = `Please analyze this image and detect if the following items are in the image: ${items.join(
          ','
        )}`
        break
      case AIAction.MEASURMENTS:
        prompt = `Please analyze this image and provide the rough measurements of either the items specified: ${items.join(
          ','
        )} and or the things you see in the image using rough estimates based on the items that might be in the image.`
        break
      default:
        break
    }

    const message = await anthropic.messages.create({
      model: 'claude-3-opus-20240229',
      max_tokens: 1024,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: mimeType.JPEG,
                data: imageBase64.split(',')[1],
              },
            },
            { type: 'text', text: prompt },
          ],
        },
      ],
    })

    return message.content[0].text
  } catch (error) {
    console.error('Error initializing Claude', error)
  }
}

export const awsRekognitionDetectImage = async (
  imageBase64: string,
  items: string[]
) => {
  const rekognition = new AWS.Rekognition()
  const imageBase64Data = base64Helper(imageBase64)

  const params = {
    Image: {
      Bytes: Buffer.from(imageBase64Data, 'base64'),
    },
    MaxLabels: 10,
    MinConfidence: 70,
  }

  const response = await rekognition.detectLabels(params).promise()

  const detectedItems = response.Labels?.map((label: any) => label.Name)

  return detectedItems?.join(', ')
}

export const measurments = async (imageBase64: string, items: string[]) => {
  const openai = new OpenAI()

  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: `please analyze this image and provide the rough measurments of either the items specified: ${items.join(
              ','
            )} and or the things you see in the image using rough estimates based on the items that might be in the image.`,
          },
          {
            type: 'image_url',
            image_url: {
              url: imageBase64,
            },
          },
        ],
      },
    ],
  })
  console.log(response.choices[0])

  return response.choices[0]
}

/**
 * Loads the glossary from an Excel file.
 * @async
 * @function loadGlossary
 * @param {string} glossaryFilePath - The path to the glossary file.
 * @returns {Promise<GlossaryEntryItem>} - A promise that resolves to an object representing the glossary.
 */
const loadGlossary = async (
  glossaryFilePath: string
): Promise<GlossaryEntryItem> => {
  const fileContent = await fs.readFile(glossaryFilePath)
  const workbook = xlsx.read(fileContent, { type: 'buffer' })
  const sheetName = workbook.SheetNames[0]
  const sheet = workbook.Sheets[sheetName]
  const rawData = xlsx.utils.sheet_to_json(sheet)

  const glossary: GlossaryEntryItem = {}

  rawData.forEach((row: any) => {
    const term = row['Column1']
    if (!term) return

    glossary[term] = {}

    Object.keys(row).forEach((key) => {
      if (key !== 'Column1') {
        const lang = mapColumnToLang(key)
        glossary[term][lang] = row[key] || ''
      }
    })
  })

  return glossary
}

/**
 * Translates text using a glossary if provided.
 * @async
 * @function translateWithGlossary
 * @param {string} text - The text to translate.
 * @param {string | undefined} glossaryFilePath - The path to the glossary file.
 * @param {string} sourceLang - The source language.
 * @param {string} targetLang - The target language.
 * @returns {Promise<string>} - A promise that resolves to the translated text.
 */
export const translateWithGlossary = async (
  text: string,
  glossaryFilePath: string | undefined,
  sourceLang: string,
  targetLang: string
): Promise<string> => {
  const model = new langChainOpenAI({
    temperature: 0,
    modelName: 'gpt-4o-mini',
    openAIApiKey: process.env.OPENAI_API_KEY,
  })

  let modifiedText = text
  let promptTemplate: PromptTemplate
  let glossaryReplacements: { [key: string]: string } = {}
  let placeholderCounter = 0

  if (glossaryFilePath) {
    const glossary = await loadGlossary(glossaryFilePath)
    const pattern = Object.keys(glossary)
      .sort((a, b) => b.length - a.length)
      .map((term) => term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
      .join('|')
    const regex = new RegExp(`\\b(${pattern})s?\\b`, 'gi')

    // First pass: Replace glossary terms with placeholders and store the translations
    modifiedText = text.replace(regex, (match) => {
      const term = match.replace(/s$/, '')
      const translation = findTranslation(glossary as any, targetLang, term)
      if (translation) {
        const placeholder = `__GLOSSARY_${placeholderCounter}__`
        const finalTranslation =
          match.endsWith('s') && !translation.endsWith('s')
            ? translation + 's'
            : translation
        glossaryReplacements[placeholder] = finalTranslation
        placeholderCounter++
        return placeholder
      }
      return match
    })

    promptTemplate = new PromptTemplate({
      template: `Translate the following text from {sourceLang} to {targetLang}. DO NOT translate any text between double underscores (like __GLOSSARY_0__). Provide only the translation, without any additional text:
      
      {text}`,
      inputVariables: ['sourceLang', 'targetLang', 'text'],
    })
  } else {
    promptTemplate = new PromptTemplate({
      template: `Translate the following text literally from {sourceLang} to {targetLang}. Provide only the translation, without any additional text:
      
      {text}`,
      inputVariables: ['sourceLang', 'targetLang', 'text'],
    })
  }

  const chain = new LLMChain({
    llm: model,
    prompt: promptTemplate,
  })

  const result = await chain.call({
    sourceLang,
    targetLang,
    text: modifiedText,
  })

  // Replace placeholders with their translations
  let finalText = result.text.trim()
  if (Object.keys(glossaryReplacements).length > 0) {
    Object.entries(glossaryReplacements).forEach(
      ([placeholder, translation]) => {
        finalText = finalText.replace(placeholder, translation)
      }
    )
  }

  return finalText
}
