'use client'

import React, { useState } from 'react'
import { useAtomValue } from 'jotai'
import { ProgressBar } from 'primereact/progressbar'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { ScrollArea } from '@/components/ui/scroll-area'
import { aiInUse } from '@/store'
import { validateImageByFolder } from '@/util/ai'
import JSZip from 'jszip'
import * as XLSX from 'xlsx'
import { DropZoneUpload } from '../DropZoneUpload'
import { Download } from 'lucide-react'

interface ValidationResult {
  filename: string
  path: string
  category: string
  expectedState: string
  detectedResult: string
  isValid: boolean
  confidence?: number
  diagnosis?: {
    overall_assessment: string
    confidence_level: number
    key_observations: string[]
    matched_criteria: string[]
    failed_criteria: string[]
    detailed_explanation: string
  }
  similarCases?: Array<{
    imageUrl: string
    category: string
    state: string
    confidence: number
    keyFeatures: string[]
  }>
}

interface FolderStructure {
  [key: string]: {
    images: { name: string; data: Blob }[]
    subfolders: string[]
  }
}

export const ValidationFolders = () => {
  const [zipFile, setZipFile] = useState<File | null>(null)
  const [folderStructure, setFolderStructure] = useState<FolderStructure>({})
  const [selectedFolders, setSelectedFolders] = useState<string[]>([])
  const [progress, setProgress] = useState<number>(0)
  const [results, setResults] = useState<ValidationResult[]>([])
  const [isProcessing, setIsProcessing] = useState(false)
  const [isExtracting, setIsExtracting] = useState(false)
  const [totalFiles, setTotalFiles] = useState(0)
  const [processedFiles, setProcessedFiles] = useState(0)

  const useAI = useAtomValue(aiInUse)

  const convertToBase64 = async (blob: Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.readAsDataURL(blob)
      reader.onload = () => resolve(reader.result as string)
      reader.onerror = (error) => reject(error)
    })
  }

  const processImageFile = async (
    imageBlob: Blob,
    filename: string,
    path: string
  ): Promise<ValidationResult> => {
    try {
      const base64Image = await convertToBase64(imageBlob)
      const validationResult = await validateImageByFolder(base64Image, path)

      const isValid = validationResult.result
        .toLowerCase()
        .includes(validationResult.expectedState.toLowerCase())

      // Parse diagnosis and explanation if they are JSON strings
      let parsedDiagnosis
      if (typeof validationResult.diagnosis === 'string') {
        try {
          parsedDiagnosis = JSON.parse(validationResult.diagnosis)
        } catch (e) {
          console.warn('Failed to parse diagnosis JSON:', e)
        }
      } else {
        parsedDiagnosis = validationResult.diagnosis
      }

      return {
        filename,
        path,
        category: validationResult.category,
        expectedState: validationResult.expectedState,
        detectedResult: validationResult.result,
        isValid,
        confidence: validationResult.confidence,
        diagnosis: parsedDiagnosis,
        similarCases: validationResult.similarCases,
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
    setIsExtracting(true)
    setFolderStructure({})
    setSelectedFolders([])
    setResults([])

    try {
      const zip = new JSZip()
      const contents = await zip.loadAsync(file)
      const structure: FolderStructure = {}

      // Process all files in the zip
      for (const [path, zipEntry] of Object.entries(contents.files)) {
        if (!zipEntry.dir) {
          // Check if it's an image file
          if (/\.(jpg|jpeg|png)$/i.test(path)) {
            const folderPath = path.split('/').slice(0, -1).join('/')
            if (!structure[folderPath]) {
              structure[folderPath] = { images: [], subfolders: [] }
            }
            const blob = await zipEntry.async('blob')
            structure[folderPath].images.push({
              name: path.split('/').pop()!,
              data: blob,
            })
          }
        }
      }

      // Process subfolder relationships
      Object.keys(structure).forEach((folder) => {
        Object.keys(structure).forEach((potentialParent) => {
          if (
            folder.startsWith(potentialParent + '/') &&
            folder !== potentialParent
          ) {
            structure[potentialParent].subfolders.push(folder)
          }
        })
      })

      setFolderStructure(structure)
    } catch (error) {
      console.error('Error processing zip file:', error)
      alert('Error processing zip file')
    } finally {
      setIsExtracting(false)
    }
  }

  const handleSelectAll = () => {
    if (selectedFolders.length === Object.keys(folderStructure).length) {
      setSelectedFolders([])
    } else {
      setSelectedFolders(Object.keys(folderStructure))
    }
  }

  const handleFolderSelect = (folderPath: string) => {
    setSelectedFolders((prev) =>
      prev.includes(folderPath)
        ? prev.filter((f) => f !== folderPath)
        : [...prev, folderPath]
    )
  }

  const handleValidate = async () => {
    if (selectedFolders.length === 0) return

    setIsProcessing(true)
    setProgress(0)
    setResults([])
    setProcessedFiles(0)

    const totalImages = selectedFolders.reduce(
      (sum, folder) => sum + folderStructure[folder].images.length,
      0
    )
    setTotalFiles(totalImages)

    try {
      const allResults: ValidationResult[] = []

      for (const folderPath of selectedFolders) {
        const { images } = folderStructure[folderPath]

        for (const image of images) {
          const result = await processImageFile(
            image.data,
            image.name,
            folderPath
          )
          allResults.push(result)
          setProcessedFiles((prev) => prev + 1)
          setProgress((allResults.length / totalImages) * 100)
        }
      }

      setResults(allResults)
    } catch (error) {
      console.error('Error validating folders:', error)
      alert('Error validating folders')
    } finally {
      setIsProcessing(false)
    }
  }

  const handleDownloadReport = () => {
    const fileName = prompt(
      'Enter file name for the report:',
      'validation-results'
    )
    if (!fileName) return

    const workbook = XLSX.utils.book_new()
    const worksheet = XLSX.utils.json_to_sheet(results)
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Validation Results')
    XLSX.writeFile(workbook, `${fileName}.xlsx`)
  }

  return (
    <div className="w-full max-w-4xl space-y-6">
      {(progress > 0 || isExtracting) && (
        <div className="mb-6">
          <ProgressBar value={progress} />
          <div className="text-center mt-2">
            {isExtracting
              ? 'Extracting zip contents...'
              : `Processing: ${processedFiles} / ${totalFiles} files`}
          </div>
        </div>
      )}

      {!Object.keys(folderStructure).length && (
        <DropZoneUpload
          onDrop={handleZipUpload}
          selectedFiles={zipFile ? [zipFile] : undefined}
          accept=".zip"
          maxFiles={1}
        />
      )}

      {Object.keys(folderStructure).length > 0 && (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <Button
              variant="outline"
              onClick={handleSelectAll}
              disabled={isProcessing}
              className="bg-white/5 hover:bg-white/10"
            >
              {selectedFolders.length === Object.keys(folderStructure).length
                ? 'Deselect All'
                : 'Select All'}
            </Button>
            <div className="space-x-2">
              <Button
                onClick={() => {
                  setZipFile(null)
                  setFolderStructure({})
                  setSelectedFolders([])
                  setResults([])
                }}
                variant="outline"
                className="bg-white/5 hover:bg-white/10"
              >
                Upload Different Zip
              </Button>
              <Button
                onClick={handleValidate}
                disabled={selectedFolders.length === 0 || isProcessing}
                className="bg-blue-500/80 hover:bg-blue-500/90"
              >
                {isProcessing
                  ? 'Validating...'
                  : `Validate ${selectedFolders.length} Folder${
                      selectedFolders.length !== 1 ? 's' : ''
                    }`}
              </Button>
            </div>
          </div>

          <ScrollArea className="h-[300px] rounded-md border border-white/10 bg-white/5 p-4">
            <div className="space-y-4">
              {Object.entries(folderStructure).map(
                ([folderPath, { images, subfolders }]) => (
                  <div key={folderPath} className="flex items-start space-x-4">
                    <Checkbox
                      id={folderPath}
                      checked={selectedFolders.includes(folderPath)}
                      onCheckedChange={() => handleFolderSelect(folderPath)}
                      disabled={isProcessing}
                    />
                    <div className="grid gap-1.5 leading-none">
                      <label
                        htmlFor={folderPath}
                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                      >
                        {folderPath || '(Root)'}
                      </label>
                      <p className="text-sm text-muted-foreground">
                        {images.length} images
                        {subfolders.length > 0 &&
                          `, ${subfolders.length} subfolder${
                            subfolders.length !== 1 ? 's' : ''
                          }`}
                      </p>
                    </div>
                  </div>
                )
              )}
            </div>
          </ScrollArea>

          {results.length > 0 && (
            <div className="mt-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold">Validation Results</h2>
                <Button
                  onClick={handleDownloadReport}
                  className="flex items-center gap-2 bg-green-600/80 hover:bg-green-600/90"
                >
                  <Download className="h-4 w-4" />
                  Download Report
                </Button>
              </div>
              <div className="grid gap-4">
                {results.map((result, index) => (
                  <div
                    key={index}
                    className={`p-4 rounded-lg border ${
                      result.isValid
                        ? 'border-green-500/20 bg-white/5'
                        : 'border-red-500/20 bg-white/5'
                    }`}
                  >
                    <div className="space-y-2">
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="font-semibold">
                            File: {result.filename}
                          </p>
                          <p className="text-sm text-gray-400">
                            Path: {result.path}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-semibold">
                            {result.isValid ? 'Valid ✅' : 'Invalid ❌'}
                          </p>
                          {result.confidence && (
                            <p className="text-sm text-gray-400">
                              Confidence: {(result.confidence * 100).toFixed(1)}
                              %
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="grid gap-2">
                        <p>
                          <span className="font-semibold">Category:</span>{' '}
                          {result.category}
                        </p>
                        <p>
                          <span className="font-semibold">Expected State:</span>{' '}
                          {result.expectedState}
                        </p>

                        {result.diagnosis && (
                          <>
                            <div className="mt-2">
                              <p className="font-semibold">Key Observations:</p>
                              <ul className="list-disc list-inside text-sm">
                                {result.diagnosis.key_observations.map(
                                  (obs, i) => (
                                    <li key={i} className="text-gray-300">
                                      {obs}
                                    </li>
                                  )
                                )}
                              </ul>
                            </div>

                            {result.diagnosis.matched_criteria.length > 0 && (
                              <div>
                                <p className="font-semibold text-green-400">
                                  Matched Criteria:
                                </p>
                                <ul className="list-disc list-inside text-sm">
                                  {result.diagnosis.matched_criteria.map(
                                    (criteria, i) => (
                                      <li key={i} className="text-gray-300">
                                        {criteria}
                                      </li>
                                    )
                                  )}
                                </ul>
                              </div>
                            )}

                            {result.diagnosis.failed_criteria.length > 0 && (
                              <div>
                                <p className="font-semibold text-red-400">
                                  Failed Criteria:
                                </p>
                                <ul className="list-disc list-inside text-sm">
                                  {result.diagnosis.failed_criteria.map(
                                    (criteria, i) => (
                                      <li key={i} className="text-gray-300">
                                        {criteria}
                                      </li>
                                    )
                                  )}
                                </ul>
                              </div>
                            )}

                            <div className="mt-2 text-sm text-gray-400">
                              <p className="font-semibold">
                                Detailed Analysis:
                              </p>
                              <p>{result.diagnosis.detailed_explanation}</p>
                            </div>
                          </>
                        )}

                        {result.similarCases &&
                          result.similarCases.length > 0 && (
                            <div className="mt-4">
                              <p className="font-semibold">Similar Cases:</p>
                              <div className="grid gap-2">
                                {result.similarCases.map((case_, i) => (
                                  <div
                                    key={i}
                                    className="text-sm bg-black/20 p-2 rounded"
                                  >
                                    <p>Category: {case_.category}</p>
                                    <p>State: {case_.state}</p>
                                    <p>
                                      Confidence:{' '}
                                      {(case_.confidence * 100).toFixed(1)}%
                                    </p>
                                    <p>
                                      Key Features:{' '}
                                      {case_.keyFeatures.join(', ')}
                                    </p>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
