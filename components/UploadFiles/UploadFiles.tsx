'use client'

import React, { useState } from 'react'
import { useAtomValue } from 'jotai'
import { ProgressBar } from 'primereact/progressbar'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { aiInUse } from '@/store'
import { handleAPICall, handleAllAIAPICall } from '@/util/api'
import { AIAction, AISelectorEnum } from '@/util/enums'
import './UploadFiles.styles.css'
import { DropZoneUpload } from '../DropZoneUpload'
import XLSX from 'xlsx'

const aiMapper = {
  0: AISelectorEnum.OPEN_AI,
  1: AISelectorEnum.GEMINI,
  2: AISelectorEnum.CLAUDE,
  3: AISelectorEnum.AWS_REKOGNITION,
}

interface AnalysisResult {
  filename: string
  expectedCategory: string // 'good' or 'bad'
  detectedResult: string
  isCorrect: boolean
}

export const UploadFiles = () => {
  const [selectedFiles, setSelectedFiles] = useState<any>(undefined)
  const [items, setItems] = useState('')
  const [preview, setPreview] = useState<string | null>(null)
  const [result, setResult] = useState<any>('')
  const [measurments, setMeasurments] = useState<any>('')
  const [resultsArray, setResultsArray] = useState<any>([])
  const [measurmentsArray, setMeasurmentsArray] = useState<any>([])
  const [progress, setProgress] = useState<number>(0)
  const [folderResults, setFolderResults] = useState<AnalysisResult[]>([])
  const [isFolderProcessing, setIsFolderProcessing] = useState(false)

  const useAI = useAtomValue(aiInUse)

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
      let response = null
      if (AISelectorEnum.ALL_AI === useAI) {
        if (result || measurments) {
          setResult('')
          setMeasurments('')
        }
        response = await handleAllAIAPICall({
          action,
          base64Image,
          items,
        })
        setProgress(75)
        const results = await Promise.all(
          response.map(async (res) => {
            const { detectedItems } = await res.json()
            return detectedItems
          })
        )

        setProgress(100)
        action === AIAction.DETECT
          ? setResultsArray(results)
          : setMeasurmentsArray(results)
      } else {
        if (resultsArray.length > 0 || measurmentsArray.length > 0) {
          setResultsArray([])
          setMeasurmentsArray([])
        }
        response = await handleAPICall({
          action,
          base64Image,
          items,
          aiToUse: useAI,
        })
        setProgress(75)
        const { detectedItems } = await response?.json()
        setProgress(100)

        action === AIAction.DETECT
          ? setResult(detectedItems)
          : setMeasurments(detectedItems)
      }
    } catch (error) {
      console.error('Error analyzing image', error)
      setProgress(0)
    }
  }

  const processFolderContents = async (items: DataTransferItemList) => {
    setIsFolderProcessing(true)
    const results: AnalysisResult[] = []

    // Convert DataTransferItemList to Array
    const itemsArray = Array.from(items)

    for (const item of itemsArray) {
      const entry = item.webkitGetAsEntry()
      if (entry?.isDirectory) {
        await processDirectory(entry as FileSystemDirectoryEntry, results)
      }
    }

    // Generate and download Excel report
    generateReport(results)
    setFolderResults(results)
    setIsFolderProcessing(false)
  }

  const processDirectory = async (
    dirEntry: FileSystemDirectoryEntry,
    results: AnalysisResult[]
  ) => {
    const reader = dirEntry.createReader()
    const entries = await new Promise<FileSystemEntry[]>((resolve) => {
      reader.readEntries((entries) => resolve(entries))
    })

    for (const entry of entries) {
      if (entry.isDirectory) {
        const category = entry.name.toLowerCase() // 'good' or 'bad'
        if (category === 'good' || category === 'bad') {
          await processImagesInDirectory(
            entry as FileSystemDirectoryEntry,
            category,
            results
          )
        }
      }
    }
  }

  const processImagesInDirectory = async (
    dirEntry: FileSystemDirectoryEntry,
    category: string,
    results: AnalysisResult[]
  ) => {
    const reader = dirEntry.createReader()
    const entries = await new Promise<FileSystemEntry[]>((resolve) => {
      reader.readEntries((entries) => resolve(entries))
    })

    for (const entry of entries) {
      if (entry.isFile && /\.(jpg|jpeg|png)$/i.test(entry.name)) {
        const fileEntry = entry as FileSystemFileEntry
        const file = await new Promise<File>((resolve) => {
          fileEntry.file((file) => resolve(file))
        })

        // Process image using existing detection logic
        const compressedFile = await compressImage(file)
        const base64Image = await convertToBase64(compressedFile)

        const response = await handleAPICall({
          action: AIAction.DETECT,
          base64Image,
          items: 'corrosion', // You might want to make this configurable
          aiToUse: useAI,
        })

        const { detectedItems } = await response?.json()

        results.push({
          filename: entry.name,
          expectedCategory: category,
          detectedResult: detectedItems,
          isCorrect:
            (category === 'bad' &&
              detectedItems.toLowerCase().includes('corrosion')) ||
            (category === 'good' &&
              !detectedItems.toLowerCase().includes('corrosion')),
        })
      }
    }
  }

  const generateReport = (results: AnalysisResult[]) => {
    // We'll use a library like xlsx to generate the report
    // This is a placeholder for the implementation
    const worksheet = XLSX.utils.json_to_sheet(results)
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Analysis Results')
    XLSX.writeFile(workbook, 'corrosion-analysis-report.xlsx')
  }

  const onDrop = async (files: File[], event?: any) => {
    setPreview(null)
    setProgress(0)
    setResult('')
    setFolderResults([])

    if (event?.dataTransfer?.items) {
      await processFolderContents(event.dataTransfer.items)
    } else if (files.length > 0) {
      // Existing single file logic
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

  const renderGetMeasurments = () => {
    if (useAI === AISelectorEnum.AWS_REKOGNITION) {
      return (
        <div>
          *AWS Rekognition returns only items detected on the image provided*
        </div>
      )
    }

    return (
      <Button
        className="w-full sm:w-auto mb-2 sm:mb-0 text-white bg-blue-500 border-0 py-2 px-4 focus:outline-none hover:bg-blue-600 hover:cursor-pointer rounded text-lg"
        disabled={!selectedFiles}
        onClick={() => handleSubmit(AIAction.MEASURMENTS)}
      >
        Get Measurements
      </Button>
    )
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
      <DropZoneUpload
        onDrop={onDrop}
        selectedFiles={selectedFiles}
        preview={preview}
        handleSubmit={handleSubmit}
        handleClear={handleClear}
        renderGetMeasurments={renderGetMeasurments}
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
        {measurments && (
          <div className="text-white">
            <h2>Measurments:</h2>
            <div>{measurments}</div>
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
                  <span className="font-bold ml-1">
                    {aiMapper[index as keyof typeof aiMapper]}
                  </span>
                </h2>
                <div>{result}</div>
              </div>
            ))}
          </div>
        )}
      </div>
      <div className="mt-3">
        {measurmentsArray.length > 0 && (
          <div>
            {measurmentsArray.map((result: any, index: number) => (
              <div key={index} className="mt-3">
                <h2>
                  Measurments:
                  <span className="font-bold ml-1">
                    {aiMapper[index as keyof typeof aiMapper]}
                  </span>
                </h2>
                <div>{result}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add folder results display */}
      {folderResults.length > 0 && (
        <div className="mt-6">
          <h2 className="text-xl font-bold mb-4">Folder Analysis Results</h2>
          <div className="grid gap-4">
            {folderResults.map((result, index) => (
              <div
                key={index}
                className={`p-4 rounded ${
                  result.isCorrect ? 'bg-green-100' : 'bg-red-100'
                }`}
              >
                <p>File: {result.filename}</p>
                <p>Expected: {result.expectedCategory}</p>
                <p>Detected: {result.detectedResult}</p>
                <p>
                  Status:{' '}
                  {result.isCorrect ? 'Correct' : 'False Positive/Negative'}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
