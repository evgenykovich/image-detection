'use client'

import React, { useState } from 'react'
import Image from 'next/image'
import Dropzone from 'react-dropzone'
import { ProgressBar } from 'primereact/progressbar'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import './UploadFiles.styles.css'

enum Action {
  DETECT = 'detect',
  MEASURMENTS = 'measurments',
}

export const UploadFiles = () => {
  const [selectedFiles, setSelectedFiles] = useState<any>(undefined)
  const [items, setItems] = useState('')
  const [preview, setPreview] = useState<string | null>(null)
  const [result, setResult] = useState<any>('')
  const [measurments, setMeasurments] = useState<any>('')
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

  const handleSubmit = async (action: string) => {
    const currentFile = selectedFiles?.[0]

    if (!currentFile) return

    try {
      setProgress(10)
      const compressedFile = await compressImage(currentFile)
      setProgress(30)
      const base64Image = await convertToBase64(compressedFile)
      setProgress(50)
      const response = await fetch(`/api/${action}`, {
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
      action === Action.DETECT
        ? setResult(detectedItems)
        : setMeasurments(detectedItems)
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

  const handleClear = () => {
    setSelectedFiles(undefined)
    setPreview(null)
    setResult('')
    setItems('')
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

      <Dropzone onDrop={onDrop} multiple={false} disabled={selectedFiles?.[0]}>
        {({ getRootProps, getInputProps }) => (
          <section className="w-full">
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
            <aside className="flex items-center justify-between w-full">
              <div>
                <Button
                  className="text-white bg-blue-500 border-0 mr-4 py-2 px-4 focus:outline-none hover:bg-blue-600 hover:cursor-pointer rounded text-lg"
                  disabled={!selectedFiles}
                  onClick={() => handleSubmit(Action.DETECT)}
                >
                  Detect
                </Button>
                <Button
                  className="text-white bg-blue-500 border-0 py-2 px-4 focus:outline-none hover:bg-blue-600 hover:cursor-pointer rounded text-lg"
                  disabled={!selectedFiles}
                  onClick={() => handleSubmit(Action.MEASURMENTS)}
                >
                  Get Measurments
                </Button>
              </div>
              {selectedFiles && selectedFiles.length > 0 && (
                <Button
                  className="text-white bg-red-500 border-0 py-2 px-4 focus:outline-none hover:bg-blue-600 hover:cursor-pointer rounded text-lg"
                  onClick={handleClear}
                >
                  Clear
                </Button>
              )}
            </aside>
          </section>
        )}
      </Dropzone>
      <div className="mt-3">
        {result && (
          <div className="text-white">
            <h2>Analysis Result:</h2>
            <div>{result}</div>
          </div>
        )}
      </div>

      <div className="mt-3">
        {measurments && (
          <div className="text-white">
            <h2>Measurments:</h2>
            <div>{measurments}</div>
          </div>
        )}
      </div>
    </div>
  )
}
