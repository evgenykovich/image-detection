import { z } from 'zod'
import { validationRules } from '@/config/validation-rules'

// Create a union type from the validation rules keys
export type Category = keyof typeof validationRules

// Create a union type of all possible states from validation rules
export type State = string

export interface ValidationCriteria {
  feature: string
  description: string
  importance: 'critical' | 'major' | 'minor'
  checkpoints: string[]
}

export interface ReferenceImage {
  url: string
  state: State
  annotations: string[]
}

export interface ValidationConfig {
  category: Category
  expectedState: State
  criteria: ValidationCriteria[]
  referenceImages: ReferenceImage[]
}

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

export interface ValidationContext {
  features: ImageFeatures
  similarCases: SimilarCase[]
  categoryGuidelines: {
    goodExamples: string[]
    badExamples: string[]
    criticalPoints: string[]
  }
  rules: {
    criticalFeatures: string[]
    failureModes: string[]
    measurements: Array<{
      type: string
      threshold: number
      tolerance: number
    }>
  }
}

export interface ValidationResult {
  isValid: boolean
  confidence: number
  diagnosis: string
  matchedCriteria: string[]
  failedCriteria: string[]
  similarCases: SimilarCase[]
  explanation: string
  features: ImageFeatures
}

export interface ValidationResponse {
  result: string
  category: string
  expectedState: string
  confidence?: number
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
}
