import { OpenAI } from 'openai'
import { GoogleGenerativeAI } from '@google/generative-ai'
import Anthropic from '@anthropic-ai/sdk'
import AWS from 'aws-sdk'
import { AIAction, mimeType } from './enums'
import { base64Helper } from './helpers'

const googleAPIKey = process.env.GOOGLE_AI_API_KEY
const claudeAPIKey = process.env.CLAUDE_API_KEY

export const detect = async (imageBase64: string, items: string[]) => {
  const openai = new OpenAI()

  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: `please analyze this image and detect if the following items are in the image: ${items.join(
              ','
            )}`,
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

  return response.choices[0]
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

  return detectedItems
}
