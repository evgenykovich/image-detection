'use client'

import React, { useState } from 'react'
import { useAtomValue } from 'jotai'
import { ProgressBar } from 'primereact/progressbar'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Switch } from '@/components/ui/switch'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import { aiInUse } from '@/store'
import { validateImageByFolder } from '@/util/ai'
import JSZip from 'jszip'
import * as XLSX from 'xlsx'
import { DropZoneUpload } from '../DropZoneUpload'
import { Download, Folder, ChevronDown, Loader2 } from 'lucide-react'

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
  explanation?:
    | string
    | {
        visual_criteria: {
          diameter_measurement: {
            result: string
            details: string
          }
          wear_detection: {
            result: string
            details: string
          }
        }
        measurement_requirements: {
          cable_diameter: {
            result: string
            details: string
          }
        }
        contextual_requirements: {
          required_elements: {
            result: string
            details: string
          }
          forbidden_elements: {
            result: string
            details: string
          }
        }
        category_guidelines: {
          good_examples: {
            result: string
            details: string
          }
          bad_examples: {
            result: string
            details: string
          }
        }
        comparison_with_similar_cases: {
          result: string
          details: string
        }
      }
  features?: {
    structuralFeatures: {
      edges: number
      contrast: number
      brightness: number
      sharpness: number
    }
    metadata: {
      dimensions: {
        width: number
        height: number
      }
      format: string
      size: number
    }
    visualFeatures?: number[]
  }
  matchedCriteria?: string[]
  failedCriteria?: string[]
  similarCases?: Array<{
    imageUrl: string
    category: string
    state: string
    confidence: number
    keyFeatures: string[]
    diagnosis?:
      | string
      | {
          overall_assessment: string
          confidence_level: number
          key_observations: string[]
          matched_criteria: string[]
          failed_criteria: string[]
          detailed_explanation: string
        }
  }>
}

interface ValidationResponse {
  result: string
  category: string
  expectedState: string
  confidence?: number
  diagnosis?:
    | string
    | {
        overall_assessment: string
        confidence_level: number
        key_observations: string[]
        matched_criteria: string[]
        failed_criteria: string[]
        detailed_explanation: string
      }
  explanation?: string
  features?: {
    structuralFeatures: {
      edges: number
      contrast: number
      brightness: number
      sharpness: number
    }
    metadata: {
      dimensions: {
        width: number
        height: number
      }
      format: string
      size: number
    }
    visualFeatures?: number[]
  }
  similarCases?: Array<{
    imageUrl: string
    category: string
    state: string
    confidence: number
    keyFeatures: string[]
    diagnosis?:
      | string
      | {
          overall_assessment: string
          confidence_level: number
          key_observations: string[]
          matched_criteria: string[]
          failed_criteria: string[]
          detailed_explanation: string
        }
  }>
}

interface FolderStructure {
  [key: string]: {
    images: { name: string; data: Blob }[]
    subfolders: string[]
  }
}

interface DiagnosisObject {
  overall_assessment: string
  confidence_level: number
  key_observations: string[]
  matched_criteria: string[]
  failed_criteria: string[]
  detailed_explanation: string
}

