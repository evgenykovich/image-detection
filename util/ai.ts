import z from 'zod'
import { OpenAI } from 'openai'
import { StructuredOutputParser } from 'langchain/output_parsers'
import { PromptTemplate, ChatPromptTemplate } from '@langchain/core/prompts'
import { HumanMessage } from '@langchain/core/messages'

const parser = StructuredOutputParser.fromZodSchema(
  z.object({
    objectsOnImage: z
      .string()
      .describe('a list of objects detected on the image'),
    prompt: z
      .string()
      .describe('Detailed analysis of the objects detected on the image.'),
  })
)

const getPrompt = async (imageBase64: string, items: string[]) => {
  const prompt = new PromptTemplate({
    template: `Analyze the following image and detect the following items: {items}. 
      Image Base64: {image}`,
    inputVariables: ['items', 'image'],
  })

  return await prompt.format({ items: items.join(', '), image: imageBase64 })
}

const createHumanMessage = (base64Image: any) => {
  return new HumanMessage({
    content: [
      {
        type: 'image_url',
        image_url: `data:image/jpeg;base64,${base64Image}`,
      },
    ],
  })
}

// export const analyze = async (imageBase64: string, items: string[]) => {
//   const humanMessage = new HumanMessage({ content: imageBase64 })
//   const promptMessage = await getPrompt(imageBase64, items)

//   const model = new OpenAI({
//     temperature: 0,
//     modelName: 'gpt-4',
//   })

//   const result = await model.invoke([
//     humanMessage,
//     new HumanMessage({ content: promptMessage }),
//   ])

//   try {
//     return parser.parse(result)
//   } catch (e) {
//     console.log('ERROR!', e)
//     return null
//   }
// }

export const test = async (imageBase64: string, items: string[]) => {
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
