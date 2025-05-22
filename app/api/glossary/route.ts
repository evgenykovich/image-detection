import { NextResponse } from 'next/server'
import * as xlsx from 'xlsx'
import { OpenAI as langChainOpenAI } from 'langchain/llms/openai'
import { LLMChain } from 'langchain/chains'
import { PromptTemplate } from 'langchain/prompts'
import { mapColumnToLang, findTranslation } from '@/util/helpers'

interface GlossaryEntryItem {
  [key: string]: {
    [lang: string]: string
  }
}

const loadGlossary = async (file: File): Promise<GlossaryEntryItem> => {
  const buffer = await file.arrayBuffer()
  const workbook = xlsx.read(buffer, { type: 'buffer' })
  const sheetName = workbook.SheetNames[0]
  const sheet = workbook.Sheets[sheetName]
  const rawData = xlsx.utils.sheet_to_json(sheet)

  const glossary: GlossaryEntryItem = {}

  rawData.forEach((row: any) => {
    const term = row['Column1']
    if (!term) return

    glossary[term] = {}

    Object.keys(row).forEach((key) => {
      if (key !== 'Column1') {
        const lang = mapColumnToLang(key)
        glossary[term][lang] = row[key] || ''
      }
    })
  })

  return glossary
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData()
    const glossaryFile = formData.get('glossary') as File
    const text = formData.get('text') as string
    const sourceLang = formData.get('sourceLang') as string
    const targetLang = formData.get('targetLang') as string

    if (!text || !sourceLang || !targetLang) {
      return NextResponse.json(
        { error: 'Text, source language, and target language are required' },
        { status: 400 }
      )
    }

    const model = new langChainOpenAI({
      temperature: 0,
      modelName: 'gpt-4o-mini',
      openAIApiKey: process.env.OPENAI_API_KEY,
    })

    let modifiedText = text
    let promptTemplate: PromptTemplate

    if (glossaryFile) {
      const glossary = await loadGlossary(glossaryFile)
      const pattern = Object.keys(glossary)
        .sort((a, b) => b.length - a.length)
        .map((term) => term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
        .join('|')
      const regex = new RegExp(`\\b(${pattern})s?\\b`, 'gi')

      modifiedText = text.replace(regex, (match) => {
        const term = match.replace(/s$/, '')
        const translation = findTranslation(glossary, targetLang, term)
        if (translation) {
          return match.endsWith('s') && !translation.endsWith('s')
            ? translation + 's'
            : translation
        }
        return match
      })
    }

    promptTemplate = new PromptTemplate({
      template: `Translate the following text ${
        glossaryFile ? 'literally ' : ''
      }from {sourceLang} to {targetLang}. Provide only the translation, without any additional text:
      
      {text}`,
      inputVariables: ['sourceLang', 'targetLang', 'text'],
    })

    const chain = new LLMChain({
      llm: model,
      prompt: promptTemplate,
    })

    const result = await chain.call({
      sourceLang,
      targetLang,
      text: modifiedText,
    })

    return NextResponse.json({ translation: result.text.trim() })
  } catch (error) {
    console.error('Error processing translation:', error)
    return NextResponse.json(
      { error: 'Failed to process translation' },
      { status: 500 }
    )
  }
}
