export const base64Helper = (imageBase64: string) => {
  const prefix = 'data:image/jpeg;base64,'
  return imageBase64.startsWith(prefix)
    ? imageBase64.substring(prefix.length)
    : imageBase64
}
