import { AISelectorEnum } from './enums'

type APICallType = {
  action: string
  base64Image: string
  items: string
  aiToUse?: string
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
