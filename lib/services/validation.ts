import { ChatOpenAI } from 'langchain/chat_models/openai'
import { HumanMessage } from 'langchain/schema'
import { ValidationResult, Category, State } from '@/types/validation'
import { extractImageFeatures } from './featureExtraction'
import { findSimilarCases, storeValidationCase } from './vectorStorage'

const model = new ChatOpenAI({
  modelName: 'gpt-4o-mini',
  temperature: 0,
})

interface ValidationOptions {
  useVectorStore: boolean
  isGroundTruth?: boolean
  storeResults?: boolean
  measurement?: string
  prompt?: string
}

function buildSimplePrompt(
  category: Category,
  expectedState: State,
  measurement?: string
): string {
  // Base criteria for each category
  const baseCriteria: { [key: string]: string[] } = {
    threads: [
      'Threads should be clearly visible',
      'Thread pattern should be consistent',
      'No visible damage to threads',
    ],
    corrosion:
      expectedState.toLowerCase() === 'corroded'
        ? [
            'Surface should show signs of rust or discoloration',
            'Visible surface degradation or pitting',
            'Material deterioration should be evident',
          ]
        : [
            'Surface should be free of rust',
            'No visible discoloration',
            'No surface degradation',
          ],
    connector_plates: [
      'The main body of the plate should maintain a consistent vertical or horizontal orientation',
      'The mounting surfaces should be level and parallel',
      'The plate should sit flush with its mounting points',
      'No twisting or rotation around the mounting axis',
      'Edges should maintain consistent spacing relative to adjacent components',
      'Note: Perspective and lighting can create illusions of bending - focus on actual physical alignment',
    ],
    cotter_pin: [
      'Pin should be properly inserted',
      'Pin ends should be bent correctly',
      'No missing or loose pins',
    ],
    spacer: [
      'Spacer should be present',
      'Proper spacing maintained',
      'No compression or damage',
    ],
    connection: [
      'All components properly connected',
      'No loose connections',
      'Proper alignment of parts',
    ],
    cable: measurement
      ? [
          `Cable diameter should meet ${measurement} inch minimum`,
          'No visible wear or damage',
          'Consistent diameter throughout',
        ]
      : [
          'Cable should meet minimum diameter',
          'No visible wear or damage',
          'Consistent diameter throughout',
        ],
  }

  // Get base criteria for this category
  const criteria = baseCriteria[category] || []

  // Convert folder names to natural language questions
  const stateQuestions: { [key: string]: string } = {
    // Threads
    'no threads visible': 'Are the threads NOT visible in this image?',
    'threads visible': 'Are the threads clearly visible in this image?',
    'threads present': 'Are threads present in this image?',
    'threads missing': 'Are threads missing from this image?',
    missing: 'Is the component missing from this image?',
    visible: 'Is the component clearly visible in this image?',

    // Corrosion
    clean: 'Is this surface clean without any corrosion?',
    corroded: 'Is there visible corrosion on this surface?',

    // Cable Diameter - now using dynamic measurement
    compliant: measurement
      ? `Does this cable appear to meet the ${measurement} inch minimum diameter requirement?`
      : 'Does this cable appear to meet the minimum diameter requirement?',
    non_compliant: measurement
      ? `Does this cable appear to be below the ${measurement} inch minimum diameter requirement?`
      : 'Does this cable appear to be below the minimum diameter requirement?',

    // Connector Plates
    bent: 'Is this connector plate bent?',
    straight: 'Is this connector plate straight?',

    // Generic states (for Cotter Pins & Spacer Plates)
    present: 'Is this component present and properly installed in the image?',
    'not present': 'Is this component missing from the image?',
    'not visible': 'Is this component not visible in the image?',

    // Positive Connection states
    secure: 'Is the connection secure and properly fastened?',
    unsecure: 'Is the connection loose or improperly fastened?',
    proper: 'Is the connection properly made and secure?',
    improper: 'Is the connection improper or unsecure?',
    connected: 'Is everything properly connected and secure?',
    disconnected: 'Is the connection broken or disconnected?',
  }

  // Get the appropriate question based on state
  const question =
    stateQuestions[expectedState.toLowerCase()] ||
    `Does this image show ${expectedState} for ${category}?`

  return `Please analyze this image and answer: ${question}

The image should meet these criteria:
${criteria.map((c) => `- ${c}`).join('\n')}

Please respond in JSON format with:
{
  "is_valid": boolean (true if ALL criteria are met),
  "confidence": number (0-1 indicating how confident you are),
  "diagnosis": {
    "overall_assessment": string (brief assessment of pass/fail),
    "confidence_level": number (0-1),
    "key_observations": string[] (specific observations about the image),
    "matched_criteria": string[] (criteria that were met),
    "failed_criteria": string[] (criteria that were not met),
    "detailed_explanation": string (detailed analysis of findings)
  },
  "explanation": string (concise summary of why the image passed or failed validation)
}

Important:
- matched_criteria should ONLY include criteria that were successfully met
- failed_criteria should include criteria that were NOT met
- If ANY criteria fail, is_valid should be false
- key_observations should contain specific details about what you see, not the criteria themselves
- diagnosis should provide a detailed technical assessment
- explanation should provide a brief, clear summary of the validation result

Focus only on answering this specific question about ${category} being ${expectedState}.`
}

