export const createURL = (path: string) => window.location.origin + path

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
