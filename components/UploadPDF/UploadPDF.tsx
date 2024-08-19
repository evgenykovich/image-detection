'use client'

import React, { useState } from 'react'
import Image from 'next/image'
import Dropzone from 'react-dropzone'
import { ProgressBar } from 'primereact/progressbar'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { generalApiCall } from '@/util/api'
import { AIAction } from '@/util/enums'
import './UploadPDF.styles.css'

export const UploadPDF = () => {
  const [selectedFiles, setSelectedFiles] = useState<any>(undefined)
  const [items, setItems] = useState('')
  const [preview, setPreview] = useState<string | null>(null)
  const [result, setResult] = useState<any>('')
  const [resultsArray, setResultsArray] = useState<any>([])
  const [progress, setProgress] = useState<number>(0)

  const handleSubmit = async (route: string) => {
    const currentFile = selectedFiles?.[0]

    if (!currentFile) return

    try {
      setProgress(10)

      setProgress(50)
      let response = null
      if (resultsArray.length > 0) {
        setResultsArray([])
      }
      response = await generalApiCall(route, currentFile)
      setProgress(75)
      const { detectedItems } = await response?.json()
      setProgress(100)

      setResult(detectedItems)
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
            <aside className="flex flex-col sm:flex-row items-center justify-between w-full">
              <div className="flex flex-col sm:flex-row items-center sm:space-x-4 w-full sm:w-auto">
                <Button
                  className="w-full sm:w-auto mb-2 sm:mb-0 text-white bg-blue-500 border-0 py-2 px-4 focus:outline-none hover:bg-blue-600 hover:cursor-pointer rounded text-lg"
                  disabled={!selectedFiles}
                  onClick={() => handleSubmit(AIAction.RETRIEVAL)}
                >
                  Detect
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
