import { z } from 'zod'

// Basic types for validation
export type Category =
  | 'corrosion'
  | 'threads'
  | 'connector_plates'
  | 'cotter_pins'
  | 'spacer_plates'
  | 'positive_connection'
  | 'cable_diameter'

export type State = string
export type ValidationImportance = 'critical' | 'high' | 'medium' | 'low'
export type ValidationType = 'measurement' | 'visual' | 'safety' | 'compliance'

export interface ImageFeatures {
  visualFeatures: number[]
  semanticFeatures?: string
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
  category: string
  state: string
  confidence: number
  similarity: number
  keyFeatures: string[]
  diagnosis?: ValidationDiagnosis
  metadata?: {
    prompt?: string
    [key: string]: any
  }
}

export interface ValidationDiagnosis {
  overall_assessment: string
  confidence_level: number
  key_observations: string[]
  matched_criteria: string[]
  failed_criteria: string[]
  detailed_explanation: string
  [key: string]: string | number | string[]
}

export interface PhysicalState {
  matches_expected: boolean
  has_defects: boolean
  condition_details: string[]
}

export interface Measurements {
  meets_requirements: boolean
  measurement_details: string[]
}

export interface Characteristics {
  physical_state?: PhysicalState
}

export interface ValidationResult {
  is_valid: boolean
  confidence: number
  diagnosis: ValidationDiagnosis
  matched_criteria: string[]
  failed_criteria: string[]
  similarCases: SimilarCase[]
  explanation: string
  features: ImageFeatures | null
  modelUsed: string
  characteristics?: Characteristics
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

export interface ModelResponse {
  is_valid: boolean
  confidence: number
  diagnosis: ValidationDiagnosis
  explanation: string
  characteristics: Characteristics
  matched_criteria?: string[]
  failed_criteria?: string[]
}
