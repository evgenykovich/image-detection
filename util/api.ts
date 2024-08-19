import { AISelectorEnum } from './enums'

type APICallType = {
  action: string
  base64Image: string
  items: string
  aiToUse?: string
}

export const generalApiCall = async (route: string, file: any) => {
  debugger
  try {
    return await fetch(`/api/${route}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        file,
      }),
    })
  } catch (error) {
    console.error('Error api call', error)
  }
}

export const handleAPICall = async ({
  action,
  base64Image,
  items,
  aiToUse = AISelectorEnum.ALL_AI,
}: APICallType) => {
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

export const handleAllAIAPICall = async ({
  action,
  base64Image,
  items,
}: APICallType) => {
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
