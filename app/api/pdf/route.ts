import { NextResponse } from 'next/server'
import pdf from 'pdf-parse'
import { OpenAI as langChainOpenAI } from 'langchain/llms/openai'
import { Document } from 'langchain/document'
import { loadQARefineChain } from 'langchain/chains'
import { OpenAIEmbeddings } from 'langchain/embeddings/openai'
import { MemoryVectorStore } from 'langchain/vectorstores/memory'

// Initialize OpenAI and chain at request time to avoid build-time issues
const initializeAI = () => {
  const model = new langChainOpenAI({
    temperature: 0,
    modelName: 'gpt-4o-mini',
  })
  return {
    model,
    chain: loadQARefineChain(model),
    embeddings: new OpenAIEmbeddings(),
  }
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData()
    const pdfFile = formData.get('pdf') as File
    const question = formData.get('question') as string

    if (!pdfFile || !question) {
      return NextResponse.json(
        { error: 'PDF file and question are required' },
        { status: 400 }
      )
    }

    const buffer = Buffer.from(await pdfFile.arrayBuffer())
    const data = await pdf(buffer)
    const content = data.text

    const doc = new Document({
      pageContent: content,
      metadata: { id: 'pdf-doc', createdAt: new Date() },
    })

    const { chain, embeddings } = initializeAI()
    const store = await MemoryVectorStore.fromDocuments([doc], embeddings)
    const relevantDocs = await store.similaritySearch(question)
    const res = await chain.call({
      input_documents: relevantDocs,
      question,
    })

    return NextResponse.json({ answer: res.output_text })
  } catch (error) {
    console.error('Error processing PDF:', error)
    return NextResponse.json(
      { error: 'Failed to process PDF' },
      { status: 500 }
    )
  }
}