function wrapCustomPrompt(customPrompt: string): string {
  return `${customPrompt}

Please respond in JSON format with:
{
  "is_valid": boolean (true if the image meets the criteria),
  "confidence": number (0-1 indicating how confident you are),
  "diagnosis": {
    "overall_assessment": string (brief assessment of pass/fail),
    "confidence_level": number (0-1),
    "key_observations": string[] (specific observations about the image),
    "matched_criteria": string[] (criteria that were met),
    "failed_criteria": string[] (criteria that were not met),
    "detailed_explanation": string (detailed analysis of findings)
  },
  "explanation": string (concise summary of why the image passed or failed validation)
}

Important:
- matched_criteria should ONLY include criteria that were successfully met
- failed_criteria should include criteria that were NOT met
- If ANY criteria fail, is_valid should be false
- key_observations should contain specific details about what you see
- diagnosis should provide a detailed technical assessment
- explanation should provide a brief, clear summary of the validation result`
}

// Helper function to update validation result
function handleValidationResult(
  response: any,
  matchesExpectedSet: boolean,
  expectedState: string,
  criteria: {
    pass: string[]
    fail: string[]
  }
) {
  response.is_valid = matchesExpectedSet
  response.diagnosis.overall_assessment = matchesExpectedSet ? 'Pass' : 'Fail'

  if (matchesExpectedSet) {
    response.diagnosis.matched_criteria = criteria.pass
    response.diagnosis.failed_criteria = []
    response.explanation = `Image correctly matches the ${expectedState} reference set.`
    response.diagnosis.detailed_explanation =
      `The image shows the expected characteristics for the ${expectedState} category, ` +
      `confirming its proper classification in the reference set.`
  } else {
    response.diagnosis.matched_criteria = []
    response.diagnosis.failed_criteria = criteria.fail
    response.explanation = `Potential misclassification: Image may not belong in the ${expectedState} reference set.`
    response.diagnosis.detailed_explanation =
      `The image shows characteristics that differ from what we expect in the ${expectedState} reference set. ` +
      `This suggests a potential misclassification that needs review.`
  }
}

