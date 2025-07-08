'use client'

import React, { useState, useEffect, useCallback } from 'react'
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import Image from 'next/image'
import JSZip from 'jszip'
import * as XLSX from 'xlsx'
import { DropZoneUpload } from '../DropZoneUpload'
import {
  Download,
  Folder,
  ChevronDown,
  Loader2,
  Check,
  Trash2,
} from 'lucide-react'
import { useToast } from '@/components/ui/use-toast'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'

interface VectorStoreStats {
  namespace: string
  totalVectors: number
  categories: string[]
  lastUpdated: string | null
  created: string | null
  sampleMetadata: {
    id: string
    category: string
    state: string
    confidence: number
    createdAt: string
    features?: {
      structuralFeatures: {
        edges: number
        contrast: number
        sharpness: number
        brightness: number
      }
      metadata?: {
        format: string
        size: number
        dimensions: {
          width: number
          height: number
        }
      }
      visualFeatures?: number[]
    }
    diagnosis?: string
    keyFeatures?: string[]
    prompt?: string
  }[]
}

interface ValidationResponse {
  isValid: boolean
  confidence: number
  diagnosis:
    | string
    | {
        overall_assessment: string
        confidence_level: number
        key_observations: string[]
        matched_criteria: string[]
        failed_criteria: string[]
        detailed_explanation: string
      }
  matchedCriteria: string[]
  failedCriteria: string[]
  similarCases: Array<{
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
  explanation: string
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
  result: string
  category: string
  expectedState: string
  mode: 'training' | 'validation'
  vectorStoreUsed: boolean
  measurement?: string
}

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
  matchedCriteria: string[]
  failedCriteria: string[]
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
  vectorStoreUsed?: boolean
}

interface SuggestedPrompt {
  text: string
  category?: string
  confidence?: number
  selected?: boolean
}

interface FolderStructure {
  [key: string]: {
    images: { name: string; data: Blob }[]
    subfolders: string[]
    prompt: string
    description: string
    suggestedPrompts?: SuggestedPrompt[]
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
  const { toast } = useToast()
  const [zipFile, setZipFile] = useState<File | null>(null)
  const [folderStructure, setFolderStructure] = useState<FolderStructure>({})
  const [selectedFolders, setSelectedFolders] = useState<string[]>([])
  const [progress, setProgress] = useState<number>(0)
  const [results, setResults] = useState<ValidationResult[]>([])
  const [isProcessing, setIsProcessing] = useState(false)
  const [isExtracting, setIsExtracting] = useState(false)
  const [totalFiles, setTotalFiles] = useState(0)
  const [processedFiles, setProcessedFiles] = useState(0)
  const [promptText, setPromptText] = useState<string>('')
  const [isPromptDialogOpen, setIsPromptDialogOpen] = useState(false)
  const [hasPromptFile, setHasPromptFile] = useState(false)
  const [promptFileName, setPromptFileName] = useState<string | null>(null)
  const [currentEditingFolder, setCurrentEditingFolder] = useState<
    string | null
  >(null)
  const [foldersNeedingPrompts, setFoldersNeedingPrompts] = useState<string[]>(
    []
  )
  const [useGemini, setUseGemini] = useState(false)

  // Validation mode controls
  const [validationMode, setValidationMode] = useState<
    'training' | 'validation'
  >('validation')
  const [useVectorStore, setUseVectorStore] = useState(true)

  const [isExportDialogOpen, setIsExportDialogOpen] = useState(false)
  const [exportFileName, setExportFileName] = useState('validation-results')
  const [isClearConfirmOpen, setIsClearConfirmOpen] = useState(false)
  const [isClearingVectorStore, setIsClearingVectorStore] = useState(false)
  const [selectedNamespace, setSelectedNamespace] = useState<string>('')
  const [availableNamespaces, setAvailableNamespaces] = useState<
    Array<{ id: string; name: string }>
  >([])
  const [isAddingNamespace, setIsAddingNamespace] = useState(false)
  const [newNamespaceName, setNewNamespaceName] = useState('')

  // Add these state variables at the top with other state declarations
  const [isSuggestingPrompt, setIsSuggestingPrompt] = useState(false)
  const [suggestedPrompts, setSuggestedPrompts] = useState<SuggestedPrompt[]>(
    []
  )

  const [vectorStats, setVectorStats] = useState<VectorStoreStats | null>(null)
  const [isLoadingStats, setIsLoadingStats] = useState(false)
  const [isDeletingVector, setIsDeletingVector] = useState<string | null>(null)

  const [isImageCategoryDialogOpen, setIsImageCategoryDialogOpen] =
    useState(false)
  const [pendingImageFile, setPendingImageFile] = useState<File | null>(null)
  const [selectedCategory, setSelectedCategory] = useState('connector_plates')
  const [selectedState, setSelectedState] = useState('straight')

  const [selectedResult, setSelectedResult] = useState<ValidationResult | null>(
    null
  )

  // Add fetchVectorStats function
  const fetchVectorStats = useCallback(async () => {
    if (!selectedNamespace) return

    try {
      setIsLoadingStats(true)
      const response = await fetch(
        `/api/vector-stats?namespace=${selectedNamespace}`
      )
      if (!response.ok) throw new Error('Failed to fetch vector store stats')
      const data = await response.json()
      setVectorStats(data)
    } catch (error) {
      console.error('Error fetching vector store stats:', error)
      toast({
        title: 'Error',
        description: 'Failed to fetch vector store statistics',
        variant: 'destructive',
      })
    } finally {
      setIsLoadingStats(false)
    }
  }, [selectedNamespace, toast])

  // Update loadNamespaces to also fetch stats
  const loadNamespaces = useCallback(async () => {
    try {
      const response = await fetch('/api/namespaces')
      if (!response.ok) throw new Error('Failed to load namespaces')
      const data = await response.json()
      setAvailableNamespaces(data.namespaces)

      // Select first namespace if none selected
      if (data.namespaces.length > 0 && !selectedNamespace) {
        setSelectedNamespace(data.namespaces[0].id)
      }

      // Fetch stats for the selected namespace
      if (selectedNamespace) {
        await fetchVectorStats()
      }
    } catch (error) {
      console.error('Error loading namespaces:', error)
    }
  }, [selectedNamespace, fetchVectorStats])

  // Add effect to fetch stats when namespace changes
  useEffect(() => {
    if (selectedNamespace) {
      fetchVectorStats()
    }
  }, [selectedNamespace, fetchVectorStats])

  // Load namespaces on component mount
  useEffect(() => {
    loadNamespaces()
  }, [loadNamespaces])

  // Update handleClearVectorStore to refresh stats
  const handleClearVectorStore = async () => {
    if (!selectedNamespace) return

    try {
      setIsClearingVectorStore(true)
      const response = await fetch('/api/clear-vector-store', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ namespace: selectedNamespace }),
      })

