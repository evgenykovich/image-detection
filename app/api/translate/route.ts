import { NextResponse } from 'next/server'
import { translateWithGlossary } from '@/util/ai'
import { writeFile } from 'fs/promises'
import { join } from 'path'
import { tmpdir } from 'os'
export const maxDuration = 300

export async function POST(req: Request) {
  try {
    const formData = await req.formData()
    const text = formData.get('text') as string
    const sourceLang = formData.get('sourceLang') as string
    const targetLang = formData.get('targetLang') as string
    const glossaryFile = formData.get('glossary') as File | null

    if (!text || !sourceLang || !targetLang) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    let glossaryFilePath: string | undefined
    if (glossaryFile) {
      const bytes = await glossaryFile.arrayBuffer()
      const buffer = Buffer.from(bytes)

      // Create a temporary file
      const tempFilePath = join(tmpdir(), `glossary-${Date.now()}.xlsx`)
      await writeFile(tempFilePath, buffer)
      glossaryFilePath = tempFilePath
    }

    const translatedText = await translateWithGlossary(
      text,
      glossaryFilePath,
      sourceLang,
      targetLang
    )

    return NextResponse.json({ translatedText })
  } catch (error) {
    console.error('Translation error:', error)
    return NextResponse.json(
      { error: 'Failed to translate text' },
      { status: 500 }
    )
  }
}
