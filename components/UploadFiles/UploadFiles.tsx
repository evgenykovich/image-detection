'use client'

import React, { useState } from 'react'
import Image from 'next/image'
import Dropzone from 'react-dropzone'
import { ProgressBar } from 'primereact/progressbar'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import './UploadFiles.styles.css'

export const UploadFiles = () => {
  const [selectedFiles, setSelectedFiles] = useState<any>(undefined)
  const [items, setItems] = useState('')
  const [preview, setPreview] = useState<string | null>(null)
  const [result, setResult] = useState<any>('')
  const [progress, setProgress] = useState<number>(0)

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

    if (!currentFile || !items) return

    try {
      setProgress(10)
      const compressedFile = await compressImage(currentFile)
      setProgress(30)
      const base64Image = await convertToBase64(compressedFile)
      setProgress(50)
      const response = await fetch('/api/detect', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          image: base64Image,
          items: items.split(',').map((item) => item.trim()),
        }),
      })
      setProgress(75)
      const { detectedItems } = await response.json()
      setProgress(100)
      setResult(detectedItems)
      setSelectedFiles(undefined)
    } catch (error) {
      console.error('Error analyzing image', error)
      setProgress(0)
    }
  }

  const onDrop = (files: any) => {
    setPreview(null)
    setProgress(0)
    setResult('')
    if (files.length > 0) {
      const file = files[0]
      setSelectedFiles(files)
      setPreview(URL.createObjectURL(file))
    }
  }

  return (
    <div>
      {progress !== 0 && (
        <div className="mt-6 mb-6">
          <ProgressBar value={progress}></ProgressBar>
        </div>
      )}
      <div className="mb-6">
        <Textarea
          className="text-black/80"
          placeholder="Enter items to detect, separated by commas"
          value={items}
          onChange={(e) => setItems(e.target.value)}
        ></Textarea>
      </div>

      <Dropzone onDrop={onDrop} multiple={false}>
        {({ getRootProps, getInputProps }) => (
          <section>
            <div {...getRootProps({ className: 'dropzone' })}>
              <input {...getInputProps()} />
              {preview ? (
                <div className="selected-file">
                  <Image height={350} width={350} src={preview} alt="Image" />
                </div>
              ) : (
                'Drag and drop file here, or click to select file'
              )}
            </div>
            <aside className="selected-file-wrapper">
              <Button
                className="text-white bg-blue-500 border-0 py-2 px-4 focus:outline-none hover:bg-blue-600 hover:cursor-pointer rounded text-lg"
                disabled={!selectedFiles}
                onClick={handleSubmit}
              >
                Upload
              </Button>
            </aside>
          </section>
        )}
      </Dropzone>
      <div>
        {result && (
          <div className="text-white">
            <h2>Analysis Result:</h2>
            <div>{result}</div>
          </div>
        )}
      </div>
    </div>
  )
}
