import { OpenAI } from 'openai'
import { z } from 'zod'
import AWS from 'aws-sdk'
import pdf from 'pdf-parse'
import * as xlsx from 'xlsx'
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
import { base64Helper } from './helpers'

const googleAPIKey = process.env.GOOGLE_AI_API_KEY
const claudeAPIKey = process.env.CLAUDE_API_KEY

AWS.config.update({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION,
})

export const translateWithGlossary = async (
  text: string,
  glossaryFilePath: string | undefined,
  sourceLang: string,
  targetLang: string
) => {
  if (!glossaryFilePath) {
    throw new Error('Glossary file path is undefined')
  }

  const glossaryChunks = await loadAndChunkGlossary(glossaryFilePath)

  const model = new langChainOpenAI({
    temperature: 0,
    modelName: 'gpt-4o',
  })

  const promptTemplate = new PromptTemplate({
    template: `You are a professional translator. Translate the following text from {sourceLang} to {targetLang}. 
    Use the provided glossary chunk for consistent terminology. Each line of the glossary contains all information about a term, separated by '|':

    Glossary Chunk:
    {glossaryChunk}

    Text to translate:
    {text}

    Translation:`,
    inputVariables: ['sourceLang', 'targetLang', 'glossaryChunk', 'text'],
  })

  const chain = new LLMChain({ llm: model, prompt: promptTemplate })

  const translatedText = await translateWithChunkedGlossary(
    text,
    glossaryChunks,
    chain,
    {
      sourceLang,
      targetLang,
    }
  )

  return translatedText
}

async function loadAndChunkGlossary(
  glossaryFilePath: string
): Promise<string[]> {
  const fileContent = await fs.readFile(glossaryFilePath)
  const workbook = xlsx.read(fileContent, { type: 'buffer' })
  const sheetName = workbook.SheetNames[0]
  const sheet = workbook.Sheets[sheetName]
  const glossary = xlsx.utils.sheet_to_json(sheet)

  if (!Array.isArray(glossary) || glossary.length === 0) {
    console.error('Glossary is empty or not an array:', glossary)
    throw new Error('Invalid glossary format')
  }

  const glossaryString = glossary
    .map((entry: any) => {
      const values = Object.values(entry)
      if (values.length === 0) {
        console.warn('Empty glossary entry:', entry)
        return null
      }
      return values.join(' | ')
    })
    .filter(Boolean)
    .join('\n')

  if (glossaryString.length === 0) {
    console.warn('Glossary string is empty')
  }

  return chunkGlossary(glossaryString)
}

function chunkGlossary(glossaryString: string): string[] {
  const MAX_CHUNK_SIZE = 10000 // Adjust as needed
  const lines = glossaryString.split('\n')
  const chunks: string[] = []
  let currentChunk = ''

  for (const line of lines) {
    if ((currentChunk + line + '\n').length > MAX_CHUNK_SIZE) {
      if (currentChunk) chunks.push(currentChunk.trim())
      currentChunk = line + '\n'
    } else {
      currentChunk += line + '\n'
    }
  }
  if (currentChunk) chunks.push(currentChunk.trim())

  return chunks
}

async function translateWithChunkedGlossary(
  text: string,
  glossaryChunks: string[],
  chain: LLMChain,
  params: { sourceLang: string; targetLang: string }
): Promise<string> {
  let translatedText = text

  for (const glossaryChunk of glossaryChunks) {
    const result = await chain.call({
      ...params,
      glossaryChunk,
      text: translatedText,
    })
    translatedText = result.text
  }

  return translatedText
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
    modelName: 'gpt-4o',
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
