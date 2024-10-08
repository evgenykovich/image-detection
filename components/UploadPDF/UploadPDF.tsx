'use client'

import React, { useState } from 'react'
import Image from 'next/image'
import Dropzone from 'react-dropzone'
import { ProgressBar } from 'primereact/progressbar'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { AIAction } from '@/util/enums'
import { validateUrl } from '@/util/helpers'
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
      <Dropzone onDrop={onDrop} multiple={false} disabled={selectedFiles?.[0]}>
        {({ getRootProps, getInputProps }) => (
          <section className="w-full">
            <div {...getRootProps({ className: 'dropzone' })}>
              <input {...getInputProps()} />
              {selectedFiles && selectedFiles.length > 0 ? (
                <div className="uploaded-file-info">
                  <p>{selectedFiles[0].name} uploaded successfully</p>
                </div>
              ) : (
                'Drag and drop file here, or click to select file'
              )}
            </div>
            <aside className="flex flex-col sm:flex-row items-center justify-between w-full">
              <div className="flex flex-col sm:flex-row items-center sm:space-x-4 w-full sm:w-auto">
                <Button
                  className="w-full sm:w-auto mb-2 sm:mb-0 text-white bg-blue-500 border-0 py-2 px-4 focus:outline-none hover:bg-blue-600 hover:cursor-pointer rounded text-lg"
                  disabled={!validateUrl(pdfUrl) && !selectedFiles}
                  onClick={() => handleSubmit(AIAction.RETRIEVAL)}
                >
                  Analyze
                </Button>
              </div>
              {selectedFiles && selectedFiles.length > 0 && (
                <Button
                  className="w-full sm:w-auto text-white bg-red-500 border-0 py-2 px-4 focus:outline-none hover:bg-blue-600 hover:cursor-pointer rounded text-lg mt-2 sm:mt-0"
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
