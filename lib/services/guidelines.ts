import { Category } from '@/types/validation'
import {
  getValidationRule,
  ValidationRule,
  validateRuleStructure,
} from '@/config/validation-rules'

export interface Guidelines {
  goodExamples: string[]
  badExamples: string[]
  criticalPoints: string[]
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

const categoryGuidelines: Record<Category, Guidelines> = {
  corrosion: {
    goodExamples: [
      'Clean metal surface with no discoloration',
      'Uniform color throughout',
      'No visible pitting or scaling',
    ],
    badExamples: [
      'Red or brown rust spots',
      'Surface pitting',
      'Flaking or bubbling paint',
      'Visible oxidation',
    ],
    criticalPoints: [
      'Check for any color changes indicating oxidation',
      'Look for surface texture changes',
      'Examine edges and corners where corrosion often starts',
      'Verify surface integrity',
    ],
    rules: {
      criticalFeatures: [
        'Surface color uniformity',
        'Metal integrity',
        'Absence of rust',
        'Paint or coating condition',
      ],
      failureModes: [
        'Surface rust',
        'Pitting corrosion',
        'Galvanic corrosion',
        'Under-paint corrosion',
      ],
      measurements: [
        {
          type: 'surface_roughness',
          threshold: 0.5,
          tolerance: 0.1,
        },
      ],
    },
  },
  threads: {
    goodExamples: [
      'Clear thread pattern',
      'No visible damage',
      'Clean threads',
      'Proper thread engagement',
    ],
    badExamples: [
      'Stripped threads',
      'Cross-threading',
      'Damaged thread peaks',
      'Excessive wear',
    ],
    criticalPoints: [
      'Check thread pattern clarity',
      'Verify thread pitch',
      'Look for damage or wear',
      'Examine thread engagement',
    ],
    rules: {
      criticalFeatures: [
        'Thread pattern visibility',
        'Thread continuity',
        'Thread peak condition',
        'Thread cleanliness',
      ],
      failureModes: [
        'Thread stripping',
        'Cross-threading',
        'Thread wear',
        'Thread damage',
      ],
      measurements: [
        {
          type: 'thread_depth',
          threshold: 0.8,
          tolerance: 0.1,
        },
      ],
    },
  },
  connector_plates: {
    goodExamples: [
      'Flat surface',
      'Proper alignment',
      'No visible bending',
      'Secure connection',
    ],
    badExamples: [
      'Visible warping',
      'Misalignment',
      'Bent edges',
      'Loose connections',
    ],
    criticalPoints: [
      'Check plate flatness',
      'Verify alignment',
      'Examine edge condition',
      'Inspect connection points',
    ],
    rules: {
      criticalFeatures: [
        'Surface flatness',
        'Edge straightness',
        'Connection security',
        'Overall alignment',
      ],
      failureModes: [
        'Plate bending',
        'Misalignment',
        'Connection failure',
        'Edge damage',
      ],
      measurements: [
        {
          type: 'flatness',
          threshold: 0.2,
          tolerance: 0.05,
        },
      ],
    },
  },
  cotter_pins: {
    goodExamples: [
      'Properly inserted pin',
      'Correct spreading',
      'Appropriate size',
      'Secure installation',
    ],
    badExamples: [
      'Missing pin',
      'Insufficient spreading',
      'Wrong size',
      'Loose installation',
    ],
    criticalPoints: [
      'Verify pin presence',
      'Check spreading angle',
      'Confirm size appropriateness',
      'Inspect installation security',
    ],
    rules: {
      criticalFeatures: [
        'Pin presence',
        'Proper spreading',
        'Size match',
        'Installation security',
      ],
      failureModes: [
        'Missing pin',
        'Inadequate spreading',
        'Size mismatch',
        'Loose fitting',
      ],
      measurements: [
        {
          type: 'spread_angle',
          threshold: 30,
          tolerance: 5,
        },
      ],
    },
  },
  spacer_plates: {
    goodExamples: [
      'Correct spacing',
      'Proper alignment',
      'Secure installation',
      'Even gaps',
    ],
    badExamples: [
      'Incorrect spacing',
      'Misalignment',
      'Loose installation',
      'Uneven gaps',
    ],
    criticalPoints: [
      'Measure spacing',
      'Check alignment',
      'Verify installation',
      'Inspect gap uniformity',
    ],
    rules: {
      criticalFeatures: [
        'Spacing accuracy',
        'Alignment precision',
        'Installation security',
        'Gap uniformity',
      ],
      failureModes: [
        'Spacing error',
        'Misalignment',
        'Loose fitting',
        'Gap variation',
      ],
      measurements: [
        {
          type: 'spacing',
          threshold: 1.0,
          tolerance: 0.1,
        },
      ],
    },
  },
  postitive_connection: {
    goodExamples: [
      'All bolts present',
      'Proper engagement',
      'Correct orientation',
      'Secure installation',
    ],
    badExamples: [
      'Missing bolts',
      'Poor engagement',
      'Wrong orientation',
      'Loose installation',
    ],
    criticalPoints: [
      'Count bolts',
      'Check engagement',
      'Verify orientation',
      'Test security',
    ],
    rules: {
      criticalFeatures: [
        'Bolt presence',
        'Thread engagement',
        'Orientation correctness',
        'Installation security',
      ],
      failureModes: [
        'Missing bolts',
        'Poor engagement',
        'Wrong orientation',
        'Looseness',
      ],
      measurements: [
        {
          type: 'torque',
          threshold: 50,
          tolerance: 5,
        },
      ],
    },
  },
  cable_diameter: {
    goodExamples: [
      'Meets 3/8-inch requirement',
      'Consistent diameter',
      'No wear points',
      'Good condition',
    ],
    badExamples: [
      'Under 3/8-inch',
      'Irregular diameter',
      'Visible wear',
      'Poor condition',
    ],
    criticalPoints: [
      'Measure diameter',
      'Check consistency',
      'Look for wear',
      'Assess condition',
    ],
    rules: {
      criticalFeatures: [
        'Diameter size',
        'Diameter consistency',
        'Surface condition',
        'Overall integrity',
      ],
      failureModes: [
        'Undersized diameter',
        'Irregular diameter',
        'Wear damage',
        'Material degradation',
      ],
      measurements: [
        {
          type: 'diameter',
          threshold: 0.375,
          tolerance: 0.015,
        },
      ],
    },
  },
}

export async function getCategoryGuidelines(
  category: Category
): Promise<Guidelines> {
  const rule = getValidationRule(category)
  return rule.guidelines
}

export async function getValidationCriteria(category: Category) {
  const rule = getValidationRule(category)
  return {
    visual: rule.criteria.visual,
    measurements: rule.criteria.measurements,
    contextual: rule.criteria.contextual,
  }
}

export async function getExpectedStates(category: Category): Promise<string[]> {
  const rule = getValidationRule(category)
  return rule.expectedStates
}

export async function validateCategory(category: string): Promise<boolean> {
  try {
    const rule = getValidationRule(category)
    const validation = validateRuleStructure(rule)
    return validation.valid
  } catch {
    return false
  }
}
