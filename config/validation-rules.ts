export interface ValidationRule {
  name: string
  description: string
  expectedStates: string[]
  criteria: {
    visual: {
      features: Array<{
        name: string
        description: string
        threshold: number
        tolerance: number
        failureMode: string
      }>
      patterns: Array<{
        name: string
        description: string
        goodExamples: string[]
        badExamples: string[]
      }>
    }
    measurements: Array<{
      name: string
      type: string
      unit: string
      threshold: number
      tolerance: number
      criticalPoints: string[]
    }>
    contextual: {
      requiredElements: string[]
      forbiddenElements: string[]
      relationships: Array<{
        description: string
        elements: string[]
        condition: string
      }>
    }
  }
  guidelines: {
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
}

export const validationRules: Record<string, ValidationRule> = {
  corrosion: {
    name: 'Corrosion Detection',
    description:
      'Validates surface condition for signs of corrosion or oxidation',
    expectedStates: ['clean', 'corroded', 'treated'],
    criteria: {
      visual: {
        features: [
          {
            name: 'surface_uniformity',
            description: 'Measures the consistency of surface coloration',
            threshold: 0.85,
            tolerance: 0.05,
            failureMode: 'Uneven coloration indicating potential corrosion',
          },
          {
            name: 'texture_roughness',
            description: 'Analyzes surface texture for pitting or scaling',
            threshold: 0.3,
            tolerance: 0.1,
            failureMode: 'Surface irregularities suggesting corrosion damage',
          },
        ],
        patterns: [
          {
            name: 'rust_pattern',
            description: 'Identifies characteristic rust patterns',
            goodExamples: [
              'Uniform metallic surface',
              'Even protective coating',
            ],
            badExamples: ['Brown spotting', 'Surface scaling'],
          },
        ],
      },
      measurements: [
        {
          name: 'surface_roughness',
          type: 'continuous',
          unit: 'μm',
          threshold: 0.5,
          tolerance: 0.1,
          criticalPoints: ['Edge zones', 'Joint areas', 'Surface depressions'],
        },
      ],
      contextual: {
        requiredElements: ['Base metal visibility', 'Surface accessibility'],
        forbiddenElements: ['Active rust formation', 'Flaking material'],
        relationships: [
          {
            description: 'Surface-coating integrity',
            elements: ['base_metal', 'protective_coating'],
            condition: 'continuous_coverage',
          },
        ],
      },
    },
    guidelines: {
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
  },
  cable_diameter: {
    name: 'Cable Diameter Validation',
    description: 'Validates cable diameter meets minimum 3/8-inch requirement',
    expectedStates: ['compliant', 'non_compliant'],
    criteria: {
      visual: {
        features: [
          {
            name: 'diameter_measurement',
            description: 'Measures the cable diameter',
            threshold: 0.375,
            tolerance: 0.015,
            failureMode: 'Cable diameter below minimum requirement',
          },
          {
            name: 'wear_detection',
            description: 'Analyzes surface for wear or damage',
            threshold: 0.8,
            tolerance: 0.1,
            failureMode: 'Cable shows signs of wear affecting diameter',
          },
        ],
        patterns: [
          {
            name: 'diameter_consistency',
            description: 'Checks for consistent diameter along cable length',
            goodExamples: ['Uniform diameter', 'No visible wear'],
            badExamples: ['Irregular diameter', 'Visible wear points'],
          },
        ],
      },
      measurements: [
        {
          name: 'cable_diameter',
          type: 'continuous',
          unit: 'inches',
          threshold: 0.375,
          tolerance: 0.015,
          criticalPoints: [
            'Multiple points along cable',
            'Wear points',
            'Stress points',
          ],
        },
      ],
      contextual: {
        requiredElements: ['Cable visibility', 'Measurement reference'],
        forbiddenElements: ['Severe wear', 'Cable damage'],
        relationships: [
          {
            description: 'Diameter consistency',
            elements: ['cable_surface', 'measurement_points'],
            condition: 'uniform_measurement',
          },
        ],
      },
    },
    guidelines: {
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
  },
}

export function getValidationRule(category: string): ValidationRule {
  const rule = validationRules[category]
  if (!rule) {
    throw new Error(`No validation rule found for category: ${category}`)
  }
  return rule
}

export function addValidationRule(
  category: string,
  rule: ValidationRule
): void {
  const validation = validateRuleStructure(rule)
  if (!validation.valid) {
    throw new Error(
      `Invalid validation rule structure:\n${validation.errors.join('\n')}`
    )
  }
  validationRules[category] = rule
}

export function validateRuleStructure(rule: ValidationRule): {
  valid: boolean
  errors: string[]
} {
  const errors: string[] = []

  const requiredFields = [
    'name',
    'description',
    'expectedStates',
    'criteria',
    'guidelines',
  ]
  requiredFields.forEach((field) => {
    if (!rule[field as keyof ValidationRule]) {
      errors.push(`Missing required field: ${field}`)
    }
  })

  if (rule.criteria) {
    if (!rule.criteria.visual?.features?.length) {
      errors.push('Criteria must include at least one visual feature')
    }
    rule.criteria.visual?.features?.forEach((feature, index) => {
      if (
        !feature.name ||
        !feature.description ||
        feature.threshold === undefined ||
        feature.tolerance === undefined
      ) {
        errors.push(
          `Invalid visual feature at index ${index}: missing required properties`
        )
      }
    })

    if (!rule.criteria.measurements?.length) {
      errors.push('Criteria must include at least one measurement')
    }
    rule.criteria.measurements?.forEach((measurement, index) => {
      if (
        !measurement.name ||
        !measurement.type ||
        !measurement.unit ||
        measurement.threshold === undefined ||
        measurement.tolerance === undefined
      ) {
        errors.push(
          `Invalid measurement at index ${index}: missing required properties`
        )
      }
    })

    if (!rule.criteria.contextual?.requiredElements?.length) {
      errors.push('Criteria must include at least one required element')
    }
    if (!rule.criteria.contextual?.relationships?.length) {
      errors.push('Criteria must include at least one relationship')
    }
  }

  if (rule.guidelines) {
    if (!rule.guidelines.goodExamples?.length) {
      errors.push('Guidelines must include at least one good example')
    }
    if (!rule.guidelines.badExamples?.length) {
      errors.push('Guidelines must include at least one bad example')
    }
    if (!rule.guidelines.criticalPoints?.length) {
      errors.push('Guidelines must include at least one critical point')
    }
    if (!rule.guidelines.rules?.criticalFeatures?.length) {
      errors.push('Guidelines must include at least one critical feature')
    }
    if (!rule.guidelines.rules?.failureModes?.length) {
      errors.push('Guidelines must include at least one failure mode')
    }
    if (!rule.guidelines.rules?.measurements?.length) {
      errors.push('Guidelines must include at least one measurement rule')
    }
  }

  rule.criteria?.visual?.features?.forEach((feature, index) => {
    if (feature.threshold < 0 || feature.threshold > 1) {
      errors.push(`Visual feature ${index} threshold must be between 0 and 1`)
    }
    if (feature.tolerance < 0 || feature.tolerance > 0.5) {
      errors.push(`Visual feature ${index} tolerance must be between 0 and 0.5`)
    }
  })

  rule.guidelines?.rules?.measurements?.forEach((measurement, index) => {
    if (measurement.tolerance < 0) {
      errors.push(`Measurement rule ${index} tolerance cannot be negative`)
    }
    if (measurement.tolerance > measurement.threshold / 2) {
      errors.push(
        `Measurement rule ${index} tolerance should not exceed half the threshold`
      )
    }
  })

  return {
    valid: errors.length === 0,
    errors,
  }
}