export const UploadZip = () => {
  const [zipFile, setZipFile] = useState<File | null>(null)
  const [folderStructure, setFolderStructure] = useState<FolderStructure>({})
  const [selectedFolders, setSelectedFolders] = useState<string[]>([])
  const [progress, setProgress] = useState<number>(0)
  const [results, setResults] = useState<ValidationResult[]>([])
  const [isProcessing, setIsProcessing] = useState(false)
  const [isExtracting, setIsExtracting] = useState(false)
  const [totalFiles, setTotalFiles] = useState(0)
  const [processedFiles, setProcessedFiles] = useState(0)

  // Validation mode controls
  const [validationMode, setValidationMode] = useState<
    'training' | 'validation'
  >('validation')
  const [useVectorStore, setUseVectorStore] = useState(true)
  const [useRulesValidation, setUseRulesValidation] = useState(true)

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
      const validationResult = await validateImageByFolder(
        base64Image,
        path,
        useVectorStore,
        validationMode === 'training',
        useRulesValidation
      )

      // Parse diagnosis if it's a JSON string
      let parsedDiagnosis: DiagnosisObject | undefined = undefined
      if (validationResult.diagnosis) {
        if (typeof validationResult.diagnosis === 'string') {
          try {
            // Remove the markdown code block markers if present
            const diagnosisStr = validationResult.diagnosis.replace(
              /```json\n|\n```/g,
              ''
            )
            const parsed = JSON.parse(diagnosisStr)
            if (typeof parsed === 'object') {
              parsedDiagnosis = parsed as DiagnosisObject
            }
          } catch (e) {
            console.warn('Failed to parse diagnosis JSON:', e)
            // If parsing fails, create a structured diagnosis from the string
            parsedDiagnosis = {
              overall_assessment: validationResult.result,
              confidence_level: validationResult.confidence || 0.5,
              key_observations: [validationResult.diagnosis],
              matched_criteria: [],
              failed_criteria: [],
              detailed_explanation: validationResult.diagnosis,
            }
          }
        } else {
          parsedDiagnosis = validationResult.diagnosis
        }
      }

      // Parse explanation if it's a JSON string
      let parsedExplanation
      if (typeof validationResult.explanation === 'string') {
        try {
          // Remove the markdown code block markers if present
          const explanationStr = validationResult.explanation.replace(
            /```json\n|\n```/g,
            ''
          )
          parsedExplanation = JSON.parse(explanationStr)
        } catch (e) {
          console.warn('Failed to parse explanation JSON:', e)
          parsedExplanation = validationResult.explanation
        }
      } else {
        parsedExplanation = validationResult.explanation
      }

      // Determine isValid based on the diagnosis overall assessment
      const isValid =
        parsedDiagnosis?.overall_assessment?.toLowerCase() !== 'invalid'

      // Get detection result from diagnosis or validation result
      const detectionResult =
        parsedDiagnosis?.key_observations?.[0] ||
        parsedDiagnosis?.overall_assessment ||
        validationResult.result ||
        'Cable diameter validation failed'

      return {
        filename,
        path,
        category: validationResult.category,
        expectedState: validationResult.expectedState,
        detectedResult: detectionResult,
        isValid,
        confidence:
          parsedDiagnosis?.confidence_level || validationResult.confidence,
        diagnosis: parsedDiagnosis,
        explanation: parsedExplanation,
        features: validationResult.features,
        matchedCriteria: parsedDiagnosis?.matched_criteria || [],
        failedCriteria: parsedDiagnosis?.failed_criteria || [],
        similarCases: validationResult.similarCases?.map((c) => {
          if (c.diagnosis && typeof c.diagnosis === 'string') {
            try {
              const diagStr = c.diagnosis.replace(/```json\n|\n```/g, '')
              const parsed = JSON.parse(diagStr)
              if (typeof parsed === 'object') {
                return {
                  ...c,
                  diagnosis: parsed as DiagnosisObject,
                }
              }
            } catch (e) {
              console.warn('Failed to parse similar case diagnosis:', e)
            }
          }
          return c
        }),
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
        diagnosis: {
          overall_assessment: 'Error',
          confidence_level: 0,
          key_observations: ['Error processing image'],
          matched_criteria: [],
          failed_criteria: [],
          detailed_explanation:
            error instanceof Error ? error.message : 'Unknown error',
        },
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

    // Transform results to flatten nested objects for Excel
    const flattenedResults = results.map((result, index) => {
      // Helper function to format explanation
      const formatExplanation = (result: any): string => {
        console.log(`Processing explanation for result ${index}:`, result)

        // First try to build explanation from diagnosis information
        const diagnosisExplanation = []

        if (result.diagnosis) {
          if (result.diagnosis.key_observations?.length > 0) {
            diagnosisExplanation.push('Key Observations:')
            diagnosisExplanation.push(
              result.diagnosis.key_observations.join('\n')
            )
          }

          if (result.diagnosis.detailed_explanation) {
            diagnosisExplanation.push('\nDetailed Analysis:')
            diagnosisExplanation.push(result.diagnosis.detailed_explanation)
          }

          if (result.matchedCriteria?.length > 0) {
            diagnosisExplanation.push('\nMatched Criteria:')
            diagnosisExplanation.push(result.matchedCriteria.join('\n'))
          }

          if (result.failedCriteria?.length > 0) {
            diagnosisExplanation.push('\nFailed Criteria:')
            diagnosisExplanation.push(result.failedCriteria.join('\n'))
          }
        }

        // If we have a structured explanation object, add it
        if (result.explanation && typeof result.explanation === 'object') {
          try {
            const sections: string[] = []

            if (result.explanation.visual_criteria) {
              sections.push('\nVisual Criteria:')
              Object.entries(result.explanation.visual_criteria).forEach(
                ([key, value]: [string, any]) => {
                  if (value && typeof value === 'object') {
                    sections.push(
                      `${key}: ${value.result || ''} - ${value.details || ''}`
                    )
                  }
                }
              )
            }

            if (result.explanation.measurement_requirements) {
              sections.push('\nMeasurement Requirements:')
              Object.entries(
                result.explanation.measurement_requirements
              ).forEach(([key, value]: [string, any]) => {
                if (value && typeof value === 'object') {
                  sections.push(
                    `${key}: ${value.result || ''} - ${value.details || ''}`
                  )
                }
              })
            }

            diagnosisExplanation.push(...sections)
          } catch (error) {
            console.error('Error formatting structured explanation:', error)
          }
        }

        // If we have a string explanation, add it
        if (result.explanation && typeof result.explanation === 'string') {
          diagnosisExplanation.push('\nAdditional Details:')
          diagnosisExplanation.push(result.explanation)
        }

        const finalExplanation = diagnosisExplanation.join('\n')
        console.log('Final formatted explanation:', finalExplanation)
        return finalExplanation
      }

      const flattenedResult = {
        'File Name': result.filename,
        Path: result.path,
        Category: result.category,
        'Expected State': result.expectedState,
        'Detected Result': result.detectedResult,
        'Is Valid': result.isValid ? 'Yes' : 'No',
        Confidence:
          typeof result.confidence === 'number'
            ? `${(result.confidence * 100).toFixed(1)}%`
            : 'N/A',
        // Diagnosis details
        'Overall Assessment': result.diagnosis?.overall_assessment || '',
        'Confidence Level': result.diagnosis?.confidence_level || '',
        'Key Observations':
          result.diagnosis?.key_observations?.join('\n') || '',
        'Matched Criteria': result.matchedCriteria?.join('\n') || '',
        'Failed Criteria': result.failedCriteria?.join('\n') || '',
        'Detailed Explanation': formatExplanation(result),
        // Feature details
        Edges: result.features?.structuralFeatures.edges || '',
        Contrast: result.features?.structuralFeatures.contrast || '',
        Brightness: result.features?.structuralFeatures.brightness || '',
        Sharpness: result.features?.structuralFeatures.sharpness || '',
        'Image Width': result.features?.metadata.dimensions.width || '',
        'Image Height': result.features?.metadata.dimensions.height || '',
        'Image Format': result.features?.metadata.format || '',
        'Image Size': result.features?.metadata.size || '',
      }

      return flattenedResult
    })

    const workbook = XLSX.utils.book_new()
    const worksheet = XLSX.utils.json_to_sheet(flattenedResults)

    // Set column widths
    const columnWidths = {
      A: 30, // File Name
      B: 40, // Path
      C: 15, // Category
      D: 15, // Expected State
      E: 15, // Detected Result
      F: 10, // Is Valid
      G: 10, // Confidence
      H: 20, // Overall Assessment
      I: 10, // Confidence Level
      J: 50, // Key Observations
      K: 50, // Matched Criteria
      L: 50, // Failed Criteria
      M: 60, // Detailed Explanation
      N: 10, // Edges
      O: 10, // Contrast
      P: 10, // Brightness
      Q: 10, // Sharpness
      R: 10, // Image Width
      S: 10, // Image Height
      T: 10, // Image Format
      U: 10, // Image Size
    }

    worksheet['!cols'] = Object.entries(columnWidths).map(([, width]) => ({
      wch: width,
    }))

    XLSX.utils.book_append_sheet(workbook, worksheet, 'Validation Results')
    XLSX.writeFile(workbook, `${fileName}.xlsx`)
  }

  return (
    <div className="w-full max-w-4xl space-y-6">
      <div className="flex items-center justify-between p-6 bg-gradient-to-r from-blue-500/10 to-purple-500/10 rounded-lg border border-blue-500/20 shadow-lg">
        <div className="space-y-2">
          <h3 className="text-xl font-semibold text-white flex items-center gap-2">
            Enhanced Validation
            <span className="text-xs font-normal px-2 py-1 rounded-full bg-blue-500/20 text-blue-300">
              Beta
            </span>
          </h3>
          <p className="text-sm text-white/80">
            Enable vector store for similar case comparison and enhanced
            validation accuracy
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium text-white/80">
            {useVectorStore ? 'Enabled' : 'Disabled'}
          </span>
          <Switch
            checked={useVectorStore}
            onCheckedChange={setUseVectorStore}
            disabled={isProcessing}
          />
        </div>
      </div>

      {/* Validation Settings Panel */}
      <div className="p-6 bg-gradient-to-r from-blue-500/10 to-purple-500/10 rounded-lg border border-blue-500/20 shadow-lg space-y-4">
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <h3 className="text-xl font-semibold text-white flex items-center gap-2">
              Validation Settings
              <span className="text-xs font-normal px-2 py-1 rounded-full bg-blue-500/20 text-blue-300">
                Beta
              </span>
            </h3>
            <p className="text-sm text-white/80">
              Configure how images are validated and processed
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Mode Selection */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-white/90">Mode</label>
            <select
              value={validationMode}
              onChange={(e) =>
                setValidationMode(e.target.value as 'training' | 'validation')
              }
              className="w-full bg-white/5 border border-white/10 rounded-md px-3 py-2 text-white"
              disabled={isProcessing}
            >
              <option value="validation" className="text-black">
                Validation Mode
              </option>
              <option value="training" className="text-black">
                Training Mode
              </option>
            </select>
            <p className="text-xs text-white/60">
              {validationMode === 'training'
                ? 'Store images as ground truth examples'
                : 'Validate images against existing examples'}
            </p>
          </div>

          {/* Vector Store Toggle */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-white/90">
                Vector Store
              </label>
              <Switch
                checked={useVectorStore}
                onCheckedChange={setUseVectorStore}
                disabled={isProcessing || validationMode === 'training'}
              />
            </div>
            <p className="text-xs text-white/60">
              Compare with similar examples
            </p>
          </div>

          {/* Rules Validation Toggle */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-white/90">
                Rules Validation
              </label>
              <Switch
                checked={useRulesValidation}
                onCheckedChange={setUseRulesValidation}
                disabled={isProcessing}
              />
            </div>
            <p className="text-xs text-white/60">
              Validate against defined rules
            </p>
          </div>
        </div>

        {validationMode === 'training' && (
          <div className="mt-4 p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-md">
            <div className="flex items-start gap-3">
              <div className="p-1.5 bg-yellow-500/20 rounded-full">
                <svg
                  className="w-4 h-4 text-yellow-500"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                  />
                </svg>
              </div>
              <div>
                <h4 className="text-sm font-medium text-yellow-500">
                  Training Mode Active
                </h4>
                <p className="text-xs text-white/60">
                  Images will be stored as ground truth examples with maximum
                  confidence. Use this mode only for validated, correct
                  examples.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {(progress > 0 || isExtracting) && !isProcessing && (
        <div className="mb-6">
          <div className="flex items-center justify-center space-x-3 mb-2">
            {isExtracting ? (
              <>
                <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />
                <p className="text-white">Extracting zip contents...</p>
              </>
            ) : (
              <p className="text-white">
                Processing: {processedFiles} / {totalFiles} files
              </p>
            )}
          </div>
          <div className="w-full bg-white/10 rounded-full h-2 overflow-hidden">
            <div
              className="h-full bg-blue-500 transition-all duration-300 ease-in-out"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}

      {isProcessing && (
        <div className="flex flex-col items-center justify-center p-8 space-y-4 bg-white/5 rounded-lg border border-white/10">
          <div className="flex items-center space-x-3">
            <Loader2 className="w-6 h-6 text-blue-500 animate-spin" />
            <p className="text-lg text-white">Validating Images...</p>
          </div>
          <div className="w-full max-w-md">
            <div className="flex justify-between text-sm text-white/70 mb-2">
              <span>
                {processedFiles} of {totalFiles} files processed
              </span>
              <span>{Math.round(progress)}%</span>
            </div>
            <div className="h-2 bg-white/10 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-500 transition-all duration-300 ease-in-out"
                style={{ width: `${progress}%` }}
              />
            </div>
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
              className="bg-white/5 hover:bg-white/10 text-white"
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
                className="bg-white/5 hover:bg-white/10 text-white"
              >
                Upload Different Zip
              </Button>
              <Button
                onClick={handleValidate}
                disabled={selectedFolders.length === 0 || isProcessing}
                className="bg-blue-500/80 hover:bg-blue-500/90 text-white"
              >
                {isProcessing
                  ? 'Validating...'
                  : `Validate ${selectedFolders.length} Folder${
                      selectedFolders.length !== 1 ? 's' : ''
                    }`}
              </Button>
            </div>
          </div>

          <div className="relative">
            <ScrollArea className="h-[300px] rounded-md border border-white/10 bg-white/5">
              <div className="space-y-4 p-4">
                {Object.entries(folderStructure).map(
                  ([folderPath, { images, subfolders }]) => (
                    <div
                      key={folderPath}
                      className="flex items-start space-x-4 p-2 rounded-lg hover:bg-white/5 transition-colors"
                    >
                      <Checkbox
                        id={folderPath}
                        checked={selectedFolders.includes(folderPath)}
                        onCheckedChange={() => handleFolderSelect(folderPath)}
                        disabled={isProcessing}
                        className="text-white"
                      />
                      <Folder className="h-4 w-4 mt-0.5 text-white/70" />
                      <div className="grid gap-1.5 leading-none text-white">
                        <label
                          htmlFor={folderPath}
                          className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                        >
                          {folderPath || '(Root)'}
                        </label>
                        <p className="text-sm text-muted-foreground text-white">
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
            <div className="absolute bottom-0 left-0 right-0 h-12 bg-gradient-to-t from-black/20 to-transparent pointer-events-none rounded-b-md flex items-center justify-center">
              <ChevronDown className="h-4 w-4 text-white/50 animate-bounce" />
            </div>
          </div>

          {results.length > 0 && (
            <div className="mt-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold text-white">
                  Validation Results
                </h2>
                <Button
                  onClick={handleDownloadReport}
                  className="flex items-center gap-2 bg-green-600/80 hover:bg-green-600/90 text-white"
                >
                  <Download className="h-4 w-4" />
                  Download Report
                </Button>
              </div>
              <div className="grid gap-4">
                <Accordion type="multiple" className="space-y-4">
                  {results.map((result, index) => (
                    <AccordionItem
                      key={index}
                      value={`item-${index}`}
                      className={`rounded-lg border ${
                        result.isValid
                          ? 'border-green-500/20 bg-gradient-to-br from-green-500/5 to-transparent'
                          : 'border-red-500/20 bg-gradient-to-br from-red-500/5 to-transparent'
                      }`}
                    >
                      <AccordionTrigger className="px-4 py-2 hover:no-underline">
                        <div className="flex justify-between items-center w-full">
                          <div className="flex items-center gap-4">
                            <span className="text-white/90 font-semibold">
                              {result.filename}
                            </span>
                            <div className="flex items-center gap-2 px-2 py-1 rounded-full bg-white/5">
                              <span className="text-sm text-white/60">
                                {result.category}
                              </span>
                            </div>
                          </div>
                          <div className="flex items-center gap-4">
                            <div
                              className={`px-3 py-1 rounded-full ${
                                result.isValid
                                  ? 'bg-green-500/20 text-green-400'
                                  : 'bg-red-500/20 text-red-400'
                              }`}
                            >
                              {result.isValid ? 'Valid' : 'Invalid'}
                            </div>
                            {result.confidence !== undefined && (
                              <div className="flex items-center gap-2">
                                <div className="w-20 h-2 bg-white/10 rounded-full overflow-hidden">
                                  <div
                                    className={`h-full ${
                                      result.isValid
                                        ? 'bg-green-500'
                                        : 'bg-red-500'
                                    } transition-all duration-300`}
                                    style={{
                                      width: `${result.confidence * 100}%`,
                                    }}
                                  />
                                </div>
                                <span className="text-sm text-white/60 mr-2">
                                  {typeof result.confidence === 'number'
                                    ? `${(result.confidence * 100).toFixed(1)}%`
                                    : 'N/A'}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent>
                        <div className="px-4 py-3 space-y-6">
                          {/* Path and Basic Info */}
                          <div className="flex items-center gap-2 text-sm text-white/60">
                            <Folder className="h-4 w-4" />
                            {result.path}
                          </div>

                          {/* Assessment Summary */}
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-4">
                              <div className="bg-white/5 rounded-lg p-4 space-y-3">
                                <h3 className="text-lg font-semibold text-white">
                                  Assessment Summary
                                </h3>
                                <div className="space-y-2">
                                  <div className="flex justify-between items-center">
                                    <span className="text-white/70">
                                      Status
                                    </span>
                                    <span
                                      className={
                                        result.isValid
                                          ? 'text-green-400'
                                          : 'text-red-400'
                                      }
                                    >
                                      {result.diagnosis?.overall_assessment ||
                                        (result.isValid ? 'Valid' : 'Invalid')}
                                    </span>
                                  </div>
                                  <div className="flex justify-between items-center">
                                    <span className="text-white/70">
                                      Confidence
                                    </span>
                                    <span className="text-white/90">
                                      {typeof result.confidence === 'number'
                                        ? `${(result.confidence * 100).toFixed(
                                            1
                                          )}%`
                                        : 'N/A'}
                                    </span>
                                  </div>
                                  <div className="flex justify-between items-center">
                                    <span className="text-white/70">
                                      Category
                                    </span>
                                    <span className="text-white/90">
                                      {(
                                        result.path.split('/')[1] || 'Unknown'
                                      ).replace(/^\d+-/, '')}
                                    </span>
                                  </div>
                                  <div className="flex justify-between items-center">
                                    <span className="text-white/70">
                                      Expected State
                                    </span>
                                    <span className="text-white/90">
                                      {(
                                        result.path.split('/')[2] || 'Unknown'
                                      ).replace(/^\d+-/, '')}
                                    </span>
                                  </div>
                                </div>
                              </div>

                              {/* Key Observations */}
                              {result.diagnosis?.key_observations &&
                                result.diagnosis.key_observations.length >
                                  0 && (
                                  <div className="bg-white/5 rounded-lg p-4 space-y-3">
                                    <h3 className="text-lg font-semibold text-white">
                                      Key Observations
                                    </h3>
                                    <ul className="space-y-2">
                                      {result.diagnosis.key_observations.map(
                                        (obs, i) => (
                                          <li
                                            key={i}
                                            className="flex items-start gap-2 text-white/80"
                                          >
                                            <span>•</span>
                                            <span>{obs}</span>
                                          </li>
                                        )
                                      )}
                                    </ul>
                                  </div>
                                )}
                            </div>

                            <div className="space-y-4">
                              {/* Validation Criteria */}
                              <div className="bg-white/5 rounded-lg p-4 space-y-4">
                                <h3 className="text-lg font-semibold text-white">
                                  Validation Criteria
                                </h3>

                                {/* Matched Criteria */}
                                {result.matchedCriteria &&
                                  result.matchedCriteria.length > 0 && (
                                    <div className="space-y-2">
                                      <h4 className="text-sm font-medium text-green-400">
                                        Matched Criteria
                                      </h4>
                                      <ul className="space-y-1">
                                        {result.matchedCriteria.map(
                                          (criteria, i) => (
                                            <li
                                              key={i}
                                              className="flex items-start gap-2 text-white/70"
                                            >
                                              <span className="text-green-400 mt-1">
                                                ✓
                                              </span>
                                              <span>{criteria}</span>
                                            </li>
                                          )
                                        )}
                                      </ul>
                                    </div>
                                  )}

                                {/* Failed Criteria */}
                                {result.failedCriteria &&
                                  result.failedCriteria.length > 0 && (
                                    <div className="space-y-2">
                                      <h4 className="text-sm font-medium text-red-400">
                                        Failed Criteria
                                      </h4>
                                      <ul className="space-y-1">
                                        {result.failedCriteria.map(
                                          (criteria, i) => (
                                            <li
                                              key={i}
                                              className="flex items-start gap-2 text-white/70"
                                            >
                                              <span className="text-red-400 mt-1">
                                                ✗
                                              </span>
                                              <span>{criteria}</span>
                                            </li>
                                          )
                                        )}
                                      </ul>
                                    </div>
                                  )}
                              </div>

                              {/* Detailed Analysis */}
                              {result.diagnosis?.detailed_explanation && (
                                <div className="bg-white/5 rounded-lg p-4 space-y-3">
                                  <h3 className="text-lg font-semibold text-white">
                                    Detailed Analysis
                                  </h3>
                                  <p className="text-white/70 text-sm whitespace-pre-wrap">
                                    {result.diagnosis.detailed_explanation}
                                  </p>
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Image Features */}
                          {result.features && (
                            <div className="bg-white/5 rounded-lg p-4 space-y-4">
                              <h3 className="text-lg font-semibold text-white">
                                Image Features
                              </h3>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {/* Structural Features */}
                                <div className="space-y-3">
                                  <h4 className="text-sm font-medium text-white/90">
                                    Structural Features
                                  </h4>
                                  <div className="space-y-2">
                                    {Object.entries(
                                      result.features.structuralFeatures
                                    ).map(([key, value]) => (
                                      <div
                                        key={key}
                                        className="flex justify-between items-center"
                                      >
                                        <span className="text-white/70 capitalize">
                                          {key}
                                        </span>
                                        <span className="text-white/90">
                                          {typeof value === 'number'
                                            ? value.toFixed(2)
                                            : value}
                                        </span>
                                      </div>
                                    ))}
                                  </div>
                                </div>

                                {/* Image Metadata */}
                                <div className="space-y-3">
                                  <h4 className="text-sm font-medium text-white/90">
                                    Image Metadata
                                  </h4>
                                  <div className="space-y-2">
                                    <div className="flex justify-between items-center">
                                      <span className="text-white/70">
                                        Dimensions
                                      </span>
                                      <span className="text-white/90">
                                        {
                                          result.features.metadata.dimensions
                                            .width
                                        }{' '}
                                        x{' '}
                                        {
                                          result.features.metadata.dimensions
                                            .height
                                        }
                                      </span>
                                    </div>
                                    <div className="flex justify-between items-center">
                                      <span className="text-white/70">
                                        Format
                                      </span>
                                      <span className="text-white/90">
                                        {result.features.metadata.format}
                                      </span>
                                    </div>
                                    <div className="flex justify-between items-center">
                                      <span className="text-white/70">
                                        Size
                                      </span>
                                      <span className="text-white/90">
                                        {(
                                          result.features.metadata.size / 1024
                                        ).toFixed(1)}{' '}
                                        KB
                                      </span>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
