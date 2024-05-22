export const createURL = (path: string) => window.location.origin + path

const getBase64 = (file: any) => {
  var reader = new FileReader()
  reader.readAsDataURL(file)
  reader.onload = function () {
    console.log(reader.result)
  }
  reader.onerror = function (error) {
    console.log('Error: ', error)
  }
}
export const handleDetectImage = async (base64: string) => {
  debugger
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