      if (!response.ok) throw new Error('Failed to clear vector store')

      toast({
        title: 'Success',
        description: 'Vector store cleared successfully',
        variant: 'default',
      })

      // Refresh stats after clearing
      await fetchVectorStats()
    } catch (error) {
      console.error('Error clearing vector store:', error)
      toast({
        title: 'Error',
        description: 'Failed to clear vector store',
        variant: 'destructive',
      })
    } finally {
      setIsClearingVectorStore(false)
      setIsClearConfirmOpen(false)
    }
  }

  const handleAddNamespace = async () => {
    try {
      setIsAddingNamespace(true)
      const response = await fetch('/api/namespaces', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newNamespaceName }),
      })

      if (!response.ok) throw new Error('Failed to add namespace')

      await loadNamespaces()
      setNewNamespaceName('')
      setIsAddingNamespace(false)
      toast({
        title: 'Success',
        description: 'Namespace added successfully',
        variant: 'default',
      })
    } catch (error) {
      console.error('Error adding namespace:', error)
      toast({
        title: 'Error',
        description: 'Failed to add namespace',
        variant: 'destructive',
      })
      setIsAddingNamespace(false)
    }
  }

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
      const folderPrompt = folderStructure[path]?.prompt || ''
      const folderDescription = folderStructure[path]?.description || ''

      console.log(
        'Sending validation request with model:',
        useGemini ? 'Gemini' : 'OpenAI'
      )

      const response = await fetch('/api/validate-image', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          imageBase64: base64Image,
          folderPath: path,
          useVectorStore,
          isTrainingMode: validationMode === 'training',
          prompt: folderPrompt,
          description: folderDescription,
          useGemini,
          namespace: selectedNamespace,
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to validate image')
      }

      const validationResult = await response.json()
      console.log('Raw API response:', validationResult)

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
      let parsedExplanation = validationResult.explanation
      if (typeof validationResult.explanation === 'string') {
        try {
          // Remove the markdown code block markers if present
          const explanationStr = validationResult.explanation
            .replace(/```json\n|\n```/g, '')
            .trim()
          // Only try to parse if it looks like JSON
          if (explanationStr.startsWith('{') && explanationStr.endsWith('}')) {
            parsedExplanation = JSON.parse(explanationStr)
          }
        } catch (e) {
          console.warn('Failed to parse explanation JSON:', e)
          // Keep the original string if parsing fails
          parsedExplanation = validationResult.explanation
        }
      }

      // Determine isValid based on the diagnosis overall assessment
      console.log('Raw validation result:', validationResult)
      const isValid =
        validationResult.isValid || // First check the direct isValid flag
        validationResult.is_valid || // Also check snake_case version
        parsedDiagnosis?.overall_assessment
          ?.toLowerCase()
          .includes('is valid') ||
        parsedDiagnosis?.overall_assessment?.toLowerCase() === 'valid' ||
        parsedDiagnosis?.overall_assessment?.toLowerCase() === 'pass'

      console.log('Computed isValid:', isValid)
      console.log('Validation diagnosis:', parsedDiagnosis)

      // Get detection result from diagnosis or validation result
      const detectionResult =
        parsedDiagnosis?.key_observations?.[0] ||
        parsedDiagnosis?.overall_assessment ||
        validationResult.result ||
        'Validation failed'

      // Get matchedCriteria from either the top-level field or diagnosis
      const matchedCriteria =
        validationResult.matchedCriteria ||
        parsedDiagnosis?.matched_criteria ||
        []

      const result = {
        filename,
        path,
        category: validationResult.category,
        expectedState: validationResult.expectedState,
        detectedResult: detectionResult,
        isValid, // Use our computed isValid value
        confidence:
          parsedDiagnosis?.confidence_level || validationResult.confidence,
        diagnosis: parsedDiagnosis,
        explanation: parsedExplanation,
        features: validationResult.features,
        matchedCriteria,
        failedCriteria: parsedDiagnosis?.failed_criteria || [],
        similarCases: validationResult.similarCases?.map(
          (c: ValidationResponse['similarCases'][0]) => {
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
          }
        ),
        vectorStoreUsed: validationResult.vectorStoreUsed,
      }

      console.log('Final mapped result:', result)
      return result
    } catch (error) {
      console.error('Error processing image:', error)
      throw error
    }
  }

  const handleZipUpload = async (files: File[]) => {
    const file = files[0]
    if (!file) {
      toast({
        title: 'Error',
        description: 'Please upload a file',
        variant: 'destructive',
      })
      return
    }

    if (file.type.startsWith('image/')) {
      if (!useVectorStore) {
        // If vector store is disabled, just process the image directly
        setZipFile(file)
        const structure: FolderStructure = {
          'individual-images': {
            images: [
              {
                name: file.name,
                data: file,
              },
            ],
            subfolders: [],
            prompt: '',
            description: '',
          },
        }
        setFolderStructure(structure)
        setSelectedFolders(['individual-images'])
        toast({
          title: 'Success',
          description: 'Image loaded successfully',
          variant: 'default',
        })
        return
      }

      // Show category selection dialog only when vector store is enabled
      setPendingImageFile(file)
      setIsImageCategoryDialogOpen(true)
      return
    }

    if (!file.name.endsWith('.zip')) {
      toast({
        title: 'Error',
        description: 'Please upload a zip file or an image',
        variant: 'destructive',
      })
      return
    }

    setZipFile(file)
    setIsExtracting(true)
    setFolderStructure({})
    setSelectedFolders([])
    setResults([])
    setHasPromptFile(false)
    setPromptFileName(null)
    setPromptText('')

    try {
      const zip = new JSZip()
      const contents = await zip.loadAsync(file)
      const structure: FolderStructure = {}

      for (const [path, zipEntry] of Object.entries(contents.files)) {
        if (!zipEntry.dir) {
          const folderPath = path.split('/').slice(0, -1).join('/')
          const fileName = path.split('/').pop()!

          // Initialize folder if it doesn't exist
          if (!structure[folderPath]) {
            structure[folderPath] = {
              images: [],
              subfolders: [],
              prompt: '',
              description: '',
            }
          }

          // Process images
          if (/\.(jpg|jpeg|png)$/i.test(fileName)) {
            const blob = await zipEntry.async('blob')
            structure[folderPath].images.push({
              name: fileName,
              data: blob,
            })
          }
          // Process prompt.txt
          else if (fileName.toLowerCase() === 'prompt.txt') {
            const promptContent = await zipEntry.async('text')
            structure[folderPath].prompt = promptContent
          }
        }
      }

      // Second pass: Process subfolder relationships
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
      toast({
        title: 'Success',
        description: 'File processed successfully',
        variant: 'default',
      })
    } catch (error) {
      console.error('Error processing file:', error)
      toast({
        title: 'Error',
        description: 'Error processing file',
        variant: 'destructive',
      })
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
    if (!selectedFolders.length) {
      toast({
        title: 'Error',
        description: 'Please select at least one folder to validate',
        variant: 'destructive',
      })
      return
    }

    if (validationMode === 'training' && !selectedNamespace) {
      toast({
        title: 'Error',
        description: 'Please select a namespace for storing training examples',
        variant: 'destructive',
      })
      return
    }

    setIsProcessing(true)
    setProgress(0)
    setProcessedFiles(0)
    setResults([])

    try {
      await processValidation()
    } catch (error) {
      console.error('Error during validation:', error)
      toast({
        title: 'Error',
        description: 'Failed to validate images',
        variant: 'destructive',
      })
    } finally {
      setIsProcessing(false)
    }
  }

  const processValidation = async () => {
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
      toast({
        title: 'Error',
        description: 'Error validating folders',
        variant: 'destructive',
      })
    } finally {
      setIsProcessing(false)
    }
  }

  const handleExportClick = () => {
    setIsExportDialogOpen(true)
  }

  const handleExportConfirm = () => {
    setIsExportDialogOpen(false)
    if (exportFileName.trim()) {
      generateExcelReport(exportFileName.trim())
    }
  }

  const generateExcelReport = (fileName: string) => {
    // Helper function to truncate and split long text
    const processLongText = (
      text: string,
      maxLength: number = 32000
    ): string[] => {
      if (!text || text.length <= maxLength) return [text]
      const chunks: string[] = []
      for (let i = 0; i < text.length; i += maxLength) {
        chunks.push(text.slice(i, i + maxLength))
      }
      return chunks
    }

    // Transform results to flatten nested objects for Excel
    const flattenedResults = results.map((result) => {
      // Helper function to format explanation
      const formatExplanation = (result: any): string => {
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

        // Add structured explanation if available
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

        return diagnosisExplanation.join('\n')
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
        'Overall Assessment': result.diagnosis?.overall_assessment || '',
        'Confidence Level': result.diagnosis?.confidence_level || '',
      }

      // Helper function to add fields with potential continuation
      const addSplitField = (
        obj: any,
        fieldName: string,
        content: string | undefined | null
      ) => {
        const chunks = processLongText(content || '')
        if (chunks[0]) {
          obj[fieldName] = chunks[0]
          if (chunks[1]) {
            obj[`${fieldName} (cont.)`] = chunks[1]
          }
        }
      }

      // Add all the potentially long fields
      addSplitField(
        flattenedResult,
        'Key Observations',
        result.diagnosis?.key_observations?.join('\n')
      )
      addSplitField(
        flattenedResult,
        'Matched Criteria',
        result.matchedCriteria?.join('\n')
      )
      addSplitField(
        flattenedResult,
        'Failed Criteria',
        result.failedCriteria?.join('\n')
      )
      addSplitField(
        flattenedResult,
        'Detailed Analysis',
        formatExplanation(result)
      )

      // Add the remaining fields
      Object.assign(flattenedResult, {
        'Structural Features - Edges':
          result.features?.structuralFeatures?.edges || '',
        'Structural Features - Contrast':
          result.features?.structuralFeatures?.contrast || '',
        'Structural Features - Brightness':
          result.features?.structuralFeatures?.brightness || '',
        'Structural Features - Sharpness':
          result.features?.structuralFeatures?.sharpness || '',
        'Image Width': result.features?.metadata?.dimensions?.width || '',
        'Image Height': result.features?.metadata?.dimensions?.height || '',
        'Image Format': result.features?.metadata?.format || '',
        'Image Size (KB)': result.features?.metadata?.size
          ? (result.features.metadata.size / 1024).toFixed(1)
          : '',
        'Reference Match': result.diagnosis?.key_observations?.some((obs) =>
          obs.toLowerCase().includes('matches reference image')
        )
          ? 'Yes'
          : 'No',
        'Reference Match Confidence':
          result.diagnosis?.key_observations
            ?.find((obs) =>
              obs.toLowerCase().includes('matches reference image')
            )
            ?.match(/\d+\.?\d*%/)?.[0] || 'N/A',
      })

      return flattenedResult
    })

    const workbook = XLSX.utils.book_new()
    const worksheet = XLSX.utils.json_to_sheet(flattenedResults)

    // Set column widths
    const columnWidths = {
      A: 30, // File Name
      B: 40, // Path
      C: 20, // Category
      D: 20, // Expected State
      E: 30, // Detected Result
      F: 10, // Is Valid
      G: 15, // Confidence
      H: 30, // Overall Assessment
      I: 15, // Confidence Level
      J: 60, // Key Observations
      K: 60, // Key Observations (cont.)
      L: 60, // Matched Criteria
      M: 60, // Matched Criteria (cont.)
      N: 60, // Failed Criteria
      O: 60, // Failed Criteria (cont.)
      P: 60, // Detailed Analysis
      Q: 60, // Detailed Analysis (cont.)
      R: 15, // Edges
      S: 15, // Contrast
      T: 15, // Brightness
      U: 15, // Sharpness
      V: 15, // Image Width
      W: 15, // Image Height
      X: 15, // Image Format
      Y: 15, // Image Size
      Z: 15, // Reference Match
      AA: 20, // Reference Match Confidence
    }

    worksheet['!cols'] = Object.entries(columnWidths).map(([, width]) => ({
      wch: width,
    }))

    XLSX.utils.book_append_sheet(workbook, worksheet, 'Validation Results')
    XLSX.writeFile(workbook, `${fileName}.xlsx`)
  }

  const handlePromptEdit = (folderPath: string) => {
    setCurrentEditingFolder(folderPath)
    setFoldersNeedingPrompts([])
    setIsPromptDialogOpen(true)
  }

  const handlePromptConfirm = () => {
    if (foldersNeedingPrompts.length > 0) {
      // Remove the current folder from the list
      const updatedFolders = foldersNeedingPrompts.filter(
        (folder) => folder !== currentEditingFolder
      )
      setFoldersNeedingPrompts(updatedFolders)

      if (updatedFolders.length > 0) {
        // Move to the next folder that needs a prompt
        setCurrentEditingFolder(updatedFolders[0])
      } else {
        // All prompts are set, close dialog and start validation
        setIsPromptDialogOpen(false)
        setCurrentEditingFolder(null)
        processValidation()
      }
    } else {
      // Normal prompt editing mode
      setIsPromptDialogOpen(false)
      setCurrentEditingFolder(null)
    }
  }

  const handleSuggestPrompt = async () => {
    if (!currentEditingFolder || !folderStructure?.[currentEditingFolder])
      return

    setIsSuggestingPrompt(true)
    try {
      const folder = folderStructure[currentEditingFolder]
      if (!folder?.images?.length) {
        toast({
          title: 'No images found',
          description:
            'The folder must contain at least one image to suggest a prompt.',
          variant: 'destructive',
        })
        return
      }

      // Get the first image as a sample
      const sampleImage = folder.images[0]
      const base64Image = await convertToBase64(sampleImage.data)

      // Send request to suggest prompt
      const response = await fetch('/api/suggest-prompt', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          imageBase64: base64Image,
          folderPath: currentEditingFolder,
          description: folder.description,
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to suggest prompt')
      }

      const { suggestedPrompt } = await response.json()

      const calculateConfidence = (prompt: string): number => {
        let confidence = 0.5 // Base confidence

        // Increase confidence based on specific characteristics
        if (
          prompt.includes('measure') ||
          prompt.includes('dimensions') ||
          prompt.includes('mm') ||
          prompt.includes('tolerance')
        ) {
          confidence += 0.2 // More confident in measurable criteria
        }

        if (
          prompt.includes('verify') ||
          prompt.includes('ensure') ||
          prompt.includes('check') ||
          prompt.includes('inspect')
        ) {
          confidence += 0.15 // Confident in verification tasks
        }

        if (
          prompt.includes('defect') ||
          prompt.includes('damage') ||
          prompt.includes('crack') ||
          prompt.includes('imperfection')
        ) {
          confidence += 0.1 // Decent confidence in defect detection
        }

        // Adjust confidence based on prompt specificity
        if (prompt.match(/\d+(\.\d+)?\s*(mm|cm|m|inch)/)) {
          confidence += 0.1 // Higher confidence when specific measurements are included
        }

        // Cap confidence at 0.95
        return Math.min(0.95, confidence)
      }

      // Split the response into individual prompts
      const prompts = suggestedPrompt
        .split('\n')
        .filter((line: string) => line.trim())
        .map((line: string) => line.trim())
        .filter((line: string) => {
          // Filter out lines that are likely headers or footers
          const isHeader =
            line.toLowerCase().includes('validation prompt') ||
            line.endsWith(':') ||
            line.startsWith('Please ensure')
          return !isHeader
        })
        .map((line: string) => {
          // Remove numbering if present
          const cleanLine = line.replace(/^\d+\.\s*/, '').trim()
          const pathParts = currentEditingFolder?.split('/') || []
          return {
            text: cleanLine,
            category: pathParts[1] || '',
            confidence: calculateConfidence(cleanLine.toLowerCase()),
            selected: false,
          }
        })
        .filter((prompt: SuggestedPrompt) => prompt.text.length > 0)

      setFolderStructure((prev) => {
        const currentFolder = prev[currentEditingFolder]
        if (!currentFolder) return prev

        return {
          ...prev,
          [currentEditingFolder]: {
            ...currentFolder,
            suggestedPrompts: [
              ...(currentFolder.suggestedPrompts || []),
              ...prompts,
            ],
          },
        }
      })

      toast({
        title: 'Prompts Suggested',
        description: `Generated ${prompts.length} validation prompts based on your folder description and sample image.`,
        variant: 'default',
      })
    } catch (error) {
      console.error('Error suggesting prompt:', error)
      toast({
        title: 'Error',
        description: 'Failed to suggest prompt. Please try again.',
        variant: 'destructive',
      })
    } finally {
      setIsSuggestingPrompt(false)
    }
  }

  const handlePromptSelect = (folderPath: string, promptIndex: number) => {
    setFolderStructure((prev) => {
      const folder = prev[folderPath]
      if (!folder?.suggestedPrompts) return prev

      const updatedPrompts = folder.suggestedPrompts.map((p, idx) => ({
        ...p,
        selected: idx === promptIndex ? !p.selected : p.selected, // Toggle selection
      }))

      // Combine selected prompts into a single prompt string
      const selectedPrompts = updatedPrompts
        .filter((p) => p.selected)
        .map((p) => p.text)
        .join('\n\n')

      return {
        ...prev,
        [folderPath]: {
          ...folder,
          prompt: selectedPrompts,
          suggestedPrompts: updatedPrompts,
        },
      }
    })
  }

  // Add this function after the other API-related functions
  const handleDeleteVector = async (vectorId: string) => {
    if (!selectedNamespace) return

    try {
      setIsDeletingVector(vectorId)
      const response = await fetch('/api/vectors', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          namespace: selectedNamespace,
          vectorId: vectorId,
        }),
      })

      if (!response.ok) throw new Error('Failed to delete vector')

      toast({
        title: 'Success',
        description: 'Vector deleted successfully',
        variant: 'default',
      })

      // Refresh stats after deletion
      await fetchVectorStats()
    } catch (error) {
      console.error('Error deleting vector:', error)
      toast({
        title: 'Error',
        description: 'Failed to delete vector',
        variant: 'destructive',
      })
    } finally {
      setIsDeletingVector(null)
    }
  }

  const handleImageCategoryConfirm = () => {
    if (!pendingImageFile) return

    const path = `individual-images/01-${selectedCategory}/01-${selectedState}`
    const structure: FolderStructure = {
      [path]: {
        images: [
          {
            name: pendingImageFile.name,
            data: pendingImageFile,
          },
        ],
        subfolders: [],
        prompt: '',
        description: '',
      },
    }
    setFolderStructure(structure)
    setSelectedFolders([path])
    setZipFile(pendingImageFile)
    setPendingImageFile(null)
    setIsImageCategoryDialogOpen(false)
    toast({
      title: 'Success',
      description: 'Image loaded successfully',
      variant: 'default',
    })
  }

  // Add this function to get unique states for a category from vector store metadata
  const getStatesForCategory = (category: string): string[] => {
    if (!vectorStats?.sampleMetadata) return []
    return Array.from(
      new Set(
        vectorStats.sampleMetadata
          .filter((meta) => meta.category === category)
          .map((meta) => meta.state)
      )
    )
  }

  // Add these formatting functions
  const formatDisplayName = (name: string): string => {
    return name
      .split('_')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ')
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

      {/* Enhanced Validation Section */}
      <div className="space-y-6">
        <Tabs defaultValue="validation" className="w-full">
          <TabsList className="w-full">
            <TabsTrigger value="validation" className="flex-1">
              Validation Settings
            </TabsTrigger>
            <TabsTrigger value="vectors" className="flex-1">
              Vector Store
            </TabsTrigger>
          </TabsList>
          <TabsContent value="validation">
            <div className="p-6 bg-gradient-to-r from-blue-500/10 to-purple-500/10 rounded-lg border border-blue-500/20 shadow-lg">
              <div className="space-y-2">
                <h3 className="text-xl font-semibold text-white">
                  Validation Settings
                </h3>
                <p className="text-sm text-white/70">
                  Configure how images are validated and processed.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
                {/* Mode Selection */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-white/90">
                    Mode
                  </label>
                  <select
                    value={validationMode}
                    onChange={(e) => {
                      const newMode = e.target.value as
                        | 'training'
                        | 'validation'
                      setValidationMode(newMode)
                      // Always enable vector store in training mode
                      if (newMode === 'training') {
                        setUseVectorStore(true)
                      }
                    }}
                    className="w-full bg-white/5 border border-white/10 rounded-md px-3 py-2 text-white"
                    disabled={isProcessing}
                  >
                    <option value="validation" className="text-black">
                      Validation Mode
                    </option>
                    <option value="training" className="text-black">
                      Tuning Mode
                    </option>
                  </select>
                  <p className="text-xs text-white/60">
                    {validationMode === 'training'
                      ? 'Store images as ground truth examples'
                      : 'Validate images against existing examples'}
                  </p>
                </div>

                {/* Model Selection */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-white/90">
                    Model
                  </label>
                  <select
                    value={useGemini ? 'gemini' : 'openai'}
                    onChange={(e) => setUseGemini(e.target.value === 'gemini')}
                    className="w-full bg-white/5 border border-white/10 rounded-md px-3 py-2 text-white"
                    disabled={isProcessing}
                  >
                    <option value="openai" className="text-black">
                      OpenAI GPT-4 Vision
                    </option>
                    <option value="gemini" className="text-black">
                      Google Gemini
                    </option>
                  </select>
                  <p className="text-xs text-white/60">
                    {useGemini
                      ? 'Using Google Gemini model for image analysis'
                      : 'Using OpenAI GPT-4 Vision for image analysis'}
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
                    {validationMode === 'training'
                      ? 'Always enabled in training mode'
                      : 'Compare with similar examples'}
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
                        Images will be stored as ground truth examples in the
                        selected namespace with maximum confidence. Use this
                        mode only for validated, correct examples.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </TabsContent>
          <TabsContent value="vectors">
            <div className="p-6 bg-gradient-to-r from-blue-500/10 to-purple-500/10 rounded-lg border border-blue-500/20 shadow-lg">
              <div className="space-y-2">
                <h3 className="text-xl font-semibold text-white">
                  Vector Store Management
                </h3>
                <p className="text-sm text-white/70">
                  View and manage stored vectors.
                </p>
              </div>

              {/* Vector Store Stats */}
              {vectorStats && (
                <div className="mt-6 space-y-4">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    <div className="p-4 bg-white/5 rounded-lg">
                      <div className="text-sm text-white/70">Total Vectors</div>
                      <div className="text-2xl font-semibold text-white">
                        {vectorStats?.totalVectors || 0}
                      </div>
                    </div>
                    <div className="p-4 bg-white/5 rounded-lg">
                      <div className="text-sm text-white/70">Categories</div>
                      <div className="text-2xl font-semibold text-white">
                        {vectorStats?.categories?.length || 0}
                      </div>
                    </div>
                    <div className="p-4 bg-white/5 rounded-lg">
                      <div className="text-sm text-white/70">Last Updated</div>
                      <div className="text-2xl font-semibold text-white">
                        {vectorStats.lastUpdated
                          ? new Date(
                              vectorStats.lastUpdated
                            ).toLocaleDateString()
                          : 'Never'}
                      </div>
                    </div>
                    <div className="p-4 bg-white/5 rounded-lg">
                      <div className="text-sm text-white/70">Created</div>
                      <div className="text-2xl font-semibold text-white">
                        {vectorStats.created
                          ? new Date(vectorStats.created).toLocaleDateString()
                          : 'Unknown'}
                      </div>
                    </div>
                  </div>

                  {/* Sample Vectors */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h4 className="text-lg font-medium text-white">
                        Sample Vectors
                      </h4>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleClearVectorStore}
                        disabled={isLoadingStats}
                        className="bg-red-500/20 hover:bg-red-500/30 text-red-300 border-red-500/30"
                      >
                        Clear Vector Store
                      </Button>
                    </div>

                    <ScrollArea className="h-[400px] rounded-lg border border-white/10">
                      <div className="space-y-2 p-4">
                        {vectorStats?.sampleMetadata?.map((metadata, idx) => (
                          <div
                            key={idx}
                            className={`
                          group flex flex-col
                          rounded-lg transition-all duration-200
                          ${
                            isDeletingVector === metadata.id
                              ? 'bg-red-500/20 border-red-500/30'
                              : 'bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20'
                          }
                        `}
                          >
                            {/* Main Info Row */}
                            <div className="flex items-center justify-between p-4">
                              <div className="flex items-center space-x-4">
                                <div className="flex flex-col space-y-1">
                                  <div className="flex items-center space-x-2">
                                    <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                                    <span className="text-sm font-medium text-white/90">
                                      {metadata.category}
                                    </span>
                                    <span className="px-2 py-0.5 text-xs rounded-full bg-white/10 text-white/70">
                                      {metadata.state}
                                    </span>
                                  </div>
                                  <div className="flex items-center space-x-2 text-xs text-white/50">
                                    <span>
                                      ID: {(metadata.id || '').substring(0, 8)}
                                      ...
                                    </span>
                                    <span>•</span>
                                    <span>
                                      {new Date(
                                        metadata.createdAt
                                      ).toLocaleDateString()}
                                    </span>
                                  </div>
                                </div>
                              </div>
                              <div className="flex items-center gap-3">
                                {metadata.confidence && (
                                  <div className="flex items-center gap-2">
                                    <div className="w-20 h-1.5 bg-white/10 rounded-full overflow-hidden">
                                      <div
                                        className="h-full bg-blue-500 transition-all duration-300"
                                        style={{
                                          width: `${
                                            metadata.confidence * 100
                                          }%`,
                                        }}
                                      />
                                    </div>
                                    <span className="text-xs text-white/50">
                                      {(metadata.confidence * 100).toFixed(1)}%
                                    </span>
                                  </div>
                                )}
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() =>
                                    handleDeleteVector(metadata.id)
                                  }
                                  disabled={isDeletingVector === metadata.id}
                                  className="opacity-0 group-hover:opacity-100 transition-opacity"
                                >
                                  {isDeletingVector === metadata.id ? (
                                    <Loader2 className="h-4 w-4 animate-spin text-red-500" />
                                  ) : (
                                    <Trash2 className="h-4 w-4 text-red-500" />
                                  )}
                                </Button>
                              </div>
                            </div>

                            {/* Additional Info */}
                            <div className="px-4 pb-4 space-y-3">
                              {/* Diagnosis & Key Features */}
                              {(metadata.diagnosis || metadata.keyFeatures) && (
                                <div className="space-y-2">
                                  {metadata.diagnosis && (
                                    <p className="text-sm text-white/70">
                                      {metadata.diagnosis}
                                    </p>
                                  )}
                                  {metadata.keyFeatures &&
                                    metadata.keyFeatures.length > 0 && (
                                      <div className="flex flex-wrap gap-1">
                                        {metadata.keyFeatures.map(
                                          (feature, i) => (
                                            <span
                                              key={i}
                                              className="px-2 py-0.5 text-xs rounded-full bg-blue-500/20 text-blue-300"
                                            >
                                              {feature}
                                            </span>
                                          )
                                        )}
                                      </div>
                                    )}
                                </div>
                              )}

                              {/* Features Accordion */}
                              {metadata.features && (
                                <Accordion
                                  type="single"
                                  collapsible
                                  className="w-full"
                                >
                                  <AccordionItem
                                    value="features"
                                    className="border-white/10"
                                  >
                                    <AccordionTrigger className="text-sm text-white/70 hover:text-white/90 hover:no-underline">
                                      Features
                                    </AccordionTrigger>
                                    <AccordionContent className="px-4 pb-3">
                                      <div className="space-y-4">
                                        {/* Structural Features */}
                                        {metadata.features
                                          .structuralFeatures && (
                                          <div className="space-y-2">
                                            <h4 className="text-xs font-medium text-white/50">
                                              Structural Features
                                            </h4>
                                            <div className="grid grid-cols-2 gap-x-12 gap-y-1">
                                              {Object.entries(
                                                metadata.features
                                                  .structuralFeatures
                                              ).map(([key, value]) => (
                                                <div
                                                  key={key}
                                                  className="flex items-center justify-between py-1"
                                                >
                                                  <span className="text-sm text-white/60 capitalize">
                                                    {key}
                                                  </span>
                                                  <span className="text-sm font-medium text-white/90">
                                                    {typeof value === 'number'
                                                      ? value.toFixed(2)
                                                      : value}
                                                  </span>
                                                </div>
                                              ))}
                                            </div>
                                          </div>
                                        )}

                                        {/* Visual Features */}
                                        {metadata.features.visualFeatures && (
                                          <div className="space-y-2">
                                            <h4 className="text-xs font-medium text-white/50">
                                              Visual Features
                                            </h4>
                                            <div className="grid grid-cols-4 gap-1 max-h-32 overflow-y-auto">
                                              {metadata.features.visualFeatures.map(
                                                (value, index) => (
                                                  <div
                                                    key={index}
                                                    className="text-xs text-white/60 py-0.5"
                                                  >
                                                    {value.toFixed(4)}
                                                  </div>
                                                )
                                              )}
                                            </div>
                                          </div>
                                        )}
                                      </div>
                                    </AccordionContent>
                                  </AccordionItem>
                                </Accordion>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  </div>
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
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
          accept=".zip,image/*"
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
                  ([
                    folderPath,
                    { images, subfolders, prompt, description },
                  ]) => (
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
                      <div className="grid gap-1.5 leading-none text-white flex-grow">
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
                          {prompt && (
                            <span className="ml-2 text-blue-400">
                              (Has prompt.txt)
                            </span>
                          )}
                        </p>
                        {description && (
                          <p className="text-sm text-white/60 mt-1">
                            {description}
                          </p>
                        )}
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handlePromptEdit(folderPath)}
                        className="bg-white/5 hover:bg-white/10 text-white"
                      >
                        {prompt ? 'Edit Prompt' : 'Add Prompt'}
                      </Button>
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
                  onClick={handleExportClick}
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
                      className={`rounded-lg border ${(() => {
                        const validationState = result.isValid
                        console.log(`Result ${index} validation state:`, {
                          isValid: result.isValid,
                          confidence: result.confidence,
                          diagnosis: result.diagnosis,
                          detectedResult: result.detectedResult,
                          matchedCriteria: result.matchedCriteria,
                          failedCriteria: result.failedCriteria,
                        })
                        return validationState
                          ? 'border-green-500/20 bg-gradient-to-br from-green-500/5 to-transparent'
                          : 'border-red-500/20 bg-gradient-to-br from-red-500/5 to-transparent'
                      })()}`}
                    >
                      <AccordionTrigger className="px-4 py-2 hover:no-underline">
                        <div className="grid w-full grid-cols-[2fr,120px,2.5fr,140px] items-center gap-4">
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div className="truncate text-left font-medium">
                                  {result.filename}
                                </div>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>{result.filename}</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>

                          <div className="text-xs font-medium text-muted-foreground bg-muted/30 px-2 py-1 rounded-full w-fit">
                            {result.category}
                          </div>

                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div
                                  className={`truncate text-left text-sm ${
                                    result.isValid
                                      ? 'text-green-500'
                                      : 'text-red-500'
                                  }`}
                                >
                                  {result.detectedResult}
                                </div>
                              </TooltipTrigger>
                              <TooltipContent className="max-w-[300px]">
                                <p className="break-words">
                                  {result.detectedResult}
                                </p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>

                          <div className="flex items-center justify-end gap-2 mr-4">
                            <div className="text-muted-foreground whitespace-nowrap">
                              {typeof result.confidence === 'number'
                                ? `${(result.confidence * 100).toFixed(1)}%`
                                : 'N/A'}
                            </div>
                            {result.vectorStoreUsed &&
                              result.similarCases &&
                              result.similarCases.length > 0 && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-6 px-2 py-0 text-xs font-medium bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 rounded-full"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    setSelectedResult(result)
                                  }}
                                >
                                  {result.similarCases.length} similar
                                </Button>
                              )}
                          </div>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent>
                        <div className="px-4 py-3 space-y-6">
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
                                    <span className="text-white/70 mr-2">
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
                                        (result.isValid ? 'Pass' : 'Fail')}
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

                              {/* Image Display */}
                              <div className="bg-white/5 rounded-lg p-4 space-y-3">
                                <h3 className="text-lg font-semibold text-white">
                                  Image
                                </h3>
                                <div className="relative w-full h-[500px]">
                                  <div className="absolute inset-0 bg-white/5 animate-pulse rounded-lg" />
                                  <Image
                                    src={(() => {
                                      const imageData = folderStructure[
                                        result.path
                                      ].images.find(
                                        (img) => img.name === result.filename
                                      )?.data
                                      return imageData
                                        ? URL.createObjectURL(imageData as Blob)
                                        : '/placeholder.png'
                                    })()}
                                    alt={result.filename}
                                    fill
                                    priority
                                    className="object-contain rounded-lg"
                                    sizes="100vw"
                                    unoptimized
                                    onLoad={(e) => {
                                      if (
                                        e.currentTarget.src.startsWith('blob:')
                                      ) {
                                        URL.revokeObjectURL(e.currentTarget.src)
                                      }
                                      // Hide the loading state
                                      const loadingEl = e.currentTarget
                                        .previousSibling as HTMLElement
                                      if (loadingEl)
                                        loadingEl.style.display = 'none'
                                    }}
                                  />
                                </div>
                              </div>
                            </div>

                            <div className="space-y-4">
                              {/* Validation Results */}
                              <div className="bg-white/5 rounded-lg p-4 space-y-4">
                                <h3 className="text-lg font-semibold text-white">
                                  Validation Results
                                </h3>

                                {/* Key Observations */}
                                {result.matchedCriteria &&
                                  result.matchedCriteria.length > 0 && (
                                    <div className="space-y-2">
                                      <h4 className="text-sm font-medium text-blue-400">
                                        Observations
                                      </h4>
                                      <ul className="space-y-1">
                                        {result.matchedCriteria.map(
                                          (observation, i) => (
                                            <li
                                              key={i}
                                              className="flex items-start gap-2 text-white/70"
                                            >
                                              <span className="text-blue-400 mt-1">
                                                •
                                              </span>
                                              <span>{observation}</span>
                                            </li>
                                          )
                                        )}
                                      </ul>
                                    </div>
                                  )}

                                {/* Validation Criteria */}
                                {result.diagnosis &&
                                  ((result.diagnosis.matched_criteria &&
                                    result.diagnosis.matched_criteria.length >
                                      0) ||
                                    (result.diagnosis.failed_criteria &&
                                      result.diagnosis.failed_criteria.length >
                                        0)) && (
                                    <div className="space-y-4 mt-4">
                                      <h4 className="text-sm font-medium text-white">
                                        Validation Criteria
                                      </h4>

                                      {/* Passed Criteria */}
                                      {result.diagnosis.matched_criteria &&
                                        result.diagnosis.matched_criteria
                                          .length > 0 && (
                                          <div className="space-y-2">
                                            <h5 className="text-sm font-medium text-green-400">
                                              Passed
                                            </h5>
                                            <ul className="space-y-1">
                                              {result.diagnosis.matched_criteria.map(
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
                                      {result.diagnosis.failed_criteria &&
                                        result.diagnosis.failed_criteria
                                          .length > 0 && (
                                          <div className="space-y-2">
                                            <h5 className="text-sm font-medium text-red-400">
                                              Failed
                                            </h5>
                                            <ul className="space-y-1">
                                              {result.diagnosis.failed_criteria.map(
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
                                  )}

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

                                {/* Validation Prompt Used */}
                                {folderStructure[result.path]?.prompt && (
                                  <div className="bg-blue-500/10 rounded-lg p-4 space-y-3 border border-blue-500/20">
                                    <div className="flex items-center justify-between">
                                      <h3 className="text-lg font-semibold text-white">
                                        Validation Prompt
                                      </h3>
                                      <span className="text-xs px-2 py-1 rounded-full bg-blue-500/20 text-blue-300">
                                        Used for validation
                                      </span>
                                    </div>
                                    <p className="text-white/70 text-sm whitespace-pre-wrap font-mono">
                                      {folderStructure[result.path].prompt}
                                    </p>
                                  </div>
                                )}
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
                                              result.features.metadata
                                                .dimensions.width
                                            }{' '}
                                            x{' '}
                                            {
                                              result.features.metadata
                                                .dimensions.height
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
                                              result.features.metadata.size /
                                              1024
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
                          </div>

                          {/* Vector Store Matches */}
                          {result.vectorStoreUsed &&
                            result.similarCases &&
                            result.similarCases.length > 0 && (
                              <div className="mt-4 p-4 bg-blue-500/10 rounded-lg border border-blue-500/20">
                                <h4 className="text-sm font-medium text-blue-400 mb-2">
                                  Vector Store Matches
                                </h4>
                                <div className="space-y-2">
                                  {result.similarCases.map(
                                    (similarCase, index) => (
                                      <div
                                        key={index}
                                        className="flex items-center justify-between text-sm"
                                      >
                                        <span className="text-white/70">
                                          {similarCase.category} (
                                          {similarCase.state})
                                        </span>
                                        <span className="text-blue-400">
                                          {(
                                            similarCase.confidence * 100
                                          ).toFixed(1)}
                                          % match
                                        </span>
                                      </div>
                                    )
                                  )}
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

      <Dialog
        open={isPromptDialogOpen}
        onOpenChange={(open) => {
          if (!open && foldersNeedingPrompts.length > 0) {
            // Prevent closing if we still have folders needing prompts
            return
          }
          setIsPromptDialogOpen(open)
          if (!open) {
            setCurrentEditingFolder(null)
            setFoldersNeedingPrompts([])
          }
        }}
      >
        <DialogContent className="sm:max-w-[800px] bg-gray-900/95 border border-white/10 text-white">
          <DialogHeader>
            <DialogTitle className="text-white">
              {foldersNeedingPrompts.length > 0
                ? `Folder Requires Prompt (${foldersNeedingPrompts.length} remaining)`
                : folderStructure[currentEditingFolder || '']?.prompt
                ? 'Edit Folder Settings'
                : 'Add Folder Settings'}
            </DialogTitle>
            <DialogDescription className="text-white/70">
              {foldersNeedingPrompts.length > 0
                ? `Please provide validation settings for folder: ${currentEditingFolder}`
                : currentEditingFolder
                ? `Edit the validation settings for folder: ${currentEditingFolder}`
                : 'Add validation settings for this folder'}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="description" className="text-white/90">
                Folder Description
              </Label>
              <textarea
                id="description"
                value={
                  folderStructure[currentEditingFolder || '']?.description || ''
                }
                onChange={(e) => {
                  if (currentEditingFolder) {
                    setFolderStructure((prev) => ({
                      ...prev,
                      [currentEditingFolder]: {
                        ...prev[currentEditingFolder],
                        description: e.target.value,
                      },
                    }))
                  }
                }}
                className="min-h-[100px] w-full bg-white/5 border border-white/10 rounded-md px-3 py-2 text-white placeholder:text-white/40"
                placeholder="Describe what images this folder contains (e.g., 'This folder contains straight connector plates of type X manufactured by Y...')"
              />
            </div>
            <div className="grid gap-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="prompt" className="text-white/90">
                  Validation Prompt
                </Label>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleSuggestPrompt}
                  disabled={
                    !currentEditingFolder ||
                    !folderStructure[currentEditingFolder]?.description ||
                    isSuggestingPrompt
                  }
                  className="bg-white/5 hover:bg-white/10 text-white"
                >
                  {isSuggestingPrompt ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Suggesting...
                    </>
                  ) : (
                    'Suggest Prompt'
                  )}
                </Button>
              </div>
              <textarea
                id="prompt"
                value={
                  folderStructure[currentEditingFolder || '']?.prompt || ''
                }
                onChange={(e) => {
                  if (currentEditingFolder) {
                    setFolderStructure((prev) => ({
                      ...prev,
                      [currentEditingFolder]: {
                        ...prev[currentEditingFolder],
                        prompt: e.target.value,
                      },
                    }))
                  }
                }}
                className="min-h-[150px] w-full bg-white/5 border border-white/10 rounded-md px-3 py-2 text-white placeholder:text-white/40"
                placeholder="Enter your validation prompt here (e.g., 'Are the connector plates straight? Check for any bends or deformations...')"
              />
            </div>

            {/* Suggested Prompts Section */}
            {currentEditingFolder &&
              (folderStructure?.[currentEditingFolder]?.suggestedPrompts ?? [])
                .length > 0 && (
                <div className="mt-4">
                  <Label className="text-white/90 mb-2">
                    Suggested Prompts
                  </Label>
                  <ScrollArea className="h-[200px] w-full rounded-md border border-white/10">
                    <div className="p-4 space-y-2">
                      {(
                        folderStructure?.[currentEditingFolder]
                          ?.suggestedPrompts ?? []
                      ).map((prompt, index) => (
                        <div
                          key={index}
                          className={`p-3 rounded-lg cursor-pointer transition-colors ${
                            prompt.selected
                              ? 'bg-blue-500/20 border border-blue-500/40'
                              : 'bg-white/5 border border-white/10 hover:bg-white/10'
                          }`}
                          onClick={() =>
                            handlePromptSelect(currentEditingFolder, index)
                          }
                        >
                          <div className="flex items-start gap-2">
                            <div
                              className={`mt-1 p-0.5 rounded-full ${
                                prompt.selected ? 'bg-blue-500' : 'bg-white/20'
                              }`}
                            >
                              <Check className="w-3 h-3" />
                            </div>
                            <div className="flex-1">
                              <p className="text-sm text-white/90">
                                {prompt.text}
                              </p>
                              <div className="flex items-center gap-2 mt-2">
                                <span className="text-xs text-white/60">
                                  Confidence:{' '}
                                  {((prompt.confidence ?? 0.5) * 100).toFixed(
                                    1
                                  )}
                                  %
                                </span>
                                {prompt.category && (
                                  <span className="text-xs px-2 py-1 rounded-full bg-white/10 text-white/60">
                                    {prompt.category}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </div>
              )}
          </div>
          <DialogFooter>
            <Button
              onClick={handlePromptConfirm}
              className="bg-blue-500/80 hover:bg-blue-500/90 text-white"
            >
              {foldersNeedingPrompts.length > 0
                ? foldersNeedingPrompts.length === 1
                  ? 'Confirm & Start Validation'
                  : 'Next Folder'
                : 'Confirm'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isExportDialogOpen} onOpenChange={setIsExportDialogOpen}>
        <DialogContent className="sm:max-w-[425px] bg-gray-900/95 border border-white/10 text-white">
          <DialogHeader>
            <DialogTitle className="text-white">
              Export Validation Report
            </DialogTitle>
            <DialogDescription className="text-white/70">
              Enter a name for your validation report Excel file.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="filename" className="text-right text-white/90">
                Filename
              </Label>
              <Input
                id="filename"
                value={exportFileName}
                onChange={(e) => setExportFileName(e.target.value)}
                className="col-span-3 bg-white/5 border-white/10 text-white placeholder:text-white/40"
                placeholder="validation-results"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              type="submit"
              onClick={handleExportConfirm}
              className="bg-green-600/80 hover:bg-green-600/90 text-white"
            >
              Export Report
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Clear Vector Store Confirmation Dialog */}
      <Dialog open={isClearConfirmOpen} onOpenChange={setIsClearConfirmOpen}>
        <DialogContent className="sm:max-w-[425px] bg-gray-900/95 border border-white/10 text-white">
          <DialogHeader>
            <DialogTitle className="text-white">Clear Vector Store</DialogTitle>
            <DialogDescription className="text-white/70">
              This action will permanently delete all stored vectors. This
              cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <div className="rounded-lg bg-red-500/10 border border-red-500/20 p-4">
              <p className="text-sm text-red-300">
                Are you sure you want to clear all vectors from the store?
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsClearConfirmOpen(false)}
              className="bg-white/5 hover:bg-white/10 text-white"
            >
              Cancel
            </Button>
            <Button
              onClick={handleClearVectorStore}
              disabled={isClearingVectorStore}
              className="bg-red-500/80 hover:bg-red-500/90 text-white"
            >
              {isClearingVectorStore ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Clearing...
                </>
              ) : (
                'Yes, Clear All'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={isImageCategoryDialogOpen}
        onOpenChange={setIsImageCategoryDialogOpen}
      >
        <DialogContent className="sm:max-w-[425px] bg-gray-900/95 border border-white/10 text-white">
          <DialogHeader>
            <DialogTitle className="text-white">Image Category</DialogTitle>
            <DialogDescription className="text-white/70">
              Select the category and state for this image.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="category" className="text-right text-white/90">
                Category
              </Label>
              <select
                id="category"
                value={selectedCategory}
                onChange={(e) => {
                  const newCategory = e.target.value
                  setSelectedCategory(newCategory)
                  const states = getStatesForCategory(newCategory)
                  if (states.length > 0) {
                    setSelectedState(states[0])
                  }
                }}
                className="col-span-3 bg-white/5 border-white/10 text-white rounded-md p-2"
              >
                {vectorStats?.categories?.map((category) => (
                  <option key={category} value={category}>
                    {formatDisplayName(category)}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="state" className="text-right text-white/90">
                State
              </Label>
              <select
                id="state"
                value={selectedState}
                onChange={(e) => setSelectedState(e.target.value)}
                className="col-span-3 bg-white/5 border-white/10 text-white rounded-md p-2"
              >
                {getStatesForCategory(selectedCategory).map((state) => (
                  <option key={state} value={state}>
                    {formatDisplayName(state)}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <DialogFooter>
            <Button
              onClick={handleImageCategoryConfirm}
              className="bg-blue-500/80 hover:bg-blue-500/90 text-white"
            >
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
