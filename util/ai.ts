import { OpenAI } from 'openai'
import { GoogleGenerativeAI } from '@google/generative-ai'

const env = process.env.GOOGLE_AI_API_KEY

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
  console.log(response.choices[0])

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
  items: string[]
) => {
  const prefix = 'data:image/jpeg;base64,'
  const imageBase64Data = imageBase64.startsWith(prefix)
    ? imageBase64.substring(prefix.length)
    : imageBase64
  const genAI = new GoogleGenerativeAI(env as string)
  const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash-latest' })

  const prompt = `please analyze this image and detect if the following items are in the image: ${items.join(
    ','
  )}`

  const image = {
    inlineData: {
      data: imageBase64Data,
      mimeType: 'image/jpeg',
    },
  }

  const result = await model.generateContent([prompt, image])
  return result.response.text()
}
