'use client'

import React, { useState } from 'react'
import { ProgressBar } from 'primereact/progressbar'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { DropZoneUpload } from '../DropZoneUpload'
import './UploadPDF.styles.css'

export const UploadPDF = () => {
  const [selectedFiles, setSelectedFiles] = useState<any>(undefined)
  const [items, setItems] = useState('')
  const [preview, setPreview] = useState<string | null>(null)
  const [result, setResult] = useState<any>('')
  const [resultsArray, setResultsArray] = useState<any>([])
  const [progress, setProgress] = useState<number>(0)
  const [pdfUrl, setPdfUrl] = useState<string>('')

  const handleSubmit = async (route: string) => {
    const currentFile = selectedFiles?.[0]

    const formData = new FormData()
    // const pdfUrl ='https://www.advantesco.com/assets/files/Antenna-Installation-Manual-General.pdf'
    if (pdfUrl) {
      formData.append('pdfUrl', pdfUrl)
    } else {
      formData.append('file', currentFile)
    }
    formData.append('question', items)

    try {
      setProgress(10)

      setProgress(50)
      if (resultsArray.length > 0) {
        setResultsArray([])
      }

      const response = await fetch(`/api/${route}`, {
        method: 'POST',
        body: formData,
      })
      setProgress(75)
      const { answer } = await response?.json()
      setProgress(100)

      setResult(answer)
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
          placeholder="Enter a question"
          value={items}
          onChange={(e) => setItems(e.target.value)}
        ></Textarea>
      </div>
      <div className="mb-6">
        <Input
          placeholder="Enter a PDF URL"
          value={pdfUrl}
          onChange={(e) => setPdfUrl(e.target.value)}
        ></Input>
      </div>
      <DropZoneUpload
        onDrop={onDrop}
        selectedFiles={selectedFiles}
        preview={preview}
        handleSubmit={handleSubmit}
        handleClear={handleClear}
      />
      <div className="mt-3">
        {result && (
          <div className="text-white">
            <h2>Analysis Result:</h2>
            <div>{result}</div>
          </div>
        )}
      </div>

      <div className="mt-3">
        {resultsArray.length > 0 && (
          <div>
            {resultsArray.map((result: any, index: number) => (
              <div key={index} className="mt-3">
                <h2>
                  Analysis Result:
                  <span className="font-bold ml-1">{resultsArray}</span>
                </h2>
                <div>{result}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
