import { z } from 'zod'

// Basic types for validation
export type Category = string
export type State = string

export interface ImageFeatures {
  visualFeatures: number[]
  structuralFeatures: {
    edges: number
    contrast: number
    brightness: number
    sharpness: number
  }
  metadata: {
    dimensions: { width: number; height: number }
    format: string
    size: number
  }
}

export interface SimilarCase {
  imageUrl: string
  category: Category
  state: State
  features: ImageFeatures
  diagnosis: string
  confidence: number
  keyFeatures: string[]
}

export interface ValidationResult {
  isValid: boolean
  confidence: number
  diagnosis: {
    overall_assessment: string
    confidence_level: number
    key_observations: string[]
    matched_criteria: string[]
    failed_criteria: string[]
    detailed_explanation: string
  }
  matchedCriteria: string[]
  failedCriteria: string[]
  similarCases: SimilarCase[]
  explanation: string
  features: ImageFeatures
  modelUsed?: string
}

export interface ValidationResponse {
  result: string
  category: string
  expectedState: string
  confidence?: number
  matchedCriteria: string[]
  failedCriteria: string[]
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
  }
  diagnosis?:
    | {
        overall_assessment: string
        confidence_level: number
        key_observations: string[]
        matched_criteria: string[]
        failed_criteria: string[]
        detailed_explanation: string
      }
    | string
  explanation?: string
  similarCases?: Array<{
    imageUrl: string
    category: string
    state: string
    confidence: number
    keyFeatures: string[]
    diagnosis?:
      | {
          overall_assessment: string
          confidence_level: number
          key_observations: string[]
          matched_criteria: string[]
          failed_criteria: string[]
          detailed_explanation: string
        }
      | string
  }>
  mode?: 'training' | 'validation'
  vectorStoreUsed?: boolean
  measurement?: string
}
