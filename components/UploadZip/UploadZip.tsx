'use client'

import React, { useState } from 'react'
import { useAtomValue } from 'jotai'
import { ProgressBar } from 'primereact/progressbar'
import { Button } from '@/components/ui/button'
import { aiInUse } from '@/store'
import { handleAPICall } from '@/util/api'
import { AIAction } from '@/util/enums'
import { validateImageByFolder } from '@/util/ai'
import JSZip from 'jszip'
import * as XLSX from 'xlsx'
import { DropZoneUpload } from '../DropZoneUpload'
import { base64Helper, addImagePrefix } from '@/util/helpers'
import { Download } from 'lucide-react'

interface ValidationResult {
  filename: string
  path: string
  category: string
  expectedState: string
  detectedResult: string
  isValid: boolean
}

export const UploadZip = () => {
  const [zipFile, setZipFile] = useState<File | null>(null)
  const [progress, setProgress] = useState<number>(0)
  const [results, setResults] = useState<ValidationResult[]>([])
  const [isProcessing, setIsProcessing] = useState(false)
  const [totalFiles, setTotalFiles] = useState(0)
  const [processedFiles, setProcessedFiles] = useState(0)

  const useAI = useAtomValue(aiInUse)

  const convertToBase64 = (file: File | Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.readAsDataURL(file)
      reader.onload = () => resolve(reader.result as string)
      reader.onerror = (error) => reject(error)
    })
  }

  const processImageFile = async (
    file: File | Blob,
    filename: string,
    path: string
  ): Promise<ValidationResult> => {
    try {
      // Convert directly to base64 without compression
      const base64Image = await convertToBase64(file)
      debugger
      const validationResult = await validateImageByFolder(base64Image, path)

      // Determine if the result matches the expected state
      const isValid = validationResult.result
        .toLowerCase()
        .includes(validationResult.expectedState.toLowerCase())

      return {
        filename,
        path,
        category: validationResult.category,
        expectedState: validationResult.expectedState,
        detectedResult: validationResult.result,
        isValid,
      }
    } catch (error) {
      console.error('Error processing image:', error)
      return {
        filename,
        path,
        category: 'unknown',
        expectedState: 'unknown',
        detectedResult: 'Error processing image',
        isValid: false,
      }
    }
  }

  const handleZipUpload = async (files: File[]) => {
    const file = files[0]
    if (!file || !file.name.endsWith('.zip')) {
      alert('Please upload a zip file')
      return
    }

    setZipFile(file)
    setIsProcessing(true)
    setProgress(0)
    setResults([])
    setProcessedFiles(0)

    try {
      const zip = new JSZip()
      const contents = await zip.loadAsync(file)
      debugger

      // Filter for image files and count them
      const imageFiles = Object.values(contents.files).filter(
        (zipEntry): zipEntry is JSZip.JSZipObject =>
          !zipEntry.dir && /\.(jpg|jpeg|png)$/i.test(zipEntry.name)
      )
      setTotalFiles(imageFiles.length)

      const results: ValidationResult[] = []

      for (const zipEntry of imageFiles) {
        const blob = await zipEntry.async('blob')
        const result = await processImageFile(
          blob,
          zipEntry.name,
          zipEntry.name
        )
        results.push(result)
        setProcessedFiles((prev) => prev + 1)
        setProgress((results.length / imageFiles.length) * 100)
      }

      setResults(results)
    } catch (error) {
      console.error('Error processing zip file:', error)
      alert('Error processing zip file')
    } finally {
      setIsProcessing(false)
    }
  }

  const handleDownloadReport = () => {
    // Create a dialog element to let user choose the file name
    const fileName = prompt(
      'Enter file name for the report:',
      'validation-results'
    )
    if (!fileName) return // User cancelled

    const workbook = XLSX.utils.book_new()
    const worksheet = XLSX.utils.json_to_sheet(results)
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Validation Results')

    // Save with user's chosen filename
    XLSX.writeFile(workbook, `${fileName}.xlsx`)
  }

  return (
    <div className="w-full max-w-4xl">
      {progress > 0 && (
        <div className="mb-6">
          <ProgressBar value={progress} />
          <div className="text-center mt-2">
            Processing: {processedFiles} / {totalFiles} files
          </div>
        </div>
      )}

      <DropZoneUpload
        onDrop={handleZipUpload}
        selectedFiles={zipFile ? [zipFile] : undefined}
        accept=".zip"
        maxFiles={1}
      />

      {results.length > 0 && (
        <div className="mt-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold">Validation Results</h2>
            <Button
              onClick={handleDownloadReport}
              className="flex items-center gap-2 bg-green-600 hover:bg-green-700"
            >
              <Download className="h-4 w-4" />
              Download Report
            </Button>
          </div>
          <div className="grid gap-4">
            {results.map((result, index) => (
              <div
                key={index}
                className={`p-4 rounded ${
                  result.isValid ? 'bg-green-100' : 'bg-red-100'
                }`}
              >
                <p className="font-semibold">File: {result.filename}</p>
                <p>Path: {result.path}</p>
                <p>Category: {result.category}</p>
                <p>Expected State: {result.expectedState}</p>
                <p>Detection Result: {result.detectedResult}</p>
                <p>Status: {result.isValid ? 'Valid' : 'Invalid'}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
