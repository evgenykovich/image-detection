import { Category } from '@/types/validation'

export interface ValidationPoint {
  description: string
  importance: 'critical' | 'high' | 'medium' | 'low'
  type: 'measurement' | 'visual' | 'safety' | 'compliance'
}

export interface CategoryTemplate {
  name: string
  description: string
  validationPoints: ValidationPoint[]
  industryStandards?: string[]
  safetyConsiderations?: string[]
  measurementRequirements?: {
    type: string
    unit: string
    tolerance?: string
  }[]
}

export const baseValidationTemplate = `You are an expert in industrial component validation and quality assurance.
Your task is to generate a detailed validation prompt based on:
1. The folder description provided
2. The sample image shown
3. The component category and expected state
4. Industry standards and safety requirements

The prompt should:
- Be specific and focused on key validation criteria
- Include measurable or observable characteristics
- Reference industry standards where applicable
- Consider safety-critical aspects
- Be clear and unambiguous
- Focus on visual inspection points
- Include specific measurements or tolerances if relevant

Format the prompt as a clear set of validation instructions.`

// This can be loaded from a database or external configuration
export const categoryTemplates: Record<Category, CategoryTemplate> = {
  corrosion: {
    name: 'Corrosion',
    description: 'Assessment of surface corrosion and material degradation',
    validationPoints: [
      {
        description: 'Surface condition assessment',
        importance: 'critical',
        type: 'visual',
      },
      {
        description: 'Extent and type of corrosion',
        importance: 'high',
        type: 'visual',
      },
      {
        description: 'Impact on structural integrity',
        importance: 'critical',
        type: 'safety',
      },
      {
        description: 'Comparison with acceptable limits',
        importance: 'high',
        type: 'compliance',
      },
      {
        description: 'Environmental exposure indicators',
        importance: 'medium',
        type: 'visual',
      },
    ],
    industryStandards: [
      'ASTM B117 - Salt Spray Testing',
      'ISO 9223 - Corrosion of Metals',
    ],
    safetyConsiderations: [
      'Structural integrity impact',
      'Load-bearing capacity',
    ],
  },
  threads: {
    name: 'Threads',
    description: 'Inspection of threaded components and connections',
    validationPoints: [
      {
        description: 'Thread pattern and pitch verification',
        importance: 'critical',
        type: 'measurement',
      },
      {
        description: 'Thread engagement length',
        importance: 'high',
        type: 'measurement',
      },
      {
        description: 'Cross-threading assessment',
        importance: 'critical',
        type: 'visual',
      },
      {
        description: 'Thread wear and damage',
        importance: 'high',
        type: 'visual',
      },
      {
        description: 'Thread cleanliness',
        importance: 'medium',
        type: 'visual',
      },
    ],
    measurementRequirements: [
      {
        type: 'Thread pitch',
        unit: 'mm',
        tolerance: '±0.1mm',
      },
      {
        type: 'Engagement length',
        unit: 'mm',
        tolerance: '±0.5mm',
      },
    ],
  },
  connector_plates: {
    name: 'Connector Plates',
    description: 'Validation of connector plate condition and installation',
    validationPoints: [
      {
        description: 'Plate alignment and orientation',
        importance: 'critical',
        type: 'visual',
      },
      {
        description: 'Surface deformation assessment',
        importance: 'critical',
        type: 'visual',
      },
      {
        description: 'Connection point integrity',
        importance: 'high',
        type: 'safety',
      },
      {
        description: 'Load-bearing capacity indicators',
        importance: 'critical',
        type: 'safety',
      },
      {
        description: 'Installation compliance',
        importance: 'high',
        type: 'compliance',
      },
    ],
  },
  cotter_pins: {
    name: 'Cotter Pins',
    description: 'Inspection of cotter pin installation and security',
    validationPoints: [
      {
        description: 'Pin insertion depth',
        importance: 'critical',
        type: 'measurement',
      },
      {
        description: 'Pin leg spread angle',
        importance: 'high',
        type: 'visual',
      },
      {
        description: 'Retention security',
        importance: 'critical',
        type: 'safety',
      },
      {
        description: 'Size appropriateness',
        importance: 'high',
        type: 'compliance',
      },
      {
        description: 'Installation orientation',
        importance: 'high',
        type: 'visual',
      },
    ],
  },
  spacer_plates: {
    name: 'Spacer Plates',
    description: 'Validation of spacer plate positioning and condition',
    validationPoints: [
      {
        description: 'Spacing measurement',
        importance: 'critical',
        type: 'measurement',
      },
      {
        description: 'Plate positioning',
        importance: 'high',
        type: 'visual',
      },
      {
        description: 'Gap consistency',
        importance: 'high',
        type: 'measurement',
      },
      {
        description: 'Surface contact',
        importance: 'medium',
        type: 'visual',
      },
      {
        description: 'Load distribution',
        importance: 'high',
        type: 'safety',
      },
    ],
    measurementRequirements: [
      {
        type: 'Gap width',
        unit: 'mm',
        tolerance: '±0.2mm',
      },
    ],
  },
  positive_connection: {
    name: 'Positive Connection',
    description: 'Assessment of connection security and integrity',
    validationPoints: [
      {
        description: 'Connection security',
        importance: 'critical',
        type: 'safety',
      },
      {
        description: 'Component engagement',
        importance: 'critical',
        type: 'visual',
      },
      {
        description: 'Load transfer assessment',
        importance: 'high',
        type: 'safety',
      },
      {
        description: 'Movement indicators',
        importance: 'high',
        type: 'visual',
      },
      {
        description: 'Assembly compliance',
        importance: 'high',
        type: 'compliance',
      },
    ],
  },
  cable_diameter: {
    name: 'Cable Diameter',
    description: 'Measurement and assessment of cable diameter',
    validationPoints: [
      {
        description: 'Precise diameter measurement',
        importance: 'critical',
        type: 'measurement',
      },
      {
        description: 'Diameter consistency',
        importance: 'high',
        type: 'measurement',
      },
      {
        description: 'Wear pattern assessment',
        importance: 'high',
        type: 'visual',
      },
      {
        description: 'Minimum diameter compliance',
        importance: 'critical',
        type: 'compliance',
      },
      {
        description: 'Cross-section analysis',
        importance: 'medium',
        type: 'visual',
      },
    ],
    measurementRequirements: [
      {
        type: 'Cable diameter',
        unit: 'mm',
        tolerance: '±0.1mm',
      },
    ],
  },
}