export async function validateImage(
  imageBuffer: Buffer,
  category: Category,
  expectedState: State,
  options: ValidationOptions = {
    useVectorStore: true,
    isGroundTruth: false,
    storeResults: true,
  }
): Promise<ValidationResult> {
  debugger
  try {
    // Extract basic features for future reference
    const features = await extractImageFeatures(imageBuffer)

    // If this is a ground truth image (training mode), skip AI validation
    if (options.isGroundTruth) {
      const groundTruthResult: ValidationResult = {
        isValid: true, // Always valid for ground truth
        confidence: 1.0, // Maximum confidence
        diagnosis: {
          overall_assessment: 'Valid',
          confidence_level: 1.0,
          key_observations: [
            `Ground truth ${expectedState} ${category} example`,
          ],
          matched_criteria: [`Meets ${expectedState} criteria for ${category}`],
          failed_criteria: [],
          detailed_explanation: `This is a reference image provided by the client showing a valid ${expectedState} ${category}.`,
        },
        matchedCriteria: [`Reference image for ${expectedState} ${category}`],
        failedCriteria: [],
        similarCases: [],
        explanation: `Ground truth example of ${expectedState} ${category}`,
        features,
      }

      // Store the ground truth case
      try {
        await storeValidationCase(
          `data:image/jpeg;base64,${imageBuffer.toString('base64')}`,
          category,
          expectedState,
          features,
          groundTruthResult.diagnosis.detailed_explanation,
          groundTruthResult.matchedCriteria,
          1.0, // Ground truth confidence
          options.prompt // Pass the prompt if provided
        )
      } catch (error) {
        console.warn('Failed to store ground truth case:', error)
      }

      return groundTruthResult
    }

    // Regular validation flow for non-training mode
    const basePrompt = options.prompt
      ? wrapCustomPrompt(options.prompt)
      : buildSimplePrompt(category, expectedState, options.measurement)

    // Get vision model analysis
    const message = new HumanMessage(basePrompt)
    message.additional_kwargs = {
      image: imageBuffer.toString('base64'),
    }

    const response = await model.call([message])

    // Parse the response
    let parsedResponse
    try {
      // Clean any markdown code block markers and trim whitespace
      const cleanedContent = response.content
        .replace(/```json\n|\n```/g, '')
        .trim()
      parsedResponse = JSON.parse(cleanedContent)
    } catch (error) {
      console.warn('Failed to parse JSON response:', error)
      // Fallback parsing for non-JSON responses
      parsedResponse = {
        is_valid: response.content.toLowerCase().includes('yes'),
        confidence: 0.5,
        explanation: response.content,
        key_observations: [response.content],
      }
    }

    // Special handling for each category
    switch (category.toLowerCase()) {
      case 'corrosion': {
        // Existing corrosion logic
        const foundCorrosion = parsedResponse.diagnosis?.key_observations?.some(
          (obs: string) =>
            obs.toLowerCase().includes('corrosion') ||
            obs.toLowerCase().includes('rust') ||
            obs.toLowerCase().includes('deterioration')
        )

        const isNoCorrosionSet =
          expectedState.toLowerCase().includes('no') ||
          expectedState.toLowerCase() === 'clean'
        const isCorrosionSet = !isNoCorrosionSet
        const matchesExpectedSet =
          (isNoCorrosionSet && !foundCorrosion) ||
          (isCorrosionSet && foundCorrosion)

        handleValidationResult(
          parsedResponse,
          matchesExpectedSet,
          expectedState,
          isNoCorrosionSet
            ? {
                pass: [
                  'Surface is free from corrosion',
                  'No visible deterioration',
                  'Material integrity maintained',
                ],
                fail: [
                  'Corrosion detected in no-corrosion reference set',
                  'Surface shows unexpected deterioration',
                  'Possible misclassification',
                ],
              }
            : {
                pass: [
                  'Corrosion clearly visible',
                  'Expected deterioration present',
                  'Matches corrosion reference set',
                ],
                fail: [
                  'No corrosion detected in corrosion reference set',
                  'Surface appears unexpectedly clean',
                  'Possible misclassification',
                ],
              }
        )
        break
      }

      case 'threads': {
        const foundThreads = parsedResponse.diagnosis?.key_observations?.some(
          (obs: string) =>
            obs.toLowerCase().includes('thread') &&
            !obs.toLowerCase().includes('no thread')
        )

        const shouldHaveThreads =
          !expectedState.toLowerCase().includes('no') &&
          (expectedState.toLowerCase().includes('visible') ||
            expectedState.toLowerCase().includes('present'))
        const matchesExpectedSet =
          (shouldHaveThreads && foundThreads) ||
          (!shouldHaveThreads && !foundThreads)

        handleValidationResult(
          parsedResponse,
          matchesExpectedSet,
          expectedState,
          shouldHaveThreads
            ? {
                pass: [
                  'Threads clearly visible',
                  'Thread pattern identifiable',
                  'Expected thread features present',
                ],
                fail: [
                  'No threads visible in threaded reference set',
                  'Expected threads not found',
                  'Possible misclassification',
                ],
              }
            : {
                pass: [
                  'No threads visible',
                  'Smooth surface as expected',
                  'Matches thread-free reference',
                ],
                fail: [
                  'Unexpected threads found',
                  'Surface shows thread pattern',
                  'Possible misclassification',
                ],
              }
        )
        break
      }

      case 'connector_plates': {
        // First check for clear indicators of physical bending
        const hasPhysicalBending =
          parsedResponse.diagnosis?.key_observations?.some((obs: string) => {
            const lowerObs = obs.toLowerCase()
            return (
              lowerObs.includes('physical deformation') ||
              lowerObs.includes('structural misalignment') ||
              lowerObs.includes('actual bending') ||
              (lowerObs.includes('gap') && lowerObs.includes('structural')) ||
              // Add more specific physical indicators
              (lowerObs.includes('bend') && lowerObs.includes('noticeable')) ||
              (lowerObs.includes('warp') && !lowerObs.includes('camera')) ||
              (lowerObs.includes('misaligned') &&
                lowerObs.includes('intended')) ||
              (lowerObs.includes('gap') && lowerObs.includes('between'))
            )
          })

        // Check for observations that might be perspective/lighting effects
        const hasPerspectiveEffects =
          parsedResponse.diagnosis?.key_observations?.some((obs: string) => {
            const lowerObs = obs.toLowerCase()
            return (
              lowerObs.includes('perspective') ||
              lowerObs.includes('camera angle') ||
              lowerObs.includes('lighting effect') ||
              lowerObs.includes('shadow') ||
              lowerObs.includes('viewing angle') ||
              // Add specific perspective-related terms
              (lowerObs.includes('appear') && lowerObs.includes('angle')) ||
              lowerObs.includes('optical') ||
              lowerObs.includes('illusion')
            )
          })

        // Only consider it bent if we have clear physical evidence and not just perspective effects
        const isBent = hasPhysicalBending && !hasPerspectiveEffects

        const shouldBeBent = expectedState.toLowerCase() === 'bent'
        const matchesExpectedSet =
          (shouldBeBent && hasPhysicalBending) ||
          (!shouldBeBent && !hasPhysicalBending)

        // Update the response based on what we actually found
        if (hasPhysicalBending) {
          // If we found physical bending evidence, make sure our observations reflect this
          parsedResponse.is_valid = shouldBeBent
          parsedResponse.diagnosis.overall_assessment = shouldBeBent
            ? 'Pass'
            : 'Fail'
          parsedResponse.diagnosis.matched_criteria = shouldBeBent
            ? [
                'Physical deformation confirmed',
                'Structural bending verified',
                'Matches bent reference set',
              ]
            : []
          parsedResponse.diagnosis.failed_criteria = shouldBeBent
            ? []
            : [
                'Physical deformation detected in straight reference set',
                'Structural bending observed',
                'Possible misclassification',
              ]
        }

        // Create context-specific explanations
        let detailedExplanation = ''
        let briefExplanation = ''

        if (shouldBeBent) {
          if (hasPhysicalBending) {
            detailedExplanation = `The image shows clear evidence of physical bending and structural deformation through multiple indicators: ${parsedResponse.diagnosis.key_observations.join(
              ', '
            )}. This correctly matches its classification in the "bent" reference set.`
            briefExplanation = `Image correctly classified as bent, showing clear physical deformation.`
          } else if (hasPerspectiveEffects) {
            detailedExplanation = `While some visual effects might suggest bending, no clear physical deformation is evident. The observed effects may be due to camera angles or lighting. Additional images from different angles might help confirm the structural state.`
            briefExplanation = `No clear physical bending detected. Consider additional viewing angles.`
          } else {
            detailedExplanation = `The image does not show sufficient evidence of physical bending or structural deformation, despite being in the "bent" reference set. This suggests a potential misclassification that needs review.`
            briefExplanation = `No physical bending detected in bent reference set. Possible misclassification.`
          }
        } else {
          if (hasPhysicalBending) {
            detailedExplanation = `The image shows clear signs of physical bending and structural deformation: ${parsedResponse.diagnosis.key_observations.join(
              ', '
            )}. This suggests a potential misclassification as this is in the "straight" reference set.`
            briefExplanation = `Physical bending detected in straight reference set. Possible misclassification.`
          } else if (hasPerspectiveEffects) {
            detailedExplanation = `While some visual effects might suggest bending, these appear to be due to perspective or lighting rather than actual structural deformation. The plate appears to be correctly classified as straight.`
            briefExplanation = `Apparent bending due to perspective effects; structurally straight as expected.`
          } else {
            detailedExplanation = `The image shows a properly aligned plate without any physical deformation, correctly matching its classification in the "straight" reference set.`
            briefExplanation = `Image correctly classified as straight, showing no physical deformation.`
          }
        }

        // Update the response with our context-specific explanations
        parsedResponse.explanation = briefExplanation
        parsedResponse.diagnosis.detailed_explanation = detailedExplanation

        // Don't call handleValidationResult - we've already set everything we need
        break
      }

      case 'cotter_pin': {
        const pinPresent = parsedResponse.diagnosis?.key_observations?.some(
          (obs: string) =>
            obs.toLowerCase().includes('pin') &&
            !obs.toLowerCase().includes('missing') &&
            !obs.toLowerCase().includes('absent')
        )

        const shouldBePresent = expectedState.toLowerCase() === 'present'
        const matchesExpectedSet =
          (shouldBePresent && pinPresent) || (!shouldBePresent && !pinPresent)

        handleValidationResult(
          parsedResponse,
          matchesExpectedSet,
          expectedState,
          shouldBePresent
            ? {
                pass: [
                  'Cotter pin properly installed',
                  'Pin ends correctly bent',
                  'Matches present reference set',
                ],
                fail: [
                  'Cotter pin missing from assembly',
                  'Expected pin not found',
                  'Possible misclassification',
                ],
              }
            : {
                pass: [
                  'No cotter pin present as expected',
                  'Assembly matches missing pin reference',
                  'Correct absence verified',
                ],
                fail: [
                  'Unexpected cotter pin found',
                  'Pin present when should be missing',
                  'Possible misclassification',
                ],
              }
        )
        break
      }

      case 'cable': {
        const meetsMinimum = parsedResponse.diagnosis?.key_observations?.some(
          (obs: string) =>
            obs.toLowerCase().includes('meets') ||
            obs.toLowerCase().includes('exceeds') ||
            obs.toLowerCase().includes('compliant')
        )

        const shouldMeetMinimum = expectedState.toLowerCase() === 'compliant'
        const matchesExpectedSet =
          (shouldMeetMinimum && meetsMinimum) ||
          (!shouldMeetMinimum && !meetsMinimum)

        handleValidationResult(
          parsedResponse,
          matchesExpectedSet,
          expectedState,
          shouldMeetMinimum
            ? {
                pass: [
                  'Cable meets minimum diameter',
                  'Dimensions within specification',
                  'Matches compliant reference set',
                ],
                fail: [
                  'Cable diameter below minimum',
                  'Does not meet size requirement',
                  'Possible misclassification',
                ],
              }
            : {
                pass: [
                  'Cable confirmed below minimum',
                  'Undersized as expected',
                  'Matches non-compliant reference',
                ],
                fail: [
                  'Cable unexpectedly meets minimum',
                  'Size exceeds expected non-compliant state',
                  'Possible misclassification',
                ],
              }
        )
        break
      }

      case 'connection': {
        const isSecure = parsedResponse.diagnosis?.key_observations?.some(
          (obs: string) =>
            obs.toLowerCase().includes('secure') ||
            obs.toLowerCase().includes('proper') ||
            obs.toLowerCase().includes('tight')
        )

        const shouldBeSecure = ['secure', 'proper', 'connected'].includes(
          expectedState.toLowerCase()
        )
        const matchesExpectedSet =
          (shouldBeSecure && isSecure) || (!shouldBeSecure && !isSecure)

        handleValidationResult(
          parsedResponse,
          matchesExpectedSet,
          expectedState,
          shouldBeSecure
            ? {
                pass: [
                  'Connection properly secured',
                  'Components correctly fastened',
                  'Matches secure reference set',
                ],
                fail: [
                  'Connection appears loose',
                  'Expected security not found',
                  'Possible misclassification',
                ],
              }
            : {
                pass: [
                  'Connection appropriately unsecured',
                  'Expected loose state verified',
                  'Matches unsecure reference',
                ],
                fail: [
                  'Unexpected secure connection',
                  'Components improperly fastened',
                  'Possible misclassification',
                ],
              }
        )
        break
      }
    }

    // Build the validation result
    const result: ValidationResult = {
      isValid: parsedResponse.is_valid,
      confidence: parsedResponse.confidence,
      diagnosis: parsedResponse.diagnosis || {
        overall_assessment: parsedResponse.is_valid ? 'Valid' : 'Invalid',
        confidence_level: parsedResponse.confidence,
        key_observations: parsedResponse.key_observations || [],
        matched_criteria: parsedResponse.matched_criteria || [],
        failed_criteria: parsedResponse.failed_criteria || [],
        detailed_explanation:
          parsedResponse.explanation || 'No detailed explanation provided',
      },
      matchedCriteria:
        parsedResponse.matched_criteria ||
        parsedResponse.key_observations ||
        [],
      failedCriteria: parsedResponse.failed_criteria || [],
      similarCases: [],
      explanation: parsedResponse.explanation || 'No explanation provided',
      features,
    }

    // If vector store is enabled, find and use similar cases
    if (options.useVectorStore) {
      try {
        const similarCases = await findSimilarCases(features, category)
        result.similarCases = similarCases

        // If we have high confidence similar cases, use them to influence the result
        const highConfidenceCases = similarCases.filter(
          (c) => c.confidence > 0.8
        )
        if (highConfidenceCases.length > 0) {
          // Calculate weighted average confidence based on similarity scores
          const totalWeight = highConfidenceCases.reduce(
            (sum, c) => sum + c.confidence,
            0
          )
          const weightedConfidence =
            highConfidenceCases.reduce(
              (sum, c) => sum + c.confidence * c.confidence,
              0
            ) / totalWeight

          // Adjust our confidence based on similar cases
          result.confidence = (result.confidence + weightedConfidence) / 2

          // If we have very similar high confidence cases, they should influence the validation
          const verySimilarCases = highConfidenceCases.filter(
            (c) => c.confidence > 0.95
          )
          if (verySimilarCases.length > 0) {
            // Update the result based on the most similar case
            const mostSimilar = verySimilarCases[0]

            // If we have an extremely high confidence match with a reference image,
            // trust the reference image's validation state
            if (mostSimilar.confidence > 0.99) {
              // Extract validation state from the reference image ID
              const isReferenceValid =
                mostSimilar.diagnosis?.toLowerCase().includes('valid') ||
                mostSimilar.imageUrl.toLowerCase().includes('compliant')

              if (isReferenceValid) {
                result.isValid = true
                result.diagnosis.overall_assessment = 'Valid'
                result.diagnosis.confidence_level = mostSimilar.confidence

                const contextByCategory: { [key: string]: string } = {
                  connector_plates:
                    'Connector plate alignment and mounting match reference standard',
                  cable_diameter: 'Cable diameter matches reference standard',
                  threads:
                    'Thread pattern and condition match reference standard',
                  corrosion: 'Surface condition matches reference standard',
                  cotter_pin: 'Pin installation matches reference standard',
                  spacer: 'Spacer installation matches reference standard',
                  connection: 'Connection assembly matches reference standard',
                }

                const matchContext =
                  contextByCategory[category] ||
                  `Matches ${category} reference standard`

                result.diagnosis.key_observations = [
                  `Matches valid reference image with ${(
                    mostSimilar.confidence * 100
                  ).toFixed(1)}% confidence`,
                  matchContext,
                  ...result.diagnosis.key_observations.filter(
                    (obs) =>
                      !obs.toLowerCase().includes('matches reference image')
                  ),
                ]

                // Provide more detailed explanation based on category
                const categorySpecificDetails =
                  category === 'connector_plates'
                    ? `The connector plate's mounting, alignment, and overall orientation match a verified reference example. ` +
                      `While visual inspection may suggest variations due to lighting and perspective, the structural alignment ` +
                      `matches our reference standard for proper installation.`
                    : ''

                result.diagnosis.detailed_explanation =
                  `This image matches a known valid reference image with very high confidence (${(
                    mostSimilar.confidence * 100
                  ).toFixed(1)}%). ` +
                  categorySpecificDetails +
                  '\n\n' +
                  `Original AI Assessment: ${result.diagnosis.detailed_explanation}`
              } else {
                // Keep the invalid state but note the reference match
                result.diagnosis.key_observations.push(
                  `Matches reference image with ${(
                    mostSimilar.confidence * 100
                  ).toFixed(1)}% confidence`
                )
                result.matchedCriteria.push(
                  `Validated against reference image for ${category}`
                )
              }
            } else {
              // For lower confidence matches, just add the observation
              result.diagnosis.key_observations.push(
                `Matches reference image with ${(
                  mostSimilar.confidence * 100
                ).toFixed(1)}% confidence`
              )
              result.matchedCriteria.push(
                `Validated against reference image for ${category}`
              )
            }
          }
        }
      } catch (error) {
        console.warn('Failed to find or process similar cases:', error)
      }
    }

    return result
  } catch (error) {
    console.error('Validation error:', error)
    return {
      isValid: false,
      confidence: 0,
      diagnosis: {
        overall_assessment: 'Invalid',
        confidence_level: 0,
        key_observations: [],
        matched_criteria: [],
        failed_criteria: ['Validation error occurred'],
        detailed_explanation:
          error instanceof Error ? error.message : 'Unknown error',
      },
      matchedCriteria: [],
      failedCriteria: ['Validation error occurred'],
      similarCases: [],
      explanation: error instanceof Error ? error.message : 'Unknown error',
      features: await extractImageFeatures(imageBuffer),
    }
  }
}
