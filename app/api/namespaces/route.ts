import { NextResponse } from 'next/server'
import fs from 'fs/promises'
import path from 'path'

interface Namespace {
  id: string
  name: string
}

const NAMESPACES_FILE = path.join(process.cwd(), 'data', 'namespaces.json')

// Ensure the data directory exists
async function ensureDataDir() {
  const dataDir = path.join(process.cwd(), 'data')
  try {
    await fs.access(dataDir)
  } catch {
    await fs.mkdir(dataDir, { recursive: true })
  }
}

// Read namespaces from file
async function readNamespaces(): Promise<Namespace[]> {
  try {
    await ensureDataDir()
    const data = await fs.readFile(NAMESPACES_FILE, 'utf-8')
    return JSON.parse(data)
  } catch (error) {
    // If file doesn't exist or is invalid, return empty array
    return []
  }
}

// Write namespaces to file
async function writeNamespaces(namespaces: Namespace[]): Promise<void> {
  await ensureDataDir()
  await fs.writeFile(NAMESPACES_FILE, JSON.stringify(namespaces, null, 2))
}

export async function GET() {
  try {
    const namespaces = await readNamespaces()
    return NextResponse.json({ namespaces })
  } catch (error) {
    console.error('Error fetching namespaces:', error)
    return NextResponse.json(
      { error: 'Failed to fetch namespaces' },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    const { name } = await request.json()
    if (!name) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 })
    }

    // Generate a URL-safe ID from the name
    const id = name.toLowerCase().replace(/[^a-z0-9]/g, '_')

    // Get existing namespaces
    const existingNamespaces = await readNamespaces()

    // Check if namespace already exists
    if (existingNamespaces.some((ns: Namespace) => ns.id === id)) {
      return NextResponse.json(
        { error: 'Namespace already exists' },
        { status: 400 }
      )
    }

    // Add new namespace
    const newNamespace: Namespace = { id, name }
    await writeNamespaces([...existingNamespaces, newNamespace])

    return NextResponse.json(newNamespace)
  } catch (error) {
    console.error('Error creating namespace:', error)
    return NextResponse.json(
      { error: 'Failed to create namespace' },
      { status: 500 }
    )
  }
}
