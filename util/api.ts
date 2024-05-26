import { AISelectorEnum } from './enums'

export const createURL = (path: string) => window.location.origin + path

type APICallType = {
  action: string
  base64Image: string
  items: string
  aiToUse?: string
}

export const handleDetectImage = async (base64: string) => {
  const res = await fetch(
    new Request(createURL(`/api/detect/`), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ image: base64 }),
    })
  )

  if (res.ok) {
    return res.json()
  } else {
    throw new Error('Something went wrong on API server!')
  }
}

export const handleAPICall = async ({
  action,
  base64Image,
  items,
  aiToUse = AISelectorEnum.OPEN_AI,
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
