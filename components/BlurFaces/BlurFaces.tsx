'use client'
import { useState } from 'react'
import Image from 'next/image'
import { DropZoneUpload } from '../DropZoneUpload'
import { ProgressBar } from 'primereact/progressbar'

export const BlurFaces = () => {
  const [preview, setPreview] = useState<string | null>(null)
  const [progress, setProgress] = useState<number>(0)
  const [result, setResult] = useState<string>('')
  const [selectedFiles, setSelectedFiles] = useState<File[] | undefined>(
    undefined
  )

  const compressImage = (file: File): Promise<File> => {
    return new Promise((resolve) => {
      const img = document.createElement('img')
      const canvas = document.createElement('canvas')
      const reader = new FileReader()

      reader.readAsDataURL(file)
      reader.onload = (event) => {
        img.src = event.target?.result as string
        img.onload = () => {
          const ctx = canvas.getContext('2d')
          canvas.width = img.width / 2
          canvas.height = img.height / 2
          ctx?.drawImage(img, 0, 0, canvas.width, canvas.height)
          canvas.toBlob((blob) => {
            if (blob) {
              resolve(new File([blob], file.name, { type: file.type }))
            }
          }, file.type)
        }
      }
    })
  }

  const convertToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.readAsDataURL(file)
      reader.onload = () => resolve(reader.result as string)
      reader.onerror = (error) => reject(error)
    })
  }

  const handleSubmit = async () => {
    const currentFile = selectedFiles?.[0]

    if (!currentFile) return

    try {
      setProgress(10)
      const compressedFile = await compressImage(currentFile)
      setProgress(30)
      const base64Image = await convertToBase64(compressedFile)
      setProgress(50)
      const response = await fetch('/api/blur-faces', {
        method: 'POST',
        body: JSON.stringify({ image: base64Image }),
      })

      const { detectedFaces } = await response.json()

      setProgress(100)
      setResult(detectedFaces)
    } catch (error) {
      console.error('Error analyzing image', error)
      setProgress(0)
    }
  }

  const onDrop = (files: File[]) => {
    setPreview(null)
    setProgress(0)
    setResult('')
    if (files.length > 0) {
      const file = files[0]
      setSelectedFiles(files)
      setPreview(URL.createObjectURL(file))
    }
  }

  const handleClear = () => {
    setProgress(0)
    setSelectedFiles(undefined)
    setPreview(null)
    setResult('')
  }
  return (
    <div>
      {progress !== 0 && (
        <div className="mt-6 mb-6">
          <ProgressBar value={progress}></ProgressBar>
        </div>
      )}
      <DropZoneUpload
        onDrop={onDrop}
        selectedFiles={selectedFiles}
        preview={preview}
        handleSubmit={handleSubmit}
        handleClear={handleClear}
      />
      {result && (
        <div
          style={{
            position: 'relative',
            width: '100%',
            height: '0',
            paddingBottom: '100%',
          }}
        >
          <Image
            src={result}
            alt="Blurred Image"
            layout="fill"
            objectFit="contain"
          />
        </div>
      )}
    </div>
  )
}
