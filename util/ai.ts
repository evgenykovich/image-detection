import { OpenAI } from 'openai'
import { z } from 'zod'
import AWS from 'aws-sdk'
import pdf from 'pdf-parse'
import * as xlsx from 'xlsx'
import Sharp from 'sharp'
import { promises as fs } from 'fs'
import { OpenAI as langChainOpenAI } from 'langchain/llms/openai'
import { LLMChain } from 'langchain/chains'
import { PromptTemplate } from 'langchain/prompts'
import { Document } from 'langchain/document'
import { loadQARefineChain } from 'langchain/chains'
import { OpenAIEmbeddings } from 'langchain/embeddings/openai'
import { MemoryVectorStore } from 'langchain/vectorstores/memory'
import { GoogleGenerativeAI } from '@google/generative-ai'
import Anthropic from '@anthropic-ai/sdk'
import { AIAction, mimeType } from './enums'
import {
  base64Helper,
  blurFaceInImage,
  findTranslation,
  mapColumnToLang,
} from './helpers'

const googleAPIKey = process.env.GOOGLE_AI_API_KEY
const claudeAPIKey = process.env.CLAUDE_API_KEY

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
  if (glossaryFilePath) {
    const glossary = await loadGlossary(glossaryFilePath)
    const pattern = Object.keys(glossary)
      .sort((a, b) => b.length - a.length)
      .map((term) => term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
      .join('|')
    const regex = new RegExp(`\\b(${pattern})s?\\b`, 'gi')

    modifiedText = text.replace(regex, (match) => {
      const term = match.replace(/s$/, '')
      const translation = findTranslation(glossary as any, targetLang, term)
      if (translation) {
        return match.endsWith('s') && !translation.endsWith('s')
          ? translation + 's'
          : translation
      }
      return match
    })

    promptTemplate = new PromptTemplate({
      template: `Translate the following text from {sourceLang} to {targetLang}. Provide only the translation, without any additional text:
      
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
  return result.text.trim()
}

const extractTextFromPDF = async (pdfBuffer: Buffer): Promise<string> => {
  const data = await pdf(pdfBuffer)
  return data.text
}

export const qa = async (question: string, pdfBuffer: Buffer) => {
  const content = await extractTextFromPDF(pdfBuffer)

  const doc = new Document({
    pageContent: content,
    metadata: { id: 'pdf-doc', createdAt: new Date() },
  })

  const model = new langChainOpenAI({
    temperature: 0,
    modelName: 'gpt-4o-mini',
  })

  const chain = loadQARefineChain(model)
  const embeddings = new OpenAIEmbeddings()
  const store = await MemoryVectorStore.fromDocuments([doc], embeddings)
  const relevantDocs = await store.similaritySearch(question)
  const res = await chain.call({
    input_documents: relevantDocs,
    question,
  })

  return res.output_text
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

export const detect = async (imageBase64: string, items: string[]) => {
  const model = new langChainOpenAI({
    modelName: 'gpt-4o',
    temperature: 0,
  })

  const prompt = `Please analyze this image and detect if the following items are in the image: ${items.join(
    ', '
  )}`

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

  return response
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

export const geminiDetectImage = async (
  imageBase64: string,
  action = AIAction.DETECT,
  items: string[]
) => {
  const imageBase64Data = base64Helper(imageBase64)
  const genAI = new GoogleGenerativeAI(googleAPIKey as string)
  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash-latest' })

    let prompt = ''

    switch (action) {
      case AIAction.DETECT:
        prompt = `please analyze this image and detect if the following items are in the image: ${items.join(
          ','
        )}`
        break
      case AIAction.MEASURMENTS:
        prompt = `please analyze this image and provide the rough measurments of either the items specified: ${items.join(
          ','
        )} and or the things you see in the image using rough estimates based on the items that might be in the image.`
        break
      default:
        break
    }

    const image = {
      inlineData: {
        data: imageBase64Data,
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
  const anthropic = new Anthropic({ apiKey: claudeAPIKey as string })
  const imageBase64Data = base64Helper(imageBase64)
  let prompt = ''

  try {
    switch (action) {
      case AIAction.DETECT:
        prompt = `please analyze this image and detect if the following items are in the image: ${items.join(
          ','
        )}`
        break
      case AIAction.MEASURMENTS:
        prompt = `please analyze this image and provide the rough measurments of either the items specified: ${items.join(
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
                data: imageBase64Data,
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
