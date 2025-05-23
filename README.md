# Image Validation System

A sophisticated system for validating mechanical component images using AI, computer vision, and vector similarity search.

## Features

- **Multi-modal Validation**: Combines computer vision, vector similarity search, and LLM analysis
- **Category-specific Guidelines**: Detailed validation criteria for different component types
- **Feature Extraction**: Advanced image analysis using edge detection and structural features
- **Similar Case Retrieval**: Vector similarity search for finding relevant historical cases
- **Comprehensive Analysis**: Detailed validation results with confidence scores and explanations

## Supported Categories

- Corrosion Detection
- Thread Analysis
- Connector Plate Inspection
- Cotter Pin Validation
- Spacer Plate Verification
- Positive Connection Check
- Cable Diameter Measurement

## Setup

1. Install dependencies:

```bash
npm install
```

2. Configure environment variables:

- Copy `.env.example` to `.env.local`
- Add your API keys:
  - OpenAI API key
  - Pinecone API key and environment

3. Initialize Pinecone index:

```bash
npx tsx scripts/init-pinecone.ts
```

## Usage

```typescript
import { validateImage } from '@/lib/services/validation'
import { Category, State } from '@/types/validation'

// Validate an image
const result = await validateImage(
  imageBuffer,
  'threads' as Category,
  'good' as State
)

console.log(result)
// {
//   isValid: boolean
//   confidence: number
//   diagnosis: string
//   matchedCriteria: string[]
//   failedCriteria: string[]
//   similarCases: SimilarCase[]
//   explanation: string
// }
```

## Architecture

The system consists of several key components:

1. **Feature Extraction Service**

   - Uses Sharp for image processing
   - Extracts visual and structural features
   - Calculates edge density and sharpness

2. **Vector Storage Service**

   - Manages similar case retrieval
   - Uses Pinecone for vector similarity search
   - Stores historical validation cases

3. **Guidelines Service**

   - Provides category-specific validation rules
   - Defines critical features and measurements
   - Contains example cases

4. **Validation Service**
   - Orchestrates the validation process
   - Combines multiple analysis methods
   - Generates comprehensive results

## Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## License

MIT
